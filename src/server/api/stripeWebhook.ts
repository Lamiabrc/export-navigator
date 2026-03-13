import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { json, supabaseAdmin } from "../supabaseAdmin.js";

export const config = {
  api: { bodyParser: false },
  runtime: "nodejs",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10",
});

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as any) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parsePriceList(raw?: string | null) {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter((v) => v.startsWith("price_"));
}

function buildPricePlanMap() {
  const map = new Map<string, string>();
  const add = (raw: string | undefined, plan: string) => {
    for (const id of parsePriceList(raw)) map.set(id, plan);
  };

  add(process.env.STRIPE_PRICE_ONLINE, "PRO_ONLINE");
  add(process.env.STRIPE_PRICE_VISIO, "PRO_VISIO");
  add(process.env.STRIPE_PRICE_PROSPECTION, "PROSPECTION");
  add(process.env.STRIPE_PRICE_PILOTAGE_HEBDO, "PILOTAGE_HEBDO");
  add(process.env.STRIPE_PRICE_PILOTAGE, "PILOTAGE_HEBDO");

  return map;
}

function resolvePlan(status: string | null, priceId: string | null) {
  if (!status || !priceId) return "FREE";
  const active = status === "active" || status === "trialing";
  if (!active) return "FREE";

  const map = buildPricePlanMap();
  return map.get(priceId) ?? "FREE";
}

async function findUserIdByCustomer(customerId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) return null;
  return data?.user_id || null;
}

async function findUserIdByEmail(email: string) {
  const admin = supabaseAdmin();
  const { data: known, error: knownErr } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (!knownErr && known?.user_id) return known.user_id;

  const authAdmin = admin.auth.admin as any;
  if (typeof authAdmin.getUserByEmail === "function") {
    const { data, error } = await authAdmin.getUserByEmail(email);
    if (error) return null;
    return data?.user?.id || null;
  }

  if (typeof authAdmin.listUsers === "function") {
    const target = email.trim().toLowerCase();
    const perPage = 200;
    for (let page = 1; page <= 5; page += 1) {
      const { data, error } = await authAdmin.listUsers({ page, perPage });
      if (error) return null;
      const users = (data?.users || []) as any[];
      const match = users.find((u) => String(u?.email || "").toLowerCase() === target);
      if (match?.id) return match.id;
      if (users.length < perPage) break;
    }
  }

  return null;
}

async function upsertBillingCustomer(userId: string, customerId: string, email?: string | null) {
  const admin = supabaseAdmin();
  const { error } = await admin.from("billing_customers").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      email: email || null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("billing_customers upsert error:", error.message);
  }
}

async function upsertSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string | null;
  if (!customerId) return;

  const item0 = subscription.items?.data?.[0];
  const priceId = item0?.price?.id ? String(item0.price.id) : null;
  const status = subscription.status ? String(subscription.status) : null;

  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const plan = resolvePlan(status, priceId);
  if ((status === "active" || status === "trialing") && plan === "FREE") {
    console.warn("billing_subscriptions: unknown priceId, defaulting to FREE", {
      priceId,
      status,
    });
  }

  let userId = await findUserIdByCustomer(customerId);
  const metaUserId = String(subscription.metadata?.supabase_user_id || subscription.metadata?.user_id || "").trim();
  if (!userId && metaUserId) {
    userId = metaUserId;
  }

  if (!userId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && typeof customer === "object" && !("deleted" in customer)) {
        const email = String(customer.email || "").trim();
        if (email) {
          userId = await findUserIdByEmail(email);
          if (userId) {
            await upsertBillingCustomer(userId, customerId, email);
          }
        }
      }
    } catch (err: any) {
      console.warn("stripe customer lookup failed:", err?.message || String(err));
    }
  }

  if (!userId) return;

  await upsertBillingCustomer(userId, customerId, null);

  const admin = supabaseAdmin();
  const { error: upsertErr } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status,
      plan,
      current_period_end: currentPeriodEnd,
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (upsertErr) {
    // On ne throw pas pour éviter de faire échouer le webhook,
    // mais on peut logguer côté Vercel.
    console.error("billing_subscriptions upsert error:", upsertErr.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      json(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    const missing: string[] = [];
    if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!process.env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");

    if (missing.length) {
      json(res, 500, { ok: false, error: "missing_env", missing });
      return;
    }

    const signature = req.headers["stripe-signature"] as string | undefined;
    if (!signature) {
      json(res, 400, { ok: false, error: "Missing Stripe signature" });
      return;
    }

    const rawBody = await readRawBody(req);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      json(res, 400, {
        ok: false,
        error: "Webhook signature verification failed",
        detail: err?.message || String(err),
      });
      return;
    }

    // ✅ Traitement
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // subscription est parfois null (paiement one-shot), on check
        const subId = session.subscription ? String(session.subscription) : null;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscription(subscription);
        break;
      }

      default:
        // On répond OK même si event non géré (Stripe retente sinon)
        break;
    }

    json(res, 200, { ok: true, received: true });
  } catch (err: any) {
    // Stripe préfère un 200 si tu ne veux pas de retries sans fin,
    // mais ici on garde un 200 avec degraded=true.
    json(res, 200, {
      ok: true,
      received: true,
      degraded: true,
      error: err?.message || String(err),
    });
  }
}
