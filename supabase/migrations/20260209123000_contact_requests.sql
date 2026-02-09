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
