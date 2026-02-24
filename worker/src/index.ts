import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import authRoutes from "./routes/auth";
import changesRoutes from "./routes/changes";
import servicesRoutes from "./routes/services";
import billingRoutes from "./routes/billing";
import suggestionsRoutes from "./routes/suggestions";
import { runFullScan } from "./services/scheduler";
import { getDb } from "./db/client";
import { alerts, changes, services, snapshots } from "./db/schema";
import { eq, desc, count as countFn } from "drizzle-orm";

const app = new Hono<{ Bindings: Env }>();

/* ── CORS ──────────────────────────────────────────── */
app.use("*", cors({
  origin: (origin) => {
    const allowed = [
      "https://tosmonitor.inksky.net",
      "https://tosmonitor.pages.dev",
      "http://localhost:3000",
      "http://localhost:3001",
    ];
    if (!origin) return "*";
    if (allowed.includes(origin)) return origin;
    // Allow CF Pages preview subdomains
    if (/^https:\/\/[a-z0-9]+\.tosmonitor\.pages\.dev$/.test(origin)) return origin;
    return "";
  },
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
}));

/* ── Routes ────────────────────────────────────────── */
app.route("/api/auth", authRoutes);
app.route("/api/changes", changesRoutes);
app.route("/api/services", servicesRoutes);
app.route("/api/billing", billingRoutes);
app.route("/api/suggestions", suggestionsRoutes);

/* ── Health ────────────────────────────────────────── */
app.get("/api/health", async (c) => {
  return c.json({
    status: "ok",
    service: "tosmonitor-api",
    runtime: "cloudflare-workers",
    timestamp: new Date().toISOString(),
  });
});

/* ── Admin: trigger scan ───────────────────────────── */
app.post("/api/admin/scan", async (c) => {
  // Fire-and-forget scan in waitUntil
  const env = c.env;
  c.executionCtx.waitUntil(runFullScan(env));
  return c.json({ message: "Scan started", status: "running" });
});

/* ── Admin: seed demo data ─────────────────────────── */
app.post("/api/admin/seed-demo", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const reset = c.req.query("reset") === "true";

  // Check if already seeded
  const [existing] = await db.select({ count: countFn() }).from(changes);
  if ((existing.count as number) > 0 && !reset) {
    return c.json({ message: "Demo data already exists. Use ?reset=true to re-seed." });
  }

  if (reset) {
    // Delete in order: alerts → changes → snapshots (respect FK constraints)
    await db.delete(alerts);
    await db.delete(changes);
    await db.delete(snapshots);
  }

  // Get some services to attach changes to
  const svcs = await db.select().from(services).limit(6);
  if (svcs.length === 0) {
    return c.json({ detail: "No services found. Run seed.py first." }, 400);
  }

  const demoChanges = [
    { slug: "stripe", type: "TOS_UPDATE" as const, severity: "MAJOR" as const,
      title: "Stripe updated payment dispute and liability clauses",
      summary: "Stripe revised Section 14 (Disputes and Reversals) to reduce the window for contesting chargebacks from 30 to 15 days." },
    { slug: "openai", type: "DATA_POLICY" as const, severity: "CRITICAL" as const,
      title: "OpenAI expanded data usage rights for model training",
      summary: "OpenAI updated their data processing terms. Free-tier API usage may now be used for model improvement." },
    { slug: "github", type: "TOS_UPDATE" as const, severity: "MINOR" as const,
      title: "GitHub clarified open-source license compliance language",
      summary: "GitHub added explicit language about DMCA handling for repositories with mixed-license code." },
    { slug: "slack", type: "PRIVACY_UPDATE" as const, severity: "MAJOR" as const,
      title: "Slack modified third-party data sharing policy",
      summary: "Slack updated their privacy policy to allow sharing aggregated workspace analytics with enterprise partners." },
    { slug: "aws", type: "PRICING_CHANGE" as const, severity: "MINOR" as const,
      title: "AWS adjusted free tier limits for Lambda",
      summary: "AWS reduced the free tier for Lambda from 1M to 500K requests/month." },
    { slug: "anthropic", type: "DATA_POLICY" as const, severity: "MAJOR" as const,
      title: "Anthropic added data retention clause for API users",
      summary: "Anthropic now retains API inputs for 30 days for safety evaluation, up from the previous 0-day policy." },
  ];

  const svcMap = new Map(svcs.map((s) => [s.slug, s.id]));
  const fakeContent = "These Terms of Service govern your use of the platform. ".repeat(50);

  let inserted = 0;
  for (const demo of demoChanges) {
    const serviceId = svcMap.get(demo.slug);
    if (!serviceId) continue;

    // Create fake snapshots (explicitly provide UUIDs since DB may not have defaults)
    const [oldSnap] = await db.insert(snapshots).values({
      id: crypto.randomUUID(),
      serviceId,
      url: `https://example.com/${demo.slug}/tos`,
      contentHash: crypto.randomUUID().replace(/-/g, ""),
      content: fakeContent,
      wordCount: fakeContent.split(/\s+/).length,
      fetchedAt: new Date(),
    }).returning();

    const [newSnap] = await db.insert(snapshots).values({
      id: crypto.randomUUID(),
      serviceId,
      url: `https://example.com/${demo.slug}/tos`,
      contentHash: crypto.randomUUID().replace(/-/g, ""),
      content: fakeContent + " Updated terms apply.",
      wordCount: (fakeContent + " Updated terms apply.").split(/\s+/).length,
      fetchedAt: new Date(),
    }).returning();

    await db.insert(changes).values({
      id: crypto.randomUUID(),
      serviceId,
      snapshotOldId: oldSnap.id,
      snapshotNewId: newSnap.id,
      changeType: demo.type,
      severity: demo.severity,
      title: demo.title,
      summary: demo.summary,
      diffHtml: `<table class="diff-table"><tr style="background:#ffeef0"><td>- Old clause text</td></tr><tr style="background:#e6ffed"><td>+ ${demo.title}</td></tr></table>`,
      sectionsChanged: 2,
      wordsAdded: 45,
      wordsRemoved: 12,
      detectedAt: new Date(),
    });
    inserted++;
  }

  return c.json({ message: `Seeded ${inserted} demo changes` });
});

/* ── Catch-all 404 ─────────────────────────────────── */
app.notFound((c) => c.json({ detail: "Not found" }, 404));

/* ── Error handler ─────────────────────────────────── */
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ detail: "Internal server error" }, 500);
});

/* ── Export ─────────────────────────────────────────── */
export default {
  fetch: app.fetch,

  // Cron Trigger handler — runs the scraper
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log(`Cron triggered at ${new Date().toISOString()}`);
    ctx.waitUntil(runFullScan(env));
  },
};
