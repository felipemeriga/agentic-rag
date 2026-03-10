"""Rerank search results using Voyage AI reranker."""

import logging

import voyageai

logger = logging.getLogger(__name__)

_client: voyageai.Client | None = None


def _get_client() -> voyageai.Client:
    global _client
    if _client is None:
        _client = voyageai.Client()
    return _client


def rerank(query: str, documents: list[dict], top_k: int = 5) -> list[dict]:
    """Rerank documents by relevance to query using voyage-rerank-2.

    Each document dict must have a 'content' key.
    Returns the top_k most relevant documents with rerank_score added.
    Falls back to returning the first top_k documents if reranking fails.
    """
    if not documents:
        return []

    try:
        texts = [doc["content"] for doc in documents]
        result = _get_client().rerank(
            query=query,
            documents=texts,
            model="rerank-2",
            top_k=min(top_k, len(documents)),
        )

        reranked = []
        for r in result.results:
            doc = documents[r.index].copy()
            doc["rerank_score"] = r.relevance_score
            reranked.append(doc)

        return reranked
    except Exception:
        logger.warning("Voyage reranker failed, falling back to un-reranked results")
        return documents[:top_k]
