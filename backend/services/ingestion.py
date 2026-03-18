"""Document ingestion pipeline: parse, hash, deduplicate, chunk, embed, store."""

import hashlib
from pathlib import Path

from db.client import get_supabase
from services.chunker import chunk_text
from services.embeddings import embed_document
from services.metadata import extract_metadata
from services.parser import extract_from_image, parse_document, transcribe_audio
from services.scope import resolve_root_folder_id

EXTENSION_TO_TYPE = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".html": "html",
    ".htm": "html",
    ".md": "markdown",
    ".markdown": "markdown",
    ".txt": "text",
    ".text": "text",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".mp3": "audio",
    ".webm": "audio",
    ".m4a": "audio",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
AUDIO_EXTENSIONS = {".mp3", ".webm", ".m4a"}


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


def upload_audio_to_storage(
    file_bytes: bytes, user_id: str, content_hash: str, filename: str
) -> str:
    """Upload raw audio to Supabase Storage and return the path."""
    ext = Path(filename).suffix.lower().lstrip(".")
    storage_path = f"{user_id}/{content_hash}.{ext}"
    sb = get_supabase()
    mime_types = {"mp3": "audio/mpeg", "webm": "audio/webm", "m4a": "audio/mp4"}
    media_type = mime_types.get(ext, "audio/mpeg")
    sb.storage.from_("audio").upload(storage_path, file_bytes, {"content-type": media_type})
    return storage_path


DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".html",
    ".htm",
    ".md",
    ".markdown",
    ".txt",
    ".text",
    ".json",
    ".yaml",
    ".yml",
}


def upload_document_to_storage(
    file_bytes: bytes, user_id: str, content_hash: str, filename: str
) -> str:
    """Upload raw document to Supabase Storage and return the path."""
    ext = Path(filename).suffix.lower().lstrip(".")
    storage_path = f"{user_id}/{content_hash}.{ext}"
    sb = get_supabase()
    mime_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "html": "text/html",
        "htm": "text/html",
        "md": "text/markdown",
        "markdown": "text/markdown",
        "txt": "text/plain",
        "text": "text/plain",
        "json": "application/json",
        "yaml": "text/yaml",
        "yml": "text/yaml",
    }
    media_type = mime_types.get(ext, "application/octet-stream")
    sb.storage.from_("documents").upload(storage_path, file_bytes, {"content-type": media_type})
    return storage_path


def ingest_document(
    file_bytes: bytes,
    filename: str,
    user_id: str,
    folder_id: str | None = None,
) -> dict:
    """Ingest a document or image: parse, hash, deduplicate, chunk, embed, store."""
    # Resolve root folder for scope filtering
    root_folder_id = None
    if folder_id:
        root_folder_id = resolve_root_folder_id(folder_id, user_id)

    content_hash = compute_content_hash(file_bytes)

    if check_duplicate(content_hash, user_id):
        return {"duplicate": True, "chunks": 0, "document_ids": []}

    ext = Path(filename).suffix.lower()
    is_image = ext in IMAGE_EXTENSIONS
    is_audio = ext in AUDIO_EXTENSIONS
    is_document = ext in DOCUMENT_EXTENSIONS
    media_storage_path: str | None = None
    media_type: str | None = None  # "image" or "audio"

    # Upload media to storage before parsing
    if is_image:
        media_storage_path = upload_image_to_storage(file_bytes, user_id, content_hash, filename)
        media_type = "image"
    elif is_audio:
        media_storage_path = upload_audio_to_storage(file_bytes, user_id, content_hash, filename)
        media_type = "audio"
    elif is_document:
        media_storage_path = upload_document_to_storage(file_bytes, user_id, content_hash, filename)
        media_type = "document"

    # Parse: image via Claude Vision, audio via Whisper, documents via Docling
    if is_image:
        text = extract_from_image(file_bytes, filename)
    elif is_audio:
        text = transcribe_audio(file_bytes, filename)
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
        if media_storage_path and media_type == "image":
            metadata["image_url"] = media_storage_path
        elif media_storage_path and media_type == "audio":
            metadata["audio_url"] = media_storage_path
        elif media_storage_path and media_type == "document":
            metadata["file_url"] = media_storage_path

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
        if root_folder_id:
            row["root_folder_id"] = root_folder_id

        result = sb.table("documents").insert(row).execute()
        inserted_ids.append(result.data[0]["id"])

    sb.table("documents").update({"status": "completed"}).eq("content_hash", content_hash).eq(
        "user_id", user_id
    ).execute()

    return {"duplicate": False, "chunks": len(inserted_ids), "document_ids": inserted_ids}
