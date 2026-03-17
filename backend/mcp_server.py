"""MCP server exposing knowledge base tools over SSE transport."""

import contextvars
import hashlib
import json
import os
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from mcp.server.fastmcp import FastMCP
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from db.client import get_supabase
from services.embeddings import embed_query
from services.search import search_documents
from services.text_to_sql import generate_and_execute_sql

MCP_PORT = int(os.environ.get("MCP_PORT", "8001"))

mcp = FastMCP("Agentic RAG Knowledge Base", host="0.0.0.0", port=MCP_PORT)

# Per-request user_id via contextvars (safe for concurrent connections)
_current_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_current_user_id", default=None
)
_current_scope_folder_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_current_scope_folder_id", default=None
)


def _verify_api_key(key: str) -> tuple[str, str] | None:
    """Verify API key and return (user_id, scope_folder_id) if valid."""
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    sb = get_supabase()
    result = (
        sb.table("api_keys").select("user_id, scope_folder_id").eq("key_hash", key_hash).execute()
    )
    if result.data and result.data[0].get("scope_folder_id"):
        return result.data[0]["user_id"], result.data[0]["scope_folder_id"]
    return None


@mcp.tool()
def knowledge_base_search(query: str) -> str:
    """Search the document knowledge base using hybrid vector + keyword search.

    Use this for questions about content in uploaded documents.

    Args:
        query: The search query to find relevant document chunks.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated. Provide a valid API key."
    embedding = embed_query(query)
    results = search_documents(
        embedding,
        query_text=query,
        user_id=_current_user_id.get(),
        root_folder_id=_current_scope_folder_id.get(),
    )
    if not results:
        return "No relevant documents found in the knowledge base."

    chunks = []
    for r in results:
        source = (r.get("metadata") or {}).get("source_filename", "unknown")
        chunks.append(f"[Source: {source}]\n{r['content']}")
    return "\n\n---\n\n".join(chunks)


@mcp.tool()
def query_documents_metadata(question: str) -> str:
    """Query structured metadata about uploaded documents using natural language.

    Use this for questions like 'how many documents are there',
    'what topics are covered', 'list all PDFs', etc.

    Args:
        question: Natural language question about document metadata.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated. Provide a valid API key."

    result = generate_and_execute_sql(question, _current_user_id.get())
    if result["error"]:
        return f"Query failed: {result['error']}"
    if not result["results"]:
        return "No results found."
    return f"SQL: {result['sql']}\nResults: {json.dumps(result['results'], default=str)}"


@mcp.tool()
def save_note(title: str, content: str) -> str:
    """Save a structured note (decision, learning, observation) to the knowledge base.

    Notes persist indefinitely and are scoped to the current domain.
    Check list_notes first to avoid duplicates.

    Args:
        title: Short summary of the note.
        content: Full note content.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated."
    sb = get_supabase()
    user_id = _current_user_id.get()
    scope_id = _current_scope_folder_id.get()
    content_hash = hashlib.sha256(content.encode()).hexdigest()

    existing = (
        sb.table("notes")
        .select("id, title")
        .eq("user_id", user_id)
        .eq("root_folder_id", scope_id)
        .eq("content_hash", content_hash)
        .limit(1)
        .execute()
    )
    if existing.data:
        return f"Note already exists: '{existing.data[0]['title']}' (id: {existing.data[0]['id']})"

    result = (
        sb.table("notes")
        .insert(
            {
                "title": title,
                "content": content,
                "content_hash": content_hash,
                "root_folder_id": scope_id,
                "user_id": user_id,
            }
        )
        .execute()
    )
    return f"Note saved: '{title}' (id: {result.data[0]['id']})"


@mcp.tool()
def list_notes(query: str = "") -> str:
    """List notes in the current scope, optionally filtered by a search query.

    Args:
        query: Optional text to filter notes by title or content.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated."
    sb = get_supabase()
    q = (
        sb.table("notes")
        .select("id, title, content, created_at")
        .eq("user_id", _current_user_id.get())
        .eq("root_folder_id", _current_scope_folder_id.get())
    )
    if query:
        q = q.or_(f"title.ilike.%{query}%,content.ilike.%{query}%")
    result = q.order("created_at", desc=True).execute()
    notes = result.data

    if not notes:
        return "No notes found."

    lines = []
    for n in notes:
        lines.append(
            f"- **{n['title']}** (id: {n['id']}, {n['created_at'][:10]})\n  {n['content'][:200]}"
        )
    return "\n".join(lines)


@mcp.tool()
def delete_note(note_id: str) -> str:
    """Delete a note by ID.

    Args:
        note_id: The UUID of the note to delete.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated."
    sb = get_supabase()
    result = (
        sb.table("notes")
        .delete()
        .eq("id", note_id)
        .eq("user_id", _current_user_id.get())
        .eq("root_folder_id", _current_scope_folder_id.get())
        .execute()
    )
    if not result.data:
        return "Note not found or not in current scope."
    return "Note deleted."


@mcp.tool()
def set_context(key: str, value: str) -> str:
    """Set a context entry (ephemeral working memory, 7-day TTL).

    Use for current task, recent decisions, temporary state.
    Overwrites existing value for the same key.

    Args:
        key: Context key (e.g., 'current_task', 'active_branch').
        value: Context value.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated."
    sb = get_supabase()
    user_id = _current_user_id.get()
    scope_id = _current_scope_folder_id.get()

    sb.table("context").delete().eq("user_id", user_id).eq("root_folder_id", scope_id).eq(
        "key", key
    ).execute()

    sb.table("context").insert(
        {
            "key": key,
            "value": value,
            "root_folder_id": scope_id,
            "user_id": user_id,
        }
    ).execute()

    return f"Context set: {key}"


@mcp.tool()
def get_context(key: str) -> str:
    """Get a single context value by key.

    Args:
        key: The context key to look up.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated."
    sb = get_supabase()
    result = (
        sb.table("context")
        .select("value, expires_at")
        .eq("user_id", _current_user_id.get())
        .eq("root_folder_id", _current_scope_folder_id.get())
        .eq("key", key)
        .gt("expires_at", datetime.now(timezone.utc).isoformat())
        .limit(1)
        .execute()
    )
    if not result.data:
        return f"No context found for key: {key}"
    return result.data[0]["value"]


@mcp.tool()
def list_context() -> str:
    """List all active context entries in the current scope."""
    if not _current_user_id.get():
        return "Error: Not authenticated."
    sb = get_supabase()
    result = (
        sb.table("context")
        .select("id, key, value, expires_at")
        .eq("user_id", _current_user_id.get())
        .eq("root_folder_id", _current_scope_folder_id.get())
        .gt("expires_at", datetime.now(timezone.utc).isoformat())
        .order("key")
        .execute()
    )
    if not result.data:
        return "No active context entries."

    lines = []
    for c in result.data:
        lines.append(f"- **{c['key']}**: {c['value']} (expires: {c['expires_at'][:10]})")
    return "\n".join(lines)


@mcp.tool()
def clear_context(key: str = "") -> str:
    """Clear context entries. If key is provided, clear only that key. Otherwise clear all.

    Args:
        key: Optional specific key to clear. Empty string clears all context.
    """
    if not _current_user_id.get():
        return "Error: Not authenticated."
    sb = get_supabase()
    query = (
        sb.table("context")
        .delete()
        .eq("user_id", _current_user_id.get())
        .eq("root_folder_id", _current_scope_folder_id.get())
    )
    if key:
        query = query.eq("key", key)
    query.execute()
    return f"Context cleared: {'key=' + key if key else 'all'}"


class ApiKeyAuthMiddleware:
    """Pure ASGI middleware for API key auth (SSE-compatible, no buffering)."""

    SKIP_PATHS = {"/", "/health"}

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # Health endpoint
        if path == "/health":
            response = JSONResponse({"status": "ok"})
            await response(scope, receive, send)
            return

        # Skip auth for root
        if path in self.SKIP_PATHS:
            await self.app(scope, receive, send)
            return

        # Extract Authorization header
        headers = dict(scope.get("headers", []))
        auth_value = headers.get(b"authorization", b"").decode()

        if not auth_value.startswith("Bearer "):
            response = JSONResponse(
                {"error": "Missing Authorization: Bearer <api-key> header"},
                status_code=401,
            )
            await response(scope, receive, send)
            return

        api_key = auth_value.split(" ", 1)[1]
        result = _verify_api_key(api_key)
        if not result:
            response = JSONResponse({"error": "Invalid or unscoped API key"}, status_code=401)
            await response(scope, receive, send)
            return

        user_id, scope_folder_id = result
        _current_user_id.set(user_id)
        _current_scope_folder_id.set(scope_folder_id)
        await self.app(scope, receive, send)


if __name__ == "__main__":
    print(f"Starting MCP server on port {MCP_PORT}...")
    print(f"SSE endpoint: http://localhost:{MCP_PORT}/sse")

    sse_app = mcp.sse_app()
    app = ApiKeyAuthMiddleware(sse_app)

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=MCP_PORT)
