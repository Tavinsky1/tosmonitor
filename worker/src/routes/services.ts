import { Hono } from "hono";
import { eq, desc, and, sql, count as countFn } from "drizzle-orm";
import { getDb } from "../db/client";
import { services, subscriptions } from "../db/schema";
import { authOptional, authRequired, type AuthUser } from "../middleware/auth";
import type { Env, Plan } from "../lib/types";
import { TIER_LIMITS } from "../lib/types";

const app = new Hono<{ Bindings: Env }>();

/** GET /api/services — list all services */
app.get("/", authOptional, async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const page = Math.max(parseInt(c.req.query("page") ?? "1"), 1);
  const perPage = Math.min(parseInt(c.req.query("per_page") ?? "50"), 100);
  const category = c.req.query("category");

  let conditions: any[] = [eq(services.isActive, true)];
  if (category) conditions.push(eq(services.category, category));
  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db.select({
    id: services.id,
    name: services.name,
    slug: services.slug,
    category: services.category,
    logoUrl: services.logoUrl,
    website: services.website,
    tosUrl: services.tosUrl,
    privacyUrl: services.privacyUrl,
    lastCheckedAt: services.lastCheckedAt,
  })
    .from(services)
    .where(where)
    .orderBy(services.name)
    .limit(perPage)
    .offset((page - 1) * perPage);

  // Get subscriber counts
  const subCounts = await db.select({
    serviceId: subscriptions.serviceId,
    count: countFn(),
  })
    .from(subscriptions)
    .groupBy(subscriptions.serviceId);

  const countMap = new Map(subCounts.map((s) => [s.serviceId, s.count]));

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      logo_url: r.logoUrl,
      website: r.website,
      tos_url: r.tosUrl,
      privacy_url: r.privacyUrl,
      last_checked_at: r.lastCheckedAt,
      subscriber_count: countMap.get(r.id) ?? 0,
    })),
    page,
    per_page: perPage,
  });
});

/** GET /api/services/categories/list */
app.get("/categories/list", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const rows = await db.select({
    category: services.category,
    count: countFn(),
  })
    .from(services)
    .where(eq(services.isActive, true))
    .groupBy(services.category)
    .orderBy(services.category);

  return c.json(rows.map((r) => ({
    category: r.category,
    count: r.count,
  })));
});

/** GET /api/services/:slug */
app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (slug === "me" || slug === "categories") return; // let other routes handle

  const db = getDb(c.env.DATABASE_URL);
  const rows = await db.select().from(services).where(eq(services.slug, slug)).limit(1);
  if (rows.length === 0) {
    return c.json({ detail: "Service not found" }, 404);
  }
  const s = rows[0];
  return c.json({
    id: s.id,
    name: s.name,
    slug: s.slug,
    category: s.category,
    logo_url: s.logoUrl,
    website: s.website,
    tos_url: s.tosUrl,
    privacy_url: s.privacyUrl,
    last_checked_at: s.lastCheckedAt,
  });
});

/** POST /api/services/subscribe */
app.post("/subscribe", authRequired, async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const user = c.get("user") as AuthUser;
  const limits = TIER_LIMITS[user.plan as Plan];

  const body = await c.req.json<{ service_id: string; webhook_url?: string }>();

  // Check service exists
  const svc = await db.select({ id: services.id })
    .from(services).where(eq(services.id, body.service_id)).limit(1);
  if (svc.length === 0) {
    return c.json({ detail: "Service not found" }, 404);
  }

  // Check subscription limit
  const [subCount] = await db.select({ count: countFn() })
    .from(subscriptions).where(eq(subscriptions.userId, user.id));
  if ((subCount.count as number) >= limits.maxServices) {
    return c.json({ detail: `Your plan allows max ${limits.maxServices} subscriptions. Upgrade for more.` }, 403);
  }

  // Check if already subscribed
  const existing = await db.select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.serviceId, body.service_id)))
    .limit(1);
  if (existing.length > 0) {
    return c.json({ detail: "Already subscribed" }, 409);
  }

  const wantWebhook = !!body.webhook_url;
  if (wantWebhook && !limits.webhookAccess) {
    return c.json({ detail: "Webhook alerts require Business plan" }, 403);
  }

  const [sub] = await db.insert(subscriptions).values({
    id: crypto.randomUUID(),
    userId: user.id,
    serviceId: body.service_id,
    notifyEmail: true,
    notifyWebhook: wantWebhook,
    webhookUrl: body.webhook_url ?? null,
    createdAt: new Date(),
  }).returning();

  return c.json({ id: sub.id, message: "Subscribed" });
});

/** DELETE /api/services/unsubscribe/:id */
app.delete("/unsubscribe/:id", authRequired, async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const user = c.get("user") as AuthUser;
  const serviceId = c.req.param("id");

  const deleted = await db.delete(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.serviceId, serviceId)))
    .returning({ id: subscriptions.id });

  if (deleted.length === 0) {
    return c.json({ detail: "Subscription not found" }, 404);
  }
  return c.json({ message: "Unsubscribed" });
});

/** GET /api/services/me/subscriptions */
app.get("/me/subscriptions", authRequired, async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const user = c.get("user") as AuthUser;

  const rows = await db.select({
    id: subscriptions.id,
    serviceId: subscriptions.serviceId,
    serviceName: services.name,
    serviceSlug: services.slug,
    notifyEmail: subscriptions.notifyEmail,
    notifyWebhook: subscriptions.notifyWebhook,
    createdAt: subscriptions.createdAt,
  })
    .from(subscriptions)
    .innerJoin(services, eq(subscriptions.serviceId, services.id))
    .where(eq(subscriptions.userId, user.id))
    .orderBy(services.name);

  return c.json(rows.map((r) => ({
    id: r.id,
    service_id: r.serviceId,
    service_name: r.serviceName,
    service_slug: r.serviceSlug,
    notify_email: r.notifyEmail,
    notify_webhook: r.notifyWebhook,
    created_at: r.createdAt,
  })));
});

export default app;
