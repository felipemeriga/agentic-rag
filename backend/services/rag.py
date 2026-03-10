"""RAG pipeline: embed query, search, stream Claude response."""

import json
import os
from collections.abc import Generator

import anthropic

from db.client import get_supabase
from services.embeddings import embed_query
from services.search import search_documents


def build_system_prompt(context_chunks: list[dict]) -> str:
    """Build system prompt with retrieved context."""
    if not context_chunks:
        return "You are a helpful assistant. No relevant documents were found for this query."

    context = "\n\n---\n\n".join([chunk["content"] for chunk in context_chunks])
    return f"""You are a helpful assistant that answers questions based on the provided context.
Use the following retrieved documents to answer the user's question.
If the context doesn't contain relevant information, say so honestly.

<context>
{context}
</context>"""


def stream_rag_response(
    conversation_id: str,
    user_message: str,
    user_id: str,
    topic: str | None = None,
    keyword: str | None = None,
) -> Generator[str, None, None]:
    """Full RAG pipeline: save message, embed, search, stream Claude response."""
    sb = get_supabase()

    # 1. Save user message
    sb.table("messages").insert(
        {
            "conversation_id": conversation_id,
            "role": "user",
            "content": user_message,
        }
    ).execute()

    # Update conversation title
    sb.table("conversations").update({"title": user_message[:50]}).eq("id", conversation_id).eq(
        "user_id", user_id
    ).execute()

    # 2. Embed query
    query_embedding = embed_query(user_message)

    # 3. Hybrid search: vector + keyword → RRF → rerank
    context_chunks = search_documents(
        query_embedding, query_text=user_message, user_id=user_id, topic=topic, keyword=keyword
    )

    # 4. Build system prompt
    system_prompt = build_system_prompt(context_chunks)

    # 5. Fetch conversation history
    history = (
        sb.table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )

    messages = [{"role": m["role"], "content": m["content"]} for m in history.data]

    # 6. Stream Claude response
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    full_response = ""

    with client.messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            full_response += text
            yield f"data: {json.dumps({'token': text})}\n\n"

    # 7. Save assistant message
    sb.table("messages").insert(
        {
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": full_response,
        }
    ).execute()

    yield f"data: {json.dumps({'done': True})}\n\n"
