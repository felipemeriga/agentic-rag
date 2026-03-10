"""Document ingestion pipeline: chunk, embed, store."""

import time

from db.client import get_supabase
from services.chunker import chunk_text
from services.embeddings import embed_document


def ingest_document(
    content: str,
    filename: str,
    user_id: str,
) -> list[str]:
    """Ingest a document: chunk -> embed -> store in pgvector.

    Returns list of inserted document IDs.
    """
    chunks = chunk_text(content)
    if not chunks:
        return []

    sb = get_supabase()
    inserted_ids: list[str] = []

    for i, chunk in enumerate(chunks):
        embedding = embed_document(chunk)

        result = (
            sb.table("documents")
            .insert(
                {
                    "content": chunk,
                    "embedding": embedding,
                    "metadata": {
                        "source_filename": filename,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                    },
                    "user_id": user_id,
                    "source_filename": filename,
                }
            )
            .execute()
        )
        inserted_ids.append(result.data[0]["id"])

        # Rate limit: Voyage AI free tier is 3 RPM — wait 25s between calls
        if i < len(chunks) - 1:
            time.sleep(25)

    return inserted_ids
