"""Seed the database with default services to monitor."""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
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
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for svc in DEFAULT_SERVICES:
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
            print(f"✅ Seeded {len(DEFAULT_SERVICES)} services")
        except Exception as e:
            await session.rollback()
            # ON CONFLICT — services already exist, that's fine
            if "unique" in str(e).lower() or "duplicate" in str(e).lower() or "already" in str(e).lower():
                print("✅ Services already seeded — skipping")
            else:
                print(f"⚠️  Seed failed: {e}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
