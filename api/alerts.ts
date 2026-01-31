import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "./_supabase";

function norm(s: string) {
  return (s || "").toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  const email = String(req.query.email || "").trim().toLowerCase();

  try {
    // prefs (optionnelles)
    let countries: string[] = [];
    let hsCodes: string[] = [];

    if (email) {
      const pref = await supabaseAdmin
        .from("watch_prefs")
        .select("countries, hs_codes")
        .eq("email", email)
        .maybeSingle();

      if (!pref.error && pref.data) {
        countries = Array.isArray(pref.data.countries) ? pref.data.countries : [];
        hsCodes = Array.isArray(pref.data.hs_codes) ? pref.data.hs_codes : [];
      }
    }

    const { data, error } = await supabaseAdmin
      .from("rss_items")
      .select("id,title,summary,source_name,pub_date,impact,link,tags")
      .eq("impact", "HIGH")
      .order("pub_date", { ascending: false })
      .limit(30);

    if (error) return json(res, 500, { ok: false, error: error.message });

    const filtered = (data || []).filter((item: any) => {
      if (!countries.length && !hsCodes.length) return true;
      const hay = norm(`${item.title} ${item.summary || ""} ${(item.tags || []).join(" ")}`);
      const countryOk = !countries.length || countries.some((c) => hay.includes(norm(c)));
      const hsOk = !hsCodes.length || hsCodes.some((h) => hay.includes(norm(h)));
      return countryOk || hsOk;
    });

    const alerts = filtered.slice(0, 12).map((item: any) => ({
      id: item.id,
      title: item.title,
      message: item.summary || "",
      severity: "HIGH",
      country: null,
      hsPrefix: null,
      detectedAt: item.pub_date,
      source: item.source_name,
    }));

    return json(res, 200, { updatedAt: new Date().toISOString(), alerts });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "Erreur serveur" });
  }
}
