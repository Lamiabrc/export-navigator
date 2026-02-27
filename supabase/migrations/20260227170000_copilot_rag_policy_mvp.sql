-- Copilot policy and controls MVP schema
-- Date: 2026-02-27

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.territories (
  iso2 text primary key check (iso2 ~ '^[A-Z]{2}$'),
  name text not null,
  aliases text[] not null default '{}'::text[],
  region text null,
  is_eu boolean not null default false,
  last_checked timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists territories_aliases_idx on public.territories using gin(aliases);

create table if not exists public.product_aliases (
  id bigserial primary key,
  term text not null unique,
  hs_chapters text[] not null default '{}'::text[],
  examples text[] not null default '{}'::text[],
  priority int not null default 50,
  last_checked timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_aliases_term_fts_idx on public.product_aliases using gin(to_tsvector('simple', term));
create index if not exists product_aliases_hs_chapters_idx on public.product_aliases using gin(hs_chapters);

create table if not exists public.hs_rules (
  id uuid primary key default gen_random_uuid(),
  hs6 text not null check (hs6 ~ '^[0-9]{6}$'),
  to_iso2 text null check (to_iso2 is null or to_iso2 = 'WORLD' or to_iso2 ~ '^[A-Z]{2}$'),
  topic text not null,
  rule_text text not null,
  docs jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  last_checked timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hs_rules_lookup_idx on public.hs_rules(hs6, to_iso2, topic);
create unique index if not exists hs_rules_dedupe_idx on public.hs_rules(hs6, coalesce(to_iso2, 'WORLD'), topic, md5(rule_text));

create table if not exists public.country_rules (
  id uuid primary key default gen_random_uuid(),
  to_iso2 text not null check (to_iso2 = 'WORLD' or to_iso2 ~ '^[A-Z]{2}$'),
  topic text not null,
  rule_text text not null,
  sources jsonb not null default '[]'::jsonb,
  last_checked timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists country_rules_lookup_idx on public.country_rules(to_iso2, topic);
create unique index if not exists country_rules_dedupe_idx on public.country_rules(to_iso2, topic, md5(rule_text));

create table if not exists public.sanctions_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  authority text null,
  source_url text null,
  format text null,
  fingerprint text null,
  enabled boolean not null default true,
  last_checked timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sanctions_sources add column if not exists authority text;
alter table public.sanctions_sources add column if not exists source_url text;
alter table public.sanctions_sources add column if not exists format text;
alter table public.sanctions_sources add column if not exists fingerprint text;
alter table public.sanctions_sources add column if not exists enabled boolean not null default true;
alter table public.sanctions_sources add column if not exists last_checked timestamptz not null default now();
alter table public.sanctions_sources add column if not exists created_at timestamptz not null default now();
alter table public.sanctions_sources add column if not exists updated_at timestamptz not null default now();
create index if not exists sanctions_sources_enabled_idx on public.sanctions_sources(enabled, updated_at desc);

create table if not exists public.sanctions_entities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid null references public.sanctions_sources(id) on delete set null,
  entity_name text not null,
  aliases text[] not null default '{}'::text[],
  entity_type text null,
  country_iso2 text null,
  programs text[] not null default '{}'::text[],
  fingerprint text null,
  raw jsonb not null default '{}'::jsonb,
  last_checked timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.sanctions_entities add column if not exists source_id uuid;
alter table public.sanctions_entities add column if not exists entity_name text;
alter table public.sanctions_entities add column if not exists aliases text[] not null default '{}'::text[];
alter table public.sanctions_entities add column if not exists entity_type text;
alter table public.sanctions_entities add column if not exists country_iso2 text;
alter table public.sanctions_entities add column if not exists programs text[] not null default '{}'::text[];
alter table public.sanctions_entities add column if not exists fingerprint text;
alter table public.sanctions_entities add column if not exists raw jsonb not null default '{}'::jsonb;
alter table public.sanctions_entities add column if not exists last_checked timestamptz not null default now();
alter table public.sanctions_entities add column if not exists updated_at timestamptz not null default now();
alter table public.sanctions_entities add column if not exists created_at timestamptz not null default now();

-- normalize legacy column names when present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sanctions_entities'
      and column_name = 'name'
  ) then
    execute 'update public.sanctions_entities set entity_name = coalesce(entity_name, name) where entity_name is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sanctions_entities'
      and column_name = 'country'
  ) then
    execute 'update public.sanctions_entities set country_iso2 = upper(left(country, 2)) where country_iso2 is null and country is not null';
  end if;
end $$;

create index if not exists sanctions_entities_name_fts_idx on public.sanctions_entities using gin(to_tsvector('simple', coalesce(entity_name, '')));
create index if not exists sanctions_entities_country_idx on public.sanctions_entities(country_iso2);
create index if not exists sanctions_entities_fingerprint_idx on public.sanctions_entities(fingerprint);

-- harmonize kb_chunks for RAG metadata
alter table public.kb_chunks add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.kb_chunks add column if not exists source_url text;
alter table public.kb_chunks add column if not exists last_checked timestamptz not null default now();
create index if not exists kb_chunks_metadata_gin_idx on public.kb_chunks using gin(metadata);

-- RLS
alter table public.territories enable row level security;
alter table public.product_aliases enable row level security;
alter table public.hs_rules enable row level security;
alter table public.country_rules enable row level security;
alter table public.sanctions_sources enable row level security;
alter table public.sanctions_entities enable row level security;

-- read policies
do $$
begin
  execute 'drop policy if exists territories_read_all on public.territories';
  execute 'create policy territories_read_all on public.territories for select to anon, authenticated using (true)';

  execute 'drop policy if exists product_aliases_read_all on public.product_aliases';
  execute 'create policy product_aliases_read_all on public.product_aliases for select to anon, authenticated using (true)';

  execute 'drop policy if exists hs_rules_read_all on public.hs_rules';
  execute 'create policy hs_rules_read_all on public.hs_rules for select to anon, authenticated using (true)';

  execute 'drop policy if exists country_rules_read_all on public.country_rules';
  execute 'create policy country_rules_read_all on public.country_rules for select to anon, authenticated using (true)';

  execute 'drop policy if exists sanctions_sources_read_all on public.sanctions_sources';
  execute 'create policy sanctions_sources_read_all on public.sanctions_sources for select to anon, authenticated using (true)';

  execute 'drop policy if exists sanctions_entities_read_all on public.sanctions_entities';
  execute 'create policy sanctions_entities_read_all on public.sanctions_entities for select to anon, authenticated using (true)';
end $$;

-- service write policies
do $$
begin
  execute 'drop policy if exists territories_write_service on public.territories';
  execute 'create policy territories_write_service on public.territories for all to service_role using (true) with check (true)';

  execute 'drop policy if exists product_aliases_write_service on public.product_aliases';
  execute 'create policy product_aliases_write_service on public.product_aliases for all to service_role using (true) with check (true)';

  execute 'drop policy if exists hs_rules_write_service on public.hs_rules';
  execute 'create policy hs_rules_write_service on public.hs_rules for all to service_role using (true) with check (true)';

  execute 'drop policy if exists country_rules_write_service on public.country_rules';
  execute 'create policy country_rules_write_service on public.country_rules for all to service_role using (true) with check (true)';

  execute 'drop policy if exists sanctions_sources_write_service on public.sanctions_sources';
  execute 'create policy sanctions_sources_write_service on public.sanctions_sources for all to service_role using (true) with check (true)';

  execute 'drop policy if exists sanctions_entities_write_service on public.sanctions_entities';
  execute 'create policy sanctions_entities_write_service on public.sanctions_entities for all to service_role using (true) with check (true)';
end $$;

grant select on public.territories to anon, authenticated;
grant select on public.product_aliases to anon, authenticated;
grant select on public.hs_rules to anon, authenticated;
grant select on public.country_rules to anon, authenticated;
grant select on public.sanctions_sources to anon, authenticated;
grant select on public.sanctions_entities to anon, authenticated;
