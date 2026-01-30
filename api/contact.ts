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

const memoryStore: ContactPayload[] = [];

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

function buildEmailBody(payload: ContactPayload) {
  const lines = [
    `Prenom: ${payload.firstName}`,
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

  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = (req.body || {}) as Record<string, unknown>;

    const payload: ContactPayload = {
      firstName: safeString(body.firstName),
      email: normalizeEmail(body.email),
      company: safeString(body.company),
      subject: safeString(body.subject),
      message: safeString(body.message),
      offerType: safeString(body.offerType || body.offer_type),
      scenarioSummary: safeString(body.scenarioSummary || body.scenario_summary),
    };

    if (!payload.firstName || !payload.email || !payload.message) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    if (!isEmailValid(payload.email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const transporter = buildTransporter();
    if (!transporter) {
      console.error("[api/contact] missing SMTP configuration");
      return res.status(500).json({ ok: false, error: "Email service not configured" });
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@mpl-export-conseil.fr";

    await transporter.sendMail({
      from: fromAddress,
      to: "lamia.brechet@outlook.fr",
      replyTo: payload.email,
      subject: `MPL Export Conseil - ${payload.subject || "Demande"}`,
      text: buildEmailBody(payload),
    });

    memoryStore.push({ ...payload });

    return res.status(200).json({ ok: true, data: { delivered: true } });
  } catch (error: any) {
    console.error("[api/contact] error", error?.message || error);
    return res.status(500).json({ ok: false, error: "Contact request failed" });
  }
}
