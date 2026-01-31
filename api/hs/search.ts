import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "../_supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  const q = String(req.query.q || "").trim();
  if (q.length < 2) return json(res, 200, { ok: true, items: [] });

  const { data, error } = await supabaseAdmin.rpc("mpl_search_hs", { q, lim: 12 });
  if (error) return json(res, 500, { ok: false, error: error.message });

  return json(res, 200, {
    ok: true,
    items: (data || []).map((x: any) => ({ code: x.code, label: x.label })),
  });
}
