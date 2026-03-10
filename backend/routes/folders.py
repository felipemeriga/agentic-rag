"""Folder CRUD endpoints for organizing documents."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from db.client import get_supabase

router = APIRouter(prefix="/api/folders")


class CreateFolderRequest(BaseModel):
    name: str
    parent_id: str | None = None


class RenameFolderRequest(BaseModel):
    name: str


@router.get("")
async def list_folders(
    parent_id: str | None = None,
    user_id: str = Depends(get_current_user),
):
    """List folders for a given parent (or root if parent_id is None)."""
    sb = get_supabase()
    query = sb.table("folders").select("*").eq("user_id", user_id)

    if parent_id:
        query = query.eq("parent_id", parent_id)
    else:
        query = query.is_("parent_id", "null")

    result = query.order("name").execute()
    return result.data


@router.post("")
async def create_folder(
    body: CreateFolderRequest,
    user_id: str = Depends(get_current_user),
):
    """Create a new folder."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Folder name cannot be empty")

    sb = get_supabase()

    # Verify parent folder belongs to user if specified
    if body.parent_id:
        parent = (
            sb.table("folders")
            .select("id")
            .eq("id", body.parent_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not parent.data:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    result = (
        sb.table("folders")
        .insert(
            {
                "name": body.name.strip(),
                "parent_id": body.parent_id,
                "user_id": user_id,
            }
        )
        .execute()
    )
    return result.data[0]


@router.patch("/{folder_id}")
async def rename_folder(
    folder_id: str,
    body: RenameFolderRequest,
    user_id: str = Depends(get_current_user),
):
    """Rename a folder."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Folder name cannot be empty")

    sb = get_supabase()
    result = (
        sb.table("folders")
        .update({"name": body.name.strip()})
        .eq("id", folder_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result.data[0]


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: str,
    user_id: str = Depends(get_current_user),
):
    """Delete a folder and all subfolders (cascade). Documents get folder_id set to null."""
    sb = get_supabase()
    sb.table("folders").delete().eq("id", folder_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.get("/{folder_id}/breadcrumbs")
async def get_breadcrumbs(
    folder_id: str,
    user_id: str = Depends(get_current_user),
):
    """Return the breadcrumb path from root to the given folder."""
    sb = get_supabase()
    breadcrumbs = []
    current_id: str | None = folder_id

    while current_id:
        result = (
            sb.table("folders")
            .select("id, name, parent_id")
            .eq("id", current_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            break
        folder = result.data[0]
        breadcrumbs.append({"id": folder["id"], "name": folder["name"]})
        current_id = folder.get("parent_id")

    breadcrumbs.reverse()
    return breadcrumbs
