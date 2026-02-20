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
    const sourceName = String(body.source_name || "Manual Upload");
    const entities = Array.isArray(body.entities) ? body.entities : [];

    const { data: source, error: sourceErr } = await admin
      .from("sanctions_sources")
      .upsert({ name: sourceName, source_url: body.source_url || null, format: body.format || "json" }, { onConflict: "name" })
      .select("id")
      .single();
    if (sourceErr) throw sourceErr;

    const { data: regSource } = await admin
      .from("source_registry")
      .upsert({ name: `sanctions:${sourceName}`, kind: "manual", enabled: true }, { onConflict: "name" })
      .select("id")
      .single();

    const runId = crypto.randomUUID();
    await admin.from("ingestion_runs").insert({ id: runId, source_id: regSource?.id, status: "partial", started_at: new Date().toISOString() });

    if (entities.length) {
      const rows = entities.map((entity: Record<string, unknown>) => ({
        source_id: source.id,
        entity_name: String(entity.entity_name || entity.name || "Unknown"),
        entity_type: String(entity.entity_type || entity.type || "entity"),
        programs: Array.isArray(entity.programs) ? entity.programs : [],
        country: entity.country ? String(entity.country) : null,
        raw: entity,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await admin.from("sanctions_entities").upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }

    await admin
      .from("ingestion_runs")
      .update({ status: "success", finished_at: new Date().toISOString(), stats: { imported: entities.length, source: sourceName } })
      .eq("id", runId);

    return Response.json({ ok: true, imported: entities.length }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
