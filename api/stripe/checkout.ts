import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { allowCors, json, readJson, supabaseAdmin } from "../_supabase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

type CheckoutPayload = {
  priceId?: string;
};

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

async function safeReadJson<T>(req: VercelRequest): Promise<T> {
  try {
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) return {} as T;
    return await readJson<T>(req);
  } catch {
    return {} as T;
  }
}

function stripeErr(e: any) {
  // StripeError a souvent: type, code, message, raw, statusCode
  return {
    type: e?.type || null,
    code: e?.code || null,
    statusCode: e?.statusCode || null,
    message: e?.message || String(e),
    param: e?.param || null,
    requestId: e?.requestId || null,
  };
}

export default allowCors(async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== "POST") {
      json(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    // ✅ ENV check (inclut Supabase env)
    const missing: string[] = [];
    if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!process.env.STRIPE_PRICE_ONLINE) missing.push("STRIPE_PRICE_ONLINE");
    if (!process.env.APP_URL) missing.push("APP_URL");
    if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missing.length) {
      json(res, 500, { ok: false, error: "missing_env", missing });
      return;
    }

    const token = getBearerToken(req);
    if (!token) {
      json(res, 401, { ok: false, error: "Missing Authorization bearer token" });
      return;
    }

    const admin = supabaseAdmin();

    // ✅ Auth user
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      json(res, 401, { ok: false, error: "invalid_auth", detail: userError?.message || null });
      return;
    }

    const user = userData.user;

    // ✅ Body tolérant
    const payload = await safeReadJson<CheckoutPayload>(req);
    const stripePriceId = String(payload?.priceId || process.env.STRIPE_PRICE_ONLINE).trim();

    if (!stripePriceId.startsWith("price_")) {
      json(res, 400, { ok: false, error: "invalid_price_id", detail: stripePriceId });
      return;
    }

    // ✅ Vérifie que le price existe (et donc que TEST/LIVE match)
    try {
      await stripe.prices.retrieve(stripePriceId);
    } catch (e: any) {
      json(res, 500, {
        ok: false,
        error: "stripe_price_retrieve_failed",
        detail: stripeErr(e),
        hint: "Mismatch TEST/LIVE ou priceId invalide.",
        stripePriceId,
      });
      return;
    }

    // ✅ lire customer existant
    const { data: existingCustomer, error: customerError } = await admin
      .from("billing_customers")
      .select("stripe_customer_id,email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (customerError) {
      json(res, 500, {
        ok: false,
        error: "db_error_read_billing_customers",
        detail: customerError.message,
      });
      return;
    }

    let stripeCustomerId = existingCustomer?.stripe_customer_id || "";

    // ✅ créer customer si absent
    if (!stripeCustomerId) {
      let customer;
      try {
        customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { supabase_user_id: user.id },
        });
      } catch (e: any) {
        json(res, 500, { ok: false, error: "stripe_customer_create_failed", detail: stripeErr(e) });
        return;
      }

      stripeCustomerId = customer.id;

      const { error: upsertError } = await admin.from("billing_customers").upsert(
        { user_id: user.id, stripe_customer_id: stripeCustomerId, email: user.email },
        { onConflict: "user_id" }
      );

      if (upsertError) {
        json(res, 500, {
          ok: false,
          error: "db_error_upsert_billing_customers",
          detail: upsertError.message,
        });
        return;
      }
    }

    // ✅ créer checkout session
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        client_reference_id: user.id,
        line_items: [{ price: stripePriceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/offre?canceled=1`,
        metadata: { supabase_user_id: user.id, plan: "online" },
        subscription_data: { metadata: { supabase_user_id: user.id, plan: "online" } },
      });
    } catch (e: any) {
      json(res, 500, { ok: false, error: "stripe_checkout_create_failed", detail: stripeErr(e) });
      return;
    }

    json(res, 200, { ok: true, url: session.url });
  } catch (e: any) {
    json(res, 500, { ok: false, error: "server_error", detail: e?.message || String(e) });
  }
});
