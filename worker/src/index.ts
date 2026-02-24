import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import authRoutes from "./routes/auth";
import changesRoutes from "./routes/changes";
import servicesRoutes from "./routes/services";
import billingRoutes from "./routes/billing";
import suggestionsRoutes from "./routes/suggestions";
import { runFullScan } from "./services/scheduler";
import { fetchPage } from "./services/fetcher";
import { computeDiff, isTooSimilar } from "./services/differ";
import { summarize } from "./services/summarizer";
import { getDb } from "./db/client";
import { alerts, changes, services, snapshots } from "./db/schema";
import { and, eq, desc, count as countFn, inArray, like, or } from "drizzle-orm";

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
  return c.json({
    detail: "Demo seed disabled. Use /api/admin/backfill-real for real historical data.",
  }, 410);
});

/* ── Admin: backfill real historical changes ───────── */
app.post("/api/admin/backfill-real", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const timeoutMs = (parseInt(c.env.SCRAPE_TIMEOUT_SECONDS || "30", 10) || 30) * 1000;
  const maxServices = Math.max(1, Math.min(8, parseInt(c.req.query("limit") || "5", 10) || 5));
  const daysBack = Math.max(30, Math.min(3650, parseInt(c.req.query("days") || "730", 10) || 730));
  const cleanDemo = c.req.query("clean_demo") !== "false";
  const slugsParam = (c.req.query("slugs") || "").trim();
  const slugFilter = slugsParam
    ? new Set(slugsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))
    : null;

  if (cleanDemo) {
    const demoSnapshotRows = await db
      .select({ id: snapshots.id })
      .from(snapshots)
      .where(like(snapshots.url, "https://example.com/%"));

    const demoSnapshotIds = demoSnapshotRows.map((r) => r.id);
    if (demoSnapshotIds.length > 0) {
      await db.delete(alerts);
      await db.delete(changes).where(or(
        inArray(changes.snapshotOldId, demoSnapshotIds),
        inArray(changes.snapshotNewId, demoSnapshotIds),
      ));
      await db.delete(snapshots).where(inArray(snapshots.id, demoSnapshotIds));
    }
  }

  let svcs = await db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(services.lastCheckedAt)
    .limit(60);

  if (slugFilter) {
    svcs = svcs.filter((s) => slugFilter.has(s.slug.toLowerCase()));
  }

  const targets = svcs
    .filter((s) => !!(s.tosUrl || s.privacyUrl))
    .slice(0, maxServices);

  const inserted: Array<{ slug: string; severity: string; title: string; date: string }> = [];
  const skipped: Array<{ slug: string; reason: string }> = [];

  for (const svc of targets) {
    const policyUrl = svc.tosUrl || svc.privacyUrl;
    if (!policyUrl) {
      skipped.push({ slug: svc.slug, reason: "no_policy_url" });
      continue;
    }

    try {
      const pair = await getWaybackPair(policyUrl, daysBack);
      if (!pair) {
        skipped.push({ slug: svc.slug, reason: "no_wayback_pair" });
        continue;
      }

      const [oldResult, newResult] = await Promise.all([
        fetchPage(pair.oldArchiveUrl, timeoutMs),
        fetchPage(pair.newArchiveUrl, timeoutMs),
      ]);

      if (!oldResult || !newResult) {
        skipped.push({ slug: svc.slug, reason: "archive_fetch_failed" });
        continue;
      }

      if (oldResult.contentHash === newResult.contentHash || isTooSimilar(oldResult.content, newResult.content)) {
        skipped.push({ slug: svc.slug, reason: "no_meaningful_diff" });
        continue;
      }

      const existingHashes = await db
        .select({ contentHash: snapshots.contentHash })
        .from(snapshots)
        .where(and(
          eq(snapshots.serviceId, svc.id),
          eq(snapshots.url, policyUrl),
          inArray(snapshots.contentHash, [oldResult.contentHash, newResult.contentHash]),
        ));

      if (existingHashes.length >= 2) {
        skipped.push({ slug: svc.slug, reason: "already_backfilled" });
        continue;
      }

      const oldSnapshotId = crypto.randomUUID();
      const newSnapshotId = crypto.randomUUID();

      await db.insert(snapshots).values([
        {
          id: oldSnapshotId,
          serviceId: svc.id,
          url: policyUrl,
          contentHash: oldResult.contentHash,
          content: oldResult.content,
          wordCount: oldResult.wordCount,
          fetchedAt: pair.oldAt,
        },
        {
          id: newSnapshotId,
          serviceId: svc.id,
          url: policyUrl,
          contentHash: newResult.contentHash,
          content: newResult.content,
          wordCount: newResult.wordCount,
          fetchedAt: pair.newAt,
        },
      ]);

      const diff = computeDiff(oldResult.content, newResult.content);
      const summary = await summarize(svc.name, diff.sections, {
        LLM_PROVIDER: c.env.LLM_PROVIDER,
        GROQ_API_KEY: c.env.GROQ_API_KEY,
        GROQ_MODEL: c.env.GROQ_MODEL,
        OPENAI_API_KEY: c.env.OPENAI_API_KEY,
        OPENAI_MODEL: c.env.OPENAI_MODEL,
        ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
        ANTHROPIC_MODEL: c.env.ANTHROPIC_MODEL,
      });
      const discoveredAt = new Date();
      const historicalRange = `${pair.oldAt.toISOString().slice(0, 10)} → ${pair.newAt.toISOString().slice(0, 10)}`;

      const [created] = await db.insert(changes).values({
        id: crypto.randomUUID(),
        serviceId: svc.id,
        snapshotOldId: oldSnapshotId,
        snapshotNewId: newSnapshotId,
        changeType: svc.tosUrl ? "TOS_UPDATE" : "PRIVACY_UPDATE",
        severity: summary.severity,
        title: summary.title,
        summary: `${summary.summary} (Historical source: ${historicalRange})`,
        diffHtml: diff.diffHtml,
        sectionsChanged: diff.sectionsChanged,
        wordsAdded: diff.wordsAdded,
        wordsRemoved: diff.wordsRemoved,
        detectedAt: discoveredAt,
      }).returning({ id: changes.id });

      if (created?.id) {
        inserted.push({
          slug: svc.slug,
          severity: summary.severity,
          title: summary.title,
          date: discoveredAt.toISOString(),
        });
      }
    } catch (err: any) {
      console.error("backfill-real error", svc.slug, err);
      skipped.push({ slug: svc.slug, reason: `error:${err?.message || "unknown"}` });
    }
  }

  return c.json({
    message: `Backfill complete: ${inserted.length} real changes inserted`,
    inserted,
    skipped,
  });
});

type WaybackPair = {
  oldAt: Date;
  newAt: Date;
  oldArchiveUrl: string;
  newArchiveUrl: string;
};

async function getWaybackPair(url: string, daysBack: number): Promise<WaybackPair | null> {
  const from = new Date(Date.now() - daysBack * 86400000);
  const fromStr = fmtWaybackDate(from);
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&filter=mimetype:text/html&collapse=digest&from=${fromStr}&limit=8`;

  const resp = await fetch(cdxUrl, {
    headers: { "User-Agent": "ToSMonitor/1.0 (+https://tosmonitor.inksky.net)" },
  });
  if (!resp.ok) return null;

  const data = await resp.json() as string[][];
  if (!Array.isArray(data) || data.length < 3) return null;

  // First row is header, choose the last two captures for real historical delta
  const rows = data.slice(1);
  const oldRow = rows[rows.length - 2];
  const newRow = rows[rows.length - 1];
  if (!oldRow || !newRow) return null;

  const oldTs = oldRow[0];
  const newTs = newRow[0];
  const original = newRow[1] || url;
  if (!oldTs || !newTs) return null;

  return {
    oldAt: parseWaybackTimestamp(oldTs),
    newAt: parseWaybackTimestamp(newTs),
    oldArchiveUrl: `https://web.archive.org/web/${oldTs}/${original}`,
    newArchiveUrl: `https://web.archive.org/web/${newTs}/${original}`,
  };
}

function fmtWaybackDate(d: Date): string {
  const y = d.getUTCFullYear().toString();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseWaybackTimestamp(ts: string): Date {
  // YYYYMMDDhhmmss
  const y = Number(ts.slice(0, 4));
  const m = Number(ts.slice(4, 6)) - 1;
  const d = Number(ts.slice(6, 8));
  const hh = Number(ts.slice(8, 10));
  const mm = Number(ts.slice(10, 12));
  const ss = Number(ts.slice(12, 14));
  return new Date(Date.UTC(y, m, d, hh, mm, ss));
}

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
