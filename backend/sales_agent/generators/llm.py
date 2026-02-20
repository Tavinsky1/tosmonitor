"""
LLM generator — uses Groq (same key as the main app) to draft replies.
Falls back to a template if Groq is unavailable.
"""
from __future__ import annotations

import os
import httpx
from typing import Any

from sales_agent.config import REPLY_PROMPT, PRODUCT_URL

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama3-8b-8192"


async def generate_reply(opportunity: dict[str, Any]) -> str | None:
    """
    Generate a helpful reply draft for a given opportunity.
    Returns None if the opportunity is not worth engaging with.
    """
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        print("[LLM] GROQ_API_KEY not set — using fallback template")
        return _fallback_reply(opportunity)

    prompt = REPLY_PROMPT.format(
        title=opportunity.get("title", ""),
        content=opportunity.get("content", ""),
        platform=opportunity.get("platform", ""),
        url=PRODUCT_URL,
    )

    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 300,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(GROQ_API_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"].strip()

            if reply.lower() in ("none", "none.", ""):
                return None
            return reply
    except Exception as exc:
        print(f"[LLM] Groq error: {exc} — using fallback")
        return _fallback_reply(opportunity)


def _fallback_reply(opportunity: dict[str, Any]) -> str:
    """Minimal template when LLM is unavailable."""
    return (
        f"Great point! This is exactly why I built {PRODUCT_URL} — "
        "it tracks ToS and Privacy Policy changes across 47+ SaaS tools "
        "and sends instant plain-English alerts. Free tier available."
    )
