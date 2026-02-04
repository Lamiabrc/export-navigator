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
    const PRICE_ONLINE = process.env.STRIPE_PRICE_ONLINE;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !APP_URL || !PRICE_ONLINE) {
      return json(res, 500, { ok: false, error: "missing_env" });
    }

    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "missing_auth" });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json(res, 401, { ok: false, error: "invalid_auth" });

    const user = userData.user;
    const email = (user.email || "").toLowerCase();
    const userId = user.id;

    // récupérer stripe_customer_id si déjà existant
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = prof?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: PRICE_ONLINE, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/offre?canceled=1`,
      metadata: { supabase_user_id: userId, plan: "online" },
      subscription_data: {
        metadata: { supabase_user_id: userId, plan: "online" },
      },
    });

    return json(res, 200, { ok: true, url: session.url });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "unknown_error" });
  }
}
