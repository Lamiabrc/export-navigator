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
  const consent = Boolean(body.consent_newsletter ?? body.consent);
  const offerType = String(body.offer_type || "lead_magnet");
  const message = String(body.message || "");
  const context = body.context || body.metadata || {};

  if (!email) return res.status(400).json({ error: "email required" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ ok: true });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("leads").insert({
    email,
    consent_newsletter: consent,
    offer_type: offerType,
    message,
    context_json: context,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
