import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = { document_id: string; max_chars?: number; overlap?: number };

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "Missing supabase env" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
  if (!body?.document_id) return json(400, { error: "document_id is required" });

  const maxChars = body.max_chars ?? 1200;
  const overlap = body.overlap ?? 150;

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, extracted_text")
    .eq("id", body.document_id)
    .single();

  if (docErr || !doc) return json(404, { error: "Document not found", details: docErr?.message });
  if (!doc.extracted_text) return json(400, { error: "No extracted_text (run parse_pdf first)" });

  // Re-run safe
  await supabase.from("document_chunks").delete().eq("document_id", body.document_id);

  const chunks = chunkText(doc.extracted_text, maxChars, overlap);
  const rows = chunks.map((content, idx) => ({
    document_id: body.document_id,
    chunk_index: idx,
    content,
    meta: { maxChars, overlap },
  }));

  if (rows.length) {
    const { error: insErr } = await supabase.from("document_chunks").insert(rows);
    if (insErr) {
      await supabase.from("documents").update({ status: "error" }).eq("id", body.document_id);
      return json(500, { error: "Insert chunks failed", details: insErr.message });
    }
  }

  await supabase.from("documents").update({ status: "chunked" }).eq("id", body.document_id);

  return json(200, { ok: true, document_id: body.document_id, chunks: rows.length });
});
