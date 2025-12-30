/// <reference deno.ns="https://deno.land/x/deno@v1.41.0/mod.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  document_id: string;
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * NOTE extraction PDF:
 * - En Edge Function, on ne peut pas compter sur des binaires OS.
 * - MVP robuste: on délègue l'extraction à un parser JS.
 * - Ici on utilise "pdf-parse" côté JS (fonctionne souvent, mais certains PDFs scannés => texte vide).
 *
 * Alternative si besoin plus tard: OCR (plus lourd).
 */
async function extractTextFromPdf(bytes: Uint8Array): Promise<string> {
  // pdf-parse attend un Buffer (Node), mais Deno + esm.sh fournit un shim Buffer.
  const pdfParse = (await import("https://esm.sh/pdf-parse@1.1.1")).default;
  // @ts-ignore Buffer polyfill fourni par esm.sh
  const { Buffer } = await import("https://esm.sh/buffer@6.0.3");
  const data = await pdfParse(Buffer.from(bytes));
  return (data?.text ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const DOC_BUCKET = Deno.env.get("DOC_BUCKET") ?? "reference-docs";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!body?.document_id) return json(400, { error: "document_id is required" });

  // 1) Load document row
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, bucket, object_path, mime_type, status")
    .eq("id", body.document_id)
    .single();

  if (docErr || !doc) return json(404, { error: "Document not found", details: docErr?.message });

  const bucket = doc.bucket || DOC_BUCKET;
  const path = doc.object_path;

  if (!path) return json(400, { error: "Document has no object_path" });

  // 2) Download from Storage
  const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(path);
  if (dlErr || !file) {
    await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
    return json(500, { error: "Storage download failed", details: dlErr?.message });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // 3) Extract text
  let extracted = "";
  try {
    extracted = await extractTextFromPdf(bytes);
  } catch (e) {
    await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
    return json(500, { error: "PDF parsing failed", details: String(e) });
  }

  // 4) Update documents
  const nextStatus = extracted.length > 0 ? "parsed" : "parsed"; // même status, mais on pourra alerter si vide
  const { error: upErr } = await supabase
    .from("documents")
    .update({
      extracted_text: extracted,
      status: nextStatus,
      language: "fr",
    })
    .eq("id", doc.id);

  if (upErr) return json(500, { error: "Update failed", details: upErr.message });

  return json(200, {
    ok: true,
    document_id: doc.id,
    bucket,
    object_path: path,
    extracted_chars: extracted.length,
    warning: extracted.length === 0 ? "No text extracted (maybe scanned PDF)" : null,
  });
});
