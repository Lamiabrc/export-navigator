-- Enable pgvector and persist LLM conversation embeddings

create extension if not exists vector;

create table if not exists public.llm_message_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'api_ask',
  session_id text null,
  role text not null default 'user' check (role in ('user','assistant')),
  message text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists llm_message_embeddings_user_id_idx
  on public.llm_message_embeddings(user_id);

create index if not exists llm_message_embeddings_created_at_idx
  on public.llm_message_embeddings(created_at desc);

create index if not exists llm_message_embeddings_embedding_idx
  on public.llm_message_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.llm_message_embeddings enable row level security;

drop policy if exists "llm_message_embeddings_select_owner" on public.llm_message_embeddings;
create policy "llm_message_embeddings_select_owner"
  on public.llm_message_embeddings
  for select
  using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "llm_message_embeddings_insert_owner" on public.llm_message_embeddings;
create policy "llm_message_embeddings_insert_owner"
  on public.llm_message_embeddings
  for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');

create or replace function public.match_llm_message_embeddings(
  p_user_id uuid,
  query_embedding vector(1536),
  match_count int default 8,
  min_similarity float default 0.2
)
returns table (
  id uuid,
  message text,
  role text,
  source text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    e.id,
    e.message,
    e.role,
    e.source,
    e.metadata,
    e.created_at,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.llm_message_embeddings e
  where e.user_id = p_user_id
    and 1 - (e.embedding <=> query_embedding) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
