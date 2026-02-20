"""
Sales Agent Runner — orchestrates the full outreach pipeline.

Usage:
    python -m sales_agent.runner            # run once
    python -m sales_agent.runner --days 7   # look back 7 days
    python -m sales_agent.runner --dry-run  # no LLM calls, just print opportunities

What it does:
1. Searches HN, Reddit, and Twitter for relevant posts
2. For each opportunity, calls the LLM to draft a reply
3. Also generates LinkedIn targets + cold email drafts
4. Saves all drafts to drafts/YYYY-MM-DD.json for review
5. Run review.py to approve/edit/skip before posting
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sales_agent.sources import search_hackernews, search_reddit, search_twitter
from sales_agent.generators import (
    generate_reply,
    get_all_linkedin_targets,
    generate_cold_email,
)

DRAFTS_DIR = Path(__file__).parent.parent / "drafts"

# Target company domains for cold email (add your own)
TARGET_DOMAINS = [
    "vercel.com",
    "netlify.com",
    "supabase.io",
    "planetscale.com",
    "railway.app",
    "fly.io",
    "linear.app",
    "notion.so",
    "retool.com",
    "airtable.com",
]


async def run(days_back: int = 3, dry_run: bool = False) -> dict[str, Any]:
    """
    Full pipeline run. Returns the drafts dict that was saved.
    """
    print(f"\n{'='*60}")
    print(f"ToS Monitor Sales Agent — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Looking back {days_back} days | dry_run={dry_run}")
    print("="*60)

    # ── 1. Discover opportunities ─────────────────────────────────────────────
    print("\n[1/4] Searching platforms for opportunities...")

    hn_opps, reddit_opps, twitter_opps = await asyncio.gather(
        search_hackernews(days_back=days_back),
        search_reddit(days_back=days_back),
        search_twitter(days_back=days_back),
    )

    all_opportunities = hn_opps + reddit_opps + twitter_opps
    print(f"  Found: {len(hn_opps)} HN | {len(reddit_opps)} Reddit | {len(twitter_opps)} Twitter")
    print(f"  Total: {len(all_opportunities)} opportunities")

    # ── 2. Generate reply drafts ─────────────────────────────────────────────
    print("\n[2/4] Generating reply drafts via LLM...")
    reply_drafts = []

    if dry_run:
        print("  [dry-run] Skipping LLM calls")
        for opp in all_opportunities[:5]:
            reply_drafts.append({
                "opportunity": opp,
                "draft": "[DRY RUN — LLM not called]",
                "status": "pending",
            })
    else:
        for i, opp in enumerate(all_opportunities, 1):
            print(f"  [{i}/{len(all_opportunities)}] {opp['platform']:10} — {opp['title'][:50]}")
            reply = await generate_reply(opp)
            if reply:
                reply_drafts.append({
                    "opportunity": opp,
                    "draft": reply,
                    "status": "pending",  # pending | approved | skipped | posted
                    "edited_draft": None,
                })
                print(f"    ✓ Draft generated ({len(reply)} chars)")
            else:
                print(f"    ✗ LLM said not relevant — skipping")

    print(f"  Generated {len(reply_drafts)} reply drafts")

    # ── 3. LinkedIn targets ──────────────────────────────────────────────────
    print("\n[3/4] Generating LinkedIn targets...")
    linkedin_targets = get_all_linkedin_targets()
    print(f"  {len(linkedin_targets)} persona templates ready")

    # ── 4. Cold email drafts ─────────────────────────────────────────────────
    print("\n[4/4] Generating cold email drafts...")
    email_drafts = []
    for domain in TARGET_DOMAINS:
        company = domain.split(".")[0].capitalize()
        draft = generate_cold_email(company=company)
        email_drafts.append({
            "domain": domain,
            "company": company,
            "email_draft": draft,
            "status": "pending",
        })
    print(f"  {len(email_drafts)} cold email drafts ready")

    # ── Save drafts ──────────────────────────────────────────────────────────
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    output_path = DRAFTS_DIR / f"{date_str}.json"

    # Merge with existing file if it exists (avoid overwriting today's approvals)
    existing = {}
    if output_path.exists():
        with open(output_path) as f:
            existing = json.load(f)

    # Add new drafts that don't already exist (by opportunity ID)
    existing_ids = {
        d["opportunity"]["id"]
        for d in existing.get("reply_drafts", [])
        if "opportunity" in d
    }
    new_reply_drafts = [
        d for d in reply_drafts
        if d["opportunity"]["id"] not in existing_ids
    ]

    drafts = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "days_back": days_back,
        "stats": {
            "hn": len(hn_opps),
            "reddit": len(reddit_opps),
            "twitter": len(twitter_opps),
            "reply_drafts": len(existing.get("reply_drafts", [])) + len(new_reply_drafts),
            "linkedin_targets": len(linkedin_targets),
            "email_drafts": len(email_drafts),
        },
        "reply_drafts": existing.get("reply_drafts", []) + new_reply_drafts,
        "linkedin_targets": linkedin_targets,
        "email_drafts": existing.get("email_drafts", email_drafts),
    }

    with open(output_path, "w") as f:
        json.dump(drafts, f, indent=2, default=str)

    print(f"\n{'='*60}")
    print(f"✅ Drafts saved to: {output_path}")
    print(f"   {len(new_reply_drafts)} new reply drafts | {len(linkedin_targets)} LinkedIn targets | {len(email_drafts)} emails")
    print(f"\nNext: run `python -m sales_agent.review` to approve and post")
    print("="*60)

    return drafts


def main():
    parser = argparse.ArgumentParser(description="ToS Monitor Sales Agent")
    parser.add_argument("--days", type=int, default=3, help="Days to look back (default: 3)")
    parser.add_argument("--dry-run", action="store_true", help="Skip LLM calls")
    args = parser.parse_args()

    asyncio.run(run(days_back=args.days, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
