create extension if not exists "pgcrypto";

-- Legacy watch schema kept idempotent for existing projects.
create table if not exists public.watch_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null unique,
  country text,
  category text,
  kind text not null check (kind in ('rss','web')),
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.watch_sources(id) on delete cascade,
  title text not null,
  link text not null,
  summary text,
  published_at timestamptz,
  country text,
  category text,
  severity text,
  normalized_ticker text,
  raw jsonb,
  hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_prefs (
  user_id uuid references auth.users(id) on delete cascade,
  countries text[] default array[]::text[],
  categories text[] default array[]::text[],
  keywords text[] default array[]::text[],
  enabled_digest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

create table if not exists public.watch_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  digest_date date not null,
  sent_at timestamptz,
  status text not null default 'pending',
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cross-migration compatibility columns.
alter table public.watch_sources
  add column if not exists name text,
  add column if not exists url text,
  add column if not exists format text,
  add column if not exists type text,
  add column if not exists is_enabled boolean,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists kind text,
  add column if not exists enabled boolean,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_status integer,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.watch_items
  add column if not exists source_id uuid,
  add column if not exists title text,
  add column if not exists link text,
  add column if not exists summary text,
  add column if not exists published_at timestamptz,
  add column if not exists country text,
  add column if not exists category text,
  add column if not exists severity text,
  add column if not exists normalized_ticker text,
  add column if not exists raw jsonb,
  add column if not exists hash text,
  add column if not exists type text,
  add column if not exists url text,
  add column if not exists guid text,
  add column if not exists impact text,
  add column if not exists tags text[],
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.watch_sources
set
  source_name = coalesce(nullif(source_name, ''), nullif(name, '')),
  name = coalesce(nullif(name, ''), nullif(source_name, '')),
  source_url = coalesce(nullif(source_url, ''), nullif(url, '')),
  url = coalesce(nullif(url, ''), nullif(source_url, '')),
  kind = coalesce(nullif(kind, ''), nullif(format, ''), 'rss'),
  format = coalesce(nullif(format, ''), nullif(kind, ''), 'rss'),
  enabled = coalesce(enabled, is_enabled, true),
  is_enabled = coalesce(is_enabled, enabled, true),
  type = coalesce(nullif(type, ''), 'regulatory'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

update public.watch_items
set
  link = coalesce(nullif(link, ''), nullif(url, '')),
  url = coalesce(nullif(url, ''), nullif(link, '')),
  hash = coalesce(nullif(hash, ''), md5(coalesce(nullif(link, ''), nullif(url, ''), coalesce(id::text, gen_random_uuid()::text)))),
  guid = coalesce(nullif(guid, ''), nullif(hash, ''), md5(coalesce(nullif(link, ''), nullif(url, ''), coalesce(id::text, gen_random_uuid()::text)))),
  type = coalesce(nullif(type, ''), 'regulatory'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

create unique index if not exists uq_watch_items_hash on public.watch_items(hash);
create index if not exists idx_watch_sources_country on public.watch_sources(country);
create index if not exists idx_watch_sources_category on public.watch_sources(category);
create index if not exists idx_watch_sources_kind on public.watch_sources(kind);
create index if not exists idx_watch_items_source on public.watch_items(source_id);
create index if not exists idx_watch_items_published on public.watch_items(published_at);
create index if not exists idx_watch_items_country on public.watch_items(country);
create index if not exists idx_watch_items_category on public.watch_items(category);

alter table public.watch_sources enable row level security;
alter table public.watch_items enable row level security;
alter table public.watch_prefs enable row level security;
alter table public.watch_digests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watch_sources' and policyname = 'watch_sources_service_role'
  ) then
    create policy "watch_sources_service_role" on public.watch_sources
      for all using (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watch_items' and policyname = 'watch_items_service_role'
  ) then
    create policy "watch_items_service_role" on public.watch_items
      for all using (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watch_prefs' and policyname = 'watch_prefs_owner'
  ) then
    create policy "watch_prefs_owner" on public.watch_prefs
      for select using (auth.role() = 'service_role' or auth.uid() = user_id)
      with check (auth.role() = 'service_role' or auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watch_digests' and policyname = 'watch_digests_owner'
  ) then
    create policy "watch_digests_owner" on public.watch_digests
      for select using (auth.role() = 'service_role' or auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watch_digests' and policyname = 'watch_digests_service_role'
  ) then
    create policy "watch_digests_service_role" on public.watch_digests
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end
$$;

create or replace function public.watch_sources_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_watch_sources_updated_at on public.watch_sources;
create trigger trg_watch_sources_updated_at
  before update on public.watch_sources
  for each row execute function public.watch_sources_updated_at();

create or replace function public.watch_items_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_watch_items_updated_at on public.watch_items;
create trigger trg_watch_items_updated_at
  before update on public.watch_items
  for each row execute function public.watch_items_updated_at();

insert into public.watch_sources (
  source_name,
  name,
  source_url,
  url,
  country,
  category,
  kind,
  format,
  type,
  enabled,
  is_enabled
)
select
  v.source_name,
  v.source_name,
  v.source_url,
  v.source_url,
  v.country,
  v.category,
  v.kind,
  v.kind,
  'regulatory',
  true,
  true
from (
  values
    ('Douanes France - veille doc', 'https://www.douane.gouv.fr/flux/rss/veille.xml', 'FR', 'customs', 'rss'),
    ('EU Trade Alerts', 'https://trade.ec.europa.eu/doclib/docs/2024/october/trade-press-releases.xml', 'EU', 'trade', 'rss'),
    ('UK HMRC - sanctions', 'https://www.gov.uk/government/news.atom', 'GB', 'sanctions', 'rss'),
    ('US Commerce - export alerts', 'https://www.commerce.gov/rss.xml', 'US', 'logistics', 'rss'),
    ('EU TAX Reforms', 'https://ec.europa.eu/taxation_customs/rss/news_rss.xml', 'EU', 'tax/vat', 'rss'),
    ('Standards ISO Updates', 'https://www.iso.org/files/rss/news.xml', null, 'standards', 'rss')
) as v(source_name, source_url, country, category, kind)
where not exists (
  select 1
  from public.watch_sources ws
  where lower(coalesce(ws.source_url, ws.url, '')) = lower(v.source_url)
);
