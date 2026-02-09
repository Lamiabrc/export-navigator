-- Reference tables required by admin dashboard and edge functions

-- Ensure admin helper exists (email allowlist + role metadata)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select
    (auth.jwt() ->> 'email') = 'lamia.brechet@outlook.fr'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

-- Ensure updated_at helper exists
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Export destinations
-- =========================================================
create table if not exists public.export_destinations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  region text null,
  zone text null,
  currency text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint export_destinations_code_uniq unique (code)
);

create index if not exists export_destinations_name_idx on public.export_destinations (name);
create index if not exists export_destinations_region_idx on public.export_destinations (region);

-- =========================================================
-- Incoterms
-- =========================================================
create table if not exists public.export_incoterms (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text null,
  version text not null default '2020',
  group_name text null,
  description text null,
  insurance_required boolean not null default false,
  insurance_min_percent numeric null,
  obligations jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint export_incoterms_code_version_uniq unique (code, version)
);

create index if not exists export_incoterms_code_idx on public.export_incoterms (code);

-- =========================================================
-- Transport rates
-- =========================================================
create table if not exists public.transport_rates (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid null references public.export_destinations(id) on delete set null,
  transport_mode text not null,
  incoterm_code text null,
  currency text not null default 'EUR',
  min_cost numeric null,
  cost_per_kg numeric null,
  cost_per_m3 numeric null,
  fixed_cost numeric null,
  notes text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transport_rates_destination_idx on public.transport_rates (destination_id);
create index if not exists transport_rates_mode_idx on public.transport_rates (transport_mode);

-- =========================================================
-- Product costs
-- =========================================================
create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  cost_type text not null,
  amount numeric not null default 0,
  currency text not null default 'EUR',
  unit text null,
  source text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_costs_product_idx on public.product_costs (product_id);
create index if not exists product_costs_type_idx on public.product_costs (cost_type);

-- =========================================================
-- HS catalog (octroi-mer or duty references)
-- =========================================================
create table if not exists public.export_hs_catalog (
  id uuid primary key default gen_random_uuid(),
  hs_code text not null,
  destination text not null,
  category text null,
  om_rate numeric null,
  omr_rate numeric null,
  notes text null,
  source text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint export_hs_catalog_uniq unique (hs_code, destination)
);

create index if not exists export_hs_catalog_hs_idx on public.export_hs_catalog (hs_code);
create index if not exists export_hs_catalog_dest_idx on public.export_hs_catalog (destination);

-- =========================================================
-- Regulatory events (triage)
-- =========================================================
create table if not exists public.reg_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text null,
  jurisdiction text null,
  impact text null,
  status text not null default 'triaged',
  export_zone text null,
  territory_codes text[] not null default '{}'::text[],
  hs_codes text[] not null default '{}'::text[],
  source_item_id uuid null references public.watch_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reg_events_source_item_uniq unique (source_item_id)
);

create index if not exists reg_events_jurisdiction_idx on public.reg_events (jurisdiction);
create index if not exists reg_events_status_idx on public.reg_events (status);

-- =========================================================
-- Playbooks
-- =========================================================
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text null,
  status text not null default 'draft',
  version text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playbooks_slug_uniq unique (slug)
);

create index if not exists playbooks_status_idx on public.playbooks (status);

create table if not exists public.playbook_sections (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  title text not null,
  content_md text null,
  content_html text null,
  position int not null default 0,
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playbook_sections_playbook_idx on public.playbook_sections (playbook_id);
create index if not exists playbook_sections_position_idx on public.playbook_sections (position);

-- =========================================================
-- Documents + chunks (for RAG ingestion)
-- =========================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  doc_type text null,
  status text not null default 'uploaded',
  object_path text not null,
  extracted_text text null,
  language text null,
  source_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_object_path_uniq unique (object_path)
);

create index if not exists documents_status_idx on public.documents (status);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  meta jsonb null,
  created_at timestamptz not null default now(),
  constraint document_chunks_doc_chunk_uniq unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_idx on public.document_chunks (document_id);

-- =========================================================
-- Updated_at triggers
-- =========================================================
drop trigger if exists trg_export_destinations_updated_at on public.export_destinations;
create trigger trg_export_destinations_updated_at
before update on public.export_destinations
for each row execute function public.set_updated_at();

drop trigger if exists trg_export_incoterms_updated_at on public.export_incoterms;
create trigger trg_export_incoterms_updated_at
before update on public.export_incoterms
for each row execute function public.set_updated_at();

drop trigger if exists trg_transport_rates_updated_at on public.transport_rates;
create trigger trg_transport_rates_updated_at
before update on public.transport_rates
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_costs_updated_at on public.product_costs;
create trigger trg_product_costs_updated_at
before update on public.product_costs
for each row execute function public.set_updated_at();

drop trigger if exists trg_export_hs_catalog_updated_at on public.export_hs_catalog;
create trigger trg_export_hs_catalog_updated_at
before update on public.export_hs_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_reg_events_updated_at on public.reg_events;
create trigger trg_reg_events_updated_at
before update on public.reg_events
for each row execute function public.set_updated_at();

drop trigger if exists trg_playbooks_updated_at on public.playbooks;
create trigger trg_playbooks_updated_at
before update on public.playbooks
for each row execute function public.set_updated_at();

drop trigger if exists trg_playbook_sections_updated_at on public.playbook_sections;
create trigger trg_playbook_sections_updated_at
before update on public.playbook_sections
for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- =========================================================
-- RLS policies
-- =========================================================
alter table public.export_destinations enable row level security;
alter table public.export_incoterms enable row level security;
alter table public.transport_rates enable row level security;
alter table public.product_costs enable row level security;
alter table public.export_hs_catalog enable row level security;
alter table public.reg_events enable row level security;
alter table public.playbooks enable row level security;
alter table public.playbook_sections enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- Public read for reference tables

drop policy if exists "export_destinations_select" on public.export_destinations;
create policy "export_destinations_select"
  on public.export_destinations for select
  using (true);

drop policy if exists "export_incoterms_select" on public.export_incoterms;
create policy "export_incoterms_select"
  on public.export_incoterms for select
  using (true);

drop policy if exists "export_hs_catalog_select" on public.export_hs_catalog;
create policy "export_hs_catalog_select"
  on public.export_hs_catalog for select
  using (true);

-- Admin write policies

drop policy if exists "export_destinations_admin_insert" on public.export_destinations;
create policy "export_destinations_admin_insert"
  on public.export_destinations for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "export_destinations_admin_update" on public.export_destinations;
create policy "export_destinations_admin_update"
  on public.export_destinations for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "export_destinations_admin_delete" on public.export_destinations;
create policy "export_destinations_admin_delete"
  on public.export_destinations for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "export_incoterms_admin_insert" on public.export_incoterms;
create policy "export_incoterms_admin_insert"
  on public.export_incoterms for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "export_incoterms_admin_update" on public.export_incoterms;
create policy "export_incoterms_admin_update"
  on public.export_incoterms for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "export_incoterms_admin_delete" on public.export_incoterms;
create policy "export_incoterms_admin_delete"
  on public.export_incoterms for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "export_hs_catalog_admin_insert" on public.export_hs_catalog;
create policy "export_hs_catalog_admin_insert"
  on public.export_hs_catalog for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "export_hs_catalog_admin_update" on public.export_hs_catalog;
create policy "export_hs_catalog_admin_update"
  on public.export_hs_catalog for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "export_hs_catalog_admin_delete" on public.export_hs_catalog;
create policy "export_hs_catalog_admin_delete"
  on public.export_hs_catalog for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "transport_rates_select" on public.transport_rates;
create policy "transport_rates_select"
  on public.transport_rates for select
  using (true);

drop policy if exists "transport_rates_admin_insert" on public.transport_rates;
create policy "transport_rates_admin_insert"
  on public.transport_rates for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "transport_rates_admin_update" on public.transport_rates;
create policy "transport_rates_admin_update"
  on public.transport_rates for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "transport_rates_admin_delete" on public.transport_rates;
create policy "transport_rates_admin_delete"
  on public.transport_rates for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "product_costs_select" on public.product_costs;
create policy "product_costs_select"
  on public.product_costs for select
  using (true);

drop policy if exists "product_costs_admin_insert" on public.product_costs;
create policy "product_costs_admin_insert"
  on public.product_costs for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "product_costs_admin_update" on public.product_costs;
create policy "product_costs_admin_update"
  on public.product_costs for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "product_costs_admin_delete" on public.product_costs;
create policy "product_costs_admin_delete"
  on public.product_costs for delete
  using (public.is_admin() or auth.role() = 'service_role');


-- Restrict documents + reg_events + playbooks to admin/service role

drop policy if exists "reg_events_select_admin" on public.reg_events;
create policy "reg_events_select_admin"
  on public.reg_events for select
  using (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "reg_events_admin_insert" on public.reg_events;
create policy "reg_events_admin_insert"
  on public.reg_events for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "reg_events_admin_update" on public.reg_events;
create policy "reg_events_admin_update"
  on public.reg_events for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "reg_events_admin_delete" on public.reg_events;
create policy "reg_events_admin_delete"
  on public.reg_events for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "playbooks_select_admin" on public.playbooks;
create policy "playbooks_select_admin"
  on public.playbooks for select
  using (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "playbooks_admin_insert" on public.playbooks;
create policy "playbooks_admin_insert"
  on public.playbooks for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "playbooks_admin_update" on public.playbooks;
create policy "playbooks_admin_update"
  on public.playbooks for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "playbooks_admin_delete" on public.playbooks;
create policy "playbooks_admin_delete"
  on public.playbooks for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "playbook_sections_select_admin" on public.playbook_sections;
create policy "playbook_sections_select_admin"
  on public.playbook_sections for select
  using (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "playbook_sections_admin_insert" on public.playbook_sections;
create policy "playbook_sections_admin_insert"
  on public.playbook_sections for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "playbook_sections_admin_update" on public.playbook_sections;
create policy "playbook_sections_admin_update"
  on public.playbook_sections for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "playbook_sections_admin_delete" on public.playbook_sections;
create policy "playbook_sections_admin_delete"
  on public.playbook_sections for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "documents_select_admin" on public.documents;
create policy "documents_select_admin"
  on public.documents for select
  using (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "documents_admin_insert" on public.documents;
create policy "documents_admin_insert"
  on public.documents for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "documents_admin_update" on public.documents;
create policy "documents_admin_update"
  on public.documents for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "documents_admin_delete" on public.documents;
create policy "documents_admin_delete"
  on public.documents for delete
  using (public.is_admin() or auth.role() = 'service_role');


drop policy if exists "document_chunks_select_admin" on public.document_chunks;
create policy "document_chunks_select_admin"
  on public.document_chunks for select
  using (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "document_chunks_admin_insert" on public.document_chunks;
create policy "document_chunks_admin_insert"
  on public.document_chunks for insert
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "document_chunks_admin_update" on public.document_chunks;
create policy "document_chunks_admin_update"
  on public.document_chunks for update
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists "document_chunks_admin_delete" on public.document_chunks;
create policy "document_chunks_admin_delete"
  on public.document_chunks for delete
  using (public.is_admin() or auth.role() = 'service_role');

-- Grants

grant select on public.export_destinations to anon, authenticated;
grant select on public.export_incoterms to anon, authenticated;
grant select on public.export_hs_catalog to anon, authenticated;
grant select on public.transport_rates to anon, authenticated;
grant select on public.product_costs to anon, authenticated;

grant select on public.reg_events to authenticated;
grant select on public.playbooks to authenticated;
grant select on public.playbook_sections to authenticated;
grant select on public.documents to authenticated;
grant select on public.document_chunks to authenticated;

grant insert, update, delete on public.export_destinations to authenticated;
grant insert, update, delete on public.export_incoterms to authenticated;
grant insert, update, delete on public.export_hs_catalog to authenticated;
grant insert, update, delete on public.transport_rates to authenticated;
grant insert, update, delete on public.product_costs to authenticated;
grant insert, update, delete on public.reg_events to authenticated;
grant insert, update, delete on public.playbooks to authenticated;
grant insert, update, delete on public.playbook_sections to authenticated;
grant insert, update, delete on public.documents to authenticated;
grant insert, update, delete on public.document_chunks to authenticated;
