"""Web search via Tavily API."""

import logging
import os

from langsmith import traceable
from tavily import TavilyClient

logger = logging.getLogger(__name__)

_client: TavilyClient | None = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        _client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    return _client


@traceable(name="web_search", run_type="tool")
def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Search the web and return extracted text content.

    Returns list of dicts with keys: title, url, content.
    Falls back to empty list on failure.
    """
    try:
        client = _get_client()
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            include_answer=False,
        )
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
            }
            for r in response.get("results", [])
        ]
    except Exception:
        logger.warning("Tavily web search failed", exc_info=True)
        return []
