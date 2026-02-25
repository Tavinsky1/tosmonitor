/**
 * Scraper scheduler: fetch all services, detect changes, summarize, alert.
 * Called by CF Cron Trigger.
 */
import { eq, desc, and } from "drizzle-orm";
import { getDb, type Db } from "../db/client";
import { services, snapshots, changes } from "../db/schema";
import { fetchPage } from "./fetcher";
import { computeDiff, isTooSimilar } from "./differ";
import { summarize } from "./summarizer";
import { sendAlertsForChanges } from "./alerts";
import type { Env, ChangeType } from "../lib/types";

export async function runFullScan(env: Env) {
  console.log("Starting full scan...");
  const db = getDb(env.DATABASE_URL);
  const timeoutMs = parseInt(env.SCRAPE_TIMEOUT_SECONDS) * 1000 || 30000;
  const BATCH_SIZE = 15;       // services per invocation (CF Workers subrequest limit)
  const CONCURRENCY = 5;       // parallel fetches

  // Scan the BATCH_SIZE least-recently-checked active services
  const allServices = await db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(services.lastCheckedAt)   // NULL (never checked) comes first
    .limit(BATCH_SIZE);

  console.log(`Scanning batch of ${allServices.length} services (most stale first)`);

  const newChangeIds: string[] = [];

  // Process in parallel chunks of CONCURRENCY
  for (let i = 0; i < allServices.length; i += CONCURRENCY) {
    const chunk = allServices.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (svc) => {
        const ids: string[] = [];
        try {
          if (svc.tosUrl) {
            const changeId = await checkUrl(db, svc, svc.tosUrl, "TOS_UPDATE", timeoutMs, env);
            if (changeId) ids.push(changeId);
          }
          if (svc.privacyUrl) {
            const changeId = await checkUrl(db, svc, svc.privacyUrl, "PRIVACY_UPDATE", timeoutMs, env);
            if (changeId) ids.push(changeId);
          }
          await db.update(services)
            .set({ lastCheckedAt: new Date() })
            .where(eq(services.id, svc.id));
        } catch (err) {
          console.error(`Error scanning ${svc.slug}:`, err);
        }
        return ids;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") newChangeIds.push(...r.value);
    }
  }

  // Send alerts for all new changes
  if (newChangeIds.length > 0) {
    console.log(`Sending alerts for ${newChangeIds.length} new changes`);
    await sendAlertsForChanges(db, newChangeIds, {
      RESEND_API_KEY: env.RESEND_API_KEY,
      EMAIL_FROM: env.EMAIL_FROM,
      APP_URL: env.APP_URL,
      WEBHOOK_TIMEOUT_SECONDS: env.WEBHOOK_TIMEOUT_SECONDS,
    });
  }

  console.log(`Scan complete. ${newChangeIds.length} changes detected.`);
}

async function checkUrl(
  db: Db,
  svc: typeof services.$inferSelect,
  url: string,
  changeType: ChangeType,
  timeoutMs: number,
  env: Env,
): Promise<string | null> {
  // Fetch the page
  const result = await fetchPage(url, timeoutMs);
  if (!result) return null;

  // Get previous snapshot for this URL
  const prevSnapshots = await db.select()
    .from(snapshots)
    .where(and(eq(snapshots.serviceId, svc.id), eq(snapshots.url, url)))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(1);

  // Save new snapshot
  const [newSnapshot] = await db.insert(snapshots).values({
    id: crypto.randomUUID(),
    serviceId: svc.id,
    url,
    contentHash: result.contentHash,
    content: result.content,
    wordCount: result.wordCount,
    fetchedAt: new Date(),
  }).returning();

  // No previous snapshot = first time, skip diff
  if (prevSnapshots.length === 0) {
    console.log(`First snapshot for ${svc.slug} (${changeType})`);
    return null;
  }

  const prev = prevSnapshots[0];
  // Same hash = no change
  if (prev.contentHash === result.contentHash) {
    return null;
  }

  // Check if change is too minor (>99.5% similar)
  if (isTooSimilar(prev.content, result.content)) {
    console.log(`${svc.slug}: change too minor, skipping`);
    return null;
  }

  // Compute diff
  const diff = computeDiff(prev.content, result.content);

  // Summarize with LLM
  const summary = await summarize(svc.name, diff.sections, {
    LLM_PROVIDER: env.LLM_PROVIDER,
    GROQ_API_KEY: env.GROQ_API_KEY,
    GROQ_MODEL: env.GROQ_MODEL,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: env.ANTHROPIC_MODEL,
  });

  // Create change record
  const [change] = await db.insert(changes).values({
    id: crypto.randomUUID(),
    serviceId: svc.id,
    snapshotOldId: prev.id,
    snapshotNewId: newSnapshot.id,
    changeType,
    severity: summary.severity,
    title: summary.title,
    summary: summary.summary,
    diffHtml: diff.diffHtml,
    sectionsChanged: diff.sectionsChanged,
    wordsAdded: diff.wordsAdded,
    wordsRemoved: diff.wordsRemoved,
    detectedAt: new Date(),
  }).returning({ id: changes.id });

  console.log(`[${summary.severity}] ${svc.slug}: ${summary.title}`);
  return change.id;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
