import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function chunkText(text: string, size = 900) {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    chunks.push(text.slice(cursor, cursor + size));
    cursor += size;
  }
  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 100);

    const { data: sourceRef } = await admin
      .from("source_registry")
      .upsert({ name: "kb-indexer", kind: "manual", enabled: true }, { onConflict: "name" })
      .select("id")
      .single();

    const runId = crypto.randomUUID();
    await admin.from("ingestion_runs").insert({ id: runId, source_id: sourceRef?.id, status: "partial", started_at: new Date().toISOString() });

    const { data: docs, error } = await admin
      .from("kb_documents")
      .select("id,content")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    let inserted = 0;
    for (const doc of docs || []) {
      await admin.from("kb_chunks").delete().eq("document_id", doc.id);
      const chunks = chunkText(doc.content || "");
      if (!chunks.length) continue;
      const rows = chunks.map((content, idx) => ({ document_id: doc.id, chunk_index: idx, content }));
      const { error: insErr } = await admin.from("kb_chunks").insert(rows);
      if (insErr) throw insErr;
      inserted += rows.length;
    }

    await admin
      .from("ingestion_runs")
      .update({ status: "success", finished_at: new Date().toISOString(), stats: { documents: docs?.length || 0, chunks: inserted } })
      .eq("id", runId);

    return Response.json({ ok: true, documents: docs?.length || 0, chunks: inserted }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
