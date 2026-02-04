import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

function buffer(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function planFromPrice(priceId: string | null) {
  const online = process.env.STRIPE_PRICE_ONLINE;
  if (priceId && online && priceId === online) return "online";
  return "free";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !webhookSecret) {
      res.status(500).send("missing_env");
      return;
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const sig = req.headers["stripe-signature"] as string;
    const rawBody = await buffer(req);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      res.status(400).send(`Webhook Error: ${err?.message || "invalid_signature"}`);
      return;
    }

    // helpers
    async function updateByUserId(userId: string, payload: any) {
      await supabaseAdmin.from("profiles").update(payload).eq("id", userId);
    }
    async function findUserIdByCustomer(customerId: string) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      return data?.id || null;
    }

    // handle events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        (session.client_reference_id as string) ||
        (session.metadata?.supabase_user_id as string) ||
        null;

      const customerId = (session.customer as string) || null;
      const subscriptionId = (session.subscription as string) || null;

      if (userId) {
        await updateByUserId(userId, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: "active",
          plan: "online",
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as string) || null;
      const userId = customerId ? await findUserIdByCustomer(customerId) : null;

      const priceId =
        sub.items?.data?.[0]?.price?.id ? String(sub.items.data[0].price.id) : null;

      const status = String(sub.status || "");
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      const plan = status === "active" || status === "trialing" ? planFromPrice(priceId) : "free";

      if (userId) {
        await updateByUserId(userId, {
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          subscription_status: status,
          plan,
          current_period_end: currentPeriodEnd,
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (e: any) {
    res.status(200).json({ received: true, degraded: true, error: e?.message || "unknown_error" });
  }
}
