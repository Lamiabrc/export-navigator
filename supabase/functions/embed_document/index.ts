import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = { document_id: string; model?: string };

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function embedTextsOpenAI(apiKey: string, model: string, inputs: string[]) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data.map((d: any) => d.embedding as number[]);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const DEFAULT_MODEL = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "Missing supabase env" });
  if (!OPENAI_API_KEY) return json(500, { error: "Missing OPENAI_API_KEY" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
  if (!body?.document_id) return json(400, { error: "document_id is required" });

  const model = body.model ?? DEFAULT_MODEL;

  const { data: chunks, error: cErr } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, content")
    .eq("document_id", body.document_id)
    .order("chunk_index", { ascending: true });

  if (cErr) return json(500, { error: "Load chunks failed", details: cErr.message });
  if (!chunks?.length) return json(400, { error: "No chunks to embed (run chunk_document first)" });

  const batchSize = 64;
  let embedded = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedTextsOpenAI(OPENAI_API_KEY, model, batch.map((c) => c.content));
    const updates = batch.map((c, idx) => ({ id: c.id, embedding: embeddings[idx] }));
    const { error: upErr } = await supabase.from("document_chunks").upsert(updates, { onConflict: "id" });
    if (upErr) return json(500, { error: "Update embeddings failed", details: upErr.message });
    embedded += batch.length;
  }

  await supabase.from("documents").update({ status: "embedded" }).eq("id", body.document_id);

  return json(200, { ok: true, document_id: body.document_id, embedded, model });
});
