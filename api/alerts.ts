import { allowCors, getQuery, json, supabaseAdmin } from "./_supabase";

export default async function handler(req: any, res: any) {
  if (allowCors(req, res)) return;

  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const email = getQuery(req, "email");
    const { data, error } = await supabaseAdmin.rpc("get_alerts", {
      p_email: email ? String(email).trim().toLowerCase() : null,
      p_limit: 50,
    });

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, {
      ok: true,
      data: {
        updatedAt: new Date().toISOString(),
        alerts: (data || []).map((a: any) => ({
          id: a.id,
          title: a.title,
          message: a.message,
          severity: a.severity,
          country: a.country,
          hsPrefix: a.hs_prefix,
          detectedAt: a.detected_at,
          source: a.source,
        })),
      },
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "alerts failed" });
  }
}
