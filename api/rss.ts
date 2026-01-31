import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "./_supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  const limit = Math.min(Number(req.query.limit || 40), 80);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  const { data, error } = await supabaseAdmin.rpc("mpl_get_rss", { lim: limit, off: offset });
  if (error) return json(res, 500, { ok: false, error: error.message });

  const row = Array.isArray(data) ? data[0] : null;
  return json(res, 200, {
    ok: true,
    data: {
      items: row?.items || [],
      total: row?.total || 0,
      sources: row?.sources || [],
    },
  });
}
