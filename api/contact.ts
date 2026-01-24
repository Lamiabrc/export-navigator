import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function safeJson(req: VercelRequest) {
  if (!req.body) return null;
  try {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return null;
  }
}

function escapeHtml(input: string) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};

  // ✅ Compatible LeadMagnet + Contact
  const email = String(body.email || "").trim().toLowerCase();
  const consent = Boolean(body.consent ?? body.consent_newsletter ?? false); // lead magnet = consent
  const simulationId = body.simulationId ? String(body.simulationId) : null;
  const metadata = body.metadata ?? null;

  const offerType = String(body.offer_type || body.offerType || "lead").trim(); // contact/express/audit/lead
  const message = String(body.message || "").trim();
  const context = body.context || body.context_json || {};

  if (!email) return res.status(400).json({ error: "email required" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid email" });

  // --- Supabase (prioritaire) ---
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({
      error: "Missing SUPABASE env",
      details: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
    });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // On tente un insert “riche” (nouveau schéma), et on fallback si ta table a un ancien schéma
  let dbWarning: string | null = null;

  try {
    const { error } = await sb.from("leads").insert({
      email,
      consent,                // lead magnet
      consent_newsletter: consent, // compat (si tu gardes ce champ)
      simulation_id: simulationId, // relie au /brief
      metadata,               // lead magnet metadata (hs, pays, incoterm…)
      offer_type: offerType,  // compat contact
      message,                // compat contact
      context_json: context,  // compat contact
      source: body.source || "lead_magnet",
    });

    if (error) throw error;
  } catch (e: any) {
    // fallback minimal si ta table n’a pas toutes les colonnes
    try {
      const { error } = await sb.from("leads").insert({
        email,
        consent_newsletter: consent,
        offer_type: offerType,
        message,
        context_json: { ...context, simulationId, metadata },
      });
      if (error) throw error;
      dbWarning = "Leads table schema is partial (fallback insert used).";
    } catch (e2: any) {
      return res.status(500).json({
        error: "db insert failed",
        details: e2?.message || "Unable to insert lead",
      });
    }
  }

  // --- Email interne (optionnel, ne doit pas casser le tunnel) ---
  const contactTo = process.env.CONTACT_TO || "lamia.brechet@outlook.fr";
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM || "MPL Export <onboarding@resend.dev>";

  let mailWarning: string | null = null;

  if (resendKey) {
    const subject = `Lead MPL - ${offerType.toUpperCase()}${simulationId ? ` - ${simulationId}` : ""}`;
    const html = `
      <h2>Nouveau lead MPL</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Consentement:</strong> ${consent ? "Oui" : "Non"}</p>
      <p><strong>Offre:</strong> ${escapeHtml(offerType)}</p>
      <p><strong>Simulation ID:</strong> ${escapeHtml(simulationId || "-")}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message || "(vide)").replace(/\n/g, "<br/>")}</p>
      <p><strong>Metadata:</strong></p>
      <pre style="background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(
        JSON.stringify(metadata ?? {}, null, 2)
      )}</pre>
      <p><strong>Contexte:</strong></p>
      <pre style="background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(
        JSON.stringify(context ?? {}, null, 2)
      )}</pre>
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
        mailWarning = text || response.statusText;
      }
    } catch (err: any) {
      mailWarning = err?.message || "email send failed";
    }
  } else {
    mailWarning = "missing RESEND_API_KEY";
  }

  return res.status(200).json({
    ok: true,
    mailWarning,
    dbWarning,
  });
}
