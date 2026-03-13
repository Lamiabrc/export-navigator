import type { VercelRequest, VercelResponse } from "@vercel/node";

import { json } from "../src/server/supabaseAdmin.js";
import stripeCheckoutHandler from "../src/server/api/stripeCheckout.js";
import stripePortalHandler from "../src/server/api/stripePortal.js";
import stripeWebhookHandler from "../src/server/api/stripeWebhook.js";

function queryParam(req: VercelRequest, key: string) {
  const value = req.query?.[key];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = queryParam(req, "mode").toLowerCase();

  if (mode === "checkout") {
    return stripeCheckoutHandler(req, res);
  }

  if (mode === "portal") {
    return stripePortalHandler(req, res);
  }

  if (mode === "webhook") {
    return stripeWebhookHandler(req, res);
  }

  return json(res, 400, { ok: false, error: "mode_required" });
}

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs",
};
