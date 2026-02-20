"""
Configuration — loaded from environment / .env file.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────
    APP_NAME: str = "ToS Monitor"
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    DEBUG: bool = False

    # ── Database ────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://tos:tos@localhost:5432/tosmonitor"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Normalize postgres:// (Render/Neon) to postgresql+asyncpg://.
        Also converts sslmode=require -> ssl=require for asyncpg.
        """
        if v.startswith("postgres://"):
            v = "postgresql+asyncpg://" + v[len("postgres://"):]
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        # asyncpg uses ?ssl=require, not ?sslmode=require
        v = v.replace("sslmode=require", "ssl=require")
        v = v.replace("sslmode=prefer", "ssl=prefer")
        return v

    # ── Auth ────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"

    # ── LLM (for change summaries) ──────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-haiku-4-20250514"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-70b-versatile"  # Free tier: 20 req/min
    LLM_PROVIDER: str = "groq"  # "openai", "anthropic", or "groq"

    # ── Scraper ─────────────────────────────────────────────
    SCRAPE_INTERVAL_HOURS: int = 6
    SCRAPE_TIMEOUT_SECONDS: int = 30
    SCRAPE_USER_AGENT: str = "ToSMonitor/1.0 (+https://tosmonitor.com)"
    MAX_CONCURRENT_SCRAPES: int = 5

    # ── Email (Resend) ──────────────────────────────────────
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "alerts@tosmonitor.com"

    # ── Webhooks ────────────────────────────────────────────
    WEBHOOK_TIMEOUT_SECONDS: int = 10

    # ── Sales Agent Bridge ──────────────────────────────────
    SALES_AGENT_ENABLED: bool = True
    SALES_AGENT_DATA_DIR: str = ""  # Path to sales-agent/data/

    # ── Stripe (billing) ────────────────────────────────────
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_PRO: str = ""       # price_xxx for $19/mo
    STRIPE_PRICE_BUSINESS: str = ""  # price_xxx for $49/mo

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Module-level singleton for direct imports
settings: Settings = get_settings()
