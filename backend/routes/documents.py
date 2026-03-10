"""Document upload, list, and delete endpoints."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from auth import get_current_user
from db.client import get_supabase
from services.ingestion import ingest_document

router = APIRouter(prefix="/api/documents")


@router.post("/upload")
async def upload_document(file: UploadFile, user_id: str = Depends(get_current_user)):
    """Upload a text/markdown file for ingestion."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    allowed_types = {".txt", ".md", ".text", ".markdown"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(allowed_types))}",
        )

    content_bytes = await file.read()
    content = content_bytes.decode("utf-8")

    if not content.strip():
        raise HTTPException(status_code=400, detail="File is empty")

    doc_ids = ingest_document(content=content, filename=file.filename, user_id=user_id)

    return {
        "filename": file.filename,
        "chunks": len(doc_ids),
        "document_ids": doc_ids,
    }


@router.get("")
async def list_documents(user_id: str = Depends(get_current_user)):
    """List user's uploaded documents, grouped by source filename."""
    sb = get_supabase()
    result = (
        sb.table("documents")
        .select("id, source_filename, metadata, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    # Group by source_filename
    files: dict[str, dict] = {}
    for doc in result.data:
        fname = doc.get("source_filename") or "unknown"
        if fname not in files:
            files[fname] = {
                "source_filename": fname,
                "chunks": 0,
                "created_at": doc["created_at"],
            }
        files[fname]["chunks"] += 1

    return list(files.values())


@router.delete("/{filename}")
async def delete_document(filename: str, user_id: str = Depends(get_current_user)):
    """Delete all chunks for a given filename belonging to the user."""
    sb = get_supabase()
    sb.table("documents").delete().eq("source_filename", filename).eq("user_id", user_id).execute()
    return {"ok": True}
