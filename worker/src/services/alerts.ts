/**
 * Send alerts (email via Resend, webhook) when changes are detected.
 */
import { eq, and, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { alerts, subscriptions, users, changes, services } from "../db/schema";

export async function sendAlertsForChanges(
  db: Db,
  changeIds: string[],
  env: { RESEND_API_KEY: string; EMAIL_FROM: string; APP_URL: string; WEBHOOK_TIMEOUT_SECONDS: string },
) {
  if (changeIds.length === 0) return;

  // Load changes with service info
  const changeRows = await db.select({
    id: changes.id,
    title: changes.title,
    summary: changes.summary,
    severity: changes.severity,
    serviceId: changes.serviceId,
    serviceName: services.name,
    serviceSlug: services.slug,
  })
    .from(changes)
    .innerJoin(services, eq(changes.serviceId, services.id))
    .where(inArray(changes.id, changeIds));

  for (const change of changeRows) {
    // Find subscribers to this service
    const subs = await db.select({
      userId: subscriptions.userId,
      notifyEmail: subscriptions.notifyEmail,
      notifyWebhook: subscriptions.notifyWebhook,
      webhookUrl: subscriptions.webhookUrl,
      userEmail: users.email,
      userName: users.name,
      userPlan: users.plan,
    })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(eq(subscriptions.serviceId, change.serviceId));

    for (const sub of subs) {
      // Skip free users for real-time alerts
      if (sub.userPlan === "FREE") continue;

      // Email alert
      if (sub.notifyEmail && env.RESEND_API_KEY) {
        try {
          await sendEmail(env, sub.userEmail, change);
          await db.insert(alerts).values({
            id: crypto.randomUUID(),
            changeId: change.id,
            userId: sub.userId,
            channel: "EMAIL",
            status: "SENT",
            sentAt: new Date(),
            createdAt: new Date(),
          });
        } catch (err: any) {
          await db.insert(alerts).values({
            id: crypto.randomUUID(),
            changeId: change.id,
            userId: sub.userId,
            channel: "EMAIL",
            status: "FAILED",
            errorMessage: err.message,
            createdAt: new Date(),
          });
        }
      }

      // Webhook alert
      if (sub.notifyWebhook && sub.webhookUrl) {
        const timeout = parseInt(env.WEBHOOK_TIMEOUT_SECONDS) * 1000 || 10000;
        try {
          await sendWebhook(sub.webhookUrl, change, timeout);
          await db.insert(alerts).values({
            id: crypto.randomUUID(),
            changeId: change.id,
            userId: sub.userId,
            channel: "WEBHOOK",
            status: "SENT",
            sentAt: new Date(),
            createdAt: new Date(),
          });
        } catch (err: any) {
          await db.insert(alerts).values({
            id: crypto.randomUUID(),
            changeId: change.id,
            userId: sub.userId,
            channel: "WEBHOOK",
            status: "FAILED",
            errorMessage: err.message,
            createdAt: new Date(),
          });
        }
      }
    }
  }
}

async function sendEmail(
  env: { RESEND_API_KEY: string; EMAIL_FROM: string; APP_URL: string },
  to: string,
  change: { title: string; summary: string; severity: string; serviceName: string; id: string },
) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: `[${change.severity}] ${change.serviceName}: ${change.title}`,
      html: `
        <h2>${change.title}</h2>
        <p><strong>Service:</strong> ${change.serviceName}</p>
        <p><strong>Severity:</strong> ${change.severity}</p>
        <p>${change.summary}</p>
        <p><a href="${env.APP_URL}/dashboard/changes/${change.id}">View details →</a></p>
        <hr>
        <p style="color:#888;font-size:12px">
          You're receiving this because you subscribed to ${change.serviceName} alerts on ToS Monitor.
        </p>
      `,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  }
}

async function sendWebhook(
  url: string,
  change: { title: string; summary: string; severity: string; serviceName: string; id: string },
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "change.detected",
        change: {
          id: change.id,
          title: change.title,
          summary: change.summary,
          severity: change.severity,
          service: change.serviceName,
        },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Webhook ${resp.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
