"""Stripe billing — checkout, webhook, portal."""

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Plan

router = APIRouter(prefix="/billing", tags=["billing"])


def _stripe_client() -> stripe.StripeClient:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing not configured")
    return stripe.StripeClient(settings.STRIPE_SECRET_KEY)


PLAN_PRICE_MAP = {
    "pro": lambda: settings.STRIPE_PRICE_PRO,
    "business": lambda: settings.STRIPE_PRICE_BUSINESS,
}


@router.post("/checkout/{plan}")
async def create_checkout(
    plan: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session and return the redirect URL."""
    plan = plan.lower()
    if plan not in PLAN_PRICE_MAP:
        raise HTTPException(status_code=400, detail="Invalid plan. Use 'pro' or 'business'.")

    price_id = PLAN_PRICE_MAP[plan]()
    if not price_id:
        raise HTTPException(status_code=503, detail="Plan pricing not configured")

    client = _stripe_client()

    # Create / reuse Stripe customer
    customer_id = current_user.stripe_customer_id
    if not customer_id:
        customer = client.customers.create(
            params={"email": current_user.email, "metadata": {"user_id": str(current_user.id)}}
        )
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        await db.commit()

    session = client.checkout.sessions.create(
        params={
            "customer": customer_id,
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{settings.APP_URL}/dashboard?upgraded=1",
            "cancel_url": f"{settings.APP_URL}/pricing",
            "metadata": {"user_id": str(current_user.id), "plan": plan},
        }
    )
    return {"url": session.url}


@router.get("/portal")
async def billing_portal(
    current_user: User = Depends(get_current_user),
):
    """Redirect to Stripe Customer Portal for subscription management."""
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    client = _stripe_client()
    session = client.billing_portal.sessions.create(
        params={
            "customer": current_user.stripe_customer_id,
            "return_url": f"{settings.APP_URL}/dashboard",
        }
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan_name = session.get("metadata", {}).get("plan", "pro")
        customer_id = session.get("customer")

        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.plan = Plan(plan_name)
                if customer_id:
                    user.stripe_customer_id = customer_id
                await db.commit()

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        sub_status = subscription.get("status")

        result = await db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        )
        user = result.scalar_one_or_none()

        if user:
            if event_type == "customer.subscription.deleted" or sub_status in ("canceled", "unpaid", "incomplete_expired"):
                user.plan = Plan.FREE
            elif sub_status == "active":
                # Re-derive plan from the price ID
                items = subscription.get("items", {}).get("data", [])
                if items:
                    price_id = items[0].get("price", {}).get("id", "")
                    if price_id == settings.STRIPE_PRICE_BUSINESS:
                        user.plan = Plan.BUSINESS
                    elif price_id == settings.STRIPE_PRICE_PRO:
                        user.plan = Plan.PRO
            await db.commit()

    return JSONResponse({"received": True})
