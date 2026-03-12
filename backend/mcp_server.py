"""MCP server exposing knowledge base tools over SSE transport."""

import contextvars
import hashlib
import json
import os

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


def _verify_api_key(key: str) -> str | None:
    """Verify API key and return user_id if valid."""
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    sb = get_supabase()
    result = sb.table("api_keys").select("user_id").eq("key_hash", key_hash).execute()
    if result.data:
        return result.data[0]["user_id"]
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
        user_id = _verify_api_key(api_key)
        if not user_id:
            response = JSONResponse({"error": "Invalid API key"}, status_code=401)
            await response(scope, receive, send)
            return

        _current_user_id.set(user_id)
        await self.app(scope, receive, send)


if __name__ == "__main__":
    print(f"Starting MCP server on port {MCP_PORT}...")
    print(f"SSE endpoint: http://localhost:{MCP_PORT}/sse")

    sse_app = mcp.sse_app()
    app = ApiKeyAuthMiddleware(sse_app)

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=MCP_PORT)
