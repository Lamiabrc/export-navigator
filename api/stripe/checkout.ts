import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { allowCors, json, readJson, supabaseAdmin } from "../_supabase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // ✅ Version stable (évite surprises)
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
  // ✅ Si body vide / pas JSON => retourne un objet vide
  try {
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) return {} as T;
    return await readJson<T>(req);
  } catch {
    return {} as T;
  }
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
    if (!process.env.STRIPE_PRICE_ONLINE) missing.push("STRIPE_PRICE_ONLINE");
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

    const user = userData.user;

    // ✅ Tolérant si le body est vide
    const payload = await safeReadJson<CheckoutPayload>(req);
    const stripePriceId = String(payload?.priceId || process.env.STRIPE_PRICE_ONLINE).trim();

    if (!stripePriceId.startsWith("price_")) {
      json(res, 400, {
        ok: false,
        error: "invalid_price_id",
        detail: "Expected a Stripe price_... id",
      });
      return;
    }

    // Lire customer existant
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

    // Créer customer si absent
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });

      stripeCustomerId = customer.id;

      const { error: upsertError } = await admin.from("billing_customers").upsert(
        {
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          email: user.email,
        },
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

    // Créer session Checkout
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: user.id,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/offre?canceled=1`,
      metadata: {
        supabase_user_id: user.id,
        plan: "online",
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: "online",
        },
      },
    });

    json(res, 200, { ok: true, url: session.url });
  } catch (e: any) {
    // ✅ Catch-all : renvoie l'erreur réelle
    json(res, 500, {
      ok: false,
      error: "server_error",
      detail: e?.message || String(e),
    });
  }
});
