import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "./_supabase";

const ALLOWED_METHODS = ["POST", "OPTIONS"];

function setCorsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function parsePayload(body: unknown) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = parsePayload(req.body);
  const email = normalizeEmail(body.email);
  const consent = Boolean(body.consent);
  const simulationId = body.simulationId ?? body.simulation_id ?? null;
  const metadata =
    typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {};

  if (!email) {
    return res.status(400).json({ ok: false, error: "Email required" });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "Supabase not configured" });
  }

  try {
    const { data, error } = await supabase.rpc("mpl_submit_lead", {
      p_email: email,
      p_consent: consent,
      p_simulation_id: simulationId,
      p_metadata: metadata,
    });

    if (error) {
      console.error("[api/lead] rpc error", error);
      return res.status(500).json({ ok: false, error: error.message || "Lead submission failed" });
    }

    const leadId = data?.lead_id ?? data?.id ?? null;

    return res.status(200).json({ ok: true, leadId });
  } catch (error: any) {
    console.error("[api/lead] error", error?.message || error);
    return res.status(500).json({ ok: false, error: "Lead submission failed" });
  }
}
