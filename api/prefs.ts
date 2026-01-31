import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "./_supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function uniq(arr: string[]) {
  return Array.from(new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean)));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const email = String(body?.email || "").trim().toLowerCase();
    const countries = uniq(body?.countries || []);
    const hsCodes = uniq(body?.hsCodes || []);

    if (!email || !EMAIL_RE.test(email)) return json(res, 400, { ok: false, error: "Email invalide" });

    const { error } = await supabaseAdmin
      .from("watch_prefs")
      .upsert(
        { email, countries, hs_codes: hsCodes },
        { onConflict: "email" }
      );

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, { ok: true });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "Erreur serveur" });
  }
}
