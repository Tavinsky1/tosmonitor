"""
Pydantic schemas for API request/response validation.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import AlertChannel, ChangeType, Plan, Severity
from app.tiers import get_limits


# ── Auth ─────────────────────────────────────────────────────


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TierInfo(BaseModel):
    plan: Plan
    max_services: int
    history_days: int
    realtime_alerts: bool
    can_view_diff: bool
    can_export: bool
    can_api: bool
    can_webhook: bool
    digest_frequency: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    plan: Plan
    tier: TierInfo | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserOut":
        out = cls.model_validate(user)
        limits = get_limits(user.plan)
        out.tier = TierInfo(
            plan=user.plan,
            max_services=limits.max_services,
            history_days=limits.history_days,
            realtime_alerts=limits.realtime_alerts,
            can_view_diff=limits.can_view_diff,
            can_export=limits.can_export,
            can_api=limits.can_api,
            can_webhook=limits.can_webhook,
            digest_frequency=limits.digest_frequency,
        )
        return out


# ── Services ────────────────────────────────────────────────


class ServiceOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    category: str | None
    logo_url: str | None
    website: str | None
    tos_url: str | None
    privacy_url: str | None
    is_active: bool
    last_checked_at: datetime | None
    created_at: datetime
    subscriber_count: int = 0

    model_config = {"from_attributes": True}


class ServiceList(BaseModel):
    services: list[ServiceOut]
    total: int


# ── Changes ─────────────────────────────────────────────────


class ChangeOut(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    service_name: str = ""
    service_slug: str = ""
    change_type: ChangeType
    severity: Severity
    title: str
    summary: str
    diff_html: str | None
    sections_changed: int
    words_added: int
    words_removed: int
    detected_at: datetime

    model_config = {"from_attributes": True}


class ChangeDetail(ChangeOut):
    old_content: str | None = None
    new_content: str | None = None
    upgrade_hint: str | None = None


class ChangeFeed(BaseModel):
    changes: list[ChangeOut]
    total: int
    page: int
    per_page: int


# ── Subscriptions ───────────────────────────────────────────


class SubscriptionCreate(BaseModel):
    service_id: uuid.UUID
    notify_email: bool = True
    notify_webhook: bool = False
    webhook_url: str | None = None


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    service_name: str = ""
    notify_email: bool
    notify_webhook: bool
    webhook_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard / Stats ───────────────────────────────────────


class DashboardStats(BaseModel):
    total_services_monitored: int
    total_changes_detected: int
    changes_last_7_days: int
    changes_last_30_days: int
    user_subscriptions: int
    critical_changes_unread: int
