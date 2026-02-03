import type { VercelRequest, VercelResponse } from "@vercel/node";

type IncomingBody = Record<string, unknown>;

type ContactRow = {
  first_name: string;
  email: string;
  company?: string | null;
  subject?: string | null;
  message: string;
  offer_type?: string | null;
  scenario_summary?: string | null;
  source?: string | null;
  topic?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  locale?: string | null;
  // optionnel: "spam" | "ok"
  status?: string | null;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function safeString(v: unknown, max = 2000) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeEmail(v: unknown) {
  return safeString(v, 254).toLowerCase();
}

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getIp(req: VercelRequest) {
  const xff = safeString(req.headers["x-forwarded-for"], 200);
  // x-forwarded-for peut contenir "ip1, ip2"
  if (xff.includes(",")) return xff.split(",")[0].trim() || null;
  return xff || null;
}

async function supabaseInsert(row: ContactRow) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/contact_requests`;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Supabase insert failed (${r.status}): ${text || r.statusText}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = (req.body || {}) as IncomingBody;

    // Honeypot anti-spam (si tu ajoutes un champ caché côté front)
    // Si présent et rempli => on stocke en "spam" (ou on ignore)
    const honeypot = safeString(body.website || body.hp || "", 200);
    const isSpam = Boolean(honeypot);

    // Compat payloads
    const firstName = safeString(body.firstName || body.name || body.fullName, 120);
    const email = normalizeEmail(body.email);
    const message = safeString(body.message, 4000);

    const subject = safeString(body.subject || body.topic, 200);
    const company = safeString(body.company || body.societe, 200);
    const offerType = safeString(body.offerType || body.offer_type, 80);
    const scenarioSummary = safeString(body.scenarioSummary || body.scenario_summary, 4000);
    const source = safeString(body.source, 120);
    const topic = safeString(body.topic, 80);

    if (!firstName || !email || !message) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields",
        required: ["firstName(or name)", "email", "message"],
      });
    }
    if (!isEmailValid(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }
    if (message.trim().length < 10) {
      return res.status(400).json({ ok: false, error: "Message too short" });
    }

    const row: ContactRow = {
      first_name: firstName,
      email,
      company: company || null,
      subject: subject || null,
      message,
      offer_type: offerType || null,
      scenario_summary: scenarioSummary || null,
      source: source || "contact-page",
      topic: topic || null,
      ip: getIp(req),
      user_agent: safeString(req.headers["user-agent"], 400) || null,
      locale: safeString(req.headers["accept-language"], 120) || null,
      status: isSpam ? "spam" : "ok",
    };

    await supabaseInsert(row);

    return res.status(200).json({ ok: true, stored: true });
  } catch (err: any) {
    console.error("[api/contact] error:", err?.message || err);

    const details =
      process.env.NODE_ENV === "development" ? String(err?.message || err) : undefined;

    return res.status(500).json({
      ok: false,
      error: "Contact request failed",
      ...(details ? { details } : {}),
    });
  }
}

// (Optionnel) si tu es sur un setup Vercel qui nécessite explicitement node runtime
export const config = {
  runtime: "nodejs",
};
