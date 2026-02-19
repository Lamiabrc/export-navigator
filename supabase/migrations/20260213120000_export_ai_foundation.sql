-- Export AI foundation: references, RAG, free chat, subscriptions and control tower access model
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.hs_codes (
  hs6 text primary key,
  label_fr text not null,
  label_en text,
  chapter text,
  updated_at timestamptz not null default now()
);

create table if not exists public.hs_synonyms (
  id bigserial primary key,
  hs6 text not null references public.hs_codes(hs6) on delete cascade,
  term text not null,
  weight int not null default 1
);
create index if not exists hs_synonyms_term_idx on public.hs_synonyms using gin (to_tsvector('simple', term));

create table if not exists public.countries (
  iso2 text primary key,
  name_fr text not null,
  name_en text,
  region text,
  currency text
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('email','checklist','clause','questions')),
  key text not null unique,
  title text not null,
  content text not null,
  tags text[] not null default '{}'
);

create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  universe text,
  lang text not null default 'fr',
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists kb_chunks_document_idx on public.kb_chunks(document_id, chunk_index);
create index if not exists kb_chunks_content_idx on public.kb_chunks using gin (to_tsvector('french', content));
create index if not exists kb_chunks_embedding_idx on public.kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.kb_documents add column if not exists source text;
alter table public.kb_documents add column if not exists universe text;
alter table public.kb_documents add column if not exists lang text;
alter table public.kb_documents add column if not exists content text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kb_documents' and column_name = 'language'
  ) then
    execute 'update public.kb_documents set lang = coalesce(lang, language, ''fr'') where lang is null';
  else
    update public.kb_documents set lang = coalesce(lang, 'fr') where lang is null;
  end if;
end $$;
alter table public.kb_documents alter column lang set default 'fr';

alter table public.kb_chunks add column if not exists chunk_index int;
alter table public.kb_chunks add column if not exists content text;
alter table public.kb_chunks add column if not exists embedding vector(1536);
update public.kb_chunks set chunk_index = coalesce(chunk_index, 0) where chunk_index is null;

-- Ensure function signature conflicts from previous migrations are removed first.
drop function if exists public.match_kb_chunks(vector, integer, double precision, text);
drop function if exists public.match_kb_chunks(vector, integer, text);
drop function if exists public.match_kb_chunks(vector, integer);

create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  filter_universe text default null
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    d.title as document_title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.kb_chunks c
  join public.kb_documents d on d.id = c.document_id
  where c.embedding is not null
    and (filter_universe is null or coalesce(d.universe,'') = filter_universe)
  order by c.embedding <=> query_embedding
  limit greatest(1, coalesce(match_count, 8));
$$;

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_response_id text,
  title text
);

create table if not exists public.chat_messages (
  id bigserial primary key,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on public.chat_messages(session_id, created_at);

create table if not exists public.chat_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  status text not null default 'inactive' check (status in ('active','inactive','trialing','canceled')),
  current_period_end timestamptz
);

create or replace function public.has_pro_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = uid
      and s.plan = 'pro'
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

grant execute on function public.has_pro_access(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'membership_role') then
    create type public.membership_role as enum ('owner', 'member');
  end if;
end $$;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id bigserial primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'member',
  unique(org_id, user_id)
);

create table if not exists public.export_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  destination_country_iso2 text references public.countries(iso2),
  product_label text,
  hs6 text references public.hs_codes(hs6),
  incoterm text,
  payment_terms text,
  amount numeric,
  currency text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.export_cases(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.case_events (
  id bigserial primary key,
  case_id uuid not null references public.export_cases(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.hs_codes enable row level security;
alter table public.hs_synonyms enable row level security;
alter table public.countries enable row level security;
alter table public.templates enable row level security;
alter table public.kb_documents enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_usage_daily enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.export_cases enable row level security;
alter table public.case_tasks enable row level security;
alter table public.case_events enable row level security;

drop policy if exists hs_codes_read_auth on public.hs_codes;
create policy hs_codes_read_auth on public.hs_codes for select to authenticated using (true);
drop policy if exists hs_synonyms_read_auth on public.hs_synonyms;
create policy hs_synonyms_read_auth on public.hs_synonyms for select to authenticated using (true);
drop policy if exists countries_read_auth on public.countries;
create policy countries_read_auth on public.countries for select to authenticated using (true);
drop policy if exists templates_read_auth on public.templates;
create policy templates_read_auth on public.templates for select to authenticated using (true);
drop policy if exists kb_documents_read_auth on public.kb_documents;
create policy kb_documents_read_auth on public.kb_documents for select to authenticated using (true);
drop policy if exists kb_chunks_read_auth on public.kb_chunks;
create policy kb_chunks_read_auth on public.kb_chunks for select to authenticated using (true);

drop policy if exists chat_sessions_owner on public.chat_sessions;
create policy chat_sessions_owner on public.chat_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists chat_messages_owner on public.chat_messages;
create policy chat_messages_owner on public.chat_messages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists chat_usage_owner on public.chat_usage_daily;
create policy chat_usage_owner on public.chat_usage_daily for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists subscriptions_owner on public.subscriptions;
create policy subscriptions_owner on public.subscriptions for select to authenticated using (auth.uid() = user_id);

create or replace function public.user_org_has_pro_access(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  )
  and public.has_pro_access(auth.uid());
$$;

grant execute on function public.user_org_has_pro_access(uuid) to authenticated;

drop policy if exists orgs_member_pro_select on public.orgs;
create policy orgs_member_pro_select on public.orgs for select to authenticated using (public.user_org_has_pro_access(id));

drop policy if exists memberships_member_pro_select on public.memberships;
create policy memberships_member_pro_select on public.memberships for select to authenticated using (public.user_org_has_pro_access(org_id));

drop policy if exists export_cases_member_pro_all on public.export_cases;
create policy export_cases_member_pro_all on public.export_cases for all to authenticated using (public.user_org_has_pro_access(org_id)) with check (public.user_org_has_pro_access(org_id));

drop policy if exists case_tasks_member_pro_all on public.case_tasks;
create policy case_tasks_member_pro_all on public.case_tasks for all to authenticated using (
  exists (
    select 1 from public.export_cases ec
    where ec.id = case_id and public.user_org_has_pro_access(ec.org_id)
  )
) with check (
  exists (
    select 1 from public.export_cases ec
    where ec.id = case_id and public.user_org_has_pro_access(ec.org_id)
  )
);

drop policy if exists case_events_member_pro_all on public.case_events;
create policy case_events_member_pro_all on public.case_events for all to authenticated using (
  exists (
    select 1 from public.export_cases ec
    where ec.id = case_id and public.user_org_has_pro_access(ec.org_id)
  )
) with check (
  exists (
    select 1 from public.export_cases ec
    where ec.id = case_id and public.user_org_has_pro_access(ec.org_id)
  )
);
