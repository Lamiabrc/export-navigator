-- Contact requests storage (used by /api/contact)

create extension if not exists pgcrypto;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  first_name text not null,
  email text not null,
  company text null,
  subject text null,
  message text not null,
  offer_type text null,
  scenario_summary text null,
  source text null,
  topic text null,

  ip text null,
  user_agent text null,
  locale text null,

  status text not null default 'ok'
);

alter table public.contact_requests
  add column if not exists created_at timestamptz,
  add column if not exists first_name text,
  add column if not exists email text,
  add column if not exists company text,
  add column if not exists subject text,
  add column if not exists message text,
  add column if not exists offer_type text,
  add column if not exists scenario_summary text,
  add column if not exists source text,
  add column if not exists topic text,
  add column if not exists ip text,
  add column if not exists user_agent text,
  add column if not exists locale text,
  add column if not exists status text;

update public.contact_requests
set
  created_at = coalesce(created_at, now()),
  status = coalesce(status, 'ok')
where created_at is null or status is null;

alter table public.contact_requests
  alter column created_at set default now(),
  alter column status set default 'ok';

alter table public.contact_requests
  alter column created_at set not null,
  alter column status set not null;

create index if not exists contact_requests_created_at_idx on public.contact_requests (created_at);
create index if not exists contact_requests_email_idx on public.contact_requests (email);
create index if not exists contact_requests_status_idx on public.contact_requests (status);

alter table public.contact_requests enable row level security;

-- Only service role can insert (server-side /api/contact)
drop policy if exists "contact_requests_insert_service_role" on public.contact_requests;
create policy "contact_requests_insert_service_role"
  on public.contact_requests for insert
  with check (auth.role() = 'service_role');

-- Only admin/service role can read
drop policy if exists "contact_requests_select_admin" on public.contact_requests;
create policy "contact_requests_select_admin"
  on public.contact_requests for select
  using (public.is_admin() or auth.role() = 'service_role');

grant select on public.contact_requests to authenticated;
grant select, insert on public.contact_requests to service_role;
