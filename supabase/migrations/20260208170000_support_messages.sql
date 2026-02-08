-- =========
-- 0) helper admin (email allowlist + role metadata)
-- =========
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select
    (auth.jwt() ->> 'email') = 'lamia.brechet@outlook.fr'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

-- =========
-- 1) Storage bucket privé pour PDFs
-- =========
insert into storage.buckets (id, name, public)
values ('kb_docs', 'kb_docs', false)
on conflict (id) do nothing;

-- Policies Storage (bucket kb_docs)
-- Lecture: utilisateurs connectés (ou garde privé strict en retirant cette policy)
drop policy if exists "kb_docs_read_authenticated" on storage.objects;
create policy "kb_docs_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'kb_docs');

-- Écriture: admin seulement
drop policy if exists "kb_docs_admin_insert" on storage.objects;
create policy "kb_docs_admin_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'kb_docs' and public.is_admin());

drop policy if exists "kb_docs_admin_update" on storage.objects;
create policy "kb_docs_admin_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'kb_docs' and public.is_admin())
with check (bucket_id = 'kb_docs' and public.is_admin());

drop policy if exists "kb_docs_admin_delete" on storage.objects;
create policy "kb_docs_admin_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'kb_docs' and public.is_admin());

-- =========
-- 2) Table metadata kb_documents
-- =========
create extension if not exists pgcrypto;

create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  language text not null default 'fr' check (language in ('fr','en')),
  tags text[] not null default '{}'::text[],

  storage_bucket text not null default 'kb_docs',
  storage_path text not null, -- ex: kb/fr/2026-02/xxxxx.pdf

  file_name text null,
  mime_type text null,
  size_bytes bigint null,

  enabled boolean not null default true,

  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint kb_documents_storage_path_uniq unique (storage_path)
);

create index if not exists kb_documents_lang_idx on public.kb_documents (language);
create index if not exists kb_documents_tags_idx on public.kb_documents using gin (tags);

-- updated_at trigger (réutilise si tu l’as déjà)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_kb_documents_updated_at on public.kb_documents;
create trigger trg_kb_documents_updated_at
before update on public.kb_documents
for each row execute function public.set_updated_at();

-- RLS
alter table public.kb_documents enable row level security;

-- Lecture: enabled=true pour tous, ou admin voit tout
drop policy if exists "kb_documents_select_enabled_or_admin" on public.kb_documents;
create policy "kb_documents_select_enabled_or_admin"
on public.kb_documents
for select
using (enabled = true or public.is_admin());

-- Écriture: admin seulement
drop policy if exists "kb_documents_admin_insert" on public.kb_documents;
create policy "kb_documents_admin_insert"
on public.kb_documents
for insert
with check (public.is_admin());

drop policy if exists "kb_documents_admin_update" on public.kb_documents;
create policy "kb_documents_admin_update"
on public.kb_documents
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "kb_documents_admin_delete" on public.kb_documents;
create policy "kb_documents_admin_delete"
on public.kb_documents
for delete
using (public.is_admin());

grant select on public.kb_documents to anon, authenticated;
grant insert, update, delete on public.kb_documents to authenticated;
