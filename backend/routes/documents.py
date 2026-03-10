"""Document upload, list, delete, and move endpoints."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from auth import get_current_user
from db.client import get_supabase
from services.ingestion import ingest_document

router = APIRouter(prefix="/api/documents")


ALLOWED_EXTENSIONS = {".txt", ".text", ".md", ".markdown", ".pdf", ".docx", ".html", ".htm"}


@router.post("/upload")
async def upload_document(
    file: UploadFile,
    folder_id: str | None = None,
    user_id: str = Depends(get_current_user),
):
    """Upload a document for ingestion. Supports PDF, DOCX, HTML, Markdown, and text."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty")

    result = ingest_document(
        file_bytes=file_bytes, filename=file.filename, user_id=user_id, folder_id=folder_id
    )

    return {
        "filename": file.filename,
        "duplicate": result["duplicate"],
        "chunks": result["chunks"],
        "document_ids": result["document_ids"],
    }


@router.get("")
async def list_documents(
    folder_id: str | None = None,
    user_id: str = Depends(get_current_user),
):
    """List user's uploaded documents, grouped by source filename, optionally filtered by folder."""
    sb = get_supabase()
    query = (
        sb.table("documents")
        .select("id, source_filename, metadata, status, created_at, folder_id")
        .eq("user_id", user_id)
    )

    if folder_id:
        query = query.eq("folder_id", folder_id)
    else:
        query = query.is_("folder_id", "null")

    result = query.order("created_at", desc=True).execute()

    # Group by source_filename
    files: dict[str, dict] = {}
    for doc in result.data:
        fname = doc.get("source_filename") or "unknown"
        if fname not in files:
            files[fname] = {
                "source_filename": fname,
                "chunks": 0,
                "status": doc.get("status", "completed"),
                "created_at": doc["created_at"],
                "folder_id": doc.get("folder_id"),
            }
        files[fname]["chunks"] += 1
        # If any chunk is processing or failed, reflect that
        if doc.get("status") == "processing":
            files[fname]["status"] = "processing"
        elif doc.get("status") == "failed" and files[fname]["status"] != "processing":
            files[fname]["status"] = "failed"

    return list(files.values())


@router.get("/filters")
async def get_filters(user_id: str = Depends(get_current_user)):
    """Return available topics and keywords for the user's documents."""
    sb = get_supabase()
    result = (
        sb.table("documents")
        .select("metadata")
        .or_(f"user_id.eq.{user_id},user_id.is.null")
        .not_.is_("metadata", "null")
        .execute()
    )

    topics: set[str] = set()
    keywords: set[str] = set()
    for doc in result.data:
        meta = doc.get("metadata") or {}
        if meta.get("topic") and meta["topic"] != "unknown":
            topics.add(meta["topic"])
        for kw in meta.get("keywords", []):
            keywords.add(kw)

    return {
        "topics": sorted(topics),
        "keywords": sorted(keywords),
    }


class MoveDocumentRequest(BaseModel):
    folder_id: str | None = None


@router.patch("/{filename}/move")
async def move_document(
    filename: str,
    body: MoveDocumentRequest,
    user_id: str = Depends(get_current_user),
):
    """Move all chunks of a document to a different folder (or root if folder_id is null)."""
    sb = get_supabase()

    # Verify target folder belongs to user if specified
    if body.folder_id:
        folder = (
            sb.table("folders")
            .select("id")
            .eq("id", body.folder_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not folder.data:
            raise HTTPException(status_code=404, detail="Target folder not found")

    sb.table("documents").update({"folder_id": body.folder_id}).eq("source_filename", filename).eq(
        "user_id", user_id
    ).execute()
    return {"ok": True}


@router.delete("/{filename}")
async def delete_document(filename: str, user_id: str = Depends(get_current_user)):
    """Delete all chunks for a given filename belonging to the user."""
    sb = get_supabase()
    sb.table("documents").delete().eq("source_filename", filename).eq("user_id", user_id).execute()
    return {"ok": True}
