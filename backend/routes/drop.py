"""External drop endpoint for programmatic file ingestion."""

import os

from fastapi import APIRouter, Header, HTTPException, UploadFile, Form
from db.client import get_supabase
from services.ingestion import (
    EXTENSION_TO_TYPE,
    IMAGE_EXTENSIONS,
    AUDIO_EXTENSIONS,
    DOCUMENT_EXTENSIONS,
    ingest_document,
)

router = APIRouter(prefix="/api")

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_AUDIO_SIZE = 25 * 1024 * 1024
MAX_DOCUMENT_SIZE = 50 * 1024 * 1024


def _verify_api_key(api_key: str) -> None:
    expected = os.environ.get("DROP_API_KEY")
    if not expected or api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _resolve_user_id(email: str) -> str:
    sb = get_supabase()
    users = sb.auth.admin.list_users()
    for user in users:
        if user.email == email:
            return user.id
    raise HTTPException(status_code=404, detail=f"User with email '{email}' not found")


def _find_or_create_folder(folder_path: str, user_id: str) -> str:
    """Resolve a folder path like 'Bank/Claro/2026', creating each level as needed."""
    sb = get_supabase()
    parts = [p.strip() for p in folder_path.split("/") if p.strip()]
    if not parts:
        raise HTTPException(status_code=400, detail="Empty folder name")

    parent_id: str | None = None
    folder_id: str | None = None

    for part in parts:
        query = (
            sb.table("folders")
            .select("id")
            .eq("user_id", user_id)
            .ilike("name", part)
            .limit(1)
        )
        if parent_id:
            query = query.eq("parent_id", parent_id)
        else:
            query = query.is_("parent_id", "null")

        result = query.execute()

        if result.data:
            folder_id = result.data[0]["id"]
        else:
            row = {"name": part, "user_id": user_id}
            if parent_id:
                row["parent_id"] = parent_id
            result = sb.table("folders").insert(row).execute()
            folder_id = result.data[0]["id"]

        parent_id = folder_id

    return folder_id


@router.post("/drop")
async def drop_document(
    file: UploadFile,
    folder_name: str = Form(default=None),
    x_api_key: str = Header(),
    x_user_email: str = Header(),
):
    """Accept a file from an external app, ingest it into the RAG pipeline."""
    _verify_api_key(x_api_key)
    user_id = _resolve_user_id(x_user_email)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in EXTENSION_TO_TYPE:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty")

    # Size limits
    if ext in IMAGE_EXTENSIONS and len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image too large. Maximum 10MB.")
    if ext in AUDIO_EXTENSIONS and len(file_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=400, detail="Audio too large. Maximum 25MB.")
    if ext in DOCUMENT_EXTENSIONS and len(file_bytes) > MAX_DOCUMENT_SIZE:
        raise HTTPException(status_code=400, detail="Document too large. Maximum 50MB.")

    # Resolve folder
    folder_id = None
    if folder_name and folder_name.strip():
        folder_id = _find_or_create_folder(folder_name.strip(), user_id)

    result = ingest_document(
        file_bytes=file_bytes,
        filename=file.filename,
        user_id=user_id,
        folder_id=folder_id,
    )

    if result["duplicate"]:
        raise HTTPException(status_code=409, detail="Duplicate file — already ingested")

    return {
        "status": "ok",
        "filename": file.filename,
        "folder_id": folder_id,
        "chunks": result["chunks"],
    }
