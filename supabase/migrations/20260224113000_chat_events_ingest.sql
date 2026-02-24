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

create index if not exists chat_events_user_id_idx on public.chat_events(user_id);
create index if not exists chat_events_created_at_idx on public.chat_events(created_at);

alter table public.chat_events enable row level security;

drop policy if exists chat_events_owner_select on public.chat_events;
create policy chat_events_owner_select
  on public.chat_events for select
  to authenticated
  using (auth.uid() = user_id);
