"""
Sales Agent Bridge — feeds detected changes into the sales-agent pipeline.

This is the glue that makes the two projects work together:
  tos-monitor detects a change → writes it to sales-agent's data format
  → sales-agent's content_agent picks it up → generates tweets/posts
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from app.config import get_settings
from app.models import Change, Service

logger = logging.getLogger(__name__)
settings = get_settings()


async def push_changes(changes: list[Change]):
    """
    Push detected changes to the sales-agent pipeline.

    Writes changes to a JSON file that the sales-agent's content_agent reads.
    This is a simple file-based bridge; upgrade to a message queue for production.
    """
    if not settings.SALES_AGENT_DATA_DIR:
        logger.debug("SALES_AGENT_DATA_DIR not set, skipping sales bridge")
        return

    data_dir = Path(settings.SALES_AGENT_DATA_DIR)
    if not data_dir.exists():
        logger.warning(f"Sales agent data dir not found: {data_dir}")
        return

    changes_file = data_dir / "product_changes.json"

    # Read existing changes
    existing = []
    if changes_file.exists():
        try:
            existing = json.loads(changes_file.read_text())
        except (json.JSONDecodeError, OSError):
            existing = []

    # Convert new changes to sales-agent format
    from app.database import async_session
    from sqlalchemy import select

    async with async_session() as db:
        for change in changes:
            # Get service info
            result = await db.execute(
                select(Service).where(Service.id == change.service_id)
            )
            service = result.scalar_one_or_none()
            if not service:
                continue

            entry = {
                "id": str(change.id),
                "service": service.name,
                "type": change.change_type.value,
                "summary": change.summary,
                "title": change.title,
                "severity": change.severity.value,
                "date": change.detected_at.isoformat() if change.detected_at else datetime.now(timezone.utc).isoformat(),
                "sections_changed": change.sections_changed,
                "words_added": change.words_added,
                "words_removed": change.words_removed,
                "url": f"{settings.APP_URL}/changes/{change.id}",
                "pushed_at": datetime.now(timezone.utc).isoformat(),
            }
            existing.append(entry)

    # Write back (keep last 200 entries)
    existing = existing[-200:]
    changes_file.write_text(json.dumps(existing, indent=2))

    logger.info(f"Pushed {len(changes)} changes to sales agent at {changes_file}")
