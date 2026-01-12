import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.2.67/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  document_id: string;
  bucket?: string; // défaut: reference-docs
  max_chars?: number; // chunk size
  overlap?: number;
  embedding_model?: string;
  max_pages?: number;
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function chunkText(text: string, maxChars = 1200, overlap = 150) {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  if (!clean) return chunks;

  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + maxChars, clean.length);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

async function resolveObjectPathFromTitle(supabase: any, bucket: string, title: string) {
  const target = norm(title);
  const { data, error } = await supabase.storage.from(bucket).list("", { limit: 200, offset: 0 });
  if (error) throw new Error(`storage.list failed: ${error.message}`);
  const files = (data ?? []).filter((x: any) => (x.name || "").toLowerCase().endsWith(".pdf"));

  // 1) match exact sur normalisation
  for (const f of files) {
    if (norm(f.name) === target) return f.name;
  }
  // 2) match "startsWith" (cas des suffixes type .00342)
  for (const f of files) {
    const fn = norm(f.name);
    if (fn.startsWith(target) || target.startsWith(fn)) return f.name;
  }
  // 3) match "contains"
  for (const f of files) {
    const fn = norm(f.name);
    if (fn.includes(target) || target.includes(fn)) return f.name;
  }
  return null;
}

async function extractTextFromPdfBytes(bytes: Uint8Array, maxPages = 200) {
  // Important: désactive le worker (edge runtime)
  const loadingTask = pdfjs.getDocument({ data: bytes, disableWorker: true } as any);
  const pdf = await loadingTask.promise;

  const pageCount = Math.min(pdf.numPages, maxPages);
  let out = "";
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as any[])
      .map((it) => String(it.str ?? "").trim())
      .filter(Boolean)
      .join(" ");
    out += `\n\n[PAGE ${i}/${pdf.numPages}]\n${pageText}`;
  }
  return { text: out.trim(), pages_extracted: pageCount, pages_total: pdf.numPages };
}

async function embedMany(apiKey: string, model: string, inputs: string[]) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const arr = data.data as { embedding: number[]; index: number }[];
  // retourne dans l’ordre d’entrée
  const byIndex = new Map(arr.map((x) => [x.index, x.embedding]));
  return inputs.map((_, i) => byIndex.get(i));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "Missing supabase env" });
  if (!OPENAI_API_KEY) return json(500, { error: "Missing OPENAI_API_KEY (needed for embeddings)" });

  const EMB_MODEL = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  if (!body?.document_id) return json(400, { error: "document_id is required" });

  const bucket = body.bucket ?? "reference-docs";
  const maxChars = body.max_chars ?? 1200;
  const overlap = body.overlap ?? 150;
  const embModel = body.embedding_model ?? EMB_MODEL;
  const maxPages = body.max_pages ?? 200;

  // 1) charge le document (title requis pour retrouver le PDF)
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id,title")
    .eq("id", body.document_id)
    .single();

  if (docErr || !doc) return json(404, { error: "Document not found", details: docErr?.message });

  // 2) résout le fichier PDF dans Storage à partir du title
  const objectPath = await resolveObjectPathFromTitle(supabase, bucket, doc.title ?? "");
  if (!objectPath) {
    await supabase.from("documents").update({ status: "error" }).eq("id", body.document_id);
    return json(400, { error: `Cannot map document.title to a PDF in bucket '${bucket}'`, title: doc.title });
  }

  // 3) download PDF
  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(objectPath);
  if (dlErr || !blob) {
    await supabase.from("documents").update({ status: "error" }).eq("id", body.document_id);
    return json(500, { error: "Storage download failed", details: dlErr?.message, objectPath });
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // 4) extract_text
  let extractedText = "";
  let pages_extracted = 0;
  let pages_total = 0;

  try {
    const parsed = await extractTextFromPdfBytes(bytes, maxPages);
    extractedText = parsed.text;
    pages_extracted = parsed.pages_extracted;
    pages_total = parsed.pages_total;
  } catch (e: any) {
    await supabase.from("documents").update({ status: "error" }).eq("id", body.document_id);
    return json(500, { error: "PDF parse failed", details: String(e), objectPath });
  }

  if (!extractedText || extractedText.length < 200) {
    await supabase.from("documents").update({ status: "error" }).eq("id", body.document_id);
    return json(400, { error: "Extracted text too small (likely empty PDF text layer)", objectPath });
  }

  await supabase
    .from("documents")
    .update({ extracted_text: extractedText, status: "parsed" })
    .eq("id", body.document_id);

  // 5) chunks (reset)
  await supabase.from("document_chunks").delete().eq("document_id", body.document_id);

  const chunks = chunkText(extractedText, maxChars, overlap);
  const chunkRows = chunks.map((content, idx) => ({
    document_id: body.document_id,
    chunk_index: idx,
    content,
    meta: { maxChars, overlap, objectPath, bucket, pages_extracted, pages_total },
  }));

  if (!chunkRows.length) {
    await supabase.from("documents").update({ status: "error", chunks: 0 }).eq("id", body.document_id);
    return json(500, { error: "Chunking produced 0 chunks", objectPath });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("document_chunks")
    .insert(chunkRows)
    .select("id,chunk_index,content");

  if (insErr) {
    await supabase.from("documents").update({ status: "error" }).eq("id", body.document_id);
    return json(500, { error: "Insert chunks failed", details: insErr.message });
  }

  await supabase
    .from("documents")
    .update({ status: "chunked", chunks: chunkRows.length })
    .eq("id", body.document_id);

  // 6) embeddings (batch)
  const rows = inserted ?? [];
  const batchSize = 64;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const inputs = batch.map((r: any) => String(r.content ?? ""));
    const vectors = await embedMany(OPENAI_API_KEY, embModel, inputs);

    const upserts = batch.map((r: any, idx: number) => ({
      id: r.id,
      embedding: vectors[idx],
    }));

    const { error: upErr } = await supabase.from("document_chunks").upsert(upserts, { onConflict: "id" });
    if (upErr) {
      await supabase.from("documents").update({ status: "error" }).eq("id", body.document_id);
      return json(500, { error: "Embedding upsert failed", details: upErr.message });
    }
  }

  await supabase.from("documents").update({ status: "ready" }).eq("id", body.document_id);

  return json(200, {
    ok: true,
    document_id: body.document_id,
    bucket,
    objectPath,
    pages_extracted,
    pages_total,
    extracted_chars: extractedText.length,
    chunks: chunkRows.length,
    embedding_model: embModel,
  });
});
