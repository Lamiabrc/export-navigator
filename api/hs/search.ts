import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function getQuery(req: VercelRequest) {
  const raw = typeof req.query?.q === "string" ? req.query.q : "";
  return raw.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const q = getQuery(req);
  if (!q || q.length < 2) return res.status(200).json({ items: [] });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "Supabase env missing" });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const isNumericQuery = /[0-9]/.test(q);
  const limit = 12;

  try {
    if (isNumericQuery) {
      const prefix = q.replace(/[^0-9]/g, "");
      if (prefix.length < 2) return res.status(200).json({ items: [] });

      const { data, error } = await sb
        .from("hs_codes")
        .select("code,description_fr,description_en,updated_at")
        .ilike("code", `${prefix}%`)
        .order("code", { ascending: true })
        .limit(limit);

      if (error) return res.status(500).json({ error: error.message });

      const items = (data || []).map((row: any) => ({
        code: String(row.code || ""),
        label: `${row.code} - ${row.description_fr || row.description_en || ""}`.trim().replace(/\s+-\s+$/, ""),
      }));

      return res.status(200).json({ items });
    }

    const { data, error } = await sb
      .from("hs_codes")
      .select("code,description_fr,description_en,updated_at")
      .textSearch("keywords", q, { config: "french" })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    const items = (data || []).map((row: any) => ({
      code: String(row.code || ""),
      label: `${row.code} - ${row.description_fr || row.description_en || ""}`.trim().replace(/\s+-\s+$/, ""),
    }));

    return res.status(200).json({ items });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Search failed" });
  }
}
