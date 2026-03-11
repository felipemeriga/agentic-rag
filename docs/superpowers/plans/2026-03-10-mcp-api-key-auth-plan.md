# MCP Per-User API Key Auth Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure the MCP server with per-user API keys so each client only accesses their own data.

**Architecture:** New `api_keys` table stores SHA-256 hashed keys mapped to user IDs (one key per user). Backend CRUD endpoints manage keys (JWT-protected). MCP server validates the API key from the Authorization header on connection, extracts user_id, and scopes all tool calls. Frontend Settings page lets users generate/revoke keys.

**Tech Stack:** Python/FastAPI, Supabase/PostgreSQL, FastMCP, React/MUI/TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/db/api_keys_schema.sql` | Create | SQL for api_keys table + RLS policies |
| `backend/routes/api_keys.py` | Create | CRUD endpoints for API key management |
| `backend/main.py` | Modify | Register api_keys router |
| `backend/mcp_server.py` | Modify | Add auth middleware, remove user_id from tool params |
| `frontend/src/lib/api.ts` | Modify | Add API key fetch/create/delete functions |
| `frontend/src/pages/SettingsPage.tsx` | Create | API key management UI |
| `frontend/src/App.tsx` | Modify | Add /settings route |
| `frontend/src/components/Sidebar.tsx` | Modify | Add Settings nav link |
| `docker-compose.yml` | Modify | Add SUPABASE_URL + SUPABASE_SERVICE_KEY to mcp-server (already present) |

---

## Chunk 1: Database + Backend API

### Task 1: Create api_keys table SQL

**Files:**
- Create: `backend/db/api_keys_schema.sql`

- [ ] **Step 1: Write the SQL schema file**

```sql
-- API keys for MCP server authentication
-- Run this in Supabase SQL Editor

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  key_hash text not null,
  name text not null default 'Default',
  created_at timestamptz default now()
);

alter table api_keys enable row level security;

create policy "Users manage own api keys"
  on api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookup by hash (MCP auth)
create index api_keys_key_hash_idx on api_keys (key_hash);
```

- [ ] **Step 2: Commit**

```bash
git add backend/db/api_keys_schema.sql
git commit -m "feat: add api_keys table schema for MCP auth"
```

---

### Task 2: Create API key backend routes

**Files:**
- Create: `backend/routes/api_keys.py`

- [ ] **Step 1: Create the route file**

```python
"""API key management endpoints for MCP authentication."""

import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException
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
```

- [ ] **Step 2: Register the router in main.py**

In `backend/main.py`, add the import and include:

```python
# Add after line 8:
from routes.api_keys import router as api_keys_router

# Add after line 25 (after folders_router):
app.include_router(api_keys_router)
```

- [ ] **Step 3: Test manually**

Start the backend:
```bash
cd backend && uv run uvicorn main:app --reload --port 8000
```

Test with curl (replace TOKEN with a valid Supabase JWT):
```bash
# Check no key exists
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/api-keys

# Create a key
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test"}' http://localhost:8000/api/api-keys

# Check key exists (should return metadata, not the key)
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/api-keys

# Revoke
curl -X DELETE -H "Authorization: Bearer TOKEN" http://localhost:8000/api/api-keys
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/api_keys.py backend/main.py
git commit -m "feat: add API key CRUD endpoints for MCP auth"
```

---

### Task 3: Add auth to MCP server

**Files:**
- Modify: `backend/mcp_server.py`

- [ ] **Step 1: Add auth middleware and scope tools to user**

Replace the entire `backend/mcp_server.py` with:

```python
"""MCP server exposing knowledge base tools over SSE transport."""

import hashlib
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from db.client import get_supabase
from services.embeddings import embed_query
from services.search import search_documents
from services.text_to_sql import generate_and_execute_sql

MCP_API_KEY = os.environ.get("MCP_API_KEY", "")
MCP_PORT = int(os.environ.get("MCP_PORT", "8001"))

mcp = FastMCP("Agentic RAG Knowledge Base", host="0.0.0.0", port=MCP_PORT)

# Store authenticated user_id per connection
_authenticated_user_id: str | None = None


def _verify_api_key(key: str) -> str | None:
    """Verify API key and return user_id if valid."""
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    sb = get_supabase()
    result = (
        sb.table("api_keys")
        .select("user_id")
        .eq("key_hash", key_hash)
        .execute()
    )
    if result.data:
        return result.data[0]["user_id"]
    return None


@mcp.tool()
def knowledge_base_search(query: str) -> str:
    """Search the document knowledge base using hybrid vector + keyword search.

    Use this for questions about content in uploaded documents.

    Args:
        query: The search query to find relevant document chunks.
    """
    if not _authenticated_user_id:
        return "Error: Not authenticated. Provide a valid API key."
    embedding = embed_query(query)
    results = search_documents(
        embedding,
        query_text=query,
        user_id=_authenticated_user_id,
    )
    if not results:
        return "No relevant documents found in the knowledge base."

    chunks = []
    for r in results:
        source = (r.get("metadata") or {}).get("source_filename", "unknown")
        chunks.append(f"[Source: {source}]\n{r['content']}")
    return "\n\n---\n\n".join(chunks)


@mcp.tool()
def query_documents_metadata(question: str) -> str:
    """Query structured metadata about uploaded documents using natural language.

    Use this for questions like 'how many documents are there',
    'what topics are covered', 'list all PDFs', etc.

    Args:
        question: Natural language question about document metadata.
    """
    if not _authenticated_user_id:
        return "Error: Not authenticated. Provide a valid API key."

    result = generate_and_execute_sql(question, _authenticated_user_id)
    if result["error"]:
        return f"Query failed: {result['error']}"
    if not result["results"]:
        return "No results found."
    return f"SQL: {result['sql']}\nResults: {json.dumps(result['results'], default=str)}"


if __name__ == "__main__":
    print(f"Starting MCP server on port {MCP_PORT}...")
    print(f"SSE endpoint: http://localhost:{MCP_PORT}/sse")

    if not MCP_API_KEY:
        print("WARNING: MCP_API_KEY not set", file=sys.stderr)

    # Get the underlying Starlette app and add auth middleware
    app = mcp.get_sse_app()

    original_app = app.app if hasattr(app, 'app') else app

    from starlette.routing import Mount

    @app.middleware("http")
    async def api_key_auth_middleware(request: Request, call_next):
        global _authenticated_user_id

        # Allow health-check or non-SSE paths without auth
        path = request.url.path
        if path in ("/", "/health"):
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                {"error": "Missing Authorization: Bearer <api-key> header"},
                status_code=401,
            )

        api_key = auth_header.split(" ", 1)[1]
        user_id = _verify_api_key(api_key)
        if not user_id:
            return JSONResponse(
                {"error": "Invalid API key"},
                status_code=401,
            )

        _authenticated_user_id = user_id
        response = await call_next(request)
        return response

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=MCP_PORT)
```

**Important note:** The global `_authenticated_user_id` approach works because each MCP server instance handles one SSE connection at a time. For production with multiple concurrent users, you'd need per-request context — but that's a future concern given the current SSE transport model.

- [ ] **Step 2: Test the MCP server locally**

Start the MCP server:
```bash
cd backend && uv run python mcp_server.py
```

Test without key (should get 401):
```bash
curl -N http://localhost:8001/sse
```

Test with invalid key (should get 401):
```bash
curl -N -H "Authorization: Bearer bad-key" http://localhost:8001/sse
```

Test with valid key (create one first via the API, then use it):
```bash
curl -N -H "Authorization: Bearer rag_<your-key>" http://localhost:8001/sse
```

- [ ] **Step 3: Commit**

```bash
git add backend/mcp_server.py
git commit -m "feat: add API key auth to MCP server"
```

---

## Chunk 2: Frontend

### Task 4: Add API key functions to frontend api client

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add types and functions**

Add at the end of `frontend/src/lib/api.ts` (after line 250):

```typescript
// --- API Keys ---

export interface ApiKeyInfo {
  name: string;
  created_at: string;
}

export interface CreatedApiKey {
  key: string;
  name: string;
  created_at: string;
}

export async function fetchApiKey(): Promise<ApiKeyInfo | null> {
  const res = await apiFetch("/api/api-keys");
  const data = await res.json();
  return data;
}

export async function createApiKey(
  name: string = "Default"
): Promise<CreatedApiKey> {
  const res = await apiFetch("/api/api-keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function revokeApiKey(): Promise<void> {
  await apiFetch("/api/api-keys", { method: "DELETE" });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add API key management functions to frontend api client"
```

---

### Task 5: Create Settings page

**Files:**
- Create: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create the Settings page component**

```tsx
import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  alpha,
  Tooltip,
  Chip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyIcon from "@mui/icons-material/Key";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import {
  fetchApiKey,
  createApiKey,
  revokeApiKey,
  type ApiKeyInfo,
} from "../lib/api";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [keyInfo, setKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const loadKey = useCallback(async () => {
    try {
      const data = await fetchApiKey();
      setKeyInfo(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKey();
  }, [loadKey]);

  const handleGenerate = async () => {
    const result = await createApiKey("Default");
    setNewKey(result.key);
    setKeyInfo({ name: result.name, created_at: result.created_at });
  };

  const handleCopy = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async () => {
    await revokeApiKey();
    setKeyInfo(null);
    setNewKey(null);
    setRevokeOpen(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0a0a12",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <IconButton onClick={() => navigate("/")} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Settings
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, maxWidth: 600, mx: "auto", width: "100%" }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          MCP API Key
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 3, color: alpha("#ffffff", 0.6) }}
        >
          Generate an API key to connect MCP clients like Claude Code or Cursor
          to your knowledge base. Only one key is active at a time — generating a
          new one replaces the old one.
        </Typography>

        {/* Existing key info */}
        {keyInfo && !newKey && (
          <Paper
            sx={{
              p: 2,
              mb: 2,
              bgcolor: alpha("#ffffff", 0.03),
              border: 1,
              borderColor: alpha("#ffffff", 0.08),
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <KeyIcon sx={{ fontSize: 18, color: "#6366f1" }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {keyInfo.name}
                </Typography>
                <Chip
                  label="Active"
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ color: alpha("#ffffff", 0.4) }}
              >
                Created{" "}
                {new Date(keyInfo.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Newly generated key */}
        {newKey && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Tooltip title={copied ? "Copied!" : "Copy"}>
                <IconButton size="small" onClick={handleCopy}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Copy your API key now — it won't be shown again
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={newKey}
              slotProps={{ input: { readOnly: true } }}
              sx={{
                mt: 1,
                "& .MuiInputBase-input": {
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                },
              }}
            />
          </Alert>
        )}

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<KeyIcon />}
            onClick={handleGenerate}
            disabled={loading}
          >
            {keyInfo ? "Regenerate Key" : "Generate API Key"}
          </Button>
          {keyInfo && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setRevokeOpen(true)}
            >
              Revoke
            </Button>
          )}
        </Box>

        {/* MCP connection instructions */}
        <Typography
          variant="h6"
          sx={{ mt: 4, mb: 2, fontWeight: 600 }}
        >
          Connect MCP Client
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 2, color: alpha("#ffffff", 0.6) }}
        >
          Add this to your MCP client configuration (e.g.,{" "}
          <code>.mcp.json</code> for Claude Code):
        </Typography>
        <Paper
          sx={{
            p: 2,
            bgcolor: alpha("#000000", 0.3),
            border: 1,
            borderColor: alpha("#ffffff", 0.08),
            fontFamily: "monospace",
            fontSize: "0.8rem",
            whiteSpace: "pre",
            overflow: "auto",
          }}
        >
          {`{
  "mcpServers": {
    "agentic-rag": {
      "type": "sse",
      "url": "http://localhost:8001/sse",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}`}
        </Paper>

        {/* Revoke confirmation dialog */}
        <Dialog open={revokeOpen} onClose={() => setRevokeOpen(false)}>
          <DialogTitle>Revoke API Key</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will immediately disconnect any MCP clients using this key.
              You can generate a new key afterward.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRevokeOpen(false)}>Cancel</Button>
            <Button onClick={handleRevoke} color="error" variant="contained">
              Revoke
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat: add Settings page with API key management UI"
```

---

### Task 6: Wire up Settings route and sidebar link

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Add Settings route to App.tsx**

In `frontend/src/App.tsx`:

Add import after line 6:
```typescript
import SettingsPage from "./pages/SettingsPage";
```

Add route after the `/documents` Route (after line 29):
```tsx
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 2: Add Settings link to Sidebar.tsx**

In `frontend/src/components/Sidebar.tsx`:

Add import after line 18 (after AutoAwesomeIcon):
```typescript
import SettingsIcon from "@mui/icons-material/Settings";
```

Add after the Documents ListItemButton closing tag (after line 111), before the `<Divider>`:
```tsx
        <ListItemButton
          onClick={() => navigate("/settings")}
          sx={{
            borderRadius: 1.5,
            py: 0.75,
            mx: 0.5,
            "&:hover": { bgcolor: alpha("#ffffff", 0.04) },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <SettingsIcon sx={{ fontSize: 18, color: alpha("#ffffff", 0.5) }} />
          </ListItemIcon>
          <ListItemText
            primary="Settings"
            primaryTypographyProps={{ variant: "body2" }}
          />
        </ListItemButton>
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat: add Settings route and sidebar navigation link"
```

---

### Task 7: Update .mcp.json with auth header

**Files:**
- Modify: `agentic-rag/.mcp.json`

- [ ] **Step 1: Update MCP config to include auth header**

```json
{
  "mcpServers": {
    "agentic-rag": {
      "type": "sse",
      "url": "http://localhost:8001/sse",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .mcp.json
git commit -m "chore: update MCP config with auth header placeholder"
```
