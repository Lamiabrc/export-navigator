import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "./_supabase";

const ALLOWED_METHODS = ["GET", "OPTIONS"];

function setCorsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const emailQuery = Array.isArray(req.query.email) ? req.query.email[0] : req.query.email;
  const email = normalizeEmail(emailQuery);

  if (!email) {
    return res.status(400).json({ ok: false, error: "Email required" });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "Supabase not configured" });
  }

  try {
    const { data, error } = await supabase.rpc("mpl_get_alerts", {
      p_email: email,
      p_limit: 25,
      p_offset: 0,
    });

    if (error) {
      console.error("[api/alerts] rpc error", error);
      return res.status(500).json({ ok: false, error: error.message || "Alerts fetch failed" });
    }

    const rows = Array.isArray(data) ? data : [];
    const alerts = rows.map((row: any) => ({
      id: String(row.id),
      title: row.title,
      message: row.message,
      severity: row.severity,
      country: row.country,
      hsPrefix: row.hs_prefix,
      detectedAt: row.detected_at,
      source: row.source,
    }));

    return res.status(200).json({
      ok: true,
      data: {
        updatedAt: new Date().toISOString(),
        alerts,
      },
    });
  } catch (error: any) {
    console.error("[api/alerts] error", error?.message || error);
    return res.status(500).json({ ok: false, error: "Alerts fetch failed" });
  }
}
