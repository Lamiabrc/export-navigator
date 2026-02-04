import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { allowCors, json, supabaseAdmin } from "../_supabase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10",
});

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

  if (!process.env.STRIPE_SECRET_KEY || !process.env.APP_URL) {
    json(res, 500, { error: "Missing Stripe or APP_URL env vars" });
    return;
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    json(res, 401, { error: "Invalid auth token" });
    return;
  }

  const { data: billingCustomer, error: customerError } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (customerError || !billingCustomer?.stripe_customer_id) {
    json(res, 404, { error: "Billing customer not found" });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: billingCustomer.stripe_customer_id,
    return_url: `${process.env.APP_URL}/account`,
  });

  json(res, 200, { url: session.url });
});
