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
  user_id uuid references auth.users(id) on delete cascade,
  source_filename text,
  source_type text,
  content_hash text,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz default now()
);

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
  filter_keyword text default null
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
  where (user_id = filter_user_id or user_id is null)
    and (filter_topic is null or metadata->>'topic' = filter_topic)
    and (filter_keyword is null or metadata->'keywords' ? filter_keyword)
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Keyword (full-text) search for hybrid search
create or replace function keyword_search(
  search_query text,
  match_count int default 20,
  filter_user_id uuid default null,
  filter_topic text default null,
  filter_keyword text default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  rank real
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    ts_rank(fts, websearch_to_tsquery('english', search_query)) as rank
  from documents
  where fts @@ websearch_to_tsquery('english', search_query)
    and (user_id = filter_user_id or user_id is null)
    and (filter_topic is null or metadata->>'topic' = filter_topic)
    and (filter_keyword is null or metadata->'keywords' ? filter_keyword)
  order by rank desc
  limit match_count;
$$;
