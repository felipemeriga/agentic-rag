"""Document ingestion pipeline: parse, hash, deduplicate, chunk, embed, store."""

import hashlib
from pathlib import Path

from db.client import get_supabase
from services.chunker import chunk_text
from services.embeddings import embed_document
from services.metadata import extract_metadata
from services.parser import parse_document

EXTENSION_TO_TYPE = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".html": "html",
    ".htm": "html",
    ".md": "markdown",
    ".markdown": "markdown",
    ".txt": "text",
    ".text": "text",
}


def compute_content_hash(content: bytes) -> str:
    """Compute SHA-256 hash of raw file bytes."""
    return hashlib.sha256(content).hexdigest()


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
    file_bytes: bytes,
    filename: str,
    user_id: str,
    folder_id: str | None = None,
) -> dict:
    """Ingest a document: parse, hash, deduplicate, chunk, embed, store.

    Returns dict with keys: duplicate (bool), chunks (int), document_ids (list).
    """
    content_hash = compute_content_hash(file_bytes)

    if check_duplicate(content_hash, user_id):
        return {"duplicate": True, "chunks": 0, "document_ids": []}

    # Parse document to text using Docling
    text = parse_document(file_bytes, filename)
    if not text.strip():
        return {"duplicate": False, "chunks": 0, "document_ids": []}

    chunks = chunk_text(text)
    if not chunks:
        return {"duplicate": False, "chunks": 0, "document_ids": []}

    source_type = EXTENSION_TO_TYPE.get(Path(filename).suffix.lower(), "text")
    sb = get_supabase()
    inserted_ids: list[str] = []

    # Insert all chunks with status=processing
    for i, chunk in enumerate(chunks):
        embedding = embed_document(chunk)
        meta = extract_metadata(chunk)

        row = {
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
            "source_type": source_type,
            "content_hash": content_hash,
            "status": "processing",
        }
        if folder_id:
            row["folder_id"] = folder_id

        result = sb.table("documents").insert(row).execute()
        inserted_ids.append(result.data[0]["id"])

    # Mark all chunks as completed
    sb.table("documents").update({"status": "completed"}).eq("content_hash", content_hash).eq(
        "user_id", user_id
    ).execute()

    return {"duplicate": False, "chunks": len(inserted_ids), "document_ids": inserted_ids}
