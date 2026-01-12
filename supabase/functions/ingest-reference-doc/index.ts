// supabase/functions/ingest-reference-docs/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.6.82/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  bucket_id?: string;
  object_paths?: string[];          // si tu veux forcer une liste
  doc_type?: string;               // default: reglementaire
  max_chars?: number;              // default: 1200
  overlap?: number;                // default: 150
  embedding_model?: string;        // default: text-embedding-3-small
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
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

function titleFromObjectPath(path: string) {
  const base = path.split("/").pop() || path;
  const noExt = base.replace(/\.pdf$/i, "");
  return noExt
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function extractTextFromPdfBytes(bytes: Uint8Array) {
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = (content.items as any[])
      .map((it) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    parts.push(pageText);
  }
  return parts.join("\n\n");
}

async function embedManyOpenAI(apiKey: string, model: string, inputs: string[]) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.data || []).map((d: any) => d.embedding as number[]);
}

async function insertChunksWithOptionalEmbedding(supabase: any, rows: any[]) {
  // Tentative 1 : avec embedding
  const { error: e1 } = await supabase.from("document_chunks").insert(rows);
  if (!e1) return { ok: true, usedEmbedding: true };

  // Si colonne embedding absente → retry sans
  const msg = String(e1?.message || "").toLowerCase();
  if (msg.includes("embedding") && msg.includes("does not exist")) {
    const rowsNoEmb = rows.map(({ embedding, ...rest }) => rest);
    const { error: e2 } = await supabase.from("document_chunks").insert(rowsNoEmb);
    if (!e2) return { ok: true, usedEmbedding: false };
    throw e2;
  }

  throw e1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "Missing supabase env" });

  // Sécurité minimale: exiger un JWT utilisateur (invoke depuis ton app)
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "Missing Authorization bearer token" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: Body = {};
  try { body = await req.json(); } catch { /* ok */ }

  const bucketId = body.bucket_id || "reference-docs";
  const docType = body.doc_type || "reglementaire";
  const maxChars = body.max_chars ?? 1200;
  const overlap = body.overlap ?? 150;
  const embModel = body.embedding_model || "text-embedding-3-small";

  const warnings: string[] = [];
  if (!OPENAI_API_KEY) warnings.push("OPENAI_API_KEY manquant: chunks créés mais RAG vectoriel impossible.");

  // 1) Liste des PDFs
  let objectPaths: string[] = [];
  if (body.object_paths?.length) {
    objectPaths = body.object_paths;
  } else {
    const { data, error } = await supabase.storage.from(bucketId).list("", { limit: 1000 });
    if (error) return json(500, { error: "Storage list failed", details: error.message });

    objectPaths = (data || [])
      .map((o: any) => o.name)
      .filter((n: string) => n && n.toLowerCase().endsWith(".pdf"));
  }

  // 2) Ingest chaque PDF
  const results: any[] = [];

  for (const object_path of objectPaths) {
    const title = titleFromObjectPath(object_path);

    try {
      // Upsert doc
      // NOTE: on suppose que documents a: id(uuid), title, doc_type, status, object_path, extracted_text
      const { data: doc, error: upErr } = await supabase
        .from("documents")
        .upsert({ title, doc_type: docType, status: "uploaded", object_path }, { onConflict: "title" })
        .select("id,title,object_path")
        .maybeSingle();

      if (upErr) throw upErr;
      const document_id = doc?.id;
      if (!document_id) throw new Error("Upsert documents failed (no id)");

      // Download pdf
      const { data: file, error: dlErr } = await supabase.storage.from(bucketId).download(object_path);
      if (dlErr || !file) throw new Error(`Download failed: ${dlErr?.message || "no file"}`);

      const bytes = new Uint8Array(await file.arrayBuffer());

      // Extract text
      const extracted_text = await extractTextFromPdfBytes(bytes);
      const extracted_len = extracted_text?.length || 0;

      await supabase
        .from("documents")
        .update({ extracted_text, status: extracted_len ? "parsed" : "error" })
        .eq("id", document_id);

      if (!extracted_len) {
        results.push({ document_id, title, object_path, ok: false, step: "extract", extracted_len: 0 });
        continue;
      }

      // Delete old chunks
      await supabase.from("document_chunks").delete().eq("document_id", document_id);

      // Chunk
      const chunks = chunkText(extracted_text, maxChars, overlap);

      // Embeddings (batch)
      const embeddings: (number[] | null)[] = new Array(chunks.length).fill(null);
      if (OPENAI_API_KEY) {
        const batchSize = 64;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const slice = chunks.slice(i, i + batchSize);
          const embs = await embedManyOpenAI(OPENAI_API_KEY, embModel, slice);
          for (let j = 0; j < embs.length; j++) embeddings[i + j] = embs[j];
        }
      }

      const rows = chunks.map((content, idx) => ({
        document_id,
        chunk_index: idx,
        content,
        embedding: embeddings[idx],
        meta: { maxChars, overlap, object_path, title, embedding_model: OPENAI_API_KEY ? embModel : null },
      }));

      const inserted = await insertChunksWithOptionalEmbedding(supabase, rows);

      await supabase.from("documents").update({ status: "chunked" }).eq("id", document_id);

      results.push({
        document_id,
        title,
        object_path,
        ok: true,
        extracted_len,
        chunks: rows.length,
        embedding: inserted.usedEmbedding,
      });
    } catch (e: any) {
      results.push({ object_path, title, ok: false, error: e?.message || String(e) });
    }
  }

  return json(200, { ok: true, bucket_id: bucketId, processed: results.length, results, warnings });
});
