import type { VercelRequest, VercelResponse } from "@vercel/node";

import { allowCors, json } from "../src/server/supabaseAdmin.js";
import hsQuotaHandler from "../src/server/api/hsQuota.js";
import hsSearchHandler from "../src/server/api/hsSearch.js";

function queryParam(req: VercelRequest, key: string) {
  const value = req.query?.[key];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = queryParam(req, "mode").toLowerCase();

  if (mode === "search") {
    return hsSearchHandler(req, res);
  }

  if (mode === "quota") {
    return hsQuotaHandler(req, res);
  }

  if (req.method === "GET") {
    return json(res, 200, { ok: true, endpoint: "/api/hs", modes: ["search", "quota"] });
  }

  return json(res, 400, { ok: false, error: "mode_required" });
}

export default allowCors(handler);

export const config = {
  runtime: "nodejs",
};
