-- Harden chat ingestion storage used by /api/chat-ingest.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.chat_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  channel text not null,
  source text null,
  client_session_id text null,
  question text not null,
  answer text not null,
  mode text null,
  context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);

alter table public.chat_events
  add column if not exists user_id uuid null references auth.users(id) on delete set null,
  add column if not exists channel text,
  add column if not exists source text,
  add column if not exists client_session_id text,
  add column if not exists question text,
  add column if not exists answer text,
  add column if not exists mode text,
  add column if not exists context_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz not null default (now() + interval '180 days');

alter table public.chat_events
  alter column channel set not null,
  alter column question set not null,
  alter column answer set not null;

create index if not exists chat_events_user_id_idx on public.chat_events(user_id);
create index if not exists chat_events_created_at_idx on public.chat_events(created_at desc);
create index if not exists chat_events_expires_at_idx on public.chat_events(expires_at);
create index if not exists chat_events_channel_created_idx on public.chat_events(channel, created_at desc);

alter table public.chat_events enable row level security;

drop policy if exists chat_events_owner_select on public.chat_events;
create policy chat_events_owner_select
  on public.chat_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists chat_events_owner_insert on public.chat_events;
create policy chat_events_owner_insert
  on public.chat_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.chat_events to authenticated;
