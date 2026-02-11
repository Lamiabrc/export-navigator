import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "../../src/server/supabaseAdmin.js";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const EMBED_MODEL = (process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small").trim();

const ADMIN_EMAILS = new Set(
  [
    "lamia.brechet@outlook.fr",
    ...(process.env.ADMIN_EMAILS || process.env.APP_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ].filter(Boolean)
);

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function requireUser(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { ok: false, error: "missing_auth_bearer" });
    return null;
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    json(res, 401, { ok: false, error: "invalid_auth", detail: error?.message || null });
    return null;
  }
  return { user: data.user, token };
}

function isAdminUser(user: any) {
  const email = String(user?.email || "").toLowerCase();
  const role = String(user?.app_metadata?.role || user?.user_metadata?.role || "").toLowerCase();
  const isAdminMeta = user?.app_metadata?.is_admin || user?.user_metadata?.is_admin;
  return ADMIN_EMAILS.has(email) || role === "admin" || isAdminMeta === true;
}

async function openaiEmbedBatch(inputs: string[]) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant");
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`openai_embeddings_failed: ${resp.status} ${err}`);
  }
  const data = (await resp.json()) as any;
  return (data?.data || []).map((d: any) => d.embedding) as number[][];
}

async function extractTextFromPdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = (content.items as any[])
      .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    fullText += strings + "\n";
  }
  return fullText;
}

function chunkText(text: string, maxWords = 800) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [] as string[];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let count = 0;

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    if (count + words.length > maxWords && current.length) {
      chunks.push(current.join(" ").trim());
      current = [];
      count = 0;
    }

    current.push(sentence);
    count += words.length;
  }

  if (current.length) chunks.push(current.join(" ").trim());

  return chunks.filter((c) => c.length > 80);
}

type IngestPayload = { document_id?: string };

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req, res);
    if (!auth) return;

    if (!isAdminUser(auth.user)) {
      return json(res, 403, { ok: false, error: "admin_only" });
    }

    const body = await readJson<IngestPayload>(req);
    const documentId = String(body?.document_id || "").trim();
    if (!documentId) return json(res, 400, { ok: false, error: "document_id_required" });

    const admin = supabaseAdmin();

    const { data: doc, error: docError } = await admin
      .from("kb_documents")
      .select("id,title,storage_bucket,storage_path,mime_type")
      .eq("id", documentId)
      .maybeSingle();

    if (docError || !doc) {
      return json(res, 404, { ok: false, error: "document_not_found", detail: docError?.message || null });
    }

    const bucket = doc.storage_bucket || "kb_admin";
    const path = doc.storage_path;

    const { data: fileData, error: fileError } = await admin.storage.from(bucket).download(path);
    if (fileError || !fileData) {
      return json(res, 500, { ok: false, error: "storage_download_failed", detail: fileError?.message || null });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = "";
    const mime = String(doc.mime_type || "").toLowerCase();
    if (mime.includes("pdf") || path.toLowerCase().endsWith(".pdf")) {
      text = await extractTextFromPdf(buffer);
    } else {
      text = buffer.toString("utf-8");
    }

    const chunks = chunkText(text, 800);
    if (!chunks.length) {
      return json(res, 400, { ok: false, error: "empty_document" });
    }

    // Remove existing chunks
    await admin.from("kb_chunks").delete().eq("document_id", doc.id);

    // Embed in batches
    const embeddings: number[][] = [];
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const vecs = await openaiEmbedBatch(batch);
      embeddings.push(...vecs);
    }

    const insertBatchSize = 100;
    for (let i = 0; i < chunks.length; i += insertBatchSize) {
      const batch = chunks.slice(i, i + insertBatchSize);
      const rows = batch.map((content, idx) => ({
        document_id: doc.id,
        chunk_index: i + idx,
        content,
        embedding: embeddings[i + idx],
      }));
      const { error: insertError } = await admin.from("kb_chunks").insert(rows);
      if (insertError) {
        console.error("[api/kb/ingest] insert chunks", insertError);
        return json(res, 500, { ok: false, error: "kb_chunks_insert_failed", detail: insertError.message });
      }
    }

    await admin
      .from("kb_documents")
      .update({ status: "ready", created_by: auth.user.id })
      .eq("id", doc.id);

    return json(res, 200, {
      ok: true,
      document_id: doc.id,
      chunks: chunks.length,
    });
  } catch (err: any) {
    console.error("[api/kb/ingest] error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "kb_ingest_failed" });
  }
});
