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

create table folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table folders enable row level security;

create policy "Users manage own folders"
  on folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1024),
  metadata jsonb,
  user_id uuid references auth.users(id) on delete cascade,
  source_filename text,
  source_type text,
  content_hash text,
  folder_id uuid references folders(id) on delete set null,
  root_folder_id uuid references folders(id) on delete set null,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz default now()
);

create index idx_documents_root_folder_id on documents(root_folder_id);

create index on documents using hnsw (embedding vector_cosine_ops);

-- Full-text search index for hybrid search
alter table documents add column if not exists fts tsvector
  generated always as (to_tsvector('english', content)) stored;
create index on documents using gin (fts);

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

alter table documents enable row level security;

create policy "Users manage own documents"
  on documents for all
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid());

create or replace function match_documents(
  query_embedding vector(1024),
  match_count int default 5,
  filter_user_id uuid default null,
  filter_topic text default null,
  filter_keyword text default null,
  filter_root_folder_id uuid default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  content_hash text
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity,
    content_hash
  from documents
  where (user_id = filter_user_id or user_id is null)
    and (filter_topic is null or metadata->>'topic' = filter_topic)
    and (filter_keyword is null or metadata->'keywords' ? filter_keyword)
    and (filter_root_folder_id is null or root_folder_id = filter_root_folder_id)
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Keyword (full-text) search for hybrid search
create or replace function keyword_search(
  search_query text,
  match_count int default 20,
  filter_user_id uuid default null,
  filter_topic text default null,
  filter_keyword text default null,
  filter_root_folder_id uuid default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  rank real,
  content_hash text
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    ts_rank(fts, websearch_to_tsquery('english', search_query)) as rank,
    content_hash
  from documents
  where fts @@ websearch_to_tsquery('english', search_query)
    and (user_id = filter_user_id or user_id is null)
    and (filter_topic is null or metadata->>'topic' = filter_topic)
    and (filter_keyword is null or metadata->'keywords' ? filter_keyword)
    and (filter_root_folder_id is null or root_folder_id = filter_root_folder_id)
  order by rank desc
  limit match_count;
$$;

-- Execute a read-only SQL query (for text-to-SQL tool)
create or replace function execute_readonly_query(query_text text)
returns jsonb
language plpgsql security definer
as $$
declare
  result jsonb;
begin
  -- Only allow SELECT statements
  if not (trim(upper(query_text)) like 'SELECT%') then
    raise exception 'Only SELECT queries are allowed';
  end if;

  -- Block dangerous keywords as defense-in-depth
  if trim(upper(query_text)) ~ '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b'
  then
    raise exception 'Query contains forbidden keywords';
  end if;

  execute format('select jsonb_agg(row_to_json(t)) from (%s) t', query_text) into result;
  return coalesce(result, '[]'::jsonb);
end;
$$;

-- Notes table (structured observations from Claude sessions)
create table notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  content_hash text not null,
  root_folder_id uuid references folders(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notes enable row level security;

create policy "Users manage own notes"
  on notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_notes_user_scope on notes(user_id, root_folder_id);
create unique index idx_notes_dedup on notes(user_id, root_folder_id, content_hash);

create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at();

-- Context table (ephemeral working memory from Claude sessions)
create table context (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value text not null,
  root_folder_id uuid references folders(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table context enable row level security;

create policy "Users manage own context"
  on context for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table context add constraint context_user_scope_key_unique unique (user_id, root_folder_id, key);
create index idx_context_expires on context(expires_at);

create trigger context_updated_at
  before update on context
  for each row execute function update_updated_at();
