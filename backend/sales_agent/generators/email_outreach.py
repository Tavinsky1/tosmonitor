"""
Cold email outreach generator.
- Generates subject lines and body copy
- Optionally uses Hunter.io free tier to find email addresses
  (set HUNTER_API_KEY env var — 50 free searches/month at hunter.io)
"""
from __future__ import annotations

import httpx
import os
import random
from typing import Any

from sales_agent.config import (
    COLD_EMAIL_SUBJECT_LINES,
    COLD_EMAIL_BODY,
    PRODUCT_URL,
    COLD_EMAIL_TARGETS,
)

SENDER_NAME = "Aaron"  # your first name
SENDER_EMAIL = "aaron@inksky.net"  # your sending email
HUNTER_SEARCH_URL = "https://api.hunter.io/v2/domain-search"
HUNTER_FIND_URL   = "https://api.hunter.io/v2/email-finder"


def generate_cold_email(
    name: str = "[First Name]",
    company: str = "[Company]",
    service: str = "Stripe",
) -> dict[str, str]:
    """
    Generate a cold email subject + body for a lead.
    Returns {"subject": ..., "body": ..., "to_name": ..., "to_company": ...}
    """
    subject_template = random.choice(COLD_EMAIL_SUBJECT_LINES)
    subject = subject_template.format(
        service=service, company=company, name=name
    )
    body = COLD_EMAIL_BODY.format(
        name=name,
        company=company,
        url=PRODUCT_URL,
        sender_name=SENDER_NAME,
    )
    return {
        "subject": subject,
        "body": body,
        "to_name": name,
        "to_company": company,
        "from": f"{SENDER_NAME} <{SENDER_EMAIL}>",
    }


async def find_emails_for_domain(domain: str, max_results: int = 5) -> list[dict[str, Any]]:
    """
    Use Hunter.io to find email addresses at a company domain.
    Requires HUNTER_API_KEY env var.
    Returns list of {"email": ..., "first_name": ..., "last_name": ..., "position": ...}
    """
    api_key = os.environ.get("HUNTER_API_KEY", "")
    if not api_key:
        print("[Email] HUNTER_API_KEY not set — skipping email discovery")
        return []

    params = {
        "domain": domain,
        "limit": max_results,
        "api_key": api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(HUNTER_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        print(f"[Email] Hunter.io error for {domain}: {exc}")
        return []

    results = []
    for email_data in data.get("data", {}).get("emails", []):
        # Only include decision-makers
        position = (email_data.get("position") or "").lower()
        if any(kw in position for kw in ["cto", "ceo", "engineer", "legal", "founder", "vp", "head", "chief", "director", "manager"]):
            results.append(
                {
                    "email": email_data.get("value", ""),
                    "first_name": email_data.get("first_name", ""),
                    "last_name": email_data.get("last_name", ""),
                    "position": email_data.get("position", ""),
                    "confidence": email_data.get("confidence", 0),
                    "domain": domain,
                }
            )
    return results


async def generate_outreach_batch(
    domains: list[str],
    service: str = "Stripe",
) -> list[dict[str, Any]]:
    """
    For a list of company domains, find contacts and generate email drafts.
    Returns list of {lead: ..., email_draft: ...}
    """
    batch = []
    for domain in domains:
        company = domain.split(".")[0].capitalize()
        contacts = await find_emails_for_domain(domain)

        if not contacts:
            # Generate generic placeholder if no Hunter data
            draft = generate_cold_email(company=company, service=service)
            batch.append({"lead": {"email": f"[contact]@{domain}", "domain": domain, "company": company}, "email_draft": draft})
            continue

        for contact in contacts[:2]:  # max 2 per company
            name = contact.get("first_name") or "[Name]"
            draft = generate_cold_email(name=name, company=company, service=service)
            draft["to_email"] = contact["email"]
            batch.append({"lead": contact, "email_draft": draft})

    return batch
