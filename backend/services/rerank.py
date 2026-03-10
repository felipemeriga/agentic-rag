"""Rerank search results using Voyage AI reranker."""

import os

import voyageai


def rerank(query: str, documents: list[dict], top_k: int = 5) -> list[dict]:
    """Rerank documents by relevance to query using voyage-rerank-2.

    Each document dict must have a 'content' key.
    Returns the top_k most relevant documents with rerank_score added.
    """
    if not documents:
        return []

    client = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])
    texts = [doc["content"] for doc in documents]

    result = client.rerank(
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
