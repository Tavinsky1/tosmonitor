"""
Hacker News source — uses Algolia HN Search API (free, no auth).
Returns a list of opportunity dicts ready for the LLM generator.
"""
from __future__ import annotations

import httpx
from datetime import datetime, timedelta, timezone
from typing import Any

from sales_agent.config import KEYWORDS, HN_TAGS, HN_MIN_POINTS

ALGOLIA_URL = "https://hn.algolia.com/api/v1/search"


async def search_hackernews(
    days_back: int = 3,
    max_per_keyword: int = 5,
) -> list[dict[str, Any]]:
    """
    Search HN for posts/comments matching KEYWORDS posted in the last `days_back` days.
    Returns deduplicated list of opportunity dicts.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    cutoff_ts = int(cutoff.timestamp())

    seen_ids: set[str] = set()
    opportunities: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=15) as client:
        for keyword in KEYWORDS:
            for tag in HN_TAGS:
                params = {
                    "query": keyword,
                    "tags": tag,
                    "numericFilters": f"created_at_i>{cutoff_ts}",
                    "hitsPerPage": max_per_keyword,
                }
                try:
                    resp = await client.get(ALGOLIA_URL, params=params)
                    resp.raise_for_status()
                    data = resp.json()
                except Exception as exc:
                    print(f"[HN] Error fetching '{keyword}' ({tag}): {exc}")
                    continue

                for hit in data.get("hits", []):
                    obj_id: str = hit.get("objectID", "")
                    if obj_id in seen_ids:
                        continue
                    seen_ids.add(obj_id)

                    points = hit.get("points") or 0
                    if tag == "story" and points < HN_MIN_POINTS:
                        continue

                    story_id = hit.get("story_id") or hit.get("objectID")
                    url = (
                        f"https://news.ycombinator.com/item?id={story_id}"
                        if tag == "comment"
                        else f"https://news.ycombinator.com/item?id={obj_id}"
                    )

                    opportunities.append(
                        {
                            "platform": "hackernews",
                            "id": obj_id,
                            "title": hit.get("title") or hit.get("comment_text", "")[:80],
                            "content": (hit.get("story_text") or hit.get("comment_text") or "").strip()[:500],
                            "url": url,
                            "author": hit.get("author", "unknown"),
                            "points": points,
                            "created_at": hit.get("created_at", ""),
                            "keyword_matched": keyword,
                            "type": tag,
                        }
                    )

    return opportunities
