# MCP Per-User API Key Authentication

## Goal

Secure the MCP server so each connected client is scoped to a single user's data via a persistent API key. Any registered Supabase user can generate an API key, configure it in their MCP client (Claude Code, Cursor, etc.), and access only their own documents.

## Architecture

### Data Flow

```
MCP Client (Claude Code / Cursor)
  → SSE connect with Authorization: Bearer <api-key>
  → MCP server hashes the key, looks up api_keys table
  → Gets user_id from the matching row
  → All tool calls automatically scoped to that user_id
  → Rejected if key is missing or invalid
```

### Database

New `api_keys` table:

| Column     | Type        | Notes                          |
|------------|-------------|--------------------------------|
| id         | uuid        | Primary key, default gen       |
| user_id    | uuid        | Unique — one key per user      |
| key_hash   | text        | SHA-256 hash of the API key    |
| name       | text        | Label (e.g., "Claude Code")    |
| created_at | timestamptz | Default now()                  |

- `user_id` has a unique constraint — one active key per user
- RLS enabled: users can only SELECT/INSERT/DELETE their own rows
- Foreign key to `auth.users(id)` with cascade delete

### Backend API (routes/api_keys.py)

All endpoints protected by Supabase JWT (same as existing routes):

| Method   | Endpoint        | Description                              |
|----------|-----------------|------------------------------------------|
| `POST`   | `/api/api-keys` | Generate new key (replaces existing one)  |
| `GET`    | `/api/api-keys` | Check if user has an active key           |
| `DELETE` | `/api/api-keys` | Revoke current key                        |

- POST generates a random key (e.g., `rag_` prefix + 32 random bytes hex), stores SHA-256 hash, returns plaintext once
- POST deletes any existing key for the user before creating the new one
- GET returns key metadata (name, created_at) but NOT the key itself

### MCP Server Auth

- On SSE connection, extract `Authorization: Bearer <key>` header
- Hash the key with SHA-256, query `api_keys` table for matching `key_hash`
- If found, store the `user_id` and pass it to all tool calls
- If not found or missing header, reject the connection
- Remove `user_id` parameter from tool signatures — it's always derived from the API key

### Frontend

New Settings page accessible from sidebar:

- Shows whether an API key exists (name + created_at)
- "Generate API Key" button — creates key, shows it once in a dialog with copy button
- "Revoke" button — deletes the key with confirmation dialog
- Display MCP connection instructions (URL + where to paste the key)

## Security

- Plaintext key shown once, never stored — only SHA-256 hash in DB
- MCP server rejects unauthenticated connections
- RLS on `api_keys`: `user_id = auth.uid()`
- API key management endpoints require valid Supabase JWT
- Lost key? Generate a new one (replaces the old one)

## Components Changed

- **New**: `backend/db/api_keys_schema.sql` — table + RLS policies
- **New**: `backend/routes/api_keys.py` — CRUD endpoints
- **Modified**: `backend/main.py` — register api_keys router
- **Modified**: `backend/mcp_server.py` — add auth middleware, remove user_id params
- **New**: `frontend/src/pages/SettingsPage.tsx` — API key management UI
- **Modified**: `frontend/src/lib/api.ts` — add API key endpoints
- **Modified**: `frontend/src/App.tsx` — add Settings route
- **Modified**: `frontend/src/components/Sidebar.tsx` — add Settings nav link
