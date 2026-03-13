import type { VercelRequest, VercelResponse } from "@vercel/node";

import { json } from "../src/server/supabaseAdmin.js";
import ingestFeedsHandler from "../src/server/api/ingestFeeds.js";
import purgeHandler from "../src/server/api/purge.js";

function queryParam(req: VercelRequest, key: string) {
  const value = req.query?.[key];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = queryParam(req, "mode").toLowerCase();

  if (mode === "purge") {
    return purgeHandler(req, res);
  }

  if (mode === "ingest-feeds") {
    return ingestFeedsHandler(req, res);
  }

  return json(res, 400, { ok: false, error: "mode_required" });
}

export const config = {
  runtime: "nodejs",
};
