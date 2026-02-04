import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import { json, supabaseAdmin } from "../_supabase.js";

export const config = {
  api: {
    bodyParser: false,
  },
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

async function upsertSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const status = subscription.status ?? null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const plan = resolvePlan(status, priceId);

  const admin = supabaseAdmin();
  const { data: customer, error: customerError } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (customerError || !customer?.user_id) {
    return;
  }

  await admin.from("billing_subscriptions").upsert(
    {
      user_id: customer.user_id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status,
      plan,
      current_period_end: currentPeriodEnd,
    },
    { onConflict: "stripe_subscription_id" },
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    json(res, 500, { error: "Missing Stripe webhook env vars" });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["stripe-signature"] as string | undefined;
  if (!signature) {
    json(res, 400, { error: "Missing Stripe signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    json(res, 400, { error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
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
        break;
    }
  } catch (err: any) {
    json(res, 500, { error: err.message || "Webhook handler failed" });
    return;
  }

  json(res, 200, { received: true });
}
