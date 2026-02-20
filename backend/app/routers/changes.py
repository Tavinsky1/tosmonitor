"""
Changes Router — list detected changes, get details + diffs.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_optional_user
from app.models import Change, Service, Snapshot, Subscription, User
from app.schemas import ChangeDetail, ChangeFeed, ChangeOut, DashboardStats
from app.tiers import get_limits, get_upgrade_reason

router = APIRouter(prefix="/changes", tags=["changes"])


@router.get("", response_model=ChangeFeed)
async def list_changes(
    service_slug: str | None = None,
    severity: str | None = None,
    days: int = Query(30, ge=1, le=365),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """List detected changes with optional filters."""
    # Tier gate: clamp history window for free users
    if user:
        max_days = get_limits(user.plan).history_days
        days = min(days, max_days)
    else:
        days = min(days, 3)  # Anonymous = free-tier visibility

    query = (
        select(Change, Service.name, Service.slug)
        .join(Service, Change.service_id == Service.id)
    )

    # Filters
    since = datetime.now(timezone.utc) - timedelta(days=days)
    query = query.where(Change.detected_at >= since)

    if service_slug:
        query = query.where(Service.slug == service_slug)
    if severity:
        query = query.where(Change.severity == severity)

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    query = (
        query.order_by(Change.detected_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)

    changes = []
    for change, svc_name, svc_slug in result.all():
        out = ChangeOut.model_validate(change)
        out.service_name = svc_name
        out.service_slug = svc_slug
        changes.append(out)

    return ChangeFeed(changes=changes, total=total, page=page, per_page=per_page)


@router.get("/feed")
async def public_feed(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Public change feed (no auth required). Powers SEO pages and embeds."""
    result = await db.execute(
        select(Change, Service.name, Service.slug)
        .join(Service, Change.service_id == Service.id)
        .order_by(Change.detected_at.desc())
        .limit(limit)
    )

    return [
        {
            "id": str(change.id),
            "service": svc_name,
            "service_slug": svc_slug,
            "title": change.title,
            "summary": change.summary,
            "severity": change.severity.value,
            "change_type": change.change_type.value,
            "detected_at": change.detected_at.isoformat(),
        }
        for change, svc_name, svc_slug in result.all()
    ]


@router.get("/{change_id}", response_model=ChangeDetail)
async def get_change(
    change_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Get full change details including diff."""
    result = await db.execute(
        select(Change, Service.name, Service.slug)
        .join(Service, Change.service_id == Service.id)
        .where(Change.id == change_id)
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Change not found")

    change, svc_name, svc_slug = row
    out = ChangeDetail.model_validate(change)
    out.service_name = svc_name
    out.service_slug = svc_slug

    # Tier gate: diff viewer requires Pro+
    if user:
        diff_reason = get_upgrade_reason(user.plan, "diff_viewer")
        if diff_reason:
            out.diff_html = None  # Strip diff for free users
            out.upgrade_hint = diff_reason
    else:
        out.diff_html = None

    # Include full content for authenticated Pro+ users
    if user and get_limits(user.plan).can_view_diff:
        if change.snapshot_old_id:
            old_snap = await db.execute(
                select(Snapshot).where(Snapshot.id == change.snapshot_old_id)
            )
            old = old_snap.scalar_one_or_none()
            if old:
                out.old_content = old.content

        if change.snapshot_new_id:
            new_snap = await db.execute(
                select(Snapshot).where(Snapshot.id == change.snapshot_new_id)
            )
            new = new_snap.scalar_one_or_none()
            if new:
                out.new_content = new.content

    return out


@router.get("/service/{service_slug}", response_model=ChangeFeed)
async def changes_by_service(
    service_slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get all changes for a specific service."""
    query = (
        select(Change, Service.name, Service.slug)
        .join(Service, Change.service_id == Service.id)
        .where(Service.slug == service_slug)
        .order_by(Change.detected_at.desc())
    )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)

    changes = []
    for change, svc_name, svc_slug in result.all():
        out = ChangeOut.model_validate(change)
        out.service_name = svc_name
        out.service_slug = svc_slug
        changes.append(out)

    return ChangeFeed(changes=changes, total=total, page=page, per_page=per_page)


# ── Dashboard Stats ──────────────────────────────────────────


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard statistics for the current user."""
    now = datetime.now(timezone.utc)

    # Total services
    total_svc = (await db.execute(
        select(func.count(Service.id)).where(Service.is_active == True)
    )).scalar() or 0

    # Total changes
    total_changes = (await db.execute(
        select(func.count(Change.id))
    )).scalar() or 0

    # Changes last 7 days
    changes_7d = (await db.execute(
        select(func.count(Change.id)).where(
            Change.detected_at >= now - timedelta(days=7)
        )
    )).scalar() or 0

    # Changes last 30 days
    changes_30d = (await db.execute(
        select(func.count(Change.id)).where(
            Change.detected_at >= now - timedelta(days=30)
        )
    )).scalar() or 0

    # User subscriptions
    user_subs = (await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.user_id == user.id
        )
    )).scalar() or 0

    # Critical changes in user's subscriptions (last 7 days)
    critical = (await db.execute(
        select(func.count(Change.id))
        .join(Subscription, Change.service_id == Subscription.service_id)
        .where(
            Subscription.user_id == user.id,
            Change.severity == "critical",
            Change.detected_at >= now - timedelta(days=7),
        )
    )).scalar() or 0

    return DashboardStats(
        total_services_monitored=total_svc,
        total_changes_detected=total_changes,
        changes_last_7_days=changes_7d,
        changes_last_30_days=changes_30d,
        user_subscriptions=user_subs,
        critical_changes_unread=critical,
    )
