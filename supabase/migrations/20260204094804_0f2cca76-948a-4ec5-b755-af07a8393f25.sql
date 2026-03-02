-- =====================================================
-- Watch / RSS - Base schema and RLS (idempotent)
-- =====================================================

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'watch_category'
  ) then
    create type public.watch_category as enum (
      'customs',
      'trade',
      'sanctions',
      'tax_vat',
      'standards',
      'logistics',
      'general'
    );
  end if;
exception
  when duplicate_object then
    null;
end
$$;

create table if not exists public.watch_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  format text not null default 'rss' check (format in ('rss', 'web', 'api')),
  type text not null default 'regulatory' check (type in ('regulatory', 'commercial', 'sanctions', 'logistics')),
  country text,
  category public.watch_category not null default 'general',
  is_enabled boolean not null default true,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

create table if not exists public.watch_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.watch_sources(id) on delete cascade,
  type text not null default 'regulatory',
  title text,
  summary text,
  url text,
  guid text not null,
  published_at timestamptz,
  country text,
  category public.watch_category,
  impact text check (impact is null or impact in ('LOW', 'MED', 'HIGH')),
  tags text[],
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, guid)
);

create table if not exists public.watch_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  countries text[] default '{}',
  categories public.watch_category[] default '{}',
  keywords text[] default '{}',
  enabled_digest boolean not null default false,
  digest_frequency text default 'weekly' check (digest_frequency in ('daily', 'weekly', 'monthly')),
  last_digest_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.watch_digest_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  items_count integer not null default 0,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  error text
);

-- Compatibility with legacy watch schema used in other pending migrations.
alter table public.watch_sources
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists kind text,
  add column if not exists enabled boolean,
  add column if not exists last_status integer,
  add column if not exists name text,
  add column if not exists url text,
  add column if not exists format text,
  add column if not exists type text,
  add column if not exists is_enabled boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.watch_items
  add column if not exists source_id uuid,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists url text,
  add column if not exists guid text,
  add column if not exists published_at timestamptz,
  add column if not exists country text,
  add column if not exists category text,
  add column if not exists impact text,
  add column if not exists tags text[],
  add column if not exists raw jsonb,
  add column if not exists link text,
  add column if not exists hash text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.watch_prefs
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists countries text[] default '{}',
  add column if not exists categories text[] default '{}',
  add column if not exists keywords text[] default '{}',
  add column if not exists enabled_digest boolean default false,
  add column if not exists digest_frequency text default 'weekly',
  add column if not exists last_digest_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.watch_digest_log
  add column if not exists user_id uuid,
  add column if not exists sent_at timestamptz default now(),
  add column if not exists items_count integer default 0,
  add column if not exists status text default 'sent',
  add column if not exists error text;

update public.watch_sources
set
  name = coalesce(nullif(name, ''), nullif(source_name, '')),
  source_name = coalesce(nullif(source_name, ''), nullif(name, '')),
  url = coalesce(nullif(url, ''), nullif(source_url, '')),
  source_url = coalesce(nullif(source_url, ''), nullif(url, '')),
  format = coalesce(nullif(format, ''), nullif(kind, ''), 'rss'),
  kind = coalesce(nullif(kind, ''), nullif(format, ''), 'rss'),
  type = coalesce(nullif(type, ''), 'regulatory'),
  is_enabled = coalesce(is_enabled, enabled, true),
  enabled = coalesce(enabled, is_enabled, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

update public.watch_items
set
  url = coalesce(nullif(url, ''), nullif(link, '')),
  link = coalesce(nullif(link, ''), nullif(url, '')),
  guid = coalesce(nullif(guid, ''), nullif(hash, ''), md5(coalesce(nullif(link, ''), nullif(url, ''), coalesce(id::text, gen_random_uuid()::text)))),
  hash = coalesce(nullif(hash, ''), md5(coalesce(nullif(link, ''), nullif(url, ''), coalesce(id::text, gen_random_uuid()::text)))),
  type = coalesce(nullif(type, ''), 'regulatory'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

create unique index if not exists uq_watch_sources_url_normalized
  on public.watch_sources ((lower(coalesce(url, source_url))))
  where coalesce(url, source_url) is not null;

create index if not exists idx_watch_items_source_id on public.watch_items(source_id);
create index if not exists idx_watch_items_published_at on public.watch_items(published_at desc);
create index if not exists idx_watch_items_country on public.watch_items(country) where country is not null;
create index if not exists idx_watch_items_category on public.watch_items(category) where category is not null;
create index if not exists idx_watch_items_impact on public.watch_items(impact) where impact is not null;
create index if not exists idx_watch_sources_enabled on public.watch_sources(enabled) where enabled = true;
create index if not exists idx_watch_prefs_user_id on public.watch_prefs(user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_watch_sources_updated_at on public.watch_sources;
create trigger trg_watch_sources_updated_at
  before update on public.watch_sources
  for each row execute function public.set_updated_at();

drop trigger if exists trg_watch_prefs_updated_at on public.watch_prefs;
create trigger trg_watch_prefs_updated_at
  before update on public.watch_prefs
  for each row execute function public.set_updated_at();

alter table public.watch_sources enable row level security;
alter table public.watch_items enable row level security;
alter table public.watch_prefs enable row level security;
alter table public.watch_digest_log enable row level security;

drop policy if exists "Tout le monde peut lire les sources actives" on public.watch_sources;
create policy "Tout le monde peut lire les sources actives"
  on public.watch_sources for select
  using (coalesce(is_enabled, enabled, true) = true);

drop policy if exists "Tout le monde peut lire les items" on public.watch_items;
create policy "Tout le monde peut lire les items"
  on public.watch_items for select
  using (true);

drop policy if exists "Utilisateurs voient leurs propres prefs" on public.watch_prefs;
create policy "Utilisateurs voient leurs propres prefs"
  on public.watch_prefs for select
  using (auth.uid() = user_id);

drop policy if exists "Utilisateurs peuvent creer leurs prefs" on public.watch_prefs;
create policy "Utilisateurs peuvent creer leurs prefs"
  on public.watch_prefs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Utilisateurs peuvent modifier leurs prefs" on public.watch_prefs;
create policy "Utilisateurs peuvent modifier leurs prefs"
  on public.watch_prefs for update
  using (auth.uid() = user_id);

drop policy if exists "Utilisateurs peuvent supprimer leurs prefs" on public.watch_prefs;
create policy "Utilisateurs peuvent supprimer leurs prefs"
  on public.watch_prefs for delete
  using (auth.uid() = user_id);

drop policy if exists "Utilisateurs voient leur historique digest" on public.watch_digest_log;
create policy "Utilisateurs voient leur historique digest"
  on public.watch_digest_log for select
  using (auth.uid() = user_id);

insert into public.watch_sources (
  name,
  source_name,
  url,
  source_url,
  format,
  kind,
  type,
  country,
  category,
  is_enabled,
  enabled
)
select
  v.name,
  v.name,
  v.url,
  v.url,
  v.format,
  case when v.format in ('rss', 'web') then v.format else 'rss' end,
  v.type,
  v.country,
  v.category,
  true,
  true
from (
  values
    ('Economie.gouv.fr - Actualites', 'https://www.economie.gouv.fr/rss/toutesactualites', 'rss', 'regulatory', 'FR', 'customs'),
    ('Service-Public Pro - Actualites', 'https://www.service-public.fr/professionnels-entreprises/actualites/rss', 'rss', 'regulatory', 'FR', 'customs'),
    ('Douanes FR - Actualites', 'https://www.douane.gouv.fr/rss/actualites.xml', 'rss', 'regulatory', 'FR', 'customs'),
    ('EUR-Lex - Nouveaux actes', 'https://eur-lex.europa.eu/rss/new-oj-daily.xml', 'rss', 'regulatory', 'EU', 'customs'),
    ('EU Commission - Trade News', 'https://trade.ec.europa.eu/rss/press-releases.xml', 'rss', 'regulatory', 'EU', 'trade'),
    ('UK GOV - HMRC News', 'https://www.gov.uk/government/organisations/hm-revenue-customs.atom', 'rss', 'regulatory', 'GB', 'customs'),
    ('UK GOV - Trade Policy', 'https://www.gov.uk/government/organisations/department-for-international-trade.atom', 'rss', 'regulatory', 'GB', 'trade'),
    ('WTO - Latest News', 'https://www.wto.org/english/news_e/news_rss_e.xml', 'rss', 'regulatory', 'INT', 'trade'),
    ('UNCTAD - News', 'https://unctad.org/rss/news.xml', 'rss', 'regulatory', 'INT', 'trade'),
    ('OFAC - Sanctions Updates', 'https://ofac.treasury.gov/news-and-sanctions/sanctions-list-updates', 'web', 'sanctions', 'US', 'sanctions'),
    ('EU Sanctions Map', 'https://www.sanctionsmap.eu/feed', 'rss', 'sanctions', 'EU', 'sanctions'),
    ('Freight Waves - News', 'https://www.freightwaves.com/feed', 'rss', 'logistics', 'INT', 'logistics'),
    ('JOC - Maritime News', 'https://www.joc.com/rss/all', 'rss', 'logistics', 'INT', 'logistics')
) as v(name, url, format, type, country, category)
where not exists (
  select 1
  from public.watch_sources ws
  where lower(coalesce(ws.url, ws.source_url, '')) = lower(v.url)
);
