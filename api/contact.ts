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
  if (!email) return res.status(400).json({ error: "email required" });

  const contactTo = process.env.CONTACT_TO || "lamia.brechet@outlook.fr";
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM || "MPL Export <onboarding@resend.dev>";
  const offerType = String(body.offer_type || "contact");
  const message = String(body.message || "");
  const context = body.context || {};

  let mailError: string | null = null;
  if (resendKey) {
    const subject = `Contact MPL - ${offerType}`;
    const html = `
      <h2>Nouvelle demande</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Offre:</strong> ${offerType}</p>
      <p><strong>Message:</strong><br/>${message ? message.replace(/\n/g, "<br/>") : "(vide)"}</p>
      <p><strong>Contexte:</strong><br/>${JSON.stringify(context, null, 2)}</p>
    `;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [contactTo],
          subject,
          html,
          reply_to: email,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        mailError = text || response.statusText;
      }
    } catch (err: any) {
      mailError = err?.message || "email send failed";
    }
  } else {
    mailError = "missing RESEND_API_KEY";
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from("leads").insert({
      email,
      consent_newsletter: Boolean(body.consent_newsletter ?? true),
      offer_type: offerType,
      message,
      context_json: context,
    });
    if (error) return res.status(500).json({ error: error.message });
  }

  if (mailError) return res.status(500).json({ error: "email send failed", details: mailError });
  return res.status(200).json({ ok: true });
}
