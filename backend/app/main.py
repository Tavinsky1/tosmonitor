"""
ToS Monitor — FastAPI Application
══════════════════════════════════
The main entry point. Mounts all routers and starts the scraper scheduler.
"""

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, changes, services, billing

settings = get_settings()
logger = logging.getLogger(__name__)

# ── Logging ──────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


# ── Scheduler ────────────────────────────────────────────────

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start/stop the background scraper scheduler + auto-seed demo data."""
    from app.scraper.scheduler import run_full_scan

    # ── Auto-seed: if changes table is empty, populate demo data ──
    try:
        await _auto_seed_if_empty()
    except Exception as e:
        logger.warning(f"Auto-seed skipped: {e}")

    scheduler.add_job(
        run_full_scan,
        trigger=IntervalTrigger(hours=settings.SCRAPE_INTERVAL_HOURS),
        id="full_scan",
        name="Full ToS/Privacy Scan",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"Scraper scheduler started (interval: {settings.SCRAPE_INTERVAL_HOURS}h)"
    )

    yield

    scheduler.shutdown(wait=False)
    logger.info("Scraper scheduler stopped")


async def _auto_seed_if_empty():
    """Insert demo changes on first boot so the dashboard is never empty."""
    import hashlib
    from datetime import datetime as _dt, timedelta, timezone as _tz

    from sqlalchemy import select as _sel, func as _fn

    from app.database import async_session
    from app.models import Change, ChangeType, Severity, Snapshot, Service

    async with async_session() as db:
        count = (await db.execute(_sel(_fn.count()).select_from(Change))).scalar() or 0
        if count > 0:
            logger.info(f"Auto-seed: {count} changes already exist — skipping")
            return

        logger.info("Auto-seed: changes table empty — inserting demo data")

        DEMO = [
            ("stripe", ChangeType.TOS_UPDATE, Severity.MAJOR,
             "Stripe updated payment dispute and liability clauses",
             "Stripe revised Section 14 (Disputes and Reversals) to reduce the window "
             "for merchants to respond to chargebacks from 10 days to 7 days. "
             "New language also clarifies that Stripe may debit funds from your account "
             "immediately upon receiving a dispute claim, without waiting for resolution. "
             "The liability cap in Section 19 was lowered from 12 months of fees to 3 months.",
             3, 142, 87, 0),
            ("openai", ChangeType.TOS_UPDATE, Severity.CRITICAL,
             "OpenAI expanded rights to use API outputs for model training",
             "OpenAI's updated Terms now explicitly state that outputs generated via the API "
             "(including completions, embeddings, and fine-tuning outputs) may be used to "
             "improve and train OpenAI models unless you have a Zero Data Retention agreement. "
             "Enterprise customers are unaffected but standard API users should review their "
             "data handling obligations. Section 3(c) was significantly rewritten.",
             5, 318, 201, 0),
            ("github", ChangeType.PRIVACY_UPDATE, Severity.MINOR,
             "GitHub added Copilot telemetry data collection details",
             "GitHub updated its Privacy Statement to add a new subsection on GitHub Copilot "
             "telemetry: keystroke timings, suggestion acceptance rates, and editor context "
             "are now explicitly listed as collected data. Users can opt out via Copilot "
             "settings. The retention period for this data is stated as 24 months.",
             2, 94, 12, 1),
            ("slack", ChangeType.TOS_UPDATE, Severity.MAJOR,
             "Slack introduced AI features clauses and data processing changes",
             "Slack's updated Terms introduce a new Section 8 (Slack AI) permitting Slack "
             "to process customer data to deliver AI-powered features. Workspace admins can "
             "disable this via settings, but it is enabled by default for all plans. "
             "The DPA (Data Processing Agreement) was also updated with new sub-processor "
             "entries including two new AWS regions.",
             4, 267, 43, 1),
            ("aws", ChangeType.PRIVACY_UPDATE, Severity.PATCH,
             "AWS updated contact information and data controller details",
             "Minor update to the AWS Privacy Notice: updated mailing address for the EU "
             "data controller (Amazon Web Services EMEA SARL) and added two new regional "
             "contact points for South Korea and Brazil. No substantive policy changes.",
             1, 38, 22, 2),
            ("anthropic", ChangeType.TOS_UPDATE, Severity.MAJOR,
             "Anthropic added commercial use restrictions for Claude API",
             "New Section 4(d) prohibits using Claude outputs to build competing foundation "
             "models or to create training datasets for AI systems without explicit written "
             "consent from Anthropic. This applies to all API tiers. The acceptable use policy "
             "was also expanded to include 10 new prohibited categories including autonomous "
             "weapons and large-scale behavior manipulation.",
             6, 489, 130, 2),
        ]

        FAKE_OLD = (
            "These Terms of Service govern your use of our platform. "
            "By using our services you agree to these terms. "
            "We reserve the right to modify these terms at any time. "
            "Your continued use constitutes acceptance of any changes. " * 50
        )

        for slug, ctype, sev, title, summary, sects, w_add, w_rem, days_ago in DEMO:
            r = await db.execute(_sel(Service).where(Service.slug == slug))
            svc = r.scalar_one_or_none()
            if not svc:
                continue

            detected = _dt.now(_tz.utc) - timedelta(days=days_ago)
            fake_new = FAKE_OLD + f"\n\nUPDATED {title} — effective {detected.date()}."
            old_h = hashlib.sha256(FAKE_OLD.encode()).hexdigest()
            new_h = hashlib.sha256(fake_new.encode()).hexdigest()

            snap_old = Snapshot(service_id=svc.id, url=svc.tos_url or "", content_hash=old_h, content=FAKE_OLD, word_count=len(FAKE_OLD.split()))
            snap_new = Snapshot(service_id=svc.id, url=svc.tos_url or "", content_hash=new_h, content=fake_new, word_count=len(fake_new.split()))
            db.add(snap_old)
            db.add(snap_new)
            await db.flush()

            db.add(Change(
                service_id=svc.id, snapshot_old_id=snap_old.id, snapshot_new_id=snap_new.id,
                change_type=ctype, severity=sev, title=title, summary=summary,
                diff_html=f"<del>{FAKE_OLD[:200]}</del><ins>{fake_new[:200]}</ins>",
                sections_changed=sects, words_added=w_add, words_removed=w_rem, detected_at=detected,
            ))

        await db.commit()
        logger.info(f"Auto-seed: inserted {len(DEMO)} demo changes")


# ── App ──────────────────────────────────────────────────────

app = FastAPI(
    title="ToS Monitor API",
    description="Track Terms of Service and Privacy Policy changes across SaaS services.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        settings.APP_URL,
        "https://tos.inksky.net",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(changes.router, prefix="/api")
app.include_router(billing.router, prefix="/api")


# ── Health check ─────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "scheduler_running": scheduler.running,
    }


@app.post("/api/admin/scan")
async def trigger_scan():
    """Manually trigger a full scan (admin endpoint)."""
    from app.scraper.scheduler import run_full_scan

    changes = await run_full_scan()
    return {
        "status": "completed",
        "changes_detected": len(changes),
    }


@app.post("/api/admin/seed-demo")
async def seed_demo_changes(reset: bool = False):
    """
    Insert realistic demo change records so the dashboard isn't empty.
    Safe to call multiple times — skips services that already have changes.
    """
    import hashlib
    import uuid as _uuid
    from datetime import datetime as _dt, timedelta, timezone as _tz

    from sqlalchemy import select as _select, delete as _delete

    from app.database import async_session
    from app.models import Change, ChangeType, Severity, Snapshot, Service

    DEMO = [
        {
            "slug": "stripe",
            "change_type": ChangeType.TOS_UPDATE,
            "severity": Severity.MAJOR,
            "title": "Stripe updated payment dispute and liability clauses",
            "summary": (
                "Stripe revised Section 14 (Disputes and Reversals) to reduce the window "
                "for merchants to respond to chargebacks from 10 days to 7 days. "
                "New language also clarifies that Stripe may debit funds from your account "
                "immediately upon receiving a dispute claim, without waiting for resolution. "
                "The liability cap in Section 19 was lowered from 12 months of fees to 3 months."
            ),
            "sections_changed": 3,
            "words_added": 142,
            "words_removed": 87,
            "days_ago": 0,
        },
        {
            "slug": "openai",
            "change_type": ChangeType.TOS_UPDATE,
            "severity": Severity.CRITICAL,
            "title": "OpenAI expanded rights to use API outputs for model training",
            "summary": (
                "OpenAI's updated Terms now explicitly state that outputs generated via the API "
                "(including completions, embeddings, and fine-tuning outputs) may be used to "
                "improve and train OpenAI models unless you have a Zero Data Retention agreement. "
                "Enterprise customers are unaffected but standard API users should review their "
                "data handling obligations. Section 3(c) was significantly rewritten."
            ),
            "sections_changed": 5,
            "words_added": 318,
            "words_removed": 201,
            "days_ago": 0,
        },
        {
            "slug": "github",
            "change_type": ChangeType.PRIVACY_UPDATE,
            "severity": Severity.MINOR,
            "title": "GitHub added Copilot telemetry data collection details",
            "summary": (
                "GitHub updated its Privacy Statement to add a new subsection on GitHub Copilot "
                "telemetry: keystroke timings, suggestion acceptance rates, and editor context "
                "are now explicitly listed as collected data. Users can opt out via Copilot "
                "settings. The retention period for this data is stated as 24 months."
            ),
            "sections_changed": 2,
            "words_added": 94,
            "words_removed": 12,
            "days_ago": 1,
        },
        {
            "slug": "slack",
            "change_type": ChangeType.TOS_UPDATE,
            "severity": Severity.MAJOR,
            "title": "Slack introduced AI features clauses and data processing changes",
            "summary": (
                "Slack's updated Terms introduce a new Section 8 (Slack AI) permitting Slack "
                "to process customer data to deliver AI-powered features. Workspace admins can "
                "disable this via settings, but it is enabled by default for all plans. "
                "The DPA (Data Processing Agreement) was also updated with new sub-processor "
                "entries including two new AWS regions."
            ),
            "sections_changed": 4,
            "words_added": 267,
            "words_removed": 43,
            "days_ago": 1,
        },
        {
            "slug": "aws",
            "change_type": ChangeType.PRIVACY_UPDATE,
            "severity": Severity.PATCH,
            "title": "AWS updated contact information and data controller details",
            "summary": (
                "Minor update to the AWS Privacy Notice: updated mailing address for the EU "
                "data controller (Amazon Web Services EMEA SARL) and added two new regional "
                "contact points for South Korea and Brazil. No substantive policy changes."
            ),
            "sections_changed": 1,
            "words_added": 38,
            "words_removed": 22,
            "days_ago": 2,
        },
        {
            "slug": "anthropic",
            "change_type": ChangeType.TOS_UPDATE,
            "severity": Severity.MAJOR,
            "title": "Anthropic added commercial use restrictions for Claude API",
            "summary": (
                "New Section 4(d) prohibits using Claude outputs to build competing foundation "
                "models or to create training datasets for AI systems without explicit written "
                "consent from Anthropic. This applies to all API tiers. The acceptable use policy "
                "was also expanded to include 10 new prohibited categories including autonomous "
                "weapons and large-scale behavior manipulation."
            ),
            "sections_changed": 6,
            "words_added": 489,
            "words_removed": 130,
            "days_ago": 2,
        },
    ]

    FAKE_OLD = (
        "These Terms of Service govern your use of our platform. "
        "By using our services you agree to these terms. "
        "We reserve the right to modify these terms at any time. "
        "Your continued use constitutes acceptance of any changes. " * 50
    )

    added = 0
    skipped = 0

    async with async_session() as db:
        if reset:
            # Delete all existing changes and their snapshots for demo slugs
            demo_slugs = [d["slug"] for d in DEMO]
            for slug in demo_slugs:
                r = await db.execute(_select(Service).where(Service.slug == slug))
                svc = r.scalar_one_or_none()
                if svc:
                    await db.execute(_delete(Change).where(Change.service_id == svc.id))
                    await db.execute(_delete(Snapshot).where(Snapshot.service_id == svc.id))
            await db.commit()

        for demo in DEMO:
            # Check if this service already has changes
            svc_result = await db.execute(
                _select(Service).where(Service.slug == demo["slug"])
            )
            service = svc_result.scalar_one_or_none()
            if not service:
                skipped += 1
                continue

            existing = await db.execute(
                _select(Change).where(Change.service_id == service.id).limit(1)
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            detected = _dt.now(_tz.utc) - timedelta(days=demo["days_ago"])
            fake_new = FAKE_OLD + f"\n\nUPDATED {demo['title']} — effective {detected.date()}."

            old_hash = hashlib.sha256(FAKE_OLD.encode()).hexdigest()
            new_hash = hashlib.sha256(fake_new.encode()).hexdigest()

            snap_old = Snapshot(
                service_id=service.id,
                url=service.tos_url or f"https://example.com/{demo['slug']}/terms",
                content_hash=old_hash,
                content=FAKE_OLD,
                word_count=len(FAKE_OLD.split()),
            )
            snap_new = Snapshot(
                service_id=service.id,
                url=service.tos_url or f"https://example.com/{demo['slug']}/terms",
                content_hash=new_hash,
                content=fake_new,
                word_count=len(fake_new.split()),
            )
            db.add(snap_old)
            db.add(snap_new)
            await db.flush()

            change = Change(
                service_id=service.id,
                snapshot_old_id=snap_old.id,
                snapshot_new_id=snap_new.id,
                change_type=demo["change_type"],
                severity=demo["severity"],
                title=demo["title"],
                summary=demo["summary"],
                diff_html=f"<del>{FAKE_OLD[:200]}</del><ins>{fake_new[:200]}</ins>",
                sections_changed=demo["sections_changed"],
                words_added=demo["words_added"],
                words_removed=demo["words_removed"],
                detected_at=detected,
            )
            db.add(change)
            await db.commit()
            added += 1

    return {"status": "ok", "added": added, "skipped": skipped}


