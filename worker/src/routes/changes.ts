import { Hono } from "hono";
import { eq, desc, and, gte, sql, count as countFn, ilike } from "drizzle-orm";
import { getDb } from "../db/client";
import { changes, services, subscriptions } from "../db/schema";
import { authOptional, authRequired, type AuthUser } from "../middleware/auth";
import type { Env, Plan } from "../lib/types";
import { TIER_LIMITS } from "../lib/types";

const app = new Hono<{ Bindings: Env }>();

/** GET /api/changes — list changes */
app.get("/", authOptional, async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const user = c.get("user") as AuthUser | null;
  const plan = user?.plan ?? "FREE";
  const limits = TIER_LIMITS[plan as Plan];

  const slug = c.req.query("slug");
  const severity = c.req.query("severity");
  const days = Math.min(parseInt(c.req.query("days") ?? String(limits.historyDays)), limits.historyDays);
  const page = Math.max(parseInt(c.req.query("page") ?? "1"), 1);
  const perPage = Math.min(parseInt(c.req.query("per_page") ?? "20"), 50);

  const cutoff = new Date(Date.now() - days * 86400000);

  let conditions: any[] = [gte(changes.detectedAt, cutoff)];
  if (slug) {
    const svc = await db.select({ id: services.id })
      .from(services).where(eq(services.slug, slug)).limit(1);
    if (svc.length > 0) conditions.push(eq(changes.serviceId, svc[0].id));
  }
  if (severity) {
    conditions.push(eq(changes.severity, severity.toUpperCase() as any));
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db.select({
    id: changes.id,
    changeType: changes.changeType,
    severity: changes.severity,
    title: changes.title,
    summary: changes.summary,
    sectionsChanged: changes.sectionsChanged,
    wordsAdded: changes.wordsAdded,
    wordsRemoved: changes.wordsRemoved,
    detectedAt: changes.detectedAt,
    serviceId: changes.serviceId,
    serviceName: services.name,
    serviceSlug: services.slug,
  })
    .from(changes)
    .innerJoin(services, eq(changes.serviceId, services.id))
    .where(where)
    .orderBy(desc(changes.detectedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  // Total count for pagination
  const [countRow] = await db.select({ count: countFn() })
    .from(changes)
    .innerJoin(services, eq(changes.serviceId, services.id))
    .where(where);

  return c.json({
    changes: rows.map((r) => ({
      id: r.id,
      change_type: r.changeType,
      severity: r.severity,
      title: r.title,
      summary: r.summary,
      sections_changed: r.sectionsChanged,
      words_added: r.wordsAdded,
      words_removed: r.wordsRemoved,
      detected_at: r.detectedAt,
      service_name: r.serviceName,
      service_slug: r.serviceSlug,
    })),
    total: Number(countRow.count),
    page,
    per_page: perPage,
  });
});

/** GET /api/changes/feed — public JSON feed */
app.get("/feed", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const limit = Math.min(parseInt(c.req.query("limit") ?? "10"), 50);

  const rows = await db.select({
    id: changes.id,
    changeType: changes.changeType,
    severity: changes.severity,
    title: changes.title,
    summary: changes.summary,
    detectedAt: changes.detectedAt,
    serviceName: services.name,
    serviceSlug: services.slug,
  })
    .from(changes)
    .innerJoin(services, eq(changes.serviceId, services.id))
    .orderBy(desc(changes.detectedAt))
    .limit(limit);

  return c.json(rows.map((r) => ({
    id: r.id,
    change_type: r.changeType,
    severity: r.severity,
    title: r.title,
    summary: r.summary,
    detected_at: r.detectedAt,
    service_name: r.serviceName,
    service_slug: r.serviceSlug,
  })));
});

/** GET /api/changes/dashboard/stats */
app.get("/dashboard/stats", authRequired, async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const user = c.get("user") as AuthUser;

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);

  const [totalServices] = await db.select({ count: countFn() }).from(services).where(eq(services.isActive, true));
  const [changes7d] = await db.select({ count: countFn() }).from(changes).where(gte(changes.detectedAt, d7));
  const [changes30d] = await db.select({ count: countFn() }).from(changes).where(gte(changes.detectedAt, d30));
  const [userSubs] = await db.select({ count: countFn() }).from(subscriptions).where(eq(subscriptions.userId, user.id));
  const [critical] = await db.select({ count: countFn() }).from(changes)
    .where(and(eq(changes.severity, "CRITICAL"), gte(changes.detectedAt, d30)));

  return c.json({
    total_services: totalServices.count,
    changes_7d: changes7d.count,
    changes_30d: changes30d.count,
    user_subscriptions: userSubs.count,
    critical_30d: critical.count,
  });
});

/** GET /api/changes/:id */
app.get("/:id", authOptional, async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const user = c.get("user") as AuthUser | null;
  const plan = user?.plan ?? "FREE";
  const limits = TIER_LIMITS[plan as Plan];

  const id = c.req.param("id");
  const rows = await db.select({
    id: changes.id,
    changeType: changes.changeType,
    severity: changes.severity,
    title: changes.title,
    summary: changes.summary,
    diffHtml: changes.diffHtml,
    sectionsChanged: changes.sectionsChanged,
    wordsAdded: changes.wordsAdded,
    wordsRemoved: changes.wordsRemoved,
    detectedAt: changes.detectedAt,
    serviceId: changes.serviceId,
    serviceName: services.name,
    serviceSlug: services.slug,
  })
    .from(changes)
    .innerJoin(services, eq(changes.serviceId, services.id))
    .where(eq(changes.id, id))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ detail: "Change not found" }, 404);
  }

  const r = rows[0];
  return c.json({
    id: r.id,
    change_type: r.changeType,
    severity: r.severity,
    title: r.title,
    summary: r.summary,
    diff_html: limits.diffAccess ? r.diffHtml : null,
    upgrade_hint: !limits.diffAccess && r.diffHtml
      ? "Upgrade to Pro to see the visual diff."
      : null,
    sections_changed: r.sectionsChanged,
    words_added: r.wordsAdded,
    words_removed: r.wordsRemoved,
    detected_at: r.detectedAt,
    service_name: r.serviceName,
    service_slug: r.serviceSlug,
    old_content: null,
    new_content: null,
  });
});

/** GET /api/changes/service/:slug */
app.get("/service/:slug", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const slug = c.req.param("slug");

  const svc = await db.select({ id: services.id })
    .from(services).where(eq(services.slug, slug)).limit(1);
  if (svc.length === 0) {
    return c.json({ detail: "Service not found" }, 404);
  }

  const rows = await db.select({
    id: changes.id,
    changeType: changes.changeType,
    severity: changes.severity,
    title: changes.title,
    summary: changes.summary,
    detectedAt: changes.detectedAt,
  })
    .from(changes)
    .where(eq(changes.serviceId, svc[0].id))
    .orderBy(desc(changes.detectedAt))
    .limit(50);

  return c.json(rows.map((r) => ({
    id: r.id,
    change_type: r.changeType,
    severity: r.severity,
    title: r.title,
    summary: r.summary,
    detected_at: r.detectedAt,
  })));
});

export default app;
