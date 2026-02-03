import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

type ContactPayload = {
  firstName: string;
  email: string;
  company?: string;
  subject?: string;
  message: string;
  offerType?: string;
  scenarioSummary?: string;
};

const CONTACT_RECIPIENT = process.env.CONTACT_TO || "contact@exportfrancefacile.com";
const CONTACT_CC = process.env.CONTACT_CC || ""; // optionnel: "lamia.brechet@outlook.fr"

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function safeString(value: unknown) {
  return String(value || "").trim();
}

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function buildEmailBody(payload: ContactPayload, raw: Record<string, unknown>) {
  const lines = [
    `Prenom/Nom: ${payload.firstName}`,
    `Email: ${payload.email}`,
    `Societe: ${payload.company || "n/a"}`,
    `Sujet: ${payload.subject || "n/a"}`,
    `Offre: ${payload.offerType || "n/a"}`,
    "",
    "Message:",
    payload.message,
  ];

  if (payload.scenarioSummary) {
    lines.push("", "Scenario:", payload.scenarioSummary);
  }

  // Petit bonus debug (sans spammer)
  if (raw?.source) lines.push("", `Source: ${String(raw.source)}`);
  if (raw?.topic && !payload.subject) lines.push("", `Topic (raw): ${String(raw.topic)}`);

  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = (req.body || {}) as Record<string, unknown>;

    // Compatibilité avec l'ancien payload du front:
    // - name => firstName
    // - topic => subject
    const firstName = safeString(body.firstName || body.name || body.fullName);
    const email = normalizeEmail(body.email);
    const message = safeString(body.message);

    const payload: ContactPayload = {
      firstName,
      email,
      company: safeString(body.company || body.societe),
      subject: safeString(body.subject || body.topic),
      message,
      offerType: safeString(body.offerType || body.offer_type || body.topic),
      scenarioSummary: safeString(body.scenarioSummary || body.scenario_summary),
    };

    if (!payload.firstName || !payload.email || !payload.message) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields",
        required: ["firstName(or name)", "email", "message"],
      });
    }

    if (!isEmailValid(payload.email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const transporter = buildTransporter();
    if (!transporter) {
      console.error("[api/contact] missing SMTP configuration");
      return res.status(500).json({ ok: false, error: "Email service not configured" });
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@exportfrancefacile.com";

    const to = CONTACT_RECIPIENT.split(",").map((s) => s.trim()).filter(Boolean);
    const cc = CONTACT_CC.split(",").map((s) => s.trim()).filter(Boolean);

    await transporter.sendMail({
      from: fromAddress,
      to,
      cc: cc.length ? cc : undefined,
      replyTo: payload.email,
      subject: `ExportFranceFacile - ${payload.subject || "Demande"}`,
      text: buildEmailBody(payload, body),
    });

    return res.status(200).json({ ok: true, data: { delivered: true } });
  } catch (error: any) {
    console.error("[api/contact] error", error?.message || error);
    return res.status(500).json({ ok: false, error: "Contact request failed" });
  }
}
