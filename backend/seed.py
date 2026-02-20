"""Seed the database with default services to monitor."""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.config import settings
from app.models import Service

DEFAULT_SERVICES = [
    {
        "name": "Stripe",
        "slug": "stripe",
        "category": "Payments",
        "tos_url": "https://stripe.com/legal/ssa",
        "privacy_url": "https://stripe.com/privacy",
    },
    {
        "name": "OpenAI",
        "slug": "openai",
        "category": "AI / ML",
        "tos_url": "https://openai.com/policies/terms-of-use",
        "privacy_url": "https://openai.com/policies/privacy-policy",
    },
    {
        "name": "AWS",
        "slug": "aws",
        "category": "Cloud",
        "tos_url": "https://aws.amazon.com/service-terms/",
        "privacy_url": "https://aws.amazon.com/privacy/",
    },
    {
        "name": "Google Cloud",
        "slug": "google-cloud",
        "category": "Cloud",
        "tos_url": "https://cloud.google.com/terms",
        "privacy_url": "https://policies.google.com/privacy",
    },
    {
        "name": "Vercel",
        "slug": "vercel",
        "category": "DevOps",
        "tos_url": "https://vercel.com/legal/terms",
        "privacy_url": "https://vercel.com/legal/privacy-policy",
    },
    {
        "name": "GitHub",
        "slug": "github",
        "category": "DevOps",
        "tos_url": "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
        "privacy_url": "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
    },
    {
        "name": "Twilio",
        "slug": "twilio",
        "category": "Communications",
        "tos_url": "https://www.twilio.com/en-us/legal/tos",
        "privacy_url": "https://www.twilio.com/en-us/legal/privacy",
    },
    {
        "name": "Shopify",
        "slug": "shopify",
        "category": "E-commerce",
        "tos_url": "https://www.shopify.com/legal/terms",
        "privacy_url": "https://www.shopify.com/legal/privacy",
    },
    {
        "name": "Slack",
        "slug": "slack",
        "category": "Communications",
        "tos_url": "https://slack.com/terms-of-service",
        "privacy_url": "https://slack.com/privacy-policy",
    },
    {
        "name": "Firebase",
        "slug": "firebase",
        "category": "Cloud",
        "tos_url": "https://firebase.google.com/terms",
        "privacy_url": "https://policies.google.com/privacy",
    },
    {
        "name": "Supabase",
        "slug": "supabase",
        "category": "Cloud",
        "tos_url": "https://supabase.com/terms",
        "privacy_url": "https://supabase.com/privacy",
    },
    {
        "name": "Cloudflare",
        "slug": "cloudflare",
        "category": "DevOps",
        "tos_url": "https://www.cloudflare.com/terms/",
        "privacy_url": "https://www.cloudflare.com/privacypolicy/",
    },
    {
        "name": "Anthropic",
        "slug": "anthropic",
        "category": "AI / ML",
        "tos_url": "https://www.anthropic.com/legal/consumer-terms",
        "privacy_url": "https://www.anthropic.com/legal/privacy",
    },
    {
        "name": "MongoDB Atlas",
        "slug": "mongodb-atlas",
        "category": "Database",
        "tos_url": "https://www.mongodb.com/legal/terms-of-use",
        "privacy_url": "https://www.mongodb.com/legal/privacy-policy",
    },
    {
        "name": "Notion",
        "slug": "notion",
        "category": "Productivity",
        "tos_url": "https://www.notion.so/terms",
        "privacy_url": "https://www.notion.so/privacy",
    },
    {
        "name": "Heroku",
        "slug": "heroku",
        "category": "Cloud",
        "tos_url": "https://www.salesforce.com/company/legal/agreements/",
        "privacy_url": "https://www.salesforce.com/company/privacy/",
    },
    {
        "name": "Auth0",
        "slug": "auth0",
        "category": "Auth",
        "tos_url": "https://auth0.com/legal/terms-of-service",
        "privacy_url": "https://auth0.com/privacy",
    },
    {
        "name": "Plaid",
        "slug": "plaid",
        "category": "Fintech",
        "tos_url": "https://plaid.com/legal/",
        "privacy_url": "https://plaid.com/legal/#end-user-privacy-policy",
    },
    {
        "name": "Datadog",
        "slug": "datadog",
        "category": "DevOps",
        "tos_url": "https://www.datadoghq.com/legal/terms/",
        "privacy_url": "https://www.datadoghq.com/legal/privacy/",
    },
    {
        "name": "HubSpot",
        "slug": "hubspot",
        "category": "Marketing",
        "tos_url": "https://legal.hubspot.com/terms-of-service",
        "privacy_url": "https://legal.hubspot.com/privacy-policy",
    },
    # ── Productivity ─────────────────────────────────────────────────────────
    {
        "name": "Linear",
        "slug": "linear",
        "category": "Productivity",
        "tos_url": "https://linear.app/terms",
        "privacy_url": "https://linear.app/privacy",
    },
    {
        "name": "Figma",
        "slug": "figma",
        "category": "Design",
        "tos_url": "https://www.figma.com/tos/",
        "privacy_url": "https://www.figma.com/privacy/",
    },
    {
        "name": "Airtable",
        "slug": "airtable",
        "category": "Productivity",
        "tos_url": "https://www.airtable.com/tos",
        "privacy_url": "https://www.airtable.com/privacy",
    },
    {
        "name": "Asana",
        "slug": "asana",
        "category": "Productivity",
        "tos_url": "https://asana.com/terms",
        "privacy_url": "https://asana.com/privacy",
    },
    {
        "name": "Atlassian",
        "slug": "atlassian",
        "category": "Productivity",
        "tos_url": "https://www.atlassian.com/legal/cloud-terms-of-service",
        "privacy_url": "https://www.atlassian.com/legal/privacy-policy",
    },
    # ── Cloud / Hosting ──────────────────────────────────────────────────────
    {
        "name": "Microsoft Azure",
        "slug": "azure",
        "category": "Cloud",
        "tos_url": "https://azure.microsoft.com/en-us/support/legal/",
        "privacy_url": "https://privacy.microsoft.com/en-us/privacystatement",
    },
    {
        "name": "DigitalOcean",
        "slug": "digitalocean",
        "category": "Cloud",
        "tos_url": "https://www.digitalocean.com/legal/terms-of-service-agreement",
        "privacy_url": "https://www.digitalocean.com/legal/privacy-policy",
    },
    {
        "name": "Netlify",
        "slug": "netlify",
        "category": "DevOps",
        "tos_url": "https://www.netlify.com/legal/terms-of-use/",
        "privacy_url": "https://www.netlify.com/privacy/",
    },
    {
        "name": "Railway",
        "slug": "railway",
        "category": "Cloud",
        "tos_url": "https://railway.app/legal/terms",
        "privacy_url": "https://railway.app/legal/privacy",
    },
    # ── Communications ───────────────────────────────────────────────────────
    {
        "name": "Zoom",
        "slug": "zoom",
        "category": "Communications",
        "tos_url": "https://explore.zoom.us/en/terms/",
        "privacy_url": "https://explore.zoom.us/en/privacy/",
    },
    {
        "name": "SendGrid",
        "slug": "sendgrid",
        "category": "Communications",
        "tos_url": "https://sendgrid.com/policies/tos/",
        "privacy_url": "https://sendgrid.com/policies/privacy/",
    },
    {
        "name": "Mailchimp",
        "slug": "mailchimp",
        "category": "Marketing",
        "tos_url": "https://mailchimp.com/legal/terms/",
        "privacy_url": "https://mailchimp.com/legal/privacy/",
    },
    # ── Observability / DevOps ───────────────────────────────────────────────
    {
        "name": "Sentry",
        "slug": "sentry",
        "category": "DevOps",
        "tos_url": "https://sentry.io/terms/",
        "privacy_url": "https://sentry.io/privacy/",
    },
    {
        "name": "PagerDuty",
        "slug": "pagerduty",
        "category": "DevOps",
        "tos_url": "https://www.pagerduty.com/terms-of-service/",
        "privacy_url": "https://www.pagerduty.com/privacy-policy/",
    },
    # ── Analytics ────────────────────────────────────────────────────────────
    {
        "name": "Mixpanel",
        "slug": "mixpanel",
        "category": "Analytics",
        "tos_url": "https://mixpanel.com/legal/terms-of-use/",
        "privacy_url": "https://mixpanel.com/legal/privacy-policy/",
    },
    {
        "name": "Segment",
        "slug": "segment",
        "category": "Analytics",
        "tos_url": "https://www.twilio.com/en-us/legal/tos",
        "privacy_url": "https://www.twilio.com/en-us/legal/privacy",
    },
    # ── Auth / Identity ──────────────────────────────────────────────────────
    {
        "name": "Okta",
        "slug": "okta",
        "category": "Auth",
        "tos_url": "https://www.okta.com/agreements/",
        "privacy_url": "https://www.okta.com/privacy-policy/",
    },
    # ── CRM / Support ────────────────────────────────────────────────────────
    {
        "name": "Salesforce",
        "slug": "salesforce",
        "category": "CRM",
        "tos_url": "https://www.salesforce.com/company/legal/agreements/",
        "privacy_url": "https://www.salesforce.com/company/privacy/",
    },
    {
        "name": "Zendesk",
        "slug": "zendesk",
        "category": "Support",
        "tos_url": "https://www.zendesk.com/company/agreements-and-terms/main-services-agreement/",
        "privacy_url": "https://www.zendesk.com/company/agreements-and-terms/privacy-notices/",
    },
    {
        "name": "Intercom",
        "slug": "intercom",
        "category": "Support",
        "tos_url": "https://www.intercom.com/legal/terms-and-policies",
        "privacy_url": "https://www.intercom.com/legal/privacy",
    },
    # ── Payments ─────────────────────────────────────────────────────────────
    {
        "name": "PayPal",
        "slug": "paypal",
        "category": "Payments",
        "tos_url": "https://www.paypal.com/us/legalhub/useragreement-full",
        "privacy_url": "https://www.paypal.com/us/legalhub/privacy-full",
    },
    # ── AI / ML ──────────────────────────────────────────────────────────────
    {
        "name": "Mistral AI",
        "slug": "mistral",
        "category": "AI / ML",
        "tos_url": "https://mistral.ai/terms/",
        "privacy_url": "https://mistral.ai/privacy/",
    },
    {
        "name": "Replicate",
        "slug": "replicate",
        "category": "AI / ML",
        "tos_url": "https://replicate.com/terms",
        "privacy_url": "https://replicate.com/privacy",
    },
    {
        "name": "Cohere",
        "slug": "cohere",
        "category": "AI / ML",
        "tos_url": "https://cohere.com/terms-of-use",
        "privacy_url": "https://cohere.com/privacy",
    },
    # ── Database / Storage ───────────────────────────────────────────────────
    {
        "name": "PlanetScale",
        "slug": "planetscale",
        "category": "Database",
        "tos_url": "https://planetscale.com/legal/siteterms",
        "privacy_url": "https://planetscale.com/legal/privacy",
    },
    {
        "name": "Redis Cloud",
        "slug": "redis-cloud",
        "category": "Database",
        "tos_url": "https://redis.io/legal/cloud-tos/",
        "privacy_url": "https://redis.io/legal/privacy-policy/",
    },
    {
        "name": "Pinecone",
        "slug": "pinecone",
        "category": "Database",
        "tos_url": "https://www.pinecone.io/terms/",
        "privacy_url": "https://www.pinecone.io/privacy/",
    },
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    added = 0
    skipped = 0

    async with async_session() as session:
        for svc in DEFAULT_SERVICES:
            result = await session.execute(
                select(Service).where(Service.slug == svc["slug"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                skipped += 1
                continue

            service = Service(
                name=svc["name"],
                slug=svc["slug"],
                category=svc["category"],
                tos_url=svc["tos_url"],
                privacy_url=svc.get("privacy_url"),
                is_active=True,
            )
            session.add(service)
            try:
                await session.commit()
                added += 1
            except Exception:
                await session.rollback()
                skipped += 1

    print(f"✅ Seed complete — {added} added, {skipped} already existed")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
