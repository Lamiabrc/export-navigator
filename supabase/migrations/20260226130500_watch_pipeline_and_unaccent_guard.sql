-- Keep unaccent available for RPCs and normalize RSS watch pipeline tables.

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto;

create or replace function public.unaccent(text)
returns text
language sql
immutable
as $$
  select extensions.unaccent($1);
$$;

grant execute on function public.unaccent(text) to anon, authenticated, service_role;

-- -----------------------------
-- regulatory_feeds normalization
-- -----------------------------

alter table if exists public.regulatory_feeds
  add column if not exists source_name text,
  add column if not exists kind text default 'rss',
  add column if not exists territory text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists logo_url text,
  add column if not exists is_public boolean not null default true,
  add column if not exists last_fetched_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_feeds'
      and column_name = 'zone'
  ) then
    execute '
      update public.regulatory_feeds
      set territory = coalesce(nullif(territory, ''''), zone)
      where coalesce(nullif(territory, ''''), '''') = ''''
    ';
  end if;
end $$;

update public.regulatory_feeds
set source_name = coalesce(nullif(source_name, ''), nullif(name, ''))
where coalesce(nullif(source_name, ''), '') = '';

update public.regulatory_feeds
set kind = 'rss'
where coalesce(nullif(kind, ''), '') = '';

create index if not exists regulatory_feeds_enabled_idx on public.regulatory_feeds(enabled);
create index if not exists regulatory_feeds_territory_idx on public.regulatory_feeds(territory);
create index if not exists regulatory_feeds_kind_idx on public.regulatory_feeds(kind);

-- -----------------------------
-- regulatory_items normalization
-- -----------------------------

alter table if exists public.regulatory_items
  add column if not exists source_id uuid,
  add column if not exists link text,
  add column if not exists territory text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists image_url text,
  add column if not exists fingerprint text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_items'
      and column_name = 'feed_id'
  ) then
    execute '
      update public.regulatory_items
      set source_id = coalesce(source_id, feed_id)
      where source_id is null
    ';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_items'
      and column_name = 'url'
  ) then
    execute '
      update public.regulatory_items
      set link = coalesce(nullif(link, ''''), url)
      where coalesce(nullif(link, ''''), '''') = ''''
    ';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_items'
      and column_name = 'zone'
  ) then
    execute '
      update public.regulatory_items
      set territory = coalesce(nullif(territory, ''''), zone)
      where coalesce(nullif(territory, ''''), '''') = ''''
    ';
  end if;
end $$;

update public.regulatory_items
set fingerprint = md5(
  coalesce(nullif(link, ''), '') || '|' ||
  coalesce(nullif(title, ''), '') || '|' ||
  coalesce(published_at::text, '')
)
where coalesce(nullif(fingerprint, ''), '') = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'regulatory_items_source_id_fkey'
      and conrelid = 'public.regulatory_items'::regclass
  ) then
    alter table public.regulatory_items
      add constraint regulatory_items_source_id_fkey
      foreign key (source_id)
      references public.regulatory_feeds(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists regulatory_items_source_fingerprint_uidx
  on public.regulatory_items(source_id, fingerprint)
  where source_id is not null and fingerprint is not null;

create index if not exists regulatory_items_published_idx on public.regulatory_items(published_at desc);
create index if not exists regulatory_items_territory_idx on public.regulatory_items(territory);
create index if not exists regulatory_items_category_idx on public.regulatory_items(category);

-- -----------------------------
-- feed fetch logs
-- -----------------------------

create table if not exists public.feed_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid null references public.regulatory_feeds(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  status text not null default 'started',
  http_status integer null,
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  deduped_count integer not null default 0,
  territory text null,
  error text null,
  created_at timestamptz not null default now(),
  constraint feed_fetch_logs_status_chk check (status in ('started', 'ok', 'failed', 'skipped'))
);

create index if not exists feed_fetch_logs_feed_id_idx on public.feed_fetch_logs(feed_id);
create index if not exists feed_fetch_logs_started_at_idx on public.feed_fetch_logs(started_at desc);
create index if not exists feed_fetch_logs_status_idx on public.feed_fetch_logs(status);

-- -----------------------------
-- RLS hardening (service role writes)
-- -----------------------------

alter table if exists public.regulatory_feeds enable row level security;
alter table if exists public.regulatory_items enable row level security;
alter table if exists public.feed_fetch_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_fetch_logs'
      and policyname = 'feed_fetch_logs_service_role'
  ) then
    create policy feed_fetch_logs_service_role
      on public.feed_fetch_logs
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
