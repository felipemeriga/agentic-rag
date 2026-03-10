"""Document search via pgvector similarity."""

from db.client import get_supabase


def search_documents(
    query_embedding: list[float],
    user_id: str | None = None,
    top_k: int = 5,
    topic: str | None = None,
    keyword: str | None = None,
) -> list[dict]:
    """Search documents by cosine similarity with optional metadata filters."""
    sb = get_supabase()
    params: dict = {
        "query_embedding": query_embedding,
        "match_count": top_k,
    }
    if user_id:
        params["filter_user_id"] = user_id
    if topic:
        params["filter_topic"] = topic
    if keyword:
        params["filter_keyword"] = keyword

    result = sb.rpc("match_documents", params).execute()
    return result.data
