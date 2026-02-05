import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { allowCors, json, supabaseAdmin } from "../_supabase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export default allowCors(async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== "POST") {
      json(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    const token = getBearerToken(req);
    if (!token) {
      json(res, 401, { ok: false, error: "Missing Authorization bearer token" });
      return;
    }

    const missing: string[] = [];
    if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!process.env.APP_URL) missing.push("APP_URL");
    if (missing.length) {
      json(res, 500, { ok: false, error: "missing_env", missing });
      return;
    }

    const admin = supabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);

    if (userError || !userData?.user) {
      json(res, 401, {
        ok: false,
        error: "invalid_auth",
        detail: userError?.message || null,
      });
      return;
    }

    const userId = userData.user.id;

    const { data: billingCustomer, error: customerError } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (customerError) {
      json(res, 500, {
        ok: false,
        error: "db_error_read_billing_customers",
        detail: customerError.message,
      });
      return;
    }

    if (!billingCustomer?.stripe_customer_id) {
      json(res, 404, {
        ok: false,
        error: "billing_customer_not_found",
        detail: "No stripe_customer_id for this user. Create one via checkout first.",
      });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: billingCustomer.stripe_customer_id,
      return_url: `${process.env.APP_URL}/account`,
    });

    json(res, 200, { ok: true, url: session.url });
  } catch (e: any) {
    json(res, 500, {
      ok: false,
      error: "server_error",
      detail: e?.message || String(e),
    });
  }
});
