"""
Services Router — list services, subscribe/unsubscribe.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_optional_user
from app.models import Service, Subscription, User
from app.schemas import ServiceList, ServiceOut, SubscriptionCreate, SubscriptionOut
from app.tiers import can_subscribe_more, get_limits, get_upgrade_reason

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=ServiceList)
async def list_services(
    category: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """List all monitored services with optional filtering."""
    query = select(Service).where(Service.is_active == True)

    if category:
        query = query.where(Service.category == category)
    if search:
        query = query.where(Service.name.ilike(f"%{search}%"))

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    query = query.order_by(Service.name).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    services = result.scalars().all()

    # Get subscriber counts
    sub_counts = {}
    if services:
        svc_ids = [s.id for s in services]
        count_result = await db.execute(
            select(Subscription.service_id, func.count(Subscription.id))
            .where(Subscription.service_id.in_(svc_ids))
            .group_by(Subscription.service_id)
        )
        sub_counts = dict(count_result.all())

    service_list = []
    for svc in services:
        out = ServiceOut.model_validate(svc)
        out.subscriber_count = sub_counts.get(svc.id, 0)
        service_list.append(out)

    return ServiceList(services=service_list, total=total)


@router.get("/{slug}", response_model=ServiceOut)
async def get_service(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single service by slug."""
    result = await db.execute(select(Service).where(Service.slug == slug))
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Get subscriber count
    count_result = await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.service_id == service.id
        )
    )
    out = ServiceOut.model_validate(service)
    out.subscriber_count = count_result.scalar() or 0

    return out


@router.get("/categories/list")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Get all available service categories."""
    result = await db.execute(
        select(Service.category, func.count(Service.id))
        .where(Service.is_active == True, Service.category.isnot(None))
        .group_by(Service.category)
        .order_by(Service.category)
    )
    return [{"name": row[0], "count": row[1]} for row in result.all()]


# ── Subscriptions ────────────────────────────────────────────


@router.post("/subscribe", response_model=SubscriptionOut, status_code=201)
async def subscribe(
    body: SubscriptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Subscribe to change alerts for a service."""
    # ── Tier gate: check subscription limit ─────────────
    current_count = (await db.execute(
        select(func.count(Subscription.id)).where(Subscription.user_id == user.id)
    )).scalar() or 0

    if not can_subscribe_more(user.plan, current_count):
        limits = get_limits(user.plan)
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your {user.plan.value} plan allows {limits.max_services} subscriptions. "
                f"Upgrade to Pro ($19/mo) for up to 15 services."
            ),
        )

    # ── Tier gate: webhook access ────────────────────────
    if body.notify_webhook:
        reason = get_upgrade_reason(user.plan, "webhook")
        if reason:
            raise HTTPException(status_code=403, detail=reason)

    # Check service exists
    svc = await db.execute(select(Service).where(Service.id == body.service_id))
    service = svc.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Check existing subscription
    existing = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.service_id == body.service_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already subscribed")

    sub = Subscription(
        user_id=user.id,
        service_id=body.service_id,
        notify_email=body.notify_email,
        notify_webhook=body.notify_webhook,
        webhook_url=body.webhook_url,
    )
    db.add(sub)
    await db.flush()

    out = SubscriptionOut.model_validate(sub)
    out.service_name = service.name
    return out


@router.delete("/unsubscribe/{service_id}", status_code=204)
async def unsubscribe(
    service_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unsubscribe from a service."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.service_id == service_id,
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)


@router.get("/me/subscriptions", response_model=list[SubscriptionOut])
async def my_subscriptions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's subscriptions."""
    result = await db.execute(
        select(Subscription, Service.name)
        .join(Service, Subscription.service_id == Service.id)
        .where(Subscription.user_id == user.id)
        .order_by(Service.name)
    )
    subs = []
    for sub, svc_name in result.all():
        out = SubscriptionOut.model_validate(sub)
        out.service_name = svc_name
        subs.append(out)
    return subs
