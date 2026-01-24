import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function asString(v: unknown) {
  return Array.isArray(v) ? String(v[0] || "") : String(v || "");
}

function normalizeQuery(q: string) {
  return q.trim();
}

function digitsOnly(q: string) {
  return q.replace(/[^0-9]/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const qRaw = normalizeQuery(asString(req.query.q));
  if (!qRaw || qRaw.length < 2) return res.status(200).json({ items: [] });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "Missing Supabase env" });

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const qDigits = digitsOnly(qRaw);

  try {
    // 1) si l’utilisateur tape des chiffres => recherche par préfixe de code
    if (qDigits.length >= 2) {
      const { data, error } = await sb
        .from("hs_codes")
        .select("code,description_fr")
        .ilike("code", `${qDigits}%`)
        .order("code", { ascending: true })
        .limit(20);

      if (error) throw error;
      return res.status(200).json({
        items: (data || []).map((r) => ({ code: r.code, label: r.description_fr })),
      });
    }

    // 2) sinon => recherche texte (full-text)
    const { data, error } = await sb
      .from("hs_codes")
      .select("code,description_fr")
      .textSearch("keywords", qRaw, { type: "websearch", config: "french" })
      .limit(20);

    if (error) throw error;
    return res.status(200).json({
      items: (data || []).map((r) => ({ code: r.code, label: r.description_fr })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: "HS search failed", details: e?.message || "unknown" });
  }
}
