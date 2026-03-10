"""MCP server exposing knowledge base tools over SSE transport."""

import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from mcp.server.fastmcp import FastMCP

from services.embeddings import embed_query
from services.search import search_documents
from services.text_to_sql import generate_and_execute_sql

MCP_API_KEY = os.environ.get("MCP_API_KEY", "")

mcp = FastMCP("Agentic RAG Knowledge Base")


@mcp.tool()
def knowledge_base_search(
    query: str,
    user_id: str = "",
) -> str:
    """Search the document knowledge base using hybrid vector + keyword search.

    Use this for questions about content in uploaded documents.

    Args:
        query: The search query to find relevant document chunks.
        user_id: Optional user ID to scope search to a specific user's documents.
    """
    embedding = embed_query(query)
    results = search_documents(
        embedding,
        query_text=query,
        user_id=user_id or None,
    )
    if not results:
        return "No relevant documents found in the knowledge base."

    chunks = []
    for r in results:
        source = (r.get("metadata") or {}).get("source_filename", "unknown")
        chunks.append(f"[Source: {source}]\n{r['content']}")
    return "\n\n---\n\n".join(chunks)


@mcp.tool()
def query_documents_metadata(
    question: str,
    user_id: str = "",
) -> str:
    """Query structured metadata about uploaded documents using natural language.

    Use this for questions like 'how many documents are there',
    'what topics are covered', 'list all PDFs', etc.

    Args:
        question: Natural language question about document metadata.
        user_id: User ID to scope the query to a specific user's documents.
    """
    if not user_id:
        return "Error: user_id is required for metadata queries."

    result = generate_and_execute_sql(question, user_id)
    if result["error"]:
        return f"Query failed: {result['error']}"
    if not result["results"]:
        return "No results found."
    return f"SQL: {result['sql']}\nResults: {json.dumps(result['results'], default=str)}"


if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "8001"))
    print(f"Starting MCP server on port {port}...")
    print(f"SSE endpoint: http://localhost:{port}/sse")

    if not MCP_API_KEY:
        print("WARNING: MCP_API_KEY not set — server is unauthenticated", file=sys.stderr)

    mcp.run(transport="sse", port=port)
