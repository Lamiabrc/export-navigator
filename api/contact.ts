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

type CallbackLeadBody = {
  phone?: unknown;
  email?: unknown;
  country_iso2?: unknown;
  message?: unknown;
  preferred_time?: unknown;
  consent?: unknown;
  page_url?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  ga_client_id?: unknown;
  user_id?: unknown;
};

type CallbackLeadRow = {
  phone: string;
  email: string;
  country_iso2: string | null;
  message: string | null;
  preferred_time: string | null;
  source: "cta_callback";
  page_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ga_client_id: string | null;
  user_id: string | null;
  status: "new";
  consent: true;
};

type NotifyResult = {
  ok: boolean;
  detail?: string;
  skipped?: boolean;
};

const VERSION = "contact-supabase-v2";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TRANSPORT_URL = (process.env.EMAIL_TRANSPORT_URL || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const EMAIL_FROM_ADDRESS =
  (process.env.EMAIL_FROM_ADDRESS || "").trim() || "Export Navigator <contact@exportfrancefacile.com>";

function safeString(v: unknown, max = 2000) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeEmail(v: unknown) {
  return safeString(v, 254).toLowerCase();
}

function isEmailValid(value: string) {
  return EMAIL_RE.test(value);
}

function normalizeIso2(v: unknown) {
  const iso2 = safeString(v, 8).toUpperCase();
  return /^[A-Z]{2}$/.test(iso2) ? iso2 : "";
}

function cleanPhone(v: unknown) {
  return safeString(v, 64).replace(/[^0-9+()\- .]/g, "").trim();
}

function parseBool(v: unknown) {
  return v === true || v === "true" || v === 1 || v === "1";
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

function parseEmails(value: string | undefined) {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => isEmailValid(item));
}

function extractEmailAddress(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function getNotificationRecipients() {
  const envRecipients = parseEmails(process.env.CONTACT_NOTIFICATION_EMAILS);
  if (envRecipients.length) return envRecipients;

  const fallback = extractEmailAddress(EMAIL_FROM_ADDRESS);
  return fallback ? [fallback] : [];
}

function getQueryMode(req: VercelRequest) {
  const value = (req.query?.mode ?? "") as string | string[];
  if (Array.isArray(value)) return safeString(value[0], 80).toLowerCase();
  return safeString(value, 80).toLowerCase();
}

function parseUtmFromUrl(pageUrl: string) {
  if (!pageUrl) return { utm_source: "", utm_medium: "", utm_campaign: "" };
  try {
    const url = new URL(pageUrl);
    return {
      utm_source: safeString(url.searchParams.get("utm_source"), 120),
      utm_medium: safeString(url.searchParams.get("utm_medium"), 120),
      utm_campaign: safeString(url.searchParams.get("utm_campaign"), 120),
    };
  } catch {
    return { utm_source: "", utm_medium: "", utm_campaign: "" };
  }
}

function parseGaClientIdFromCookie(req: VercelRequest) {
  const cookie = safeString(req.headers.cookie, 4000);
  if (!cookie) return "";
  const match = cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/i);
  return match?.[1] ? safeString(match[1], 120) : "";
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!TRANSPORT_URL) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport(TRANSPORT_URL);
  return transporter;
}

async function sendEmail(params: {
  subject: string;
  text: string;
  replyTo: string;
}): Promise<NotifyResult> {
  const recipients = getNotificationRecipients();
  if (!recipients.length) {
    return { ok: false, detail: "missing_CONTACT_NOTIFICATION_EMAILS_or_EMAIL_FROM_ADDRESS" };
  }

  if (RESEND_API_KEY) {
    const payload = {
      from: EMAIL_FROM_ADDRESS,
      to: recipients,
      subject: params.subject,
      text: params.text,
      reply_to: params.replyTo,
    };

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, detail: detail || "resend_failed" };
      }

      return { ok: true };
    } catch (error: any) {
      return { ok: false, detail: safeString(error?.message || error, 500) || "resend_failed" };
    }
  }

  const transport = getTransport();
  if (!transport) {
    return { ok: true, skipped: true, detail: "missing_RESEND_API_KEY" };
  }

  try {
    await transport.sendMail({
      from: EMAIL_FROM_ADDRESS,
      to: recipients,
      subject: params.subject,
      text: params.text,
      replyTo: params.replyTo,
    });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, detail: safeString(error?.message || error, 500) || "smtp_failed" };
  }
}

function buildContactNotificationSubject(row: ContactRow) {
  const parts = ["exportfrancefacile.com", "Nouveau contact"];
  if (row.topic) parts.push(row.topic);
  if (row.company) parts.push(row.company);
  return parts.join(" - ").slice(0, 200);
}

function buildContactNotificationBody(row: ContactRow) {
  const lines = [
    "Nouveau message recu depuis exportfrancefacile.com",
    "",
    `Nom ou societe : ${row.first_name}`,
    `Email : ${row.email}`,
    row.company ? `Societe : ${row.company}` : "",
    row.offer_type ? `Offre : ${row.offer_type}` : "",
    row.topic ? `Sujet : ${row.topic}` : "",
    row.scenario_summary ? `Resume : ${row.scenario_summary}` : "",
    "",
    "Message :",
    row.message,
    "",
    `Origine : ${row.source ?? "contact-page"}`,
    `Adresse IP : ${row.ip ?? "n/a"}`,
    `Langue du navigateur : ${row.locale ?? "n/a"}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildCallbackNotificationBody(row: CallbackLeadRow, createdAt: string) {
  const lines = [
    "Nouveau lead callback (CTA) - exportfrancefacile.com",
    "",
    `Date : ${createdAt}`,
    `Telephone : ${row.phone}`,
    `Email : ${row.email}`,
    `Pays : ${row.country_iso2 || "non precise"}`,
    `Creneau : ${row.preferred_time || "non precise"}`,
    `Page : ${row.page_url || "non precisee"}`,
    "",
    "Message :",
    row.message || "(aucun)",
  ];

  return lines.join("\n");
}

async function supabaseInsertContact(row: ContactRow) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      code: "missing_env",
      status: 500,
      detail: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on Vercel.",
    };
  }

  const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/contact_requests`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    if (response.ok) return { ok: true as const };

    const detail = await response.text().catch(() => "");
    return {
      ok: false as const,
      code: "supabase_insert_failed",
      status: response.status,
      detail: (detail || response.statusText || "Unknown error").slice(0, 800),
    };
  } catch (error: any) {
    return {
      ok: false as const,
      code: "supabase_insert_failed",
      status: 0,
      detail: safeString(error?.message || error, 800) || "Unknown error",
    };
  }
}

async function supabaseInsertCallbackLead(row: CallbackLeadRow) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      code: "missing_env",
      status: 500,
      detail: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/lead`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false as const,
        code: "lead_insert_failed",
        status: response.status,
        detail: (detail || response.statusText || "Unknown error").slice(0, 900),
      };
    }

    const payload = (await response.json().catch(() => [])) as Array<{ id?: string; created_at?: string }>;
    const first = payload?.[0] || {};
    return {
      ok: true as const,
      leadId: safeString(first.id, 80) || null,
      createdAt: safeString(first.created_at, 80) || new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      ok: false as const,
      code: "lead_insert_failed",
      status: 0,
      detail: safeString(error?.message || error, 900) || "Unknown error",
    };
  }
}

async function handleLeadCallback(req: VercelRequest, res: VercelResponse) {
  const body = parseBody(req) as CallbackLeadBody;

  const recipients = getNotificationRecipients();
  if (!recipients.length) {
    return res.status(500).json({
      ok: false,
      error: "missing_env",
      detail: "Configure CONTACT_NOTIFICATION_EMAILS or EMAIL_FROM_ADDRESS",
    });
  }

  const phone = cleanPhone(body.phone);
  const email = normalizeEmail(body.email);
  const consent = parseBool(body.consent);

  if (!phone || phone.length < 6) {
    return res.status(400).json({ ok: false, error: "validation_error", detail: "phone_required" });
  }

  if (!email || !isEmailValid(email)) {
    return res.status(400).json({ ok: false, error: "validation_error", detail: "valid_email_required" });
  }

  if (!consent) {
    return res.status(400).json({ ok: false, error: "validation_error", detail: "consent_required" });
  }

  const pageUrl = safeString(body.page_url || req.headers.referer, 2000);
  const utmFromUrl = parseUtmFromUrl(pageUrl);
  const countryIso2 = normalizeIso2(body.country_iso2) || null;
  const userIdRaw = safeString(body.user_id, 80);
  const userId = UUID_RE.test(userIdRaw) ? userIdRaw : null;

  const row: CallbackLeadRow = {
    phone,
    email,
    country_iso2: countryIso2,
    message: safeString(body.message, 3000) || null,
    preferred_time: safeString(body.preferred_time, 120) || null,
    source: "cta_callback",
    page_url: pageUrl || null,
    utm_source: safeString(body.utm_source, 120) || utmFromUrl.utm_source || null,
    utm_medium: safeString(body.utm_medium, 120) || utmFromUrl.utm_medium || null,
    utm_campaign: safeString(body.utm_campaign, 120) || utmFromUrl.utm_campaign || null,
    ga_client_id: safeString(body.ga_client_id, 120) || parseGaClientIdFromCookie(req) || null,
    user_id: userId,
    status: "new",
    consent: true,
  };

  const insert = await supabaseInsertCallbackLead(row);
  if (!insert.ok) {
    return res.status(500).json({ ok: false, error: insert.code, detail: insert.detail });
  }

  const notify = await sendEmail({
    subject: `[Callback] ${row.country_iso2 || "N/A"} - ${row.phone}`,
    text: buildCallbackNotificationBody(row, insert.createdAt),
    replyTo: row.email,
  });

  return res.status(200).json({
    ok: true,
    lead_id: insert.leadId,
    email_sent: notify.ok && !notify.skipped,
    email_skipped: Boolean(notify.skipped),
    email_detail: notify.ok ? undefined : notify.detail,
  });
}

async function handleContact(req: VercelRequest, res: VercelResponse) {
  const body = parseBody(req);

  const honeypot = safeString((body as any).website || (body as any).hp || "", 200);
  const isSpam = Boolean(honeypot);

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

  const insert = await supabaseInsertContact(row);
  if (!insert.ok) {
    console.warn("[api/contact] supabase skipped:", insert.detail || insert.code);
  }

  const notification = await sendEmail({
    subject: buildContactNotificationSubject(row),
    text: buildContactNotificationBody(row),
    replyTo: row.email,
  });
  if (!notification.ok) {
    console.error("[api/contact] notification error:", notification);
  }

  return res.status(200).json({
    ok: true,
    stored: insert.ok,
    emailSent: notification.ok,
    emailDetail: notification.ok ? undefined : notification.detail,
    version: VERSION,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, version: VERSION, modes: ["contact", "lead-callback"] });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const mode = getQueryMode(req);
    if (mode === "lead-callback") {
      return await handleLeadCallback(req, res);
    }

    return await handleContact(req, res);
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
