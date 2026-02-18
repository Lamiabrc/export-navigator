import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const DAILY_LIMIT = 30;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function callLLM(input: string) {
  if (!OPENAI_API_KEY) return "Je peux déjà vous aider, mais le moteur LLM n'est pas configuré. Donnez produit, pays, incoterm et je vous propose un plan concret.";
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, input }),
  });
  const data = await res.json();
  return data?.output_text || "Je n'ai pas pu générer de réponse exploitable.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const sbUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const sbAdmin = createClient(url, service);

    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    const user = userData.user;

    const { session_id, message, context = {} } = await req.json();
    const text = String(message || "").trim();
    if (!text) return Response.json({ error: "message is required" }, { status: 400, headers: corsHeaders });

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await sbAdmin.from("chat_usage_daily").select("count").eq("user_id", user.id).eq("day", today).maybeSingle();
    const current = Number(usage?.count || 0);
    if (current >= DAILY_LIMIT) {
      return Response.json({ error: "Daily limit reached", remaining: 0 }, { status: 429, headers: corsHeaders });
    }
    await sbAdmin.from("chat_usage_daily").upsert({ user_id: user.id, day: today, count: current + 1 });

    let sessionId = String(session_id || "").trim();
    if (!sessionId) {
      const { data: created, error: createErr } = await sbAdmin.from("chat_sessions").insert({ user_id: user.id, title: text.slice(0, 80) }).select("id").single();
      if (createErr) throw createErr;
      sessionId = created.id;
    }

    const ragHint = [context.product, context.countryIso2, context.hs6, context.incoterm, context.paymentTerms].filter(Boolean).join(" | ");
    const prompt = `Tu es un copilote export humain, concret et empathique.\nMessage: ${text}\nContexte: ${ragHint || "(vide)"}\nRéponds en 6-10 lignes max + checklist actionnable.`;
    const reply = await callLLM(prompt);

    await sbAdmin.from("chat_messages").insert([
      { session_id: sessionId, user_id: user.id, role: "user", content: text },
      { session_id: sessionId, user_id: user.id, role: "assistant", content: reply },
    ]);

    return Response.json({ session_id: sessionId, reply, remaining: DAILY_LIMIT - (current + 1), sources: [] }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
