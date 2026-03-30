"""Query rewriting: expand and reformulate queries for better retrieval."""

import os

import anthropic
from langsmith import traceable
from langsmith.wrappers import wrap_anthropic

REWRITE_PROMPT = """Rewrite the following search query to improve document retrieval.
Your goal is to expand the query with synonyms, related terms, and alternative phrasings
while preserving the original intent.

Return ONLY the rewritten query, nothing else. Keep it under 200 words.

Original query: {query}"""

MULTI_QUERY_PROMPT = """Generate 3 different search queries that capture different angles
of the user's original question. Each query should use different terms and phrasing
to maximize recall across a document knowledge base.

Return ONLY the queries, one per line, no numbering or bullets.

Original question: {query}"""


@traceable(name="rewrite_query", run_type="chain")
def rewrite_query(query: str) -> str:
    """Rewrite a query for better retrieval using Claude Haiku."""
    client = wrap_anthropic(anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"]))
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": REWRITE_PROMPT.format(query=query)}],
    )
    return response.content[0].text.strip()


@traceable(name="generate_multi_queries", run_type="chain")
def generate_multi_queries(query: str) -> list[str]:
    """Generate multiple query variants to improve retrieval recall."""
    client = wrap_anthropic(anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"]))
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": MULTI_QUERY_PROMPT.format(query=query)}],
    )
    text = response.content[0].text.strip()
    queries = [line.strip() for line in text.split("\n") if line.strip()]
    return queries[:3]
