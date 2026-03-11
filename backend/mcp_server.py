"""MCP server exposing knowledge base tools over SSE transport."""

import hashlib
import json
import os

from dotenv import load_dotenv

load_dotenv()

from mcp.server.fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

from db.client import get_supabase
from services.embeddings import embed_query
from services.search import search_documents
from services.text_to_sql import generate_and_execute_sql

MCP_PORT = int(os.environ.get("MCP_PORT", "8001"))

mcp = FastMCP("Agentic RAG Knowledge Base", host="0.0.0.0", port=MCP_PORT)

# Store authenticated user_id per connection
_authenticated_user_id: str | None = None


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
    if not _authenticated_user_id:
        return "Error: Not authenticated. Provide a valid API key."
    embedding = embed_query(query)
    results = search_documents(
        embedding,
        query_text=query,
        user_id=_authenticated_user_id,
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
    if not _authenticated_user_id:
        return "Error: Not authenticated. Provide a valid API key."

    result = generate_and_execute_sql(question, _authenticated_user_id)
    if result["error"]:
        return f"Query failed: {result['error']}"
    if not result["results"]:
        return "No results found."
    return f"SQL: {result['sql']}\nResults: {json.dumps(result['results'], default=str)}"


if __name__ == "__main__":
    print(f"Starting MCP server on port {MCP_PORT}...")
    print(f"SSE endpoint: http://localhost:{MCP_PORT}/sse")

    # Get the underlying Starlette app and add auth middleware
    app = mcp.get_sse_app()

    @app.middleware("http")
    async def api_key_auth_middleware(request: Request, call_next):
        global _authenticated_user_id

        # Allow health-check paths without auth
        path = request.url.path
        if path in ("/", "/health"):
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                {"error": "Missing Authorization: Bearer <api-key> header"},
                status_code=401,
            )

        api_key = auth_header.split(" ", 1)[1]
        user_id = _verify_api_key(api_key)
        if not user_id:
            return JSONResponse(
                {"error": "Invalid API key"},
                status_code=401,
            )

        _authenticated_user_id = user_id
        response = await call_next(request)
        return response

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=MCP_PORT)
