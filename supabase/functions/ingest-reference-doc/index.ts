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
  prefix?: string;                 // optionnel: sous-dossier storage à scanner
  object_paths?: string[];         // optionnel: forcer une liste
  max_docs?: number;               // default: 25 (garde-fou timeouts)
  doc_type?: string;               // default: reglementaire
  max_chars?: number;              // default: 1200
  overlap?: number;                // default: 150
  embedding_model?: string;        // default: text-embedding-3-small
  embed?: boolean;                 // default: true (si OPENAI_API_KEY présent)
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

function chunkText(text: string, maxChars = 1200, overlap = 150) {
  const clean = (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const chunks: string[] = [];
  if (!clean) return chunks;

  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + maxChars, clean.length);
    const slice = clean.slice(i, end).trim();
    if (slice) chunks.push(slice);

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
  // Edge/Deno: pas de worker → disableWorker
  const loadingTask = pdfjs.getDocument({ data: bytes, disableWorker: true });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    try {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map((it) => (typeof it?.str === "string" ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) parts.push(pageText);
    } catch {
      // ignore page failure (scanné / erreur ponctuelle)
    }
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

async function insertBatched(supabase: any, rows: any[], batchSize = 250) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("document_chunks").insert(slice);
    if (error) throw error;
  }
}

async function insertChunksWithOptionalEmbedding(supabase: any, rows: any[]) {
  // Tentative 1 : insert avec embedding
  try {
    await insertBatched(supabase, rows, 200);
    return { ok: true, usedEmbedding: true };
  } catch (e: any) {
    const msg = String(e?.message || e || "").toLowerCase();

    // Si colonne embedding absente → retry sans embedding
    if (msg.includes("embedding") && (msg.includes("does not exist") || msg.includes("unknown column"))) {
      const rowsNoEmb = rows.map(({ embedding, ...rest }) => rest);
      await insertBatched(supabase, rowsNoEmb, 250);
      return { ok: true, usedEmbedding: false };
    }

    // Si type vector mismatch (dimension) → on peut aussi fallback sans embeddings
    if (msg.includes("vector") || msg.includes("dimension")) {
      const rowsNoEmb = rows.map(({ embedding, ...rest }) => rest);
      await insertBatched(supabase, rowsNoEmb, 250);
      return { ok: true, usedEmbedding: false, warning: "Embedding non inséré (dimension/type vector)." };
    }

    throw e;
  }
}

async function listAllPdfObjectPaths(supabase: any, bucketId: string, prefix: string, limit: number) {
  // storage.list ne descend pas dans les sous-dossiers automatiquement
  // ici on liste seulement le dossier "prefix" (ex: "" ou "douane")
  const { data, error } = await supabase.storage.from(bucketId).list(prefix || "", { limit: 1000 });
  if (error) throw new Error(`Storage list failed: ${error.message}`);

  const out: string[] = [];
  for (const o of data || []) {
    // o.name peut être un fichier ou un "folder" selon stockage
    const name = o?.name as string;
    if (!name) continue;

    const fullPath = prefix ? `${prefix.replace(/\/+$/g, "")}/${name}` : name;

    if (name.toLowerCase().endsWith(".pdf")) out.push(fullPath);
    if (out.length >= limit) break;
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "Missing supabase env" });

  // Exiger un JWT utilisateur (invoke depuis ton app)
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json(401, { error: "Missing Authorization bearer token" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Vérifier que le JWT est valide (et récupérer l'user)
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json(401, { error: "Invalid token", details: userErr?.message || "no user" });
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    // ok
  }

  const bucketId = body.bucket_id || "reference-docs";
  const prefix = (body.prefix || "").replace(/^\/+|\/+$/g, ""); // sanitize
  const docType = body.doc_type || "reglementaire";
  const maxChars = body.max_chars ?? 1200;
  const overlap = body.overlap ?? 150;
  const embModel = body.embedding_model || "text-embedding-3-small";
  const maxDocs = Math.max(1, Math.min(body.max_docs ?? 25, 200));
  const wantEmbed = body.embed !== false;

  const warnings: string[] = [];
  if (!OPENAI_API_KEY) warnings.push("OPENAI_API_KEY manquant: chunks créés mais embeddings absents (RAG vectoriel désactivé).");

  // 1) Liste des PDFs
  let objectPaths: string[] = [];

  try {
    if (body.object_paths?.length) {
      objectPaths = body.object_paths.slice(0, maxDocs);
    } else {
      objectPaths = await listAllPdfObjectPaths(supabase, bucketId, prefix, maxDocs);
    }
  } catch (e: any) {
    return json(500, { error: "Listing PDFs failed", details: e?.message || String(e) });
  }

  // 2) Ingest chaque PDF
  const results: any[] = [];

  for (const object_path of objectPaths) {
    const title = titleFromObjectPath(object_path);

    try {
      // Upsert doc (mieux: unique sur object_path)
      const { data: doc, error: upErr } = await supabase
        .from("documents")
        .upsert(
          { title, doc_type: docType, status: "uploaded", object_path },
          { onConflict: "object_path" }
        )
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
      if (!chunks.length) {
        results.push({ document_id, title, object_path, ok: false, step: "chunk", extracted_len, chunks: 0 });
        continue;
      }

      // Embeddings (batch)
      const embeddings: (number[] | null)[] = new Array(chunks.length).fill(null);

      const canEmbed = Boolean(OPENAI_API_KEY && wantEmbed);
      if (canEmbed) {
        const batchSize = 96;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const slice = chunks.slice(i, i + batchSize);
          const embs = await embedManyOpenAI(OPENAI_API_KEY!, embModel, slice);
          for (let j = 0; j < embs.length; j++) embeddings[i + j] = embs[j];
        }
      }

      const rows = chunks.map((content, idx) => ({
        document_id,
        chunk_index: idx,
        content,
        embedding: embeddings[idx],
        meta: {
          maxChars,
          overlap,
          object_path,
          title,
          embedding_model: canEmbed ? embModel : null,
          doc_type: docType,
        },
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
        warning: inserted.warning,
      });
    } catch (e: any) {
      results.push({ object_path, title, ok: false, error: e?.message || String(e) });
      try {
        // best effort: marquer le doc en erreur si on retrouve l'id
        await supabase.from("documents").update({ status: "error" }).eq("object_path", object_path);
      } catch {
        // ignore
      }
    }
  }

  return json(200, {
    ok: true,
    bucket_id: bucketId,
    prefix,
    requested: objectPaths.length,
    processed: results.length,
    results,
    warnings,
    user: { id: userData.user.id, email: userData.user.email },
  });
});
