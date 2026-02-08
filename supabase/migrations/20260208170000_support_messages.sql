create extension if not exists "pgcrypto";

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text null,
  name text null,
  message text not null,
  page_url text null,
  context jsonb null,
  status text not null default 'new'
);

create index if not exists support_messages_created_at_idx on public.support_messages(created_at);

alter table public.support_messages enable row level security;

create policy "support_messages_insert"
  on public.support_messages
  for insert
  with check (auth.role() in ('anon', 'authenticated'));

create policy "support_messages_service_role"
  on public.support_messages
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
