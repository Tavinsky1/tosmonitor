"""
Page Fetcher — downloads ToS/privacy pages and extracts clean text.

Uses httpx for async HTTP + BeautifulSoup for HTML→text extraction.
Handles retries, timeouts, and common anti-bot measures.
"""

import hashlib
import re
import asyncio
import logging

import httpx
from bs4 import BeautifulSoup

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def fetch_page(url: str, retries: int = 3) -> dict:
    """
    Fetch a web page and extract clean text content.

    Returns:
        {
            "url": str,
            "content": str,         # cleaned text
            "content_hash": str,    # SHA-256 of content
            "word_count": int,
            "status": "ok" | "error",
            "error": str | None,
        }
    """
    headers = {
        "User-Agent": settings.SCRAPE_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(
                timeout=settings.SCRAPE_TIMEOUT_SECONDS,
                follow_redirects=True,
                http2=True,
            ) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()

                content = _extract_text(resp.text)
                content_hash = hashlib.sha256(content.encode()).hexdigest()

                return {
                    "url": url,
                    "content": content,
                    "content_hash": content_hash,
                    "word_count": len(content.split()),
                    "status": "ok",
                    "error": None,
                }

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                # Rate limited — back off
                wait = (attempt + 1) * 10
                logger.warning(f"Rate limited on {url}, waiting {wait}s")
                await asyncio.sleep(wait)
                continue
            logger.error(f"HTTP {e.response.status_code} fetching {url}")
            return {
                "url": url,
                "content": "",
                "content_hash": "",
                "word_count": 0,
                "status": "error",
                "error": f"HTTP {e.response.status_code}",
            }

        except (httpx.TimeoutException, httpx.ConnectError) as e:
            if attempt < retries - 1:
                wait = (attempt + 1) * 5
                logger.warning(f"Timeout/connection error on {url}, retry in {wait}s")
                await asyncio.sleep(wait)
                continue
            return {
                "url": url,
                "content": "",
                "content_hash": "",
                "word_count": 0,
                "status": "error",
                "error": str(e),
            }

        except Exception as e:
            logger.exception(f"Unexpected error fetching {url}")
            return {
                "url": url,
                "content": "",
                "content_hash": "",
                "word_count": 0,
                "status": "error",
                "error": str(e),
            }

    return {
        "url": url,
        "content": "",
        "content_hash": "",
        "word_count": 0,
        "status": "error",
        "error": "Max retries exceeded",
    }


def _extract_text(html: str) -> str:
    """
    Extract clean, readable text from HTML.
    Removes navigation, footers, scripts, and non-content elements.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Remove non-content elements
    for tag in soup.find_all(
        ["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe"]
    ):
        tag.decompose()

    # Try to find the main content area
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"role": "main"})
        or soup.find(class_=re.compile(r"(content|article|body|terms|legal|policy)", re.I))
    )

    target = main or soup.body or soup

    # Extract text with structure preserved
    lines = []
    for element in target.stripped_strings:
        line = element.strip()
        if line:
            lines.append(line)

    text = "\n".join(lines)

    # Normalize whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)

    return text.strip()


async def fetch_multiple(urls: list[str], max_concurrent: int = 5) -> list[dict]:
    """Fetch multiple pages concurrently with a semaphore."""
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _limited_fetch(url: str) -> dict:
        async with semaphore:
            result = await fetch_page(url)
            await asyncio.sleep(1)  # Gentle rate limit between fetches
            return result

    return await asyncio.gather(*[_limited_fetch(url) for url in urls])
