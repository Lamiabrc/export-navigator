import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "./_supabase";

type PrefsPayload = {
  email: string;
  countries: string[];
  hsCodes: string[];
};

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readJson<PrefsPayload>(req);

    const email = String(body?.email || "").trim();
    const countries = Array.isArray(body?.countries) ? body.countries.map(String) : [];
    const hsCodes = Array.isArray(body?.hsCodes) ? body.hsCodes.map(String) : [];

    if (!email) return json(res, 400, { ok: false, error: "email_required" });

    const supabase = supabaseAdmin();
    const { error } = await supabase.rpc("upsert_watch_prefs", {
      p_email: email,
      p_countries: countries,
      p_hs_codes: hsCodes,
    });

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, { ok: true });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "prefs_failed" });
  }
});
