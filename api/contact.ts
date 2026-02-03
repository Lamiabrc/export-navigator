import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

type IncomingBody = Record<string, unknown>;

type ContactRow = {
  first_name: string;
  email: string;
  company: string | null;
  subject: string | null;
  message: string;
  offer_type: string | null;
  scenario_summary: string | null;
  source: string | null;
  topic: string | null;

  ip: string | null;
  user_agent: string | null;
  locale: string | null;

  status: "ok" | "spam";
};

const VERSION = "contact-supabase-v1";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  if (xff.includes(",")) return xff.split(",")[0].trim() || null;
  return xff || null;
}

function parseBody(req: VercelRequest): IncomingBody {
  const b: any = (req as any).body;
  if (!b) return {};
  if (typeof b === "object") return b as IncomingBody;
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as IncomingBody;
    } catch {
      return {};
    }
  }
  return {};
}

const TRANSPORT_URL = process.env.EMAIL_TRANSPORT_URL;
const CONTACT_NOTIFICATION_EMAILS = process.env.CONTACT_NOTIFICATION_EMAILS
  ? process.env.CONTACT_NOTIFICATION_EMAILS.split(",").map((value) => value.trim()).filter(Boolean)
  : ["lamia.brechet@outlook.fr"];
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "Export Navigator <no-reply@exportfrancefacile.com>";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
const getTransport = () => {
  if (!TRANSPORT_URL) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport(TRANSPORT_URL);
  return transporter;
};

const buildNotificationSubject = (row: ContactRow) => {
  const parts = ["exportfrancefacile.com", "Nouveau contact"];
  if (row.topic) parts.push(row.topic);
  if (row.company) parts.push(row.company);
  return parts.join(" — ").slice(0, 200);
};

const buildNotificationBody = (row: ContactRow) => {
  const lines = [
    "Nouveau message reçu depuis exportfrancefacile.com",
    "",
    `Nom ou société : ${row.first_name}`,
    `Email : ${row.email}`,
    row.company ? `Société : ${row.company}` : "",
    row.offer_type ? `Offre : ${row.offer_type}` : "",
    row.topic ? `Sujet : ${row.topic}` : "",
    row.scenario_summary ? `Résumé : ${row.scenario_summary}` : "",
    "",
    "Message :",
    row.message,
    "",
    `Origine : ${row.source ?? "contact-page"}`,
    `Adresse IP : ${row.ip ?? "n/a"}`,
    `Langue du navigateur : ${row.locale ?? "n/a"}`,
  ].filter(Boolean);
  return lines.join("\n");
};

async function sendNotificationEmail(row: ContactRow) {
  const transport = getTransport();
  if (!transport) {
    return { ok: false as const, detail: "missing_email_transport" };
  }

  if (!CONTACT_NOTIFICATION_EMAILS.length) {
    return { ok: false as const, detail: "missing_recipients" };
  }

  await transport.sendMail({
    from: EMAIL_FROM_ADDRESS,
    to: CONTACT_NOTIFICATION_EMAILS,
    subject: buildNotificationSubject(row),
    text: buildNotificationBody(row),
    replyTo: row.email,
  });

  return { ok: true as const };
}

async function supabaseInsert(row: ContactRow) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      code: "missing_env",
      status: 500,
      detail: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on Vercel (Production).",
    };
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

  if (r.ok) return { ok: true as const };

  const text = await r.text().catch(() => "");
  return {
    ok: false as const,
    code: "supabase_insert_failed",
    status: r.status,
    detail: (text || r.statusText || "Unknown error").slice(0, 800),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  // ✅ Ping simple (pour confirmer que la route utilise bien CE fichier)
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, version: VERSION });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = parseBody(req);

    // Honeypot anti-spam (facultatif côté front)
    const honeypot = safeString((body as any).website || (body as any).hp || "", 200);
    const isSpam = Boolean(honeypot);

    // Compat payloads : ancien front (name/topic) + nouveau (firstName/subject)
    const firstName = safeString(body.firstName || body.name || body.fullName, 120);
    const email = normalizeEmail(body.email);
    const message = safeString(body.message, 4000);

    const subject = safeString(body.subject || body.topic, 200);
    const company = safeString(body.company || (body as any).societe, 200);
    const offerType = safeString(body.offerType || (body as any).offer_type, 80);
    const scenarioSummary = safeString(body.scenarioSummary || (body as any).scenario_summary, 4000);
    const source = safeString(body.source, 120) || "contact-page";
    const topic = safeString(body.topic, 80);

    if (!firstName || !email || !message) {
      return res.status(400).json({
        ok: false,
        error: "missing_fields",
        required: ["firstName(or name)", "email", "message"],
      });
    }
    if (!isEmailValid(email)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }
    if (message.trim().length < 10) {
      return res.status(400).json({ ok: false, error: "message_too_short" });
    }

    const row: ContactRow = {
      first_name: firstName,
      email,
      company: company || null,
      subject: subject || null,
      message,
      offer_type: offerType || null,
      scenario_summary: scenarioSummary || null,
      source,
      topic: topic || null,
      ip: getIp(req),
      user_agent: safeString(req.headers["user-agent"], 400) || null,
      locale: safeString(req.headers["accept-language"], 120) || null,
      status: isSpam ? "spam" : "ok",
    };

    const insert = await supabaseInsert(row);
    if (!insert.ok && insert.code !== "missing_env") {
      console.error("[api/contact] insert error:", insert);
      return res.status(500).json({
        ok: false,
        error: insert.code,
        supabase_status: insert.status,
        detail: insert.detail,
        version: VERSION,
      });
    }
    if (!insert.ok) {
      console.warn("[api/contact] supabase skipped:", insert.detail || insert.code);
    }

    const notification = await sendNotificationEmail(row);
    if (!notification.ok) {
      console.error("[api/contact] notification error:", notification);
    }

    return res.status(200).json({ ok: true, stored: true, version: VERSION });
  } catch (err: any) {
    console.error("[api/contact] fatal:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err).slice(0, 500),
      version: VERSION,
    });
  }
}

export const config = {
  runtime: "nodejs",
};
