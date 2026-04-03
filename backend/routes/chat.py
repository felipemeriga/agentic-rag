from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import get_current_user
from services.rag import stream_rag_response

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    conversation_id: str
    content: str
    topic: str | None = None
    keyword: str | None = None
    fast_mode: bool = False


@router.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user)):
    def event_generator():
        yield from stream_rag_response(
            conversation_id=request.conversation_id,
            user_message=request.content,
            user_id=user_id,
            topic=request.topic,
            keyword=request.keyword,
            fast_mode=request.fast_mode,
        )

    return StreamingResponse(event_generator(), media_type="text/event-stream")
