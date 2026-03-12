"""Document ingestion pipeline: parse, hash, deduplicate, chunk, embed, store."""

import hashlib
from pathlib import Path

from db.client import get_supabase
from services.chunker import chunk_text
from services.embeddings import embed_document
from services.metadata import extract_metadata
from services.parser import extract_from_image, parse_document

EXTENSION_TO_TYPE = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".html": "html",
    ".htm": "html",
    ".md": "markdown",
    ".markdown": "markdown",
    ".txt": "text",
    ".text": "text",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


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


def upload_image_to_storage(
    file_bytes: bytes, user_id: str, content_hash: str, filename: str
) -> str:
    """Upload raw image to Supabase Storage and return the path."""
    ext = Path(filename).suffix.lower().lstrip(".")
    storage_path = f"{user_id}/{content_hash}.{ext}"
    sb = get_supabase()
    media_type = "image/png" if ext == "png" else "image/jpeg"
    sb.storage.from_("images").upload(storage_path, file_bytes, {"content-type": media_type})
    return storage_path


def ingest_document(
    file_bytes: bytes,
    filename: str,
    user_id: str,
    folder_id: str | None = None,
) -> dict:
    """Ingest a document or image: parse, hash, deduplicate, chunk, embed, store."""
    content_hash = compute_content_hash(file_bytes)

    if check_duplicate(content_hash, user_id):
        return {"duplicate": True, "chunks": 0, "document_ids": []}

    ext = Path(filename).suffix.lower()
    is_image = ext in IMAGE_EXTENSIONS
    image_storage_path: str | None = None

    # Upload image to storage before parsing
    if is_image:
        image_storage_path = upload_image_to_storage(file_bytes, user_id, content_hash, filename)

    # Parse: image via Claude Vision, documents via Docling
    if is_image:
        text = extract_from_image(file_bytes, filename)
    else:
        text = parse_document(file_bytes, filename)

    if not text.strip():
        return {"duplicate": False, "chunks": 0, "document_ids": []}

    chunks = chunk_text(text)
    if not chunks:
        return {"duplicate": False, "chunks": 0, "document_ids": []}

    source_type = EXTENSION_TO_TYPE.get(ext, "text")
    sb = get_supabase()
    inserted_ids: list[str] = []

    for i, chunk in enumerate(chunks):
        embedding = embed_document(chunk)
        meta = extract_metadata(chunk)

        metadata = {
            "source_filename": filename,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "topic": meta["topic"],
            "keywords": meta["keywords"],
        }
        if image_storage_path:
            metadata["image_url"] = image_storage_path

        row = {
            "content": chunk,
            "embedding": embedding,
            "metadata": metadata,
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

    sb.table("documents").update({"status": "completed"}).eq("content_hash", content_hash).eq(
        "user_id", user_id
    ).execute()

    return {"duplicate": False, "chunks": len(inserted_ids), "document_ids": inserted_ids}
