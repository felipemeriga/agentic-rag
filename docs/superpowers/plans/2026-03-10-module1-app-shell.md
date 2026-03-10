# Module 1 — App Shell Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack chat app with Supabase auth, conversation management, and basic RAG (seeded documents → vector search → Claude Haiku streaming responses).

**Architecture:** React+MUI frontend handles auth via Supabase JS SDK and communicates with a FastAPI backend over REST. The backend validates JWTs, manages conversations/messages in Supabase Postgres, and serves a streaming RAG endpoint that embeds queries via Voyage AI, searches pgvector, and streams Claude Haiku responses via SSE.

**Tech Stack:** React, TypeScript, Vite, MUI, React Router, Supabase JS SDK, Python, FastAPI, uv, Anthropic SDK, Voyage AI, Supabase (Postgres + pgvector + Auth)

**Spec:** `docs/superpowers/specs/2026-03-10-module1-app-shell-design.md`

---

## Chunk 1: Project Scaffolding & Database

### Task 1: Backend project setup

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/main.py`
- Create: `backend/.env.example`
- Create: `.env.example` (root, for reference)

- [ ] **Step 1: Initialize backend with uv**

```bash
cd backend
uv init --no-readme
```

- [ ] **Step 2: Add dependencies**

```bash
cd backend
uv add fastapi uvicorn[standard] supabase anthropic voyageai python-dotenv pyjwt[crypto]
```

- [ ] **Step 3: Create main.py with health check**

Create `backend/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Agentic RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create .env.example**

Create `backend/.env.example`:

```
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=
```

Note: Frontend env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are in `frontend/.env.example`, created in Task 4.

- [ ] **Step 5: Verify backend starts**

```bash
cd backend
uv run fastapi dev main.py
```

Visit `http://localhost:8000/api/health` — should return `{"status": "ok"}`.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend with FastAPI and uv"
```

---

### Task 2: Database schema

**Files:**
- Create: `backend/db/schema.sql`

- [ ] **Step 1: Create schema.sql**

Create `backend/db/schema.sql` with the full DDL from the spec:

```sql
create extension if not exists vector;

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1024),
  metadata jsonb,
  created_at timestamptz default now()
);

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

-- Similarity search function for RAG
create or replace function match_documents(
  query_embedding vector(1024),
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

- [ ] **Step 2: Run schema against Supabase**

Run via Supabase SQL Editor (Dashboard → SQL Editor → paste and run) or:

```bash
psql "$SUPABASE_URL" -f backend/db/schema.sql
```

Verify tables exist in Supabase Dashboard → Table Editor.

- [ ] **Step 3: Commit**

```bash
git add backend/db/schema.sql
git commit -m "feat: add database schema with pgvector and RLS"
```

---

### Task 3: Supabase client singleton

**Files:**
- Create: `backend/db/__init__.py`
- Create: `backend/db/supabase.py`

- [ ] **Step 1: Create __init__.py**

Create empty `backend/db/__init__.py`.

- [ ] **Step 2: Create supabase.py**

Create `backend/db/supabase.py`:

```python
import os
from functools import lru_cache
from supabase import create_client, Client


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/
git commit -m "feat: add Supabase client singleton"
```

---

### Task 4: Frontend project setup

**Files:**
- Create: `frontend/` (Vite scaffold)
- Modify: `frontend/vite.config.ts` (add proxy)
- Modify: `frontend/src/main.tsx` (MUI dark theme)

- [ ] **Step 1: Scaffold Vite React TypeScript project**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material react-router-dom @supabase/supabase-js react-markdown
```

- [ ] **Step 3: Configure Vite proxy**

Replace `frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Set up MUI dark theme**

Replace `frontend/src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Step 5: Create Supabase client**

Create `frontend/src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Create `frontend/.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 6: Verify frontend starts**

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` — should show default Vite page with dark theme.

- [ ] **Step 7: Clean up default Vite files**

Remove `frontend/src/App.css`, `frontend/src/index.css`, `frontend/src/assets/`. Replace `frontend/src/App.tsx`:

```typescript
import { Typography, Box } from "@mui/material";

function App() {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <Typography variant="h4">Agentic RAG</Typography>
    </Box>
  );
}

export default App;
```

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React, MUI dark theme"
```

---

## Chunk 2: Authentication

### Task 5: Backend JWT auth middleware

**Files:**
- Create: `backend/auth.py`
- Create: `backend/routes/__init__.py`

- [ ] **Step 1: Create auth.py**

Create `backend/auth.py`:

```python
import os
from fastapi import Request, HTTPException
import jwt


async def get_current_user(request: Request) -> str:
    """Extract and validate Supabase JWT. Returns user_id."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header.split(" ", 1)[1]
    secret = os.environ["SUPABASE_JWT_SECRET"]

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no sub claim")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

- [ ] **Step 2: Create routes/__init__.py**

Create empty `backend/routes/__init__.py`.

- [ ] **Step 3: Commit**

```bash
git add backend/auth.py backend/routes/__init__.py
git commit -m "feat: add JWT auth middleware for Supabase"
```

---

### Task 6: Frontend auth pages

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/AuthProvider.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create API client**

Create `frontend/src/lib/api.ts`:

```typescript
import { supabase } from "./supabase";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response;
}
```

- [ ] **Step 2: Create AuthProvider**

Create `frontend/src/components/AuthProvider.tsx`:

```typescript
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 3: Create ProtectedRoute**

Create `frontend/src/components/ProtectedRoute.tsx`:

```typescript
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { CircularProgress, Box } from "@mui/material";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Create LoginPage**

Create `frontend/src/pages/LoginPage.tsx`:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Tab,
  Tabs,
} from "@mui/material";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (tab === 0) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <Card sx={{ width: 400 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom align="center">
            Agentic RAG
          </Typography>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
            <Tab label="Sign In" />
            <Tab label="Sign Up" />
          </Tabs>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading
                ? "Loading..."
                : tab === 0
                  ? "Sign In"
                  : "Sign Up"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
```

- [ ] **Step 5: Wire up routing in App.tsx**

Replace `frontend/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import { Typography, Box } from "@mui/material";

function ChatPage() {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <Typography variant="h4">Chat (coming soon)</Typography>
    </Box>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 6: Verify auth flow**

1. Run frontend (`npm run dev`)
2. Visit `http://localhost:5173` — should redirect to `/login`
3. Sign up with email/password
4. Should redirect to `/` showing "Chat (coming soon)"
5. Refresh — should stay on `/`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add auth flow with login, signup, and protected routes"
```

---

## Chunk 3: Conversation Management

### Task 7: Backend conversation endpoints

**Files:**
- Create: `backend/routes/conversations.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create conversations.py**

Create `backend/routes/conversations.py`:

```python
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
```

- [ ] **Step 2: Register router in main.py**

Add to `backend/main.py`, after the CORS middleware:

```python
from routes.conversations import router as conversations_router

app.include_router(conversations_router)
```

- [ ] **Step 3: Verify endpoints**

Start backend, then test with curl (use a valid Supabase JWT):

```bash
# Create conversation
curl -X POST http://localhost:8000/api/conversations \
  -H "Authorization: Bearer $TOKEN"

# List conversations
curl http://localhost:8000/api/conversations \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/conversations.py backend/main.py
git commit -m "feat: add conversation CRUD endpoints"
```

---

### Task 8: Frontend sidebar and conversation management

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/pages/ChatPage.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add API functions for conversations**

Append to `frontend/src/lib/api.ts`:

```typescript
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiFetch("/api/conversations");
  return res.json();
}

export async function createConversation(): Promise<Conversation> {
  const res = await apiFetch("/api/conversations", { method: "POST" });
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export async function fetchConversation(
  id: string
): Promise<ConversationWithMessages> {
  const res = await apiFetch(`/api/conversations/${id}`);
  return res.json();
}
```

- [ ] **Step 2: Create Sidebar**

Create `frontend/src/components/Sidebar.tsx`:

```typescript
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Button,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "./AuthProvider";
import { Conversation } from "../lib/api";

interface SidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({
  conversations,
  selectedId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  const { user, signOut } = useAuth();

  return (
    <Box
      sx={{
        width: 280,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onNew}
        >
          New Chat
        </Button>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflow: "auto" }}>
        {conversations.map((conv) => (
          <ListItemButton
            key={conv.id}
            selected={conv.id === selectedId}
            onClick={() => onSelect(conv.id)}
          >
            <ListItemText
              primary={conv.title}
              primaryTypographyProps={{ noWrap: true }}
            />
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" noWrap sx={{ flex: 1 }}>
          {user?.email}
        </Typography>
        <IconButton size="small" onClick={signOut}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Create ChatPage**

Create `frontend/src/pages/ChatPage.tsx`:

```typescript
import { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import Sidebar from "../components/Sidebar";
import {
  Conversation,
  fetchConversations,
  createConversation,
  deleteConversation,
  fetchConversation,
  Message,
} from "../lib/api";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const loadConversations = async (autoSelect = false) => {
    const convs = await fetchConversations();
    setConversations(convs);
    if (autoSelect && convs.length > 0) {
      setSelectedId(convs[0].id);
    }
  };

  useEffect(() => {
    loadConversations(true);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchConversation(selectedId).then((conv) => setMessages(conv.messages));
    } else {
      setMessages([]);
    }
  }, [selectedId]);

  const handleNew = async () => {
    const conv = await createConversation();
    setConversations((prev) => [conv, ...prev]);
    setSelectedId(conv.id);
    setMessages([]);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (selectedId === id) {
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selectedId ? (
          <Typography color="text.secondary">
            {messages.length} messages (chat input coming next)
          </Typography>
        ) : (
          <Typography color="text.secondary">
            Select or create a conversation
          </Typography>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Update App.tsx to use ChatPage**

Replace the `ChatPage` placeholder in `frontend/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 5: Verify sidebar**

1. Start both frontend and backend
2. Log in → should see sidebar with "New Chat" button
3. Click "New Chat" → conversation appears in sidebar
4. Click delete → conversation removed

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add sidebar with conversation management"
```

---

## Chunk 4: RAG Pipeline & Chat

### Task 9: Voyage AI embeddings service

**Files:**
- Create: `backend/services/__init__.py`
- Create: `backend/services/embeddings.py`

- [ ] **Step 1: Create services/__init__.py**

Create empty `backend/services/__init__.py`.

- [ ] **Step 2: Create embeddings.py**

Create `backend/services/embeddings.py`:

```python
import os
import voyageai


def get_voyage_client() -> voyageai.Client:
    return voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])


def embed_query(text: str) -> list[float]:
    """Embed a single query string. Returns a 1024-dim vector."""
    client = get_voyage_client()
    result = client.embed([text], model="voyage-3", input_type="query")
    return result.embeddings[0]


def embed_document(text: str) -> list[float]:
    """Embed a document chunk. Returns a 1024-dim vector."""
    client = get_voyage_client()
    result = client.embed([text], model="voyage-3", input_type="document")
    return result.embeddings[0]
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/
git commit -m "feat: add Voyage AI embeddings service"
```

---

### Task 10: RAG service

**Files:**
- Create: `backend/services/rag.py`

- [ ] **Step 1: Create rag.py**

Create `backend/services/rag.py`:

```python
import os
import json
from collections.abc import Generator
import anthropic
from services.embeddings import embed_query
from db.supabase import get_supabase


def search_documents(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """Search documents by cosine similarity using pgvector."""
    sb = get_supabase()
    # Use Supabase RPC to call a similarity search function,
    # or use raw SQL via the REST API.
    # For simplicity, we use the rpc approach with a database function.
    result = sb.rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_count": top_k,
        },
    ).execute()
    return result.data


def build_system_prompt(context_chunks: list[dict]) -> str:
    """Build system prompt with retrieved context."""
    if not context_chunks:
        return "You are a helpful assistant. No relevant documents were found for this query."

    context = "\n\n---\n\n".join(
        [chunk["content"] for chunk in context_chunks]
    )
    return f"""You are a helpful assistant that answers questions based on the provided context.
Use the following retrieved documents to answer the user's question.
If the context doesn't contain relevant information, say so honestly.

<context>
{context}
</context>"""


def stream_rag_response(
    conversation_id: str, user_message: str, user_id: str
) -> Generator[str, None, None]:
    """
    Full RAG pipeline: save message, embed, search, stream Claude response.
    Yields SSE-formatted strings. Returns the full assistant response.
    """
    sb = get_supabase()

    # 1. Save user message
    sb.table("messages").insert(
        {
            "conversation_id": conversation_id,
            "role": "user",
            "content": user_message,
        }
    ).execute()

    # Update conversation's updated_at
    sb.table("conversations").update(
        {"title": user_message[:50]}
    ).eq("id", conversation_id).eq("user_id", user_id).execute()

    # 2. Embed query
    query_embedding = embed_query(user_message)

    # 3. Search documents
    context_chunks = search_documents(query_embedding)

    # 4. Build system prompt
    system_prompt = build_system_prompt(context_chunks)

    # 5. Fetch conversation history
    history = (
        sb.table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )

    messages = [{"role": m["role"], "content": m["content"]} for m in history.data]

    # 6-7. Stream Claude response
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    full_response = ""

    with client.messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            full_response += text
            yield f"data: {json.dumps({'token': text})}\n\n"

    # 8. Save assistant message
    sb.table("messages").insert(
        {
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": full_response,
        }
    ).execute()

    yield f"data: {json.dumps({'done': True})}\n\n"
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/rag.py backend/db/schema.sql
git commit -m "feat: add RAG service with vector search and Claude streaming"
```

---

### Task 11: Chat SSE endpoint

**Files:**
- Create: `backend/routes/chat.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create chat.py**

Create `backend/routes/chat.py`:

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from auth import get_current_user
from services.rag import stream_rag_response

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    conversation_id: str
    content: str


@router.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user)):
    def event_generator():
        yield from stream_rag_response(
            conversation_id=request.conversation_id,
            user_message=request.content,
            user_id=user_id,
        )

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

- [ ] **Step 2: Register chat router in main.py**

Add to `backend/main.py`:

```python
from routes.chat import router as chat_router

app.include_router(chat_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/chat.py backend/main.py
git commit -m "feat: add SSE chat endpoint"
```

---

### Task 12: Seed data

**Files:**
- Create: `backend/db/seed.py`

- [ ] **Step 1: Create seed script**

Create `backend/db/seed.py` — a Python script that embeds sample text chunks via Voyage AI and inserts them into Supabase:

```python
"""Seed the documents table with sample RAG content and embeddings."""

import os
import sys
sys.path.insert(0, os.path.dirname(__file__) + "/..")

from dotenv import load_dotenv
load_dotenv()

from services.embeddings import embed_document
from db.supabase import get_supabase

SAMPLE_CHUNKS = [
    {
        "content": "Retrieval-Augmented Generation (RAG) is a technique that combines information retrieval with text generation. It retrieves relevant documents from a knowledge base and uses them as context for a language model to generate accurate, grounded responses.",
        "metadata": {"topic": "RAG overview", "chunk_index": 0},
    },
    {
        "content": "Vector embeddings are dense numerical representations of text that capture semantic meaning. Similar texts have similar embeddings, enabling semantic search. Models like Voyage AI produce high-quality embeddings for retrieval tasks.",
        "metadata": {"topic": "embeddings", "chunk_index": 0},
    },
    {
        "content": "pgvector is a PostgreSQL extension that adds support for vector similarity search. It supports multiple index types including HNSW and IVFFlat, and distance metrics like cosine similarity, inner product, and L2 distance.",
        "metadata": {"topic": "pgvector", "chunk_index": 0},
    },
    {
        "content": "Chunking is the process of splitting documents into smaller pieces for embedding and retrieval. Common strategies include fixed-size chunks with overlap, sentence-based splitting, and recursive character splitting. Typical chunk sizes are 256-512 tokens.",
        "metadata": {"topic": "chunking", "chunk_index": 0},
    },
    {
        "content": "Hybrid search combines vector (semantic) search with keyword (lexical) search. This approach captures both semantic meaning and exact keyword matches. Results from both methods can be merged using Reciprocal Rank Fusion (RRF).",
        "metadata": {"topic": "hybrid search", "chunk_index": 0},
    },
    {
        "content": "Reranking is a second-stage retrieval step that re-scores retrieved documents using a more powerful model. After initial retrieval returns candidate documents, a reranker evaluates each document's relevance to the query more carefully.",
        "metadata": {"topic": "reranking", "chunk_index": 0},
    },
    {
        "content": "Supabase is an open-source Firebase alternative built on PostgreSQL. It provides authentication, real-time subscriptions, storage, and database management. With the pgvector extension, Supabase can serve as a vector database for RAG applications.",
        "metadata": {"topic": "supabase", "chunk_index": 0},
    },
]


def seed():
    sb = get_supabase()

    # Check if documents already exist
    existing = sb.table("documents").select("id").limit(1).execute()
    if existing.data:
        print("Documents already seeded. Skipping.")
        return

    for chunk in SAMPLE_CHUNKS:
        print(f"Embedding: {chunk['metadata']['topic']}...")
        embedding = embed_document(chunk["content"])
        sb.table("documents").insert(
            {
                "content": chunk["content"],
                "embedding": embedding,
                "metadata": chunk["metadata"],
            }
        ).execute()
        print(f"  Inserted.")

    print(f"\nSeeded {len(SAMPLE_CHUNKS)} documents.")


if __name__ == "__main__":
    seed()
```

- [ ] **Step 2: Run seed script**

```bash
cd backend
uv run python db/seed.py
```

Expected: 7 documents seeded. Verify in Supabase Dashboard → Table Editor → documents.

- [ ] **Step 3: Commit**

```bash
git add backend/db/seed.py
git commit -m "feat: add seed script for test documents with embeddings"
```

---

## Chunk 5: Chat UI

### Task 13: Message display components

**Files:**
- Create: `frontend/src/components/MessageBubble.tsx`
- Create: `frontend/src/components/ChatArea.tsx`
- Create: `frontend/src/components/ChatInput.tsx`

- [ ] **Step 1: Create MessageBubble**

Create `frontend/src/components/MessageBubble.tsx`:

```typescript
import { Box, Paper, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 2,
        px: 2,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 2,
          maxWidth: "70%",
          bgcolor: isUser ? "primary.dark" : "grey.900",
        }}
      >
        {isUser ? (
          <Typography>{content}</Typography>
        ) : (
          <Box sx={{ "& p": { m: 0 }, "& pre": { overflow: "auto" } }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
```

- [ ] **Step 2: Create ChatInput**

Create `frontend/src/components/ChatInput.tsx`:

```typescript
import { useState } from "react";
import { Box, TextField, IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", display: "flex", gap: 1 }}>
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder="Type a message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        size="small"
      />
      <IconButton
        color="primary"
        onClick={handleSend}
        disabled={disabled || !input.trim()}
      >
        <SendIcon />
      </IconButton>
    </Box>
  );
}
```

- [ ] **Step 3: Create ChatArea**

Create `frontend/src/components/ChatArea.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { Message } from "../lib/api";

interface ChatAreaProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  onSend: (message: string) => void;
}

export default function ChatArea({
  messages,
  streamingContent,
  isStreaming,
  onSend,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh" }}>
      <Box sx={{ flex: 1, overflow: "auto", py: 2 }}>
        {messages.length === 0 && !isStreaming && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Typography color="text.secondary">
              Send a message to start the conversation
            </Typography>
          </Box>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isStreaming && streamingContent && (
          <MessageBubble role="assistant" content={streamingContent} />
        )}
        <div ref={bottomRef} />
      </Box>
      <ChatInput onSend={onSend} disabled={isStreaming} />
    </Box>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MessageBubble.tsx frontend/src/components/ChatInput.tsx frontend/src/components/ChatArea.tsx
git commit -m "feat: add chat UI components (MessageBubble, ChatInput, ChatArea)"
```

---

### Task 14: SSE streaming and wiring it all together

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/ChatPage.tsx`

- [ ] **Step 1: Add SSE streaming function to api.ts**

Append to `frontend/src/lib/api.ts`:

```typescript
export async function streamChat(
  conversationId: string,
  content: string,
  onToken: (token: string) => void,
  onDone: () => void
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ conversation_id: conversationId, content }),
  });

  if (!response.ok) {
    throw new Error(`Chat error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.done) {
          onDone();
          return;
        }
        if (data.token) {
          onToken(data.token);
        }
      }
    }
  }
  onDone();
}
```

- [ ] **Step 2: Update ChatPage with streaming**

Replace `frontend/src/pages/ChatPage.tsx`:

```typescript
import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import {
  Conversation,
  Message,
  fetchConversations,
  createConversation,
  deleteConversation,
  fetchConversation,
  streamChat,
} from "../lib/api";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef("");

  const loadConversations = async (autoSelect = false) => {
    const convs = await fetchConversations();
    setConversations(convs);
    if (autoSelect && convs.length > 0) {
      setSelectedId(convs[0].id);
    }
  };

  useEffect(() => {
    loadConversations(true);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchConversation(selectedId).then((conv) => setMessages(conv.messages));
    } else {
      setMessages([]);
    }
  }, [selectedId]);

  const handleNew = async () => {
    const conv = await createConversation();
    setConversations((prev) => [conv, ...prev]);
    setSelectedId(conv.id);
    setMessages([]);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (selectedId === id) {
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  const handleSend = async (content: string) => {
    if (!selectedId || isStreaming) return;

    // Optimistically add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");
    streamingRef.current = "";

    try {
      await streamChat(
        selectedId,
        content,
        (token) => {
          streamingRef.current += token;
          setStreamingContent(streamingRef.current);
        },
        () => {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: streamingRef.current,
            created_at: new Date().toISOString(),
          };
          setMessages((msgs) => [...msgs, assistantMsg]);
          setStreamingContent("");
          streamingRef.current = "";
          setIsStreaming(false);
          loadConversations();
        }
      );
    } catch {
      setIsStreaming(false);
      setStreamingContent("");
      streamingRef.current = "";
    }
  };

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <ChatArea
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        onSend={handleSend}
      />
    </Box>
  );
}
```

- [ ] **Step 3: End-to-end verification**

1. Start backend: `cd backend && uv run fastapi dev main.py`
2. Start frontend: `cd frontend && npm run dev`
3. Log in at `http://localhost:5173`
4. Create a new conversation
5. Ask "What is RAG?" — should stream a response using the seeded documents as context
6. Verify message history persists on page refresh
7. Verify sidebar shows updated conversation title

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: wire up SSE streaming chat with RAG pipeline"
```

---

## Chunk 6: Polish & Push

### Task 15: Final cleanup and push

- [ ] **Step 1: Remove unused default Vite files**

Delete any remaining default Vite files if not already removed (check for `App.css`, `index.css`, `assets/react.svg`).

- [ ] **Step 2: Verify .gitignore covers secrets**

Check that `.env`, `.npmrc`, `node_modules/`, `__pycache__/`, `.venv/` are all gitignored. Verify no secrets in staged files.

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```
