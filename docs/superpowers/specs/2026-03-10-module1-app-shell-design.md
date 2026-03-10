# Module 1 — App Shell Design

## Overview

Full-stack app shell with Supabase email/password auth, chat UI with sidebar conversation list, and basic RAG wired end-to-end using seeded test documents.

## Architecture

```
Browser (React + MUI dark theme)
  │
  ├── Supabase JS SDK → Supabase Auth (email/password)
  │
  └── REST calls → FastAPI Backend
                      ├── GET    /api/conversations      (list threads)
                      ├── POST   /api/conversations       (create thread)
                      ├── GET    /api/conversations/:id   (get messages)
                      ├── DELETE /api/conversations/:id   (delete thread)
                      ├── POST   /api/chat                (send message → SSE stream)
                      └── Auth middleware (validates Supabase JWT)
                              │
                              ├── Embed query (Voyage AI)
                              ├── Search Supabase pgvector
                              ├── Inject top chunks into system prompt
                              └── Stream Claude Haiku response via SSE
```

Auth is client-side (Supabase JS SDK). Backend validates JWTs on protected endpoints.

## Database Schema

```sql
create extension if not exists vector;

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on conversation changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Documents table has no RLS; shared read-only data accessed via service key
create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1024),
  metadata jsonb,
  created_at timestamptz default now()
);

-- HNSW works at any table size, unlike IVFFlat which needs tuning
create index on documents using hnsw (embedding vector_cosine_ops);

alter table conversations enable row level security;
alter table messages enable row level security;

create policy "Users manage own conversations"
  on conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own messages"
  on messages for all
  using (conversation_id in (select id from conversations where user_id = auth.uid()))
  with check (conversation_id in (select id from conversations where user_id = auth.uid()));
```

## Frontend

- **Framework:** React + TypeScript + Vite + MUI (dark theme, no theme switching)
- **Pages:** `/login` (email/password login + signup), `/` (main chat, protected)
- **Layout:** Left sidebar (~280px) with conversation list + "New Chat" button + user info/logout. Main area with scrollable message list + fixed input bar.
- **Routing:** React Router for `/login` and `/` pages
- **Components:** AuthProvider, ProtectedRoute, Sidebar, ChatArea, MessageBubble (markdown rendering), ChatInput (disabled while streaming), StreamingMessage (renders SSE tokens)
- **Behavior:** Fetch conversations on login, select most recent. "New Chat" creates and selects a conversation. Messages stream via SSE with auto-scroll.

## Backend

```
backend/
├── pyproject.toml
├── main.py              # FastAPI app, CORS, router includes
├── auth.py              # JWT validation (Supabase)
├── routes/
│   ├── conversations.py # CRUD for conversations
│   └── chat.py          # SSE streaming endpoint
├── services/
│   ├── rag.py           # Embed → search → prompt → Claude
│   └── embeddings.py    # Voyage AI embedding calls
├── db/
│   ├── supabase.py      # Supabase client singleton
│   ├── schema.sql       # DDL
│   └── seed.sql         # Test documents with pre-computed embeddings
└── .env.example
```

**Auth middleware:** Validates `Authorization: Bearer <token>` against Supabase JWT secret, injects `user_id` into request state, returns 401 if invalid.

**Chat request body:** `{ "conversation_id": "uuid", "content": "string" }`

**Chat flow:**
1. Save user message to DB, update conversation's `updated_at`
2. Embed message via Voyage AI
3. Query documents table (cosine similarity, top 5 chunks)
4. Build system prompt with retrieved chunks
5. Fetch conversation history from DB
6. Call Claude Haiku API with streaming
7. SSE stream tokens to frontend
8. On completion, save assistant message to DB

## Model

Claude Haiku (`claude-haiku-4-5-20251001`) — cheapest model, suitable for dev/testing.

## Dev Setup

- Frontend: `npm run dev` (Vite, port 5173, proxies `/api/*` to backend)
- Backend: `uv run fastapi dev main.py` (port 8000)
- CORS: backend allows `http://localhost:5173`

## Seed Data

5-10 text chunks with pre-computed Voyage AI embeddings, inserted via `seed.sql`. Topic: RAG concepts (self-referential test data).

## Environment Variables

```
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=
```
