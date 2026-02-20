"""
Twitter/X source — uses Twitter API v2 (bearer token, free dev tier).
Set TWITTER_BEARER_TOKEN in your environment.
Free tier: 500k tweet reads/month, 1 search query at a time.

Get a token at: https://developer.twitter.com/en/portal/projects-and-apps
"""
from __future__ import annotations

import httpx
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sales_agent.config import TWITTER_QUERIES

TWITTER_SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent"


def _bearer_header() -> dict[str, str]:
    token = os.environ.get("TWITTER_BEARER_TOKEN", "")
    if not token:
        raise RuntimeError(
            "Set TWITTER_BEARER_TOKEN env var. "
            "Get one free at https://developer.twitter.com"
        )
    return {"Authorization": f"Bearer {token}"}


async def search_twitter(
    days_back: int = 2,
    max_per_query: int = 10,
) -> list[dict[str, Any]]:
    """
    Search recent tweets using Twitter API v2.
    Returns list of opportunity dicts.
    """
    start_time = (
        datetime.now(timezone.utc) - timedelta(days=days_back)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    seen_ids: set[str] = set()
    opportunities: list[dict[str, Any]] = []

    try:
        headers = _bearer_header()
    except RuntimeError as e:
        print(f"[Twitter] Skipped: {e}")
        return []

    async with httpx.AsyncClient(timeout=15) as client:
        for query in TWITTER_QUERIES:
            params = {
                "query": query,
                "start_time": start_time,
                "max_results": max_per_query,
                "tweet.fields": "author_id,created_at,text,public_metrics,entities",
                "expansions": "author_id",
                "user.fields": "name,username",
            }
            try:
                resp = await client.get(
                    TWITTER_SEARCH_URL, params=params, headers=headers
                )
                if resp.status_code == 429:
                    print("[Twitter] Rate limited — skipping remaining queries")
                    break
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                print(f"[Twitter] Error for query '{query[:40]}': {exc}")
                continue

            tweets = data.get("data", [])
            users = {
                u["id"]: u
                for u in data.get("includes", {}).get("users", [])
            }

            for tweet in tweets:
                t_id = tweet.get("id", "")
                if t_id in seen_ids:
                    continue
                seen_ids.add(t_id)

                author_id = tweet.get("author_id", "")
                user = users.get(author_id, {})
                username = user.get("username", "unknown")
                metrics = tweet.get("public_metrics", {})

                opportunities.append(
                    {
                        "platform": "twitter",
                        "id": t_id,
                        "title": tweet.get("text", "")[:80],
                        "content": tweet.get("text", ""),
                        "url": f"https://twitter.com/{username}/status/{t_id}",
                        "author": username,
                        "author_id": author_id,
                        "likes": metrics.get("like_count", 0),
                        "retweets": metrics.get("retweet_count", 0),
                        "replies": metrics.get("reply_count", 0),
                        "created_at": tweet.get("created_at", ""),
                        "keyword_matched": query,
                    }
                )

    return opportunities
