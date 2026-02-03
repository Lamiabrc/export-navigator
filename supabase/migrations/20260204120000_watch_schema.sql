create extension if not exists "pgcrypto";

-- Table : watch_sources (RSS/web feeds configuration)
create table if not exists watch_sources (
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

create index if not exists idx_watch_sources_country on watch_sources(country);
create index if not exists idx_watch_sources_category on watch_sources(category);
create index if not exists idx_watch_sources_kind on watch_sources(kind);

-- Table : watch_items (ingested RSS/feeds)
create table if not exists watch_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references watch_sources(id) on delete cascade,
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

create unique index if not exists uq_watch_items_hash on watch_items(hash);
create index if not exists idx_watch_items_source on watch_items(source_id);
create index if not exists idx_watch_items_published on watch_items(published_at);
create index if not exists idx_watch_items_country on watch_items(country);
create index if not exists idx_watch_items_category on watch_items(category);

-- Table : watch_prefs (user-specific filters + digest opt-in)
create table if not exists watch_prefs (
  user_id uuid references auth.users(id) on delete cascade,
  countries text[] default array[]::text[],
  categories text[] default array[]::text[],
  keywords text[] default array[]::text[],
  enabled_digest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

-- Table : watch_digests (sent/queued digests)
create table if not exists watch_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  digest_date date not null,
  sent_at timestamptz,
  status text not null default 'pending',
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: gate access
alter table watch_sources enable row level security;
alter table watch_items enable row level security;
alter table watch_prefs enable row level security;
alter table watch_digests enable row level security;

create policy "watch_sources_service_role" on watch_sources
  for all
  using (auth.role() = 'service_role');
create policy "watch_items_service_role" on watch_items
  for all
  using (auth.role() = 'service_role');

create policy "watch_prefs_owner" on watch_prefs
  for select using (auth.role() = 'service_role' OR auth.uid() = user_id)
  with check (auth.role() = 'service_role' OR auth.uid() = user_id);

create policy "watch_digests_owner" on watch_digests
  for select using (auth.role() = 'service_role' OR auth.uid() = user_id);
create policy "watch_digests_service_role" on watch_digests
  for insert, update, delete using (auth.role() = 'service_role');

-- Trigger helpers
create or replace function watch_sources_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_watch_sources_updated_at
  before update on watch_sources
  for each row execute function watch_sources_updated_at();

create or replace function watch_items_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_watch_items_updated_at
  before update on watch_items
  for each row execute function watch_items_updated_at();

-- Seed initial sources (FR, EU, GB, US)
insert into watch_sources (source_name, source_url, country, category, kind) values
  ('Douanes France - veille doc', 'https://www.douane.gouv.fr/flux/rss/veille.xml', 'FR', 'customs', 'rss'),
  ('EU Trade Alerts', 'https://trade.ec.europa.eu/doclib/docs/2024/october/trade-press-releases.xml', 'EU', 'trade', 'rss'),
  ('UK HMRC - sanctions', 'https://www.gov.uk/government/news.atom', 'GB', 'sanctions', 'rss'),
  ('US Commerce - export alerts', 'https://www.commerce.gov/rss.xml', 'US', 'logistics', 'rss'),
  ('EU TAX Reforms', 'https://ec.europa.eu/taxation_customs/rss/news_rss.xml', 'EU', 'tax/vat', 'rss'),
  ('Standards ISO Updates', 'https://www.iso.org/files/rss/news.xml', null, 'standards', 'rss')
on conflict (source_url) do nothing;
