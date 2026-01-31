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

function normalizeList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const countries = normalizeList(body.countries ?? body.countriesList ?? body.countries_list);
  const hsCodes = normalizeList(body.hsCodes ?? body.hs_codes ?? body.hscode);

  if (!email) {
    return res.status(400).json({ ok: false, error: "Email required" });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "Supabase not configured" });
  }

  try {
    const { error } = await supabase.rpc("mpl_upsert_prefs", {
      p_email: email,
      p_countries: countries,
      p_hs_codes: hsCodes,
    });

    if (error) {
      console.error("[api/prefs] rpc error", error);
      return res.status(500).json({ ok: false, error: error.message || "Prefs update failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[api/prefs] error", error?.message || error);
    return res.status(500).json({ ok: false, error: "Prefs update failed" });
  }
}
