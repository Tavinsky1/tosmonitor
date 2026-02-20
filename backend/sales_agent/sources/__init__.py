"""Sources package — discover outreach opportunities across platforms."""
from .hackernews import search_hackernews
from .reddit import search_reddit
from .twitter import search_twitter

__all__ = ["search_hackernews", "search_reddit", "search_twitter"]
