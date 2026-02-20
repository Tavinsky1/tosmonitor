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
from app.routers import auth, changes, services

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
    """Start/stop the background scraper scheduler."""
    from app.scraper.scheduler import run_full_scan

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
