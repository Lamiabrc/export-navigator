import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { allowCors, json, readJson, supabaseAdmin } from "../_supabase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10",
});

type CheckoutPayload = {
  priceId?: string;
};

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export default allowCors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { error: "Missing Authorization bearer token" });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ONLINE || !process.env.APP_URL) {
    json(res, 500, { error: "Missing Stripe or APP_URL env vars" });
    return;
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    json(res, 401, { error: "Invalid auth token" });
    return;
  }

  const user = userData.user;
  const { priceId } = await readJson<CheckoutPayload>(req);
  const stripePriceId = (priceId || process.env.STRIPE_PRICE_ONLINE).trim();

  const { data: existingCustomer, error: customerError } = await admin
    .from("billing_customers")
    .select("stripe_customer_id,email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (customerError) {
    json(res, 500, { error: "Failed to read billing customer" });
    return;
  }

  let stripeCustomerId = existingCustomer?.stripe_customer_id || "";
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: {
        supabase_user_id: user.id,
      },
    });
    stripeCustomerId = customer.id;

    const { error: upsertError } = await admin.from("billing_customers").upsert(
      {
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        email: user.email,
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      json(res, 500, { error: "Failed to store billing customer" });
      return;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: user.id,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/offre?canceled=1`,
    metadata: {
      supabase_user_id: user.id,
      plan: "online",
    },
  });

  json(res, 200, { url: session.url });
});
