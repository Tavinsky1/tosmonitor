"""
LinkedIn generator — creates personalised DM drafts and Sales Navigator search URLs.
Cannot auto-post to LinkedIn without violating their ToS, so this generates
copy-paste drafts + opens search URLs for manual outreach.
"""
from __future__ import annotations

import urllib.parse
from typing import Any

from sales_agent.config import (
    LINKEDIN_DM_TEMPLATE,
    LINKEDIN_PERSONAS,
    PRODUCT_URL,
    PRODUCT_NAME,
)

SENDER_NAME = "ToS Monitor Team"  # override with your name


def generate_linkedin_dm(
    name: str = "[Name]",
    title: str = "[Title]",
    company: str = "[Company]",
) -> str:
    """
    Generate a personalised LinkedIn DM draft.
    Fill in actual recipient details when sending.
    """
    return LINKEDIN_DM_TEMPLATE.format(
        name=name,
        title=title,
        company=company,
        url=PRODUCT_URL,
        sender_name=SENDER_NAME,
    )


def linkedin_search_url(persona: dict[str, Any]) -> str:
    """
    Generate a LinkedIn People Search URL for a given persona dict.
    Works with regular LinkedIn (basic people search).
    """
    title = persona.get("title", "")
    industry = persona.get("industry", "")
    company_size = persona.get("company_size", "")

    # LinkedIn people search (no Sales Navigator needed)
    query = f"{title} {industry}".strip()
    params = {
        "keywords": query,
        "origin": "GLOBAL_SEARCH_HEADER",
        "sid": "outreach",
    }
    base = "https://www.linkedin.com/search/results/people/?"
    return base + urllib.parse.urlencode(params)


def get_all_linkedin_targets() -> list[dict[str, Any]]:
    """
    Return list of LinkedIn personas with their search URLs and DM templates.
    """
    targets = []
    for persona in LINKEDIN_PERSONAS:
        targets.append(
            {
                "persona": persona,
                "search_url": linkedin_search_url(persona),
                "dm_template": generate_linkedin_dm(
                    title=persona.get("title", ""),
                    company=f"[{persona.get('industry', '')} company]",
                ),
            }
        )
    return targets
