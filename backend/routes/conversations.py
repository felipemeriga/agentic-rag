from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from db.supabase import get_supabase

router = APIRouter(prefix="/api/conversations")


@router.get("")
async def list_conversations(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    result = (
        sb.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data


@router.post("")
async def create_conversation(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    result = (
        sb.table("conversations")
        .insert({"user_id": user_id})
        .execute()
    )
    return result.data[0]


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str, user_id: str = Depends(get_current_user)
):
    sb = get_supabase()
    conv = (
        sb.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = (
        sb.table("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    return {**conv.data[0], "messages": messages.data}


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str, user_id: str = Depends(get_current_user)
):
    sb = get_supabase()
    sb.table("conversations").delete().eq("id", conversation_id).eq(
        "user_id", user_id
    ).execute()
    return {"ok": True}
