import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, getIntParam, supabaseAdmin } from "./_supabase";

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const limit = Math.max(1, Math.min(getIntParam(req, "limit", 40), 200));
    const offset = Math.max(0, getIntParam(req, "offset", 0));

    const supabase = supabaseAdmin();

    // total
    const { count, error: countErr } = await supabase
      .from("rss_items")
      .select("id", { count: "exact", head: true });

    if (countErr) return json(res, 500, { ok: false, error: countErr.message });

    // items
    const { data, error } = await supabase
      .from("rss_items")
      .select("id, source_name, title, summary, link, pub_date, impact, reasons, tags")
      .order("pub_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return json(res, 500, { ok: false, error: error.message });

    const items = (data || []).map((row: any) => ({
      id: row.id,
      sourceName: row.source_name,
      title: row.title,
      summary: row.summary,
      link: row.link,
      pubDate: row.pub_date,
      impact: row.impact,
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
      tags: Array.isArray(row.tags) ? row.tags : [],
    }));

    // sources (dérivées)
    const sourceSet = new Set<string>();
    items.forEach((it: any) => sourceSet.add(it.sourceName));
    const sources = Array.from(sourceSet).sort().map((name) => ({ id: name, name }));

    return json(res, 200, {
      ok: true,
      data: {
        items,
        total: count ?? 0,
        sources,
      },
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "rss_failed" });
  }
});
