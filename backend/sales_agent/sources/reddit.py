"""
Reddit source — uses Reddit's public JSON API (no auth for reading).
For posting, set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET + REDDIT_USERNAME + REDDIT_PASSWORD
in your environment and install praw.
"""
from __future__ import annotations

import httpx
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sales_agent.config import KEYWORDS, SUBREDDITS

REDDIT_BASE = "https://www.reddit.com"
HEADERS = {"User-Agent": "tosmonitor-sales-agent/1.0"}


async def search_reddit(
    days_back: int = 3,
    max_per_query: int = 5,
) -> list[dict[str, Any]]:
    """
    Search Reddit for posts matching KEYWORDS in SUBREDDITS.
    Uses the public JSON API — no credentials required for reading.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    seen_ids: set[str] = set()
    opportunities: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        # Search across all relevant subreddits with each keyword
        for keyword in KEYWORDS[:8]:  # limit to avoid rate limits
            subreddit_str = "+".join(SUBREDDITS)
            url = f"{REDDIT_BASE}/r/{subreddit_str}/search.json"
            params = {
                "q": keyword,
                "sort": "new",
                "t": "week",
                "limit": max_per_query,
                "restrict_sr": "true",
            }
            try:
                resp = await client.get(url, params=params, headers=HEADERS)
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                print(f"[Reddit] Error searching '{keyword}': {exc}")
                continue

            posts = data.get("data", {}).get("children", [])
            for post in posts:
                p = post.get("data", {})
                post_id = p.get("id", "")
                if post_id in seen_ids:
                    continue

                created_utc = p.get("created_utc", 0)
                created_dt = datetime.fromtimestamp(created_utc, tz=timezone.utc)
                if created_dt < cutoff:
                    continue

                seen_ids.add(post_id)
                opportunities.append(
                    {
                        "platform": "reddit",
                        "id": post_id,
                        "title": p.get("title", ""),
                        "content": (p.get("selftext") or "").strip()[:500],
                        "url": f"https://reddit.com{p.get('permalink', '')}",
                        "author": p.get("author", "unknown"),
                        "subreddit": p.get("subreddit", ""),
                        "score": p.get("score", 0),
                        "num_comments": p.get("num_comments", 0),
                        "created_at": created_dt.isoformat(),
                        "keyword_matched": keyword,
                    }
                )

    return opportunities


def get_praw_client():
    """
    Returns an authenticated PRAW Reddit instance for posting replies.
    Requires env vars: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
                       REDDIT_USERNAME, REDDIT_PASSWORD
    Install: pip install praw
    """
    try:
        import praw  # type: ignore
    except ImportError:
        raise RuntimeError("Install praw: pip install praw")

    return praw.Reddit(
        client_id=os.environ["REDDIT_CLIENT_ID"],
        client_secret=os.environ["REDDIT_CLIENT_SECRET"],
        username=os.environ["REDDIT_USERNAME"],
        password=os.environ["REDDIT_PASSWORD"],
        user_agent="tosmonitor-sales-agent/1.0 by u/{username}".format(
            username=os.environ.get("REDDIT_USERNAME", "tosmonitor")
        ),
    )


def post_reddit_reply(submission_url: str, reply_text: str) -> bool:
    """
    Post a reply to a Reddit submission using PRAW.
    Returns True on success.
    """
    reddit = get_praw_client()
    try:
        submission = reddit.submission(url=submission_url)
        submission.reply(reply_text)
        return True
    except Exception as exc:
        print(f"[Reddit] Failed to post reply: {exc}")
        return False
