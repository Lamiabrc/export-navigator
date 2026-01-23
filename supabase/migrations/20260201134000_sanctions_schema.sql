create extension if not exists "pgcrypto";

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'running',
  rows integer default 0,
  checksum text
);

create table if not exists raw_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  fetched_at timestamptz not null default now(),
  payload jsonb not null,
  checksum text not null
);

create table if not exists sanctions_entities (
  id uuid primary key default gen_random_uuid(),
  entity_key text unique not null,
  list_name text not null,
  name text not null,
  aliases text[],
  program text,
  country text,
  identifiers jsonb,
  first_seen timestamptz,
  last_seen timestamptz
);

create table if not exists sanctions_matches (
  id uuid primary key default gen_random_uuid(),
  query_name text,
  query_country text,
  matched_entity_id uuid references sanctions_entities(id) on delete cascade,
  match_score numeric,
  created_at timestamptz not null default now()
);

create table if not exists change_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  entity_key text,
  change_type text not null,
  summary text,
  severity text,
  detected_at timestamptz not null default now(),
  old_hash text,
  new_hash text
);

alter table leads add column if not exists consent_newsletter boolean default false;
alter table leads add column if not exists offer_type text;
alter table leads add column if not exists message text;
alter table leads add column if not exists context_json jsonb;

alter table simulations add column if not exists payload jsonb;
alter table simulations add column if not exists result jsonb;

alter table alerts add column if not exists country_iso2 text;
alter table alerts add column if not exists source text;
