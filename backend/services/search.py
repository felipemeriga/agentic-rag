"""Hybrid search: vector + keyword with RRF fusion and reranking."""

from langsmith import traceable

from db.client import get_supabase
from services.rerank import rerank


def _vector_search(
    query_embedding: list[float],
    user_id: str | None,
    top_k: int,
    topic: str | None,
    keyword: str | None,
) -> list[dict]:
    """Search documents by cosine similarity."""
    sb = get_supabase()
    params: dict = {"query_embedding": query_embedding, "match_count": top_k}
    if user_id:
        params["filter_user_id"] = user_id
    if topic:
        params["filter_topic"] = topic
    if keyword:
        params["filter_keyword"] = keyword

    result = sb.rpc("match_documents", params).execute()
    return result.data


def _keyword_search(
    query: str,
    user_id: str | None,
    top_k: int,
    topic: str | None,
    keyword: str | None,
) -> list[dict]:
    """Search documents by full-text keyword matching."""
    sb = get_supabase()
    params: dict = {"search_query": query, "match_count": top_k}
    if user_id:
        params["filter_user_id"] = user_id
    if topic:
        params["filter_topic"] = topic
    if keyword:
        params["filter_keyword"] = keyword

    result = sb.rpc("keyword_search", params).execute()
    return result.data


def _reciprocal_rank_fusion(
    vector_results: list[dict],
    keyword_results: list[dict],
    k: int = 60,
) -> list[dict]:
    """Merge two ranked lists using Reciprocal Rank Fusion (RRF).

    Score for each document = sum of 1/(k + rank) across both lists.
    """
    scores: dict[str, float] = {}
    docs_by_id: dict[str, dict] = {}

    for rank, doc in enumerate(vector_results):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        docs_by_id[doc_id] = doc

    for rank, doc in enumerate(keyword_results):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        docs_by_id[doc_id] = doc

    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    return [docs_by_id[doc_id] for doc_id in sorted_ids]


@traceable(name="search_documents", run_type="retriever")
def search_documents(
    query_embedding: list[float],
    query_text: str = "",
    user_id: str | None = None,
    top_k: int = 5,
    topic: str | None = None,
    keyword: str | None = None,
) -> list[dict]:
    """Hybrid search: vector + keyword → RRF fusion → Voyage reranking.

    Fetches top 20 from each search method, merges with RRF,
    then reranks the fused results to return top_k.
    """
    fetch_k = 20

    vector_results = _vector_search(query_embedding, user_id, fetch_k, topic, keyword)

    keyword_results = []
    if query_text:
        keyword_results = _keyword_search(query_text, user_id, fetch_k, topic, keyword)

    if not vector_results and not keyword_results:
        return []

    # If only one source returned results, skip fusion
    if not keyword_results:
        fused = vector_results
    elif not vector_results:
        fused = keyword_results
    else:
        fused = _reciprocal_rank_fusion(vector_results, keyword_results)

    # Rerank the fused results
    return rerank(query_text or "query", fused, top_k=top_k)
