-- =========
-- Invoice uploads: storage + metadata
-- =========
create extension if not exists pgcrypto;

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('invoice_files', 'invoice_files', false)
on conflict (id) do nothing;

-- Storage policies
-- Read: owner or service role
-- Write: owner only

drop policy if exists "invoice_files_select_owner" on storage.objects;
create policy "invoice_files_select_owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'invoice_files'
  and (auth.uid() = owner or auth.role() = 'service_role')
);

drop policy if exists "invoice_files_insert_owner" on storage.objects;
create policy "invoice_files_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'invoice_files'
  and auth.uid() = owner
);

drop policy if exists "invoice_files_update_owner" on storage.objects;
create policy "invoice_files_update_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'invoice_files'
  and (auth.uid() = owner or auth.role() = 'service_role')
)
with check (
  bucket_id = 'invoice_files'
  and (auth.uid() = owner or auth.role() = 'service_role')
);

drop policy if exists "invoice_files_delete_owner" on storage.objects;
create policy "invoice_files_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'invoice_files'
  and (auth.uid() = owner or auth.role() = 'service_role')
);

-- Metadata table
create table if not exists public.invoice_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text null,
  size_bytes bigint null,
  destination text null,
  incoterm text null,
  currency text null,
  total_ht numeric null,
  total_tva numeric null,
  total_ttc numeric null,
  parsed jsonb null,
  created_at timestamptz not null default now(),
  constraint invoice_uploads_file_path_uniq unique (file_path)
);

create index if not exists invoice_uploads_user_id_idx on public.invoice_uploads (user_id);
create index if not exists invoice_uploads_created_at_idx on public.invoice_uploads (created_at);

alter table public.invoice_uploads enable row level security;

drop policy if exists "invoice_uploads_select_owner" on public.invoice_uploads;
create policy "invoice_uploads_select_owner"
on public.invoice_uploads
for select
using (auth.uid() = user_id);

drop policy if exists "invoice_uploads_insert_owner" on public.invoice_uploads;
create policy "invoice_uploads_insert_owner"
on public.invoice_uploads
for insert
with check (auth.uid() = user_id);

drop policy if exists "invoice_uploads_update_owner" on public.invoice_uploads;
create policy "invoice_uploads_update_owner"
on public.invoice_uploads
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "invoice_uploads_delete_owner" on public.invoice_uploads;
create policy "invoice_uploads_delete_owner"
on public.invoice_uploads
for delete
using (auth.uid() = user_id);
