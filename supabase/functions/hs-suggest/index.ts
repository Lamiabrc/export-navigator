import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type HsItem = { hs6: string; label_fr: string; score: number };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query = "", limit = 8 } = await req.json().catch(() => ({}));
    const q = String(query).trim();
    const take = Math.min(Math.max(Number(limit) || 8, 1), 20);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const merged = new Map<string, HsItem>();

    if (!q) {
      const { data, error } = await supabase.from("hs_codes").select("hs6,label_fr").order("updated_at", { ascending: false }).limit(take);
      if (error) throw error;
      return Response.json({ items: (data || []).map((row) => ({ hs6: row.hs6, label_fr: row.label_fr, score: 0.5 })) }, { headers: corsHeaders });
    }

    const { data: codes, error: codesErr } = await supabase
      .from("hs_codes")
      .select("hs6,label_fr")
      .or(`label_fr.ilike.%${q}%,hs6.ilike.%${q}%`)
      .limit(take);
    if (codesErr) throw codesErr;

    for (const row of codes || []) {
      merged.set(row.hs6, { hs6: row.hs6, label_fr: row.label_fr, score: 1.2 });
    }

    const { data: synonyms, error: synErr } = await supabase
      .from("hs_synonyms")
      .select("hs6,term,weight")
      .ilike("term", `%${q}%`)
      .limit(take);
    if (synErr) throw synErr;

    for (const row of synonyms || []) {
      const current = merged.get(row.hs6);
      if (current) {
        current.score += Number(row.weight || 1) / 5;
      } else {
        merged.set(row.hs6, { hs6: row.hs6, label_fr: row.term, score: 0.8 + Number(row.weight || 1) / 10 });
      }
    }

    const { data: examples, error: exErr } = await supabase
      .from("product_hs_examples")
      .select("hs6,product_term,confidence")
      .ilike("product_term", `%${q}%`)
      .limit(take);
    if (exErr) throw exErr;

    for (const row of examples || []) {
      const current = merged.get(row.hs6);
      const bonus = Number(row.confidence || 70) / 100;
      if (current) {
        current.score += bonus;
      } else {
        merged.set(row.hs6, { hs6: row.hs6, label_fr: row.product_term, score: bonus });
      }
    }

    const items = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, take);
    return Response.json({ items }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
