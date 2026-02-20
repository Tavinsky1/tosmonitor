"""
Tier Limits — defines what each plan can and cannot do.

Tier philosophy:
  - FREE: Evaluation mode. 2 services, no real-time alerts, 3-day history.
    User must check the dashboard manually. The friction converts.
  - PRO:  Power user. 15 services, real-time email, full history, diff viewer.
  - TEAM: Organization. Unlimited services, Slack/webhook, API access, 5 seats.
"""

from dataclasses import dataclass
from app.models import Plan


@dataclass(frozen=True)
class TierLimits:
    max_services: int          # How many services they can subscribe to
    history_days: int          # How many days of change history they see
    realtime_alerts: bool      # Real-time email? Or weekly digest only
    can_view_diff: bool        # Can they see the visual diff view?
    can_export: bool           # Can they export/download data?
    can_api: bool              # Can they call the API programmatically?
    can_webhook: bool          # Can they use Slack/webhook alerts?
    can_invite_team: bool      # Can they add team members?
    max_seats: int             # Team seats (1 = solo)
    digest_frequency: str      # "none" | "weekly" | "daily" | "realtime"


PLAN_LIMITS: dict[Plan, TierLimits] = {
    Plan.FREE: TierLimits(
        max_services=2,
        history_days=3,
        realtime_alerts=False,
        can_view_diff=False,
        can_export=False,
        can_api=False,
        can_webhook=False,
        can_invite_team=False,
        max_seats=1,
        digest_frequency="weekly",
    ),
    Plan.PRO: TierLimits(
        max_services=15,
        history_days=365,
        realtime_alerts=True,
        can_view_diff=True,
        can_export=True,
        can_api=True,
        can_webhook=False,
        can_invite_team=False,
        max_seats=1,
        digest_frequency="realtime",
    ),
    Plan.BUSINESS: TierLimits(
        max_services=999,  # Effectively unlimited
        history_days=365 * 3,
        realtime_alerts=True,
        can_view_diff=True,
        can_export=True,
        can_api=True,
        can_webhook=True,
        can_invite_team=True,
        max_seats=5,
        digest_frequency="realtime",
    ),
}


def get_limits(plan: Plan) -> TierLimits:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[Plan.FREE])


def can_subscribe_more(plan: Plan, current_count: int) -> bool:
    """Check if user can add another subscription."""
    return current_count < get_limits(plan).max_services


def get_upgrade_reason(plan: Plan, feature: str) -> str | None:
    """Return an upgrade message if the feature is gated, else None."""
    limits = get_limits(plan)

    messages = {
        "realtime_alerts": (
            not limits.realtime_alerts,
            "Upgrade to Pro ($19/mo) for real-time email alerts. Free plan gets weekly digests only.",
        ),
        "diff_viewer": (
            not limits.can_view_diff,
            "Upgrade to Pro ($19/mo) to see visual diffs of what changed.",
        ),
        "webhook": (
            not limits.can_webhook,
            "Upgrade to Team ($49/mo) for Slack and webhook integrations.",
        ),
        "export": (
            not limits.can_export,
            "Upgrade to Pro ($19/mo) to export change data.",
        ),
        "api": (
            not limits.can_api,
            "Upgrade to Pro ($19/mo) for API access.",
        ),
    }

    gated, message = messages.get(feature, (False, None))
    return message if gated else None
