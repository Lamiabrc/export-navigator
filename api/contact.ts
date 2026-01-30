import type { VercelRequest, VercelResponse } from "@vercel/node";

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

    memoryStore.push({ ...payload });

    return res.status(200).json({ ok: true, data: { stored: true } });
  } catch (error: any) {
    console.error("[api/contact] error", error?.message || error);
    return res.status(500).json({ ok: false, error: "Contact request failed" });
  }
}
