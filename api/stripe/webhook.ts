import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { json, supabaseAdmin } from "../_supabase.js";

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

function resolvePlan(status: string | null, priceId: string | null) {
  if (!status || !priceId) return "free";
  const active = status === "active" || status === "trialing";
  return active && priceId === process.env.STRIPE_PRICE_ONLINE ? "online" : "free";
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

  const userId = await findUserIdByCustomer(customerId);
  if (!userId) return;

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
    if (!process.env.STRIPE_PRICE_ONLINE) missing.push("STRIPE_PRICE_ONLINE");

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
