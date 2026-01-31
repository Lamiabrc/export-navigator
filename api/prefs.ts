import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "./_supabase";

type PrefsPayload = {
  email?: string;
  countries?: string[];
  hsCodes?: string[];
};

function normalizeArray(value?: string[] | null): string[] {
  if (!value) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson<PrefsPayload>(req);
    const email = String(body?.email || "").trim();
    if (!email) {
      return json(res, 400, { ok: false, error: "email_required" });
    }

    const payload = {
      p_email: email,
      p_countries: normalizeArray(body?.countries),
      p_hs_codes: normalizeArray(body?.hsCodes),
    };

    const supabase = supabaseAdmin();
    const { error } = await supabase.rpc("mpl_upsert_prefs", payload);
    if (error) {
      console.error("[api/prefs] rpc error", error);
      return json(res, 500, { ok: false, error: error.message || "prefs_rpc_failed" });
    }

    return json(res, 200, { ok: true });
  } catch (err: any) {
    console.error("[api/prefs] error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "prefs_failed" });
  }
});
