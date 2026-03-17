-- API keys for MCP server authentication
-- Run this in Supabase SQL Editor

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_folder_id uuid not null references folders(id) on delete cascade,
  key_hash text not null,
  name text not null default 'Default',
  created_at timestamptz default now(),
  unique (user_id, scope_folder_id)
);

alter table api_keys enable row level security;

create policy "Users manage own api keys"
  on api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookup by hash (MCP auth)
create index api_keys_key_hash_idx on api_keys (key_hash);
