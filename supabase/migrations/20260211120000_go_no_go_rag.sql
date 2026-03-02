-- Go/No-Go + RAG + retention (2026-02-11)

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Admin helper: email allowlist + role metadata
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  with emails as (
    select
      case
        when coalesce(current_setting('app.admin_emails', true), '') = '' then array[]::text[]
        else regexp_split_to_array(current_setting('app.admin_emails', true), '\\s*,\\s*')
      end as list
  )
  select
    (auth.jwt() ->> 'email') = 'lamia.brechet@outlook.fr'
    or (auth.jwt() ->> 'email') = any((select list from emails))
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', '') = 'true'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', '') = 'true';
$$;

-- 1) Tool runs (audit des appels outils)
create table if not exists public.tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  input_json jsonb not null,
  output_json jsonb,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '90 days')
);

create index if not exists tool_runs_user_id_idx on public.tool_runs(user_id);
create index if not exists tool_runs_created_at_idx on public.tool_runs(created_at);

alter table public.tool_runs enable row level security;

drop policy if exists "tool_runs_select_owner" on public.tool_runs;
create policy "tool_runs_select_owner"
  on public.tool_runs for select
  using (auth.uid() = user_id);

drop policy if exists "tool_runs_insert_owner" on public.tool_runs;
create policy "tool_runs_insert_owner"
  on public.tool_runs for insert
  with check (auth.uid() = user_id);

drop policy if exists "tool_runs_delete_owner" on public.tool_runs;
create policy "tool_runs_delete_owner"
  on public.tool_runs for delete
  using (auth.uid() = user_id);

-- 2) Go/No-Go assessments
create table if not exists public.go_no_go_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null,
  product_desc text not null,
  hs_code text null,
  incoterm text null,
  payment_method text null,
  value_amount numeric null,
  currency text null,
  risk_score int not null check (risk_score >= 0 and risk_score <= 100),
  risk_breakdown jsonb not null,
  recommendations jsonb not null,
  checklist jsonb null,
  messages jsonb null,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '90 days')
);

create index if not exists go_no_go_user_id_idx on public.go_no_go_assessments(user_id);
create index if not exists go_no_go_created_at_idx on public.go_no_go_assessments(created_at);

alter table public.go_no_go_assessments enable row level security;

drop policy if exists "go_no_go_select_owner" on public.go_no_go_assessments;
create policy "go_no_go_select_owner"
  on public.go_no_go_assessments for select
  using (auth.uid() = user_id);

drop policy if exists "go_no_go_insert_owner" on public.go_no_go_assessments;
create policy "go_no_go_insert_owner"
  on public.go_no_go_assessments for insert
  with check (auth.uid() = user_id);

drop policy if exists "go_no_go_delete_owner" on public.go_no_go_assessments;
create policy "go_no_go_delete_owner"
  on public.go_no_go_assessments for delete
  using (auth.uid() = user_id);

-- 3) Objectives uploads (user scoped)
create table if not exists public.objectives_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_bucket text not null default 'objectives',
  storage_path text not null,
  mime_type text null,
  size_bytes bigint null,
  preview_rows jsonb null,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '90 days')
);

create index if not exists objectives_uploads_user_id_idx on public.objectives_uploads(user_id);
create index if not exists objectives_uploads_created_at_idx on public.objectives_uploads(created_at);

alter table public.objectives_uploads enable row level security;

drop policy if exists "objectives_uploads_select_owner" on public.objectives_uploads;
create policy "objectives_uploads_select_owner"
  on public.objectives_uploads for select
  using (auth.uid() = user_id);

drop policy if exists "objectives_uploads_insert_owner" on public.objectives_uploads;
create policy "objectives_uploads_insert_owner"
  on public.objectives_uploads for insert
  with check (auth.uid() = user_id);

drop policy if exists "objectives_uploads_delete_owner" on public.objectives_uploads;
create policy "objectives_uploads_delete_owner"
  on public.objectives_uploads for delete
  using (auth.uid() = user_id);

-- 4) Deletion requests (optional trace)
create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending',
  processed_at timestamptz null,
  note text null
);

create index if not exists deletion_requests_user_id_idx on public.deletion_requests(user_id);

alter table public.deletion_requests enable row level security;

drop policy if exists "deletion_requests_select_owner" on public.deletion_requests;
create policy "deletion_requests_select_owner"
  on public.deletion_requests for select
  using (auth.uid() = user_id);

drop policy if exists "deletion_requests_insert_owner" on public.deletion_requests;
create policy "deletion_requests_insert_owner"
  on public.deletion_requests for insert
  with check (auth.uid() = user_id);

-- 5) KB tables (admin-only)
-- Extend kb_documents for RAG metadata
alter table public.kb_documents add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.kb_documents add column if not exists source text;
alter table public.kb_documents add column if not exists status text not null default 'uploaded';

-- Prefer new bucket by default for new docs
alter table public.kb_documents alter column storage_bucket set default 'kb_admin';

-- Chunks table
create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.kb_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz default now()
);

create index if not exists kb_chunks_document_id_idx on public.kb_chunks(document_id);
create index if not exists kb_chunks_embedding_idx
  on public.kb_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.kb_chunks enable row level security;

-- Admin-only RLS for kb_documents
alter table public.kb_documents enable row level security;

drop policy if exists "kb_documents_select_enabled_or_admin" on public.kb_documents;
drop policy if exists "kb_documents_admin_insert" on public.kb_documents;
drop policy if exists "kb_documents_admin_update" on public.kb_documents;
drop policy if exists "kb_documents_admin_delete" on public.kb_documents;

drop policy if exists "kb_documents_admin_select" on public.kb_documents;
create policy "kb_documents_admin_select" on public.kb_documents
  for select using (public.is_admin() or auth.role() = 'service_role');
drop policy if exists "kb_documents_admin_insert" on public.kb_documents;
create policy "kb_documents_admin_insert" on public.kb_documents
  for insert with check (public.is_admin() or auth.role() = 'service_role');
drop policy if exists "kb_documents_admin_update" on public.kb_documents;
create policy "kb_documents_admin_update" on public.kb_documents
  for update using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');
drop policy if exists "kb_documents_admin_delete" on public.kb_documents;
create policy "kb_documents_admin_delete" on public.kb_documents
  for delete using (public.is_admin() or auth.role() = 'service_role');

-- Admin-only RLS for kb_chunks
drop policy if exists "kb_chunks_admin_select" on public.kb_chunks;
create policy "kb_chunks_admin_select" on public.kb_chunks
  for select using (public.is_admin() or auth.role() = 'service_role');
drop policy if exists "kb_chunks_admin_insert" on public.kb_chunks;
create policy "kb_chunks_admin_insert" on public.kb_chunks
  for insert with check (public.is_admin() or auth.role() = 'service_role');
drop policy if exists "kb_chunks_admin_update" on public.kb_chunks;
create policy "kb_chunks_admin_update" on public.kb_chunks
  for update using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');
drop policy if exists "kb_chunks_admin_delete" on public.kb_chunks;
create policy "kb_chunks_admin_delete" on public.kb_chunks
  for delete using (public.is_admin() or auth.role() = 'service_role');

-- Vector search helper
create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  min_similarity float default 0.15
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    kb_chunks.id,
    kb_chunks.document_id,
    kb_chunks.chunk_index,
    kb_chunks.content,
    1 - (kb_chunks.embedding <=> query_embedding) as similarity
  from public.kb_chunks
  where 1 - (kb_chunks.embedding <=> query_embedding) >= min_similarity
  order by kb_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 6) Storage buckets + policies
insert into storage.buckets (id, name, public)
values ('kb_admin', 'kb_admin', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('objectives', 'objectives', false)
on conflict (id) do nothing;

-- kb_admin: admin only

drop policy if exists "kb_admin_read" on storage.objects;
create policy "kb_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'kb_admin' and public.is_admin());

drop policy if exists "kb_admin_insert" on storage.objects;
create policy "kb_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kb_admin' and public.is_admin());

drop policy if exists "kb_admin_update" on storage.objects;
create policy "kb_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'kb_admin' and public.is_admin())
  with check (bucket_id = 'kb_admin' and public.is_admin());

drop policy if exists "kb_admin_delete" on storage.objects;
create policy "kb_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'kb_admin' and public.is_admin());

-- objectives: owner only (path prefix user_id/..)

drop policy if exists "objectives_read_owner" on storage.objects;
create policy "objectives_read_owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'objectives' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "objectives_insert_owner" on storage.objects;
create policy "objectives_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'objectives' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "objectives_update_owner" on storage.objects;
create policy "objectives_update_owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'objectives' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'objectives' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "objectives_delete_owner" on storage.objects;
create policy "objectives_delete_owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'objectives' and (storage.foldername(name))[1] = auth.uid()::text);
