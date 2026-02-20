"""
Alert Service — sends email/webhook notifications when changes are detected.

Tier-aware:
  - FREE users → no real-time alerts. Changes are batched into weekly digests.
  - PRO users → real-time email alerts on every change.
  - TEAM users → real-time email + webhook/Slack alerts.
"""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Alert, AlertChannel, AlertStatus, Change, Service, Subscription, User
from app.tiers import get_limits

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_alerts_for_changes(
    changes: list[Change], db: AsyncSession
):
    """
    Send alerts to all subscribers of the affected services.
    Called by the scheduler after detecting changes.
    """
    for change in changes:
        # Get service info
        svc_result = await db.execute(
            select(Service).where(Service.id == change.service_id)
        )
        service = svc_result.scalar_one_or_none()
        if not service:
            continue

        # Get all subscribers for this service
        sub_result = await db.execute(
            select(Subscription).where(Subscription.service_id == change.service_id)
        )
        subscribers = sub_result.scalars().all()

        logger.info(
            f"Sending alerts for {service.name} change to {len(subscribers)} subscribers"
        )

        for sub in subscribers:
            # ── Tier check: get user's plan ──────────────────────────
            user_result = await db.execute(
                select(User).where(User.id == sub.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                continue

            limits = get_limits(user.plan)

            # FREE users don't get real-time alerts — skip them.
            # They'll get a weekly digest via a separate scheduled task.
            if not limits.realtime_alerts:
                logger.info(
                    f"Skipping real-time alert for {user.email} ({user.plan.value} plan)"
                )
                continue

            # Email alert (PRO+)
            if sub.notify_email:
                alert = Alert(
                    change_id=change.id,
                    user_id=sub.user_id,
                    channel=AlertChannel.EMAIL,
                    status=AlertStatus.PENDING,
                )
                db.add(alert)
                await db.flush()

                try:
                    await _send_email_alert(user, service, change)
                    alert.status = AlertStatus.SENT
                    alert.sent_at = datetime.now(timezone.utc)
                except Exception as e:
                    alert.status = AlertStatus.FAILED
                    alert.error_message = str(e)
                    logger.error(f"Email alert failed: {e}")

            # Webhook alert (TEAM only — already gated at subscribe time, but double-check)
            if sub.notify_webhook and sub.webhook_url and limits.can_webhook:
                alert = Alert(
                    change_id=change.id,
                    user_id=sub.user_id,
                    channel=AlertChannel.WEBHOOK,
                    status=AlertStatus.PENDING,
                )
                db.add(alert)
                await db.flush()

                try:
                    await _send_webhook_alert(sub.webhook_url, service, change)
                    alert.status = AlertStatus.SENT
                    alert.sent_at = datetime.now(timezone.utc)
                except Exception as e:
                    alert.status = AlertStatus.FAILED
                    alert.error_message = str(e)
                    logger.error(f"Webhook alert failed: {e}")


async def _send_email_alert(user: User, service: Service, change: Change):
    """Send an email alert via Resend."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set, skipping email alert")
        return

    severity_emoji = {
        "critical": "🔴",
        "major": "🟠",
        "minor": "🟡",
        "patch": "⚪",
    }
    emoji = severity_emoji.get(change.severity.value, "📋")

    html_body = f"""
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16213e;">{emoji} {change.title}</h2>
        <p style="color: #666; font-size: 14px;">
            Service: <strong>{service.name}</strong> ·
            Severity: <strong>{change.severity.value.upper()}</strong> ·
            {change.sections_changed} section(s) changed
        </p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; line-height: 1.6;">{change.summary}</p>
        </div>
        <p>
            <a href="{settings.APP_URL}/changes/{change.id}"
               style="background: #4361ee; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">
                View Full Diff →
            </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
            You're receiving this because you subscribed to {service.name} policy alerts on ToS Monitor.
        </p>
    </div>
    """

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.EMAIL_FROM,
                "to": [user.email],
                "subject": f"{emoji} {service.name}: {change.title}",
                "html": html_body,
            },
        )
        resp.raise_for_status()
        logger.info(f"Email sent to {user.email} for {service.name} change")


async def _send_webhook_alert(webhook_url: str, service: Service, change: Change):
    """Send a webhook notification (Slack/Discord/custom)."""
    payload = {
        "event": "policy_change",
        "service": {
            "name": service.name,
            "slug": service.slug,
        },
        "change": {
            "id": str(change.id),
            "title": change.title,
            "summary": change.summary,
            "severity": change.severity.value,
            "change_type": change.change_type.value,
            "sections_changed": change.sections_changed,
            "words_added": change.words_added,
            "words_removed": change.words_removed,
            "detected_at": change.detected_at.isoformat(),
            "url": f"{settings.APP_URL}/changes/{change.id}",
        },
    }

    async with httpx.AsyncClient(timeout=settings.WEBHOOK_TIMEOUT_SECONDS) as client:
        resp = await client.post(webhook_url, json=payload)
        resp.raise_for_status()
        logger.info(f"Webhook sent to {webhook_url} for {service.name} change")
