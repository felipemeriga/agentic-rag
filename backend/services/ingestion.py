"""Document ingestion pipeline: hash, deduplicate, chunk, embed, store."""

import hashlib

from db.client import get_supabase
from services.chunker import chunk_text
from services.embeddings import embed_document
from services.metadata import extract_metadata


def compute_content_hash(content: str) -> str:
    """Compute SHA-256 hash of file content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def check_duplicate(content_hash: str, user_id: str) -> bool:
    """Check if a document with this hash already exists for the user."""
    sb = get_supabase()
    result = (
        sb.table("documents")
        .select("id")
        .eq("content_hash", content_hash)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


def ingest_document(
    content: str,
    filename: str,
    user_id: str,
) -> dict:
    """Ingest a document: hash, deduplicate, chunk, embed, store.

    Returns dict with keys: duplicate (bool), chunks (int), document_ids (list).
    """
    content_hash = compute_content_hash(content)

    if check_duplicate(content_hash, user_id):
        return {"duplicate": True, "chunks": 0, "document_ids": []}

    chunks = chunk_text(content)
    if not chunks:
        return {"duplicate": False, "chunks": 0, "document_ids": []}

    sb = get_supabase()
    inserted_ids: list[str] = []

    # Insert all chunks with status=processing
    for i, chunk in enumerate(chunks):
        embedding = embed_document(chunk)
        meta = extract_metadata(chunk)

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
                        "topic": meta["topic"],
                        "keywords": meta["keywords"],
                    },
                    "user_id": user_id,
                    "source_filename": filename,
                    "content_hash": content_hash,
                    "status": "processing",
                }
            )
            .execute()
        )
        inserted_ids.append(result.data[0]["id"])

    # Mark all chunks as completed
    sb.table("documents").update({"status": "completed"}).eq("content_hash", content_hash).eq(
        "user_id", user_id
    ).execute()

    return {"duplicate": False, "chunks": len(inserted_ids), "document_ids": inserted_ids}
