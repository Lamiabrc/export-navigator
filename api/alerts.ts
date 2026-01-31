import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "./_supabase";

function normalize(s: string) {
  return (s || "").toLowerCase();
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const email = String((req.query as any)?.email ?? "").trim();
    const supabase = supabaseAdmin();

    // On charge des prefs si email fourni
    let countries: string[] = [];
    let hsCodes: string[] = [];

    if (email) {
      const { data: prefs, error: prefsErr } = await supabase
        .from("watch_prefs")
        .select("countries, hs_codes")
        .eq("email", normalize(email))
        .maybeSingle();

      if (!prefsErr && prefs) {
        countries = Array.isArray((prefs as any).countries) ? (prefs as any).countries : [];
        hsCodes = Array.isArray((prefs as any).hs_codes) ? (prefs as any).hs_codes : [];
      }
    }

    // On prend un pool d’items HIGH et on filtre en JS si prefs existantes
    const { data, error } = await supabase
      .from("rss_items")
      .select("id, title, summary, impact, pub_date, source_name, tags")
      .eq("impact", "HIGH")
      .order("pub_date", { ascending: false })
      .limit(200);

    if (error) return json(res, 500, { error: error.message });

    const pool = (data || []).map((row: any) => {
      const text = normalize(`${row.title} ${row.summary} ${(row.tags || []).join(" ")}`);
      return { row, text };
    });

    let filtered = pool;

    if (countries.length) {
      const cNorm = countries.map(normalize);
      filtered = filtered.filter((x) => cNorm.some((c) => x.text.includes(c)));
    }

    if (hsCodes.length) {
      const hsNorm = hsCodes.map((h) => normalize(String(h).replace(/\D/g, ""))).filter(Boolean);
      if (hsNorm.length) {
        filtered = filtered.filter((x) => hsNorm.some((h) => x.text.includes(h)));
      }
    }

    const alerts = filtered.slice(0, 50).map(({ row }: any) => ({
      id: row.id,
      title: row.title,
      message: row.summary,
      severity: row.impact,
      country: null,
      hsPrefix: null,
      detectedAt: row.pub_date,
      source: row.source_name,
    }));

    return json(res, 200, {
      updatedAt: new Date().toISOString(),
      alerts,
    });
  } catch (e: any) {
    return json(res, 500, { error: e?.message || "alerts_failed" });
  }
});
