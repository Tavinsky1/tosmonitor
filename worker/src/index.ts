import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import authRoutes from "./routes/auth";
import changesRoutes from "./routes/changes";
import servicesRoutes from "./routes/services";
import billingRoutes from "./routes/billing";
import suggestionsRoutes from "./routes/suggestions";
import { runFullScan } from "./services/scheduler";
import { summarize } from "./services/summarizer";
import { getDb } from "./db/client";
import { changes, services, snapshots } from "./db/schema";
import { eq, desc, count as countFn, like } from "drizzle-orm";
import { computeDiff } from "./services/differ";

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
  const env = c.env;
  c.executionCtx.waitUntil(runFullScan(env));
  return c.json({ message: "Full scan started", status: "running" });
});

/* ── Public warmup: trigger scan if stale, return latest stats ── */
app.get("/api/warmup", async (c) => {
  const db = getDb(c.env.DATABASE_URL);

  // Check when we last scanned anything
  const [latest] = await db
    .select({ lastChecked: services.lastCheckedAt })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(desc(services.lastCheckedAt))
    .limit(1);

  const lastChecked = latest?.lastChecked;
  const staleMs = 3 * 60 * 60 * 1000; // 3 hours
  const isStale = !lastChecked || (Date.now() - new Date(lastChecked).getTime()) > staleMs;

  if (isStale) {
    // Fire-and-forget a full scan
    c.executionCtx.waitUntil(runFullScan(c.env));
  }

  // Return current change count so frontend knows what to expect
  const [changeCount] = await db.select({ count: countFn() }).from(changes);
  const [serviceCount] = await db.select({ count: countFn() }).from(services).where(eq(services.isActive, true));

  return c.json({
    status: "ok",
    scan_triggered: isStale,
    last_checked: lastChecked,
    total_changes: Number(changeCount.count),
    total_services: Number(serviceCount.count),
  });
});

/* ── Admin: test LLM connection ────────────────────── */
app.get("/api/admin/test-llm", async (c) => {
  const env = c.env;
  try {
    const testSections = [{
      oldText: "We may share your data with third-party partners.",
      newText: "We will share your data with third-party partners and use it to train AI models.",
      type: "modified" as const,
    }];
    const result = await summarize("TestService", testSections, {
      LLM_PROVIDER: env.LLM_PROVIDER,
      GROQ_API_KEY: env.GROQ_API_KEY,
      GROQ_MODEL: env.GROQ_MODEL,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      OPENAI_MODEL: env.OPENAI_MODEL,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: env.ANTHROPIC_MODEL,
    });
    return c.json({ status: "ok", model: env.GROQ_MODEL, result });
  } catch (err: any) {
    return c.json({ status: "error", error: err?.message || String(err) }, 500);
  }
});

/* ── Admin: re-summarize all existing changes with LLM ── */
app.post("/api/admin/resummarize", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const env = c.env;

  // Only re-summarize changes that still have the generic fallback title
  const allChanges = await db
    .select({
      id: changes.id,
      serviceId: changes.serviceId,
      snapshotOldId: changes.snapshotOldId,
      snapshotNewId: changes.snapshotNewId,
      title: changes.title,
    })
    .from(changes);

  const generic = allChanges.filter((ch) => ch.title.endsWith("policy updated"));
  const batch = generic.slice(0, 8); // Process max 8 per call to stay within time limit

  // Run inline (not waitUntil) so we can return real results
  let updated = 0;
  let failed = 0;

  for (const ch of batch) {
    try {
      const [svc] = await db.select({ name: services.name }).from(services).where(eq(services.id, ch.serviceId));
      if (!svc) { failed++; continue; }

      const [oldSnap] = await db.select({ content: snapshots.content }).from(snapshots).where(eq(snapshots.id, ch.snapshotOldId));
      const [newSnap] = await db.select({ content: snapshots.content }).from(snapshots).where(eq(snapshots.id, ch.snapshotNewId));
      if (!oldSnap || !newSnap) {
        console.log(`[resummarize] skip ${ch.id} - missing snapshots`);
        failed++; continue;
      }

      const diff = computeDiff(oldSnap.content, newSnap.content);
      if (!diff.sections.length) {
        console.log(`[resummarize] skip ${ch.id} - no diff sections`);
        failed++; continue;
      }

      const summary = await summarize(svc.name, diff.sections, {
        LLM_PROVIDER: env.LLM_PROVIDER,
        GROQ_API_KEY: env.GROQ_API_KEY,
        GROQ_MODEL: env.GROQ_MODEL,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
        OPENAI_MODEL: env.OPENAI_MODEL,
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        ANTHROPIC_MODEL: env.ANTHROPIC_MODEL,
      });

      await db.update(changes).set({
        title: summary.title,
        summary: summary.summary,
        severity: summary.severity,
      }).where(eq(changes.id, ch.id));

      console.log(`[resummarize] ✓ ${svc.name}: ${summary.severity} - ${summary.title}`);
      updated++;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err: any) {
      console.error(`[resummarize] ✗ change ${ch.id}:`, err?.message);
      failed++;
    }
  }

  return c.json({
    status: "done",
    updated,
    failed,
    remaining: generic.length - batch.length,
    total_generic: generic.length,
    total_changes: allChanges.length,
  });
});

/* ── Admin: clean up false-positive "No changes" entries ── */
app.delete("/api/admin/cleanup", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const deleted = await db.delete(changes).where(like(changes.title, "No %")).returning({ id: changes.id });
  return c.json({ status: "ok", deleted: deleted.length });
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
