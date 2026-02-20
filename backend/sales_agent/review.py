"""
Sales Agent Review CLI — interactive terminal UI for approving drafts.

Usage:
    python -m sales_agent.review                    # review today's drafts
    python -m sales_agent.review --date 2025-06-10  # review a specific date
    python -m sales_agent.review --type linkedin    # only LinkedIn targets
    python -m sales_agent.review --type email       # only cold emails

Commands during review:
    [a] approve  — mark as approved (for replies: opens URL + copies to clipboard)
    [e] edit     — open draft in $EDITOR for editing before approving
    [s] skip     — skip this draft (mark as skipped)
    [p] post     — attempt to auto-post (Reddit only; others open browser)
    [q] quit     — save progress and exit
    [?] help     — show this help

The file is saved after every action so you can quit safely at any time.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import pyperclip  # type: ignore
    HAS_CLIPBOARD = True
except ImportError:
    HAS_CLIPBOARD = False

DRAFTS_DIR = Path(__file__).parent.parent / "drafts"

COLORS = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "green": "\033[92m",
    "yellow": "\033[93m",
    "blue": "\033[94m",
    "cyan": "\033[96m",
    "red": "\033[91m",
    "dim": "\033[2m",
}


def c(color: str, text: str) -> str:
    """Colorize text for terminal output."""
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"


def print_header(title: str):
    print("\n" + "=" * 60)
    print(c("bold", f"  {title}"))
    print("=" * 60)


def print_opportunity(opp: dict[str, Any]):
    platform = opp.get("platform", "?").upper()
    print(c("dim", f"  Platform : {platform}"))
    print(c("dim", f"  Author   : {opp.get('author', '?')}"))
    print(c("dim", f"  URL      : {opp.get('url', '?')}"))
    print(c("dim", f"  Keyword  : {opp.get('keyword_matched', '?')}"))
    print()
    print(c("cyan", "  [POST/COMMENT]"))
    title = opp.get("title", "")
    content = opp.get("content", "")
    if title:
        print(f"  {c('bold', title)}")
    if content:
        print(f"  {content[:300]}")


def print_draft(draft_text: str):
    print()
    print(c("green", "  [DRAFT REPLY]"))
    for line in draft_text.split("\n"):
        print(f"  {line}")


def edit_in_editor(text: str) -> str:
    """Open text in $EDITOR and return the edited version."""
    editor = os.environ.get("EDITOR", "nano")
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, prefix="tosmonitor_draft_"
    ) as f:
        f.write(text)
        tmp_path = f.name
    try:
        subprocess.run([editor, tmp_path], check=True)
        with open(tmp_path) as f:
            return f.read().strip()
    finally:
        os.unlink(tmp_path)


def copy_to_clipboard(text: str) -> bool:
    if HAS_CLIPBOARD:
        try:
            pyperclip.copy(text)
            return True
        except Exception:
            pass
    # Fallback: pbcopy on macOS
    try:
        subprocess.run(["pbcopy"], input=text.encode(), check=True)
        return True
    except Exception:
        pass
    return False


def prompt(options: list[str]) -> str:
    opts_str = " / ".join(f"[{o}]" for o in options)
    try:
        return input(f"\n  {opts_str} ? ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return "q"


def review_reply_drafts(drafts: dict[str, Any]) -> dict[str, Any]:
    """Interactive review for reply drafts (HN, Reddit, Twitter)."""
    items: list[dict[str, Any]] = drafts.get("reply_drafts", [])
    pending = [i for i, d in enumerate(items) if d.get("status") == "pending"]

    if not pending:
        print(c("yellow", "\n  No pending reply drafts."))
        return drafts

    print(c("bold", f"\n  {len(pending)} pending reply drafts\n"))

    for queue_pos, idx in enumerate(pending, 1):
        item = items[idx]
        opp = item["opportunity"]
        draft_text = item.get("edited_draft") or item.get("draft", "")

        print_header(f"Reply Draft {queue_pos}/{len(pending)}")
        print_opportunity(opp)
        print_draft(draft_text)

        choice = prompt(["a=approve", "e=edit", "s=skip", "p=post", "q=quit"])

        if choice in ("q", "quit"):
            print(c("yellow", "\n  Saving and exiting..."))
            break

        elif choice in ("s", "skip"):
            items[idx]["status"] = "skipped"
            print(c("dim", "  → Skipped"))

        elif choice in ("e", "edit"):
            new_text = edit_in_editor(draft_text)
            items[idx]["edited_draft"] = new_text
            items[idx]["status"] = "approved"
            copied = copy_to_clipboard(new_text)
            print(c("green", f"  → Edited and approved" + (" | Copied to clipboard ✓" if copied else "")))
            webbrowser.open(opp.get("url", ""))

        elif choice in ("a", "approve"):
            items[idx]["status"] = "approved"
            copied = copy_to_clipboard(draft_text)
            print(c("green", f"  → Approved" + (" | Copied to clipboard ✓" if copied else "")))
            webbrowser.open(opp.get("url", ""))
            print(c("dim", "  Paste the reply in the browser tab that just opened"))

        elif choice in ("p", "post"):
            platform = opp.get("platform", "")
            if platform == "reddit":
                try:
                    from sales_agent.sources.reddit import post_reddit_reply
                    success = post_reddit_reply(opp["url"], draft_text)
                    if success:
                        items[idx]["status"] = "posted"
                        print(c("green", "  → Posted to Reddit ✓"))
                    else:
                        print(c("red", "  → Post failed — check credentials"))
                except Exception as exc:
                    print(c("red", f"  → Error: {exc}"))
            else:
                # Can't auto-post — open browser
                items[idx]["status"] = "approved"
                copied = copy_to_clipboard(draft_text)
                webbrowser.open(opp.get("url", ""))
                print(c("yellow", f"  → Auto-post not available for {platform}. Opened browser" + (" + copied ✓" if copied else "")))

        drafts["reply_drafts"] = items

    return drafts


def review_linkedin_targets(drafts: dict[str, Any]) -> dict[str, Any]:
    """Review LinkedIn persona targets and open search URLs."""
    targets = drafts.get("linkedin_targets", [])
    if not targets:
        print(c("yellow", "\n  No LinkedIn targets."))
        return drafts

    print_header(f"LinkedIn Targets ({len(targets)} personas)")
    for i, target in enumerate(targets, 1):
        persona = target.get("persona", {})
        dm = target.get("dm_template", "")
        url = target.get("search_url", "")
        print(f"\n  {c('bold', str(i))}. {persona.get('title')} @ {persona.get('industry')} ({persona.get('company_size')} employees)")
        print(c("dim", f"     {url[:80]}"))
        choice = prompt(["o=open search", "d=show DM template", "s=skip", "q=quit"])
        if choice in ("q",):
            break
        if choice in ("o",):
            webbrowser.open(url)
            print(c("green", "  → Opened LinkedIn search"))
        if choice in ("d",):
            print_draft(dm)
            copy_to_clipboard(dm)
            print(c("dim", "  DM template copied to clipboard"))

    return drafts


def review_email_drafts(drafts: dict[str, Any]) -> dict[str, Any]:
    """Review cold email drafts."""
    items = [d for d in drafts.get("email_drafts", []) if d.get("status") == "pending"]
    if not items:
        print(c("yellow", "\n  No pending email drafts."))
        return drafts

    print_header(f"Cold Email Drafts ({len(items)} pending)")
    for i, item in enumerate(items, 1):
        draft = item.get("email_draft", {})
        print(f"\n  {c('bold', str(i))}. To: {item.get('company')} ({item.get('domain')})")
        print(c("cyan", f"     Subject: {draft.get('subject', '')}"))
        print(c("dim", f"     From: {draft.get('from', '')}"))

        choice = prompt(["v=view full", "c=copy body", "s=skip", "q=quit"])
        if choice in ("q",):
            break
        if choice in ("v",):
            print_draft(draft.get("body", ""))
        if choice in ("c",):
            copy_to_clipboard(draft.get("body", ""))
            item["status"] = "approved"
            print(c("green", "  → Email body copied to clipboard ✓"))

    return drafts


def load_drafts(date_str: str) -> tuple[dict[str, Any], Path]:
    path = DRAFTS_DIR / f"{date_str}.json"
    if not path.exists():
        print(c("red", f"\n  No drafts file found: {path}"))
        print(c("dim", "  Run: python -m sales_agent.runner  to generate drafts first"))
        sys.exit(1)
    with open(path) as f:
        return json.load(f), path


def save_drafts(drafts: dict[str, Any], path: Path):
    drafts["last_reviewed"] = datetime.now(timezone.utc).isoformat()
    with open(path, "w") as f:
        json.dump(drafts, f, indent=2, default=str)
    print(c("dim", f"\n  Progress saved → {path.name}"))


def main():
    parser = argparse.ArgumentParser(description="ToS Monitor Sales Agent — Draft Review")
    parser.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        help="Date of drafts to review (YYYY-MM-DD)")
    parser.add_argument("--type", choices=["all", "replies", "linkedin", "email"],
                        default="all", help="Which draft type to review")
    args = parser.parse_args()

    print(c("bold", "\n  ToS Monitor — Sales Agent Draft Review"))
    print(c("dim", f"  Date: {args.date} | Type: {args.type}"))

    if not HAS_CLIPBOARD:
        print(c("yellow", "\n  Tip: pip install pyperclip  for clipboard support"))

    drafts, path = load_drafts(args.date)

    stats = drafts.get("stats", {})
    print(f"\n  {c('bold', 'Stats')}:")
    for k, v in stats.items():
        print(f"    {k:20} {v}")

    try:
        if args.type in ("all", "replies"):
            drafts = review_reply_drafts(drafts)
            save_drafts(drafts, path)

        if args.type in ("all", "linkedin"):
            drafts = review_linkedin_targets(drafts)
            save_drafts(drafts, path)

        if args.type in ("all", "email"):
            drafts = review_email_drafts(drafts)
            save_drafts(drafts, path)

    except KeyboardInterrupt:
        print(c("yellow", "\n\n  Interrupted — saving progress..."))
        save_drafts(drafts, path)

    # Final summary
    replies = drafts.get("reply_drafts", [])
    n_approved = sum(1 for r in replies if r.get("status") == "approved")
    n_posted = sum(1 for r in replies if r.get("status") == "posted")
    n_skipped = sum(1 for r in replies if r.get("status") == "skipped")
    n_pending = sum(1 for r in replies if r.get("status") == "pending")

    print("\n" + "=" * 60)
    print(c("bold", "  Session Summary"))
    print(f"  Approved : {c('green', str(n_approved))}")
    print(f"  Posted   : {c('green', str(n_posted))}")
    print(f"  Skipped  : {c('dim', str(n_skipped))}")
    print(f"  Pending  : {c('yellow', str(n_pending))}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
