"""Document ingestion pipeline: chunk, embed, store."""

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

    return inserted_ids
