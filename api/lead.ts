import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function safeJson(req: VercelRequest) {
  if (!req.body) return null;
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};
  const email = String(body.email || "").trim().toLowerCase();
  const consent = Boolean(body.consent);
  const source = String(body.source || "lead_magnet");
  const simulationId = body.simulationId ? String(body.simulationId) : null;
  const metadata = body.metadata || {};

  if (!email) return res.status(400).json({ error: "email required" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ ok: true, leadId: null });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("leads")
    .insert({ email, source, consent_bool: consent, metadata_json: metadata })
    .select("id")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (simulationId) {
    await sb.from("simulations").update({ email }).eq("id", simulationId);
  }

  return res.status(200).json({ ok: true, leadId: data?.id || null });
}
