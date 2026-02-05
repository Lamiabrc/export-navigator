import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

type CheckoutPayload = { priceId?: string };

function allowCors(handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const origin = (req.headers.origin as string) || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }
    await handler(req, res);
  };
}

function json(res: VercelResponse, status: number, body: any) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function getAppUrl(req: VercelRequest) {
  const envUrl = String(process.env.APP_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const origin = String(req.headers.origin || "").trim();
  if (origin) return origin.replace(/\/+$/, "");

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
  if (!host) return "";

  const protoRaw = String(req.headers["x-forwarded-proto"] || "https");
  const proto = protoRaw.split(",")[0].trim() || "https";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

async function safeReadJson<T>(req: VercelRequest): Promise<T> {
  try {
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) return {} as T;

    const raw = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    if (!raw || !raw.trim()) return {} as T;
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

function stripeErr(e: any) {
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

    // ENV
    const missing: string[] = [];
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const STRIPE_PRICE_ONLINE = process.env.STRIPE_PRICE_ONLINE || "";
    const SUPABASE_URL = process.env.SUPABASE_URL || "";
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!STRIPE_PRICE_ONLINE) missing.push("STRIPE_PRICE_ONLINE");
    if (!SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missing.length) {
      json(res, 500, { ok: false, error: "missing_env", missing });
      return;
    }

    const appUrl = getAppUrl(req);
    if (!appUrl) {
      json(res, 500, {
        ok: false,
        error: "missing_app_url",
        detail: "Set APP_URL or call checkout from a browser origin.",
      });
      return;
    }

    const token = getBearerToken(req);
    if (!token) {
      json(res, 401, { ok: false, error: "missing_auth_bearer" });
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Auth Supabase
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      json(res, 401, { ok: false, error: "invalid_auth", detail: userError?.message || null });
      return;
    }

    const user = userData.user;

    // Body tolérant
    const payload = await safeReadJson<CheckoutPayload>(req);
    const priceId = String(payload?.priceId || STRIPE_PRICE_ONLINE).trim();

    if (!priceId.startsWith("price_")) {
      json(res, 400, { ok: false, error: "invalid_price_id", detail: priceId });
      return;
    }

    // ✅ Vérif price + mismatch TEST/LIVE
    let priceObj: Stripe.Price;
    try {
      priceObj = await stripe.prices.retrieve(priceId);
    } catch (e: any) {
      json(res, 500, {
        ok: false,
        error: "stripe_price_retrieve_failed",
        detail: stripeErr(e),
        hint: "Souvent: mauvais priceId ou mismatch TEST/LIVE.",
      });
      return;
    }

    const keyMode = STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "test";
    const priceMode = priceObj.livemode ? "live" : "test";
    if (keyMode !== priceMode) {
      json(res, 500, {
        ok: false,
        error: "stripe_test_live_mismatch",
        detail: { keyMode, priceMode, priceId },
        hint: "Ta clé Stripe et ton priceId ne sont pas du même mode (TEST vs LIVE).",
      });
      return;
    }

    // Lire / créer billing customer
    const { data: existingCustomer, error: customerError } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (customerError) {
      json(res, 500, {
        ok: false,
        error: "db_error_read_billing_customers",
        detail: customerError.message,
        hint: "Vérifie que la table public.billing_customers existe bien.",
      });
      return;
    }

    const upsertCustomer = async (stripeCustomerId: string) => {
      const { error: upsertError } = await admin.from("billing_customers").upsert(
        {
          user_id: user.id,
          email: user.email,
          stripe_customer_id: stripeCustomerId,
        },
        { onConflict: "user_id" }
      );

      if (upsertError) {
        json(res, 500, {
          ok: false,
          error: "db_error_upsert_billing_customers",
          detail: upsertError.message,
        });
        return false;
      }
      return true;
    };

    const createCustomer = async () => {
      try {
        const created = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { supabase_user_id: user.id },
        });
        const ok = await upsertCustomer(created.id);
        return ok ? created.id : null;
      } catch (e: any) {
        json(res, 500, { ok: false, error: "stripe_customer_create_failed", detail: stripeErr(e) });
        return null;
      }
    };

    let customerId = existingCustomer?.stripe_customer_id || "";

    if (!customerId) {
      const createdId = await createCustomer();
      if (!createdId) return;
      customerId = createdId;
    }

    // Checkout session
    let session: Stripe.Checkout.Session;
    const createSession = async (cid: string) =>
      stripe.checkout.sessions.create({
        mode: "subscription",
        customer: cid,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/offre?canceled=1`,
        metadata: { supabase_user_id: user.id, plan: "online" },
        subscription_data: { metadata: { supabase_user_id: user.id, plan: "online" } },
      });

    try {
      session = await createSession(customerId);
    } catch (e: any) {
      const err = stripeErr(e);
      // Auto-heal if stored customer is missing (often after TEST/LIVE switch)
      if (err.code === "resource_missing" && err.param === "customer") {
        const freshId = await createCustomer();
        if (!freshId) return;
        try {
          session = await createSession(freshId);
        } catch (e2: any) {
          json(res, 500, { ok: false, error: "stripe_checkout_create_failed", detail: stripeErr(e2) });
          return;
        }
      } else {
        json(res, 500, { ok: false, error: "stripe_checkout_create_failed", detail: err });
        return;
      }
    }

    json(res, 200, { ok: true, url: session.url });
  } catch (e: any) {
    json(res, 500, { ok: false, error: "server_error", detail: e?.message || String(e) });
  }
});

export const config = {
  runtime: "nodejs",
};
