"""
Change Summarizer — uses LLM to generate plain-language summaries of ToS changes.

This is what makes the product valuable: instead of a raw diff,
users get "Stripe added a clause allowing them to use your data for AI training."
"""

import logging

import httpx

from app.config import get_settings
from app.models import Severity

logger = logging.getLogger(__name__)
settings = get_settings()


SYSTEM_PROMPT = """You are a legal policy analyst. Given a diff of changes to a Terms of Service or Privacy Policy document, produce:

1. A clear, one-line TITLE (max 80 chars) describing the most important change
2. A plain-language SUMMARY (2-4 sentences) explaining what changed and why it matters to users/businesses
3. A SEVERITY rating: critical, major, minor, or patch

Severity Guide:
- critical: Data usage changes (AI training, selling data), liability changes, forced arbitration
- major: Pricing changes, service limits, new restrictions
- minor: Clarification of existing terms, formatting changes with substance
- patch: Typo fixes, formatting-only changes

Respond in JSON format:
{"title": "...", "summary": "...", "severity": "critical|major|minor|patch"}"""


async def summarize_change(
    service_name: str,
    old_text: str,
    new_text: str,
    diff_sections: list[dict] | None = None,
) -> dict:
    """
    Generate an LLM-powered summary of a ToS/privacy change.

    Returns: {"title": str, "summary": str, "severity": Severity}
    """
    # Build the prompt with context
    prompt_parts = [f"Service: {service_name}\n"]

    if diff_sections:
        prompt_parts.append("Changed sections:\n")
        for section in diff_sections[:10]:  # Limit context length
            if section.get("old_text"):
                prompt_parts.append(f"REMOVED:\n{section['old_text'][:500]}\n")
            if section.get("new_text"):
                prompt_parts.append(f"ADDED:\n{section['new_text'][:500]}\n")
            prompt_parts.append("---\n")
    else:
        # Fallback: send truncated full texts
        prompt_parts.append(f"Previous version (excerpt):\n{old_text[:1500]}\n\n")
        prompt_parts.append(f"New version (excerpt):\n{new_text[:1500]}\n")

    user_msg = "".join(prompt_parts)

    try:
        if settings.LLM_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
            return await _summarize_anthropic(user_msg)
        elif settings.OPENAI_API_KEY:
            return await _summarize_openai(user_msg)
        else:
            return _fallback_summary(service_name)
    except Exception as e:
        logger.error(f"LLM summarization failed: {e}")
        return _fallback_summary(service_name)


async def _summarize_openai(user_msg: str) -> dict:
    """Call OpenAI API for summarization."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={
                "model": settings.OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
                "max_tokens": 500,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        import json
        result = json.loads(data["choices"][0]["message"]["content"])
        return _normalize_result(result)


async def _summarize_anthropic(user_msg: str) -> dict:
    """Call Anthropic API for summarization."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.ANTHROPIC_MODEL,
                "max_tokens": 500,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_msg}],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        import json
        text = data["content"][0]["text"]
        # Extract JSON from response
        start = text.find("{")
        end = text.rfind("}") + 1
        result = json.loads(text[start:end])
        return _normalize_result(result)


def _normalize_result(result: dict) -> dict:
    """Normalize LLM response to expected format."""
    severity_map = {
        "critical": Severity.CRITICAL,
        "major": Severity.MAJOR,
        "minor": Severity.MINOR,
        "patch": Severity.PATCH,
    }
    return {
        "title": result.get("title", "Policy change detected")[:500],
        "summary": result.get("summary", "A change was detected in the policy document."),
        "severity": severity_map.get(
            result.get("severity", "minor").lower(), Severity.MINOR
        ),
    }


def _fallback_summary(service_name: str) -> dict:
    """Fallback when LLM is unavailable."""
    return {
        "title": f"{service_name} policy updated",
        "summary": f"A change was detected in {service_name}'s policy. Review the diff for details.",
        "severity": Severity.MINOR,
    }
