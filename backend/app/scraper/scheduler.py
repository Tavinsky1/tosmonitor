"""
Scraper Scheduler — periodically checks all active services for changes.

This is the core loop:
1. Fetch each service's ToS/privacy pages
2. Compare with previous snapshot
3. If changed → create Change record, trigger alerts, feed sales agent
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models import Change, ChangeType, Service, Snapshot
from app.scraper.fetcher import fetch_page
from app.scraper.differ import compute_diff
from app.scraper.summarizer import summarize_change

logger = logging.getLogger(__name__)
settings = get_settings()


async def check_service(service: Service, db: AsyncSession) -> list[Change]:
    """
    Check a single service for ToS/privacy changes.
    Returns list of new Change objects (empty if no changes).
    """
    changes = []

    urls_to_check = []
    if service.tos_url:
        urls_to_check.append(("tos", service.tos_url, ChangeType.TOS_UPDATE))
    if service.privacy_url:
        urls_to_check.append(("privacy", service.privacy_url, ChangeType.PRIVACY_UPDATE))

    for doc_type, url, change_type in urls_to_check:
        try:
            # Fetch current page
            result = await fetch_page(url)
            if result["status"] != "ok":
                logger.warning(f"Failed to fetch {url}: {result['error']}")
                continue

            # Get previous snapshot for this URL
            prev_snapshot = await _get_latest_snapshot(db, service.id, url)

            # Save new snapshot
            new_snapshot = Snapshot(
                service_id=service.id,
                url=url,
                content_hash=result["content_hash"],
                content=result["content"],
                word_count=result["word_count"],
            )
            db.add(new_snapshot)
            await db.flush()  # Get the ID

            # Compare
            if prev_snapshot is None:
                logger.info(f"First snapshot for {service.name} ({doc_type})")
                continue

            if prev_snapshot.content_hash == result["content_hash"]:
                logger.debug(f"No changes for {service.name} ({doc_type})")
                continue

            # Compute diff
            diff = compute_diff(prev_snapshot.content, result["content"])

            if not diff.has_changes:
                continue

            # Skip near-identical changes (e.g., dynamic date in footer)
            if diff.similarity_ratio > 0.995:
                logger.debug(f"Trivial change for {service.name} ({doc_type}), skipping")
                continue

            # Generate LLM summary
            section_dicts = [
                {"old_text": s.old_text, "new_text": s.new_text, "heading": s.heading}
                for s in diff.sections
            ]
            summary = await summarize_change(
                service_name=service.name,
                old_text=prev_snapshot.content,
                new_text=result["content"],
                diff_sections=section_dicts,
            )

            # Create change record
            change = Change(
                service_id=service.id,
                snapshot_old_id=prev_snapshot.id,
                snapshot_new_id=new_snapshot.id,
                change_type=change_type,
                severity=summary["severity"],
                title=summary["title"],
                summary=summary["summary"],
                diff_html=diff.diff_html,
                sections_changed=diff.sections_changed,
                words_added=diff.words_added,
                words_removed=diff.words_removed,
            )
            db.add(change)
            changes.append(change)

            logger.info(
                f"Change detected: {service.name} ({doc_type}) — "
                f"severity={summary['severity'].value}, sections={diff.sections_changed}"
            )

        except Exception as e:
            logger.exception(f"Error checking {service.name} ({doc_type}): {e}")

    # Update last-checked timestamp via explicit UPDATE (works even with detached service object)
    from sqlalchemy import update as _update
    await db.execute(
        _update(Service)
        .where(Service.id == service.id)
        .values(last_checked_at=datetime.now(timezone.utc))
    )

    return changes


async def _get_latest_snapshot(
    db: AsyncSession, service_id, url: str
) -> Snapshot | None:
    """Get the most recent snapshot for a service+URL."""
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.service_id == service_id, Snapshot.url == url)
        .order_by(Snapshot.fetched_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def run_full_scan():
    """
    Check ALL active services for changes.
    Called by APScheduler on a timer.
    """
    logger.info("Starting full scan...")

    # Fetch service list in its own session so it's committed/closed cleanly
    async with async_session() as db:
        result = await db.execute(
            select(Service).where(Service.is_active == True)
        )
        services = result.scalars().all()

    logger.info(f"Checking {len(services)} services")

    all_changes = []
    for service in services:
        # Each service gets its OWN session — a failure in one never affects another
        try:
            async with async_session() as db:
                changes = await check_service(service, db)
                await db.commit()  # Commit snapshots + changes + last_checked_at per service
                all_changes.extend(changes)
        except Exception as e:
            logger.exception(f"Error scanning {service.name}: {e}")

        await asyncio.sleep(2)  # Rate limit between services

    logger.info(
        f"Scan complete: {len(services)} services checked, "
        f"{len(all_changes)} changes detected"
    )

    # Trigger alerts for new changes (using a fresh session)
    if all_changes:
        async with async_session() as db:
            from app.services.alerts import send_alerts_for_changes
            await send_alerts_for_changes(all_changes, db)
            await db.commit()

        # Feed sales agent
        if settings.SALES_AGENT_ENABLED:
            from app.services.sales_bridge import push_changes
            await push_changes(all_changes)

    return all_changes

