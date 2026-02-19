import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { query = "", limit = 8 } = await req.json().catch(() => ({}));
    const supabase = createClient(url, key, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });

    const q = String(query || "").trim();
    const take = Math.min(Math.max(Number(limit) || 8, 1), 20);

    if (!q) {
      const { data, error } = await supabase.from("hs_codes").select("hs6,label_fr").order("updated_at", { ascending: false }).limit(take);
      if (error) throw error;
      return Response.json({ items: (data || []).map((x) => ({ ...x, score: 0.5 })) }, { headers: corsHeaders });
    }

    const { data: hs, error } = await supabase
      .from("hs_codes")
      .select("hs6,label_fr")
      .or(`label_fr.ilike.%${q}%,hs6.ilike.%${q}%`)
      .limit(take);
    if (error) throw error;

    const { data: syn } = await supabase.from("hs_synonyms").select("hs6,term,weight").ilike("term", `%${q}%`).limit(take);
    const merged = new Map<string, { hs6: string; label_fr: string; score: number }>();
    for (const row of hs || []) merged.set(row.hs6, { hs6: row.hs6, label_fr: row.label_fr, score: 1 });
    for (const row of syn || []) {
      const current = merged.get(row.hs6);
      if (current) current.score += Number(row.weight || 1) / 10;
      else merged.set(row.hs6, { hs6: row.hs6, label_fr: row.term, score: Number(row.weight || 1) / 10 });
    }

    const items = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, take);
    return Response.json({ items }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
