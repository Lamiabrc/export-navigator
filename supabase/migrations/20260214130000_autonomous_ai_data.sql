create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.source_registry (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  kind text not null check (kind in ('api','dataset','manual','scrape')),
  base_url text,
  license text,
  refresh_rule text,
  enabled boolean not null default true,
  last_run_at timestamptz
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.source_registry(id) on delete cascade,
  status text not null check (status in ('success','failed','partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text
);

alter table public.countries add column if not exists iso3 text;

create table if not exists public.country_aliases (
  id bigserial primary key,
  iso2 text not null references public.countries(iso2) on delete cascade,
  alias text not null,
  lang text not null default 'fr',
  unique(iso2, alias)
);
create index if not exists country_aliases_alias_idx on public.country_aliases using gin (to_tsvector('simple', alias));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  category text
);

create table if not exists public.product_synonyms (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  term text not null,
  lang text not null default 'fr',
  weight int not null default 1
);
create index if not exists product_synonyms_term_idx on public.product_synonyms using gin (to_tsvector('simple', term));

create table if not exists public.product_hs_examples (
  id bigserial primary key,
  product_term text not null,
  hs6 text not null references public.hs_codes(hs6) on delete cascade,
  note text,
  confidence int not null default 70
);
create index if not exists product_hs_examples_term_idx on public.product_hs_examples using gin (to_tsvector('simple', product_term));

create index if not exists hs_codes_label_idx on public.hs_codes using gin (to_tsvector('french', coalesce(label_fr, '')));
create index if not exists hs_synonyms_term_idx on public.hs_synonyms using gin (to_tsvector('simple', term));

alter table public.templates drop constraint if exists templates_type_check;
alter table public.templates add constraint templates_type_check check (type in ('email','checklist','clause','questions','rule'));

alter table public.kb_documents add column if not exists license text;

create index if not exists kb_chunks_embedding_idx on public.kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists kb_chunks_content_idx on public.kb_chunks using gin (to_tsvector('french', content));

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
    d.title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.kb_chunks c
  join public.kb_documents d on d.id = c.document_id
  where c.embedding is not null
    and (filter_universe is null or d.universe = filter_universe)
  order by c.embedding <=> query_embedding
  limit greatest(1, coalesce(match_count, 8));
$$;

create table if not exists public.sanctions_sources (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  source_url text,
  format text
);

create table if not exists public.sanctions_entities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sanctions_sources(id) on delete set null,
  entity_name text not null,
  entity_type text,
  programs text[] not null default '{}',
  country text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists sanctions_entities_name_idx on public.sanctions_entities using gin (to_tsvector('simple', entity_name));

-- RLS
alter table public.source_registry enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.country_aliases enable row level security;
alter table public.products enable row level security;
alter table public.product_synonyms enable row level security;
alter table public.product_hs_examples enable row level security;
alter table public.sanctions_sources enable row level security;
alter table public.sanctions_entities enable row level security;

drop policy if exists source_registry_read_auth on public.source_registry;
create policy source_registry_read_auth on public.source_registry for select to authenticated using (true);
drop policy if exists ingestion_runs_read_auth on public.ingestion_runs;
create policy ingestion_runs_read_auth on public.ingestion_runs for select to authenticated using (true);
drop policy if exists country_aliases_read_auth on public.country_aliases;
create policy country_aliases_read_auth on public.country_aliases for select to authenticated using (true);
drop policy if exists products_read_auth on public.products;
create policy products_read_auth on public.products for select to authenticated using (true);
drop policy if exists product_synonyms_read_auth on public.product_synonyms;
create policy product_synonyms_read_auth on public.product_synonyms for select to authenticated using (true);
drop policy if exists product_hs_examples_read_auth on public.product_hs_examples;
create policy product_hs_examples_read_auth on public.product_hs_examples for select to authenticated using (true);
drop policy if exists sanctions_sources_read_auth on public.sanctions_sources;
create policy sanctions_sources_read_auth on public.sanctions_sources for select to authenticated using (true);
drop policy if exists sanctions_entities_read_auth on public.sanctions_entities;
create policy sanctions_entities_read_auth on public.sanctions_entities for select to authenticated using (true);

-- write policies reserved for service role (edge/admin)
drop policy if exists source_registry_write_service on public.source_registry;
create policy source_registry_write_service on public.source_registry for all to service_role using (true) with check (true);
drop policy if exists ingestion_runs_write_service on public.ingestion_runs;
create policy ingestion_runs_write_service on public.ingestion_runs for all to service_role using (true) with check (true);
drop policy if exists sanctions_write_service on public.sanctions_sources;
create policy sanctions_write_service on public.sanctions_sources for all to service_role using (true) with check (true);
drop policy if exists sanctions_entities_write_service on public.sanctions_entities;
create policy sanctions_entities_write_service on public.sanctions_entities for all to service_role using (true) with check (true);
drop policy if exists products_write_service on public.products;
create policy products_write_service on public.products for all to service_role using (true) with check (true);
drop policy if exists product_synonyms_write_service on public.product_synonyms;
create policy product_synonyms_write_service on public.product_synonyms for all to service_role using (true) with check (true);
drop policy if exists product_hs_examples_write_service on public.product_hs_examples;
create policy product_hs_examples_write_service on public.product_hs_examples for all to service_role using (true) with check (true);
drop policy if exists country_aliases_write_service on public.country_aliases;
create policy country_aliases_write_service on public.country_aliases for all to service_role using (true) with check (true);

insert into public.source_registry(name, kind, base_url, license, refresh_rule)
values
  ('OFAC SDN', 'dataset', 'https://ofac.treasury.gov', 'Public', 'weekly'),
  ('UN Sanctions', 'dataset', 'https://scsanctions.un.org', 'Public', 'weekly'),
  ('Manual Upload', 'manual', null, null, 'on-demand')
on conflict (name) do nothing;
