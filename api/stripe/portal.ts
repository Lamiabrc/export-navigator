import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

function json(res: VercelResponse, status: number, body: any) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

function getBearerToken(req: VercelRequest) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const APP_URL = process.env.APP_URL;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !APP_URL) {
      return json(res, 500, { ok: false, error: "missing_env" });
    }

    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "missing_auth" });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json(res, 401, { ok: false, error: "invalid_auth" });

    const userId = userData.user.id;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    const customerId = prof?.stripe_customer_id;
    if (!customerId) return json(res, 400, { ok: false, error: "no_customer" });

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/account`,
    });

    return json(res, 200, { ok: true, url: portal.url });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "unknown_error" });
  }
}
