import { Hono } from "hono";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { authRequired, type AuthUser } from "../middleware/auth";
import type { Env } from "../lib/types";

const app = new Hono<{ Bindings: Env }>();

function getStripe(env: Env) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Billing not configured");
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
}

/** POST /api/billing/checkout/:plan */
app.post("/checkout/:plan", authRequired, async (c) => {
  const plan = c.req.param("plan").toLowerCase();
  const user = c.get("user") as AuthUser;

  const priceMap: Record<string, string> = {
    pro: c.env.STRIPE_PRICE_PRO,
    business: c.env.STRIPE_PRICE_BUSINESS,
  };

  const priceId = priceMap[plan];
  if (!priceId) {
    return c.json({ detail: "Invalid plan. Use 'pro' or 'business'." }, 400);
  }

  const stripe = getStripe(c.env);
  const db = getDb(c.env.DATABASE_URL);

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${c.env.APP_URL}/dashboard?upgraded=1`,
    cancel_url: `${c.env.APP_URL}/pricing`,
    metadata: { user_id: user.id, plan },
  });

  return c.json({ url: session.url });
});

/** GET /api/billing/portal */
app.get("/portal", authRequired, async (c) => {
  const user = c.get("user") as AuthUser;
  if (!user.stripeCustomerId) {
    return c.json({ detail: "No active subscription found" }, 400);
  }

  const stripe = getStripe(c.env);
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${c.env.APP_URL}/dashboard`,
  });

  return c.json({ url: session.url });
});

/** POST /api/billing/webhook */
app.post("/webhook", async (c) => {
  const stripe = getStripe(c.env);
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ detail: "Missing signature" }, 400);

  const body = await c.req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return c.json({ detail: "Invalid signature" }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const plan = session.metadata?.plan?.toUpperCase() as "PRO" | "BUSINESS";
    if (userId && plan) {
      await db.update(users).set({ plan }).where(eq(users.id, userId));
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    if (sub.status === "active") {
      const customer = await stripe.customers.retrieve(sub.customer as string);
      if ("metadata" in customer && customer.metadata?.user_id) {
        // Plan already set at checkout, but update if needed
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(sub.customer as string);
    if ("metadata" in customer && customer.metadata?.user_id) {
      await db.update(users).set({ plan: "FREE" }).where(eq(users.id, customer.metadata.user_id));
    }
  }

  return c.json({ received: true });
});

export default app;
