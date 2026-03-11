from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.chat import router as chat_router
from routes.conversations import router as conversations_router
from routes.documents import router as documents_router
from routes.folders import router as folders_router
from routes.api_keys import router as api_keys_router

load_dotenv()

app = FastAPI(title="Agentic RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversations_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(folders_router)
app.include_router(api_keys_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
