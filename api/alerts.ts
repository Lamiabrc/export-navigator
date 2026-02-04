import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "./_supabase.js";

function mapAlertRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    severity: String(row.severity ?? "info"),
    country: row.country ?? null,
    hsPrefix: row.hs_prefix ?? row.hsPrefix ?? null,
    detectedAt: row.detected_at ?? row.detectedAt ?? null,
    source: row.source ?? null,
  };
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const email = String((req.query as any)?.email ?? "").trim();
    const supabase = supabaseAdmin();
    let rows: Record<string, unknown>[] = [];

    if (email) {
      const { data, error } = await supabase.rpc("mpl_get_alerts", {
        p_email: email,
        p_limit: 50,
      });

      if (error) {
        console.error("[api/alerts] mpl_get_alerts error", error);
        return json(res, 500, { ok: false, error: error.message || "alerts_rpc_failed" });
      }

      rows = Array.isArray(data) ? data : [];
    } else {
      const { data, error } = await supabase
        .from("mpl_alerts")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[api/alerts] select error", error);
        return json(res, 500, { ok: false, error: error.message || "alerts_select_failed" });
      }

      rows = Array.isArray(data) ? data : [];
    }

    const alerts = rows.map(mapAlertRow);

    return json(res, 200, {
      updatedAt: new Date().toISOString(),
      alerts,
    });
  } catch (err: any) {
    console.error("[api/alerts] error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "alerts_failed" });
  }
});
