import { allowCors, json, readBodyJson, supabaseAdmin } from "./_supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(
      v
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 50)
    )
  );
}

export default async function handler(req: any, res: any) {
  if (allowCors(req, res)) return;

  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readBodyJson(req);
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) return json(res, 400, { ok: false, error: "Email invalide" });

    const countries = cleanArray(body?.countries);
    const hsCodes = cleanArray(body?.hsCodes);

    const { data, error } = await supabaseAdmin.rpc("upsert_watch_prefs", {
      p_email: email,
      p_countries: countries,
      p_hs_codes: hsCodes,
      p_themes: [],
      p_sources: [],
    });

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, { ok: Boolean(data) });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "prefs failed" });
  }
}
