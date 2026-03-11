"""API key management endpoints for MCP authentication."""

import hashlib
import secrets

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user
from db.client import get_supabase

router = APIRouter(prefix="/api/api-keys")


class CreateKeyRequest(BaseModel):
    name: str = "Default"


class ApiKeyResponse(BaseModel):
    name: str
    created_at: str


class CreateKeyResponse(BaseModel):
    key: str
    name: str
    created_at: str


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


@router.get("")
async def get_api_key(
    user_id: str = Depends(get_current_user),
) -> ApiKeyResponse | None:
    """Check if user has an active API key. Returns metadata only."""
    sb = get_supabase()
    result = (
        sb.table("api_keys")
        .select("name, created_at")
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    return ApiKeyResponse(name=row["name"], created_at=row["created_at"])


@router.post("")
async def create_api_key(
    body: CreateKeyRequest,
    user_id: str = Depends(get_current_user),
) -> CreateKeyResponse:
    """Generate a new API key. Replaces any existing key for this user."""
    sb = get_supabase()

    # Delete existing key if any
    sb.table("api_keys").delete().eq("user_id", user_id).execute()

    # Generate new key
    raw_key = f"rag_{secrets.token_hex(32)}"
    key_hash = _hash_key(raw_key)

    result = (
        sb.table("api_keys")
        .insert(
            {
                "user_id": user_id,
                "key_hash": key_hash,
                "name": body.name.strip() or "Default",
            }
        )
        .execute()
    )

    row = result.data[0]
    return CreateKeyResponse(
        key=raw_key,
        name=row["name"],
        created_at=row["created_at"],
    )


@router.delete("")
async def revoke_api_key(
    user_id: str = Depends(get_current_user),
):
    """Revoke the user's API key."""
    sb = get_supabase()
    sb.table("api_keys").delete().eq("user_id", user_id).execute()
    return {"ok": True}
