-- ==== 000_init_mpl.sql ====
create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  hs_code text,
  tva numeric,
  manufacturer text,
  created_at timestamptz default now()
);

create table if not exists regulatory_feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_url text,
  category text,
  zone text,
  enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists regulatory_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid references regulatory_feeds(id) on delete set null,
  title text not null,
  summary text,
  url text,
  published_at timestamptz,
  category text,
  zone text,
  severity text,
  created_at timestamptz default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text,
  severity text,
  country_iso2 text null,
  hs_prefix text null,
  source text,
  detected_at timestamptz default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text,
  consent boolean default false,
  offer_type text,
  message text,
  context jsonb,
  created_at timestamptz default now()
);

create table if not exists simulations (
  id uuid primary key default gen_random_uuid(),
  email text null,
  payload jsonb,
  result jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_products_hs_code on products (hs_code);
create index if not exists idx_regulatory_items_published_at on regulatory_items (published_at);
create index if not exists idx_regulatory_items_zone on regulatory_items (zone);
create index if not exists idx_regulatory_items_category on regulatory_items (category);
create index if not exists idx_alerts_country_iso2 on alerts (country_iso2);

insert into products (code, label, hs_code, tva, manufacturer)
values
  ('P-3004', 'Gel dermique apaisant', '3004', 20, 'Laboratoires MPL'),
  ('P-8708', 'Kit freinage premium', '8708', 20, 'MPL Auto'),
  ('P-2204', 'Coffret vin rouge 2022', '2204', 20, 'Domaine Atlantique'),
  ('P-3304', 'Soin hydratant visage', '3304', 20, 'MPL Cosmetique'),
  ('P-9403', 'Chaise bureau ergonomique', '9403', 20, 'Atelier Nord'),
  ('P-8504', 'Transformateur 220V industriel', '8504', 20, 'ElectroMPL'),
  ('P-4202', 'Sac de transport textile', '4202', 20, 'MPL Bags'),
  ('P-8471', 'Kit capteurs IoT export', '8471', 20, 'MPL Tech'),
  ('P-3923', 'Emballage recyclable', '3923', 20, 'PackMPL'),
  ('P-7616', 'Profil aluminium sur mesure', '7616', 20, 'MPL Metal');

insert into regulatory_feeds (name, source_url, category, zone, enabled)
values
  ('UE - Sanctions et restrictions', 'https://data.europa.eu', 'sanctions', 'EU', true),
  ('OFAC - Alerts', 'https://home.treasury.gov', 'sanctions', 'US', true),
  ('ONU - Listes consolidees', 'https://www.un.org', 'sanctions', 'GLOBAL', true);

insert into regulatory_items (feed_id, title, summary, url, published_at, category, zone, severity)
select id, 'Mise a jour sanctions secteur energie', 'Nouvelles restrictions sur les exportations sensibles vers la Russie.', 'https://data.europa.eu', now() - interval '2 days', 'sanctions', 'EU', 'high'
from regulatory_feeds where name = 'UE - Sanctions et restrictions'
union all
select id, 'Documents requis pour agroalimentaire', 'Certification sanitaire obligatoire pour certains HS 22xx.', 'https://data.europa.eu', now() - interval '5 days', 'docs', 'EU', 'medium'
from regulatory_feeds where name = 'UE - Sanctions et restrictions'
union all
select id, 'OFAC - Alertes Iran', 'Nouvelles entites ajoutees a la SDN list.', 'https://home.treasury.gov', now() - interval '4 days', 'sanctions', 'US', 'high'
from regulatory_feeds where name = 'OFAC - Alerts'
union all
select id, 'Taxes additionnelles sur electronics', 'Droits additionnels sur certains composants.', 'https://home.treasury.gov', now() - interval '8 days', 'taxes', 'US', 'medium'
from regulatory_feeds where name = 'OFAC - Alerts'
union all
select id, 'ONU - Mise a jour liste export control', 'Nouveaux controles dual-use sur materiels telecom.', 'https://www.un.org', now() - interval '6 days', 'regulation', 'GLOBAL', 'medium'
from regulatory_feeds where name = 'ONU - Listes consolidees'
union all
select id, 'Procedure douaniere renforcee', 'Double verification pour HS 8708.', 'https://data.europa.eu', now() - interval '9 days', 'douane', 'EU', 'low'
from regulatory_feeds where name = 'UE - Sanctions et restrictions'
union all
select id, 'ONU - Focus sur documents d''origine', 'Renforcement des controles sur certificats d''origine.', 'https://www.un.org', now() - interval '10 days', 'docs', 'GLOBAL', 'low'
from regulatory_feeds where name = 'ONU - Listes consolidees'
union all
select id, 'OFAC - Clarification transport maritime', 'Guidelines sur assurances et transporteurs.', 'https://home.treasury.gov', now() - interval '3 days', 'maritime', 'US', 'medium'
from regulatory_feeds where name = 'OFAC - Alerts'
union all
select id, 'UE - Actualisation taxes carbone', 'Impact sur HS 7616 et 8504.', 'https://data.europa.eu', now() - interval '7 days', 'taxes', 'EU', 'medium'
from regulatory_feeds where name = 'UE - Sanctions et restrictions'
union all
select id, 'ONU - Guide documentation transport', 'Nouvelles recommandations pour transport maritime.', 'https://www.un.org', now() - interval '12 days', 'maritime', 'GLOBAL', 'low'
from regulatory_feeds where name = 'ONU - Listes consolidees'
union all
select id, 'US - Notices compliance export', 'Mise a jour des exigences de declaration.', 'https://home.treasury.gov', now() - interval '1 day', 'regulation', 'US', 'high'
from regulatory_feeds where name = 'OFAC - Alerts'
union all
select id, 'UE - Focus documents pharma', 'Verification renforcee des dossiers CE.', 'https://data.europa.eu', now() - interval '11 days', 'docs', 'EU', 'medium'
from regulatory_feeds where name = 'UE - Sanctions et restrictions';

insert into alerts (title, message, severity, country_iso2, hs_prefix, source, detected_at)
values
  ('Sanctions UE - Russie', 'Blocage partiel sur HS 8708.', 'high', 'RU', '8708', 'demo', now() - interval '2 days'),
  ('Taxes additionnelles US', 'Droits additionnels sur 8504.', 'medium', 'US', '8504', 'demo', now() - interval '4 days'),
  ('Documentation Maroc', 'Certificat d''origine obligatoire pour 2204.', 'medium', 'MA', '2204', 'demo', now() - interval '5 days'),
  ('Controle maritime Chine', 'Delais portuaires en hausse.', 'low', 'CN', '9403', 'demo', now() - interval '7 days'),
  ('Alertes conformite UE', 'Verification renforcee des dossiers pharma.', 'high', 'DE', '3004', 'demo', now() - interval '9 days'),
  ('US - Controles douane', 'Focus sur HS 3304.', 'medium', 'US', '3304', 'demo', now() - interval '12 days');
-- ==== 20250201120000_create_export_tables.sql ====
-- Tables et vues non destructives pour Export Navigator
create extension if not exists "pgcrypto";

-- ====================
-- Tables principales (legacy + nouvelles tables alignées au prompt)
-- ====================
create table if not exists public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  date date,
  client_id text,
  product_id text,
  qty numeric,
  unit_price_ht numeric,
  net_sales_ht numeric,
  currency text,
  market_zone text,
  incoterm text,
  destination text,
  created_at timestamptz default now()
);

create index if not exists sales_lines_date_idx on public.sales_lines(date);
create index if not exists sales_lines_zone_idx on public.sales_lines(market_zone);

create table if not exists public.cost_lines (
  id uuid primary key default gen_random_uuid(),
  date date,
  cost_type text,
  amount numeric,
  currency text,
  market_zone text,
  incoterm text,
  client_id text,
  product_id text,
  destination text,
  created_at timestamptz default now()
);

create index if not exists cost_lines_date_idx on public.cost_lines(date);
create index if not exists cost_lines_zone_idx on public.cost_lines(market_zone);

-- Nouvelles tables dédiées (sales / costs / octroi_mer / taxes_om)
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  date date,
  client_id text,
  product_id text,
  qty numeric,
  unit_price_ht numeric,
  net_sales_ht numeric,
  currency text,
  market_zone text,
  destination text,
  incoterm text,
  created_at timestamptz default now()
);

create index if not exists sales_date_idx on public.sales(date);
create index if not exists sales_zone_idx on public.sales(market_zone);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  date date,
  cost_type text,
  amount numeric,
  currency text,
  market_zone text,
  destination text,
  incoterm text,
  client_id text,
  product_id text,
  created_at timestamptz default now()
);

create index if not exists costs_date_idx on public.costs(date);
create index if not exists costs_zone_idx on public.costs(market_zone);

create table if not exists public.octroi_mer (
  id uuid primary key default gen_random_uuid(),
  territory_code text not null,
  hs_code text,
  om_rate numeric,
  omr_rate numeric,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.taxes_om (
  id uuid primary key default gen_random_uuid(),
  territory_code text not null,
  rule_name text,
  rate_percent numeric,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.om_rates (
  id uuid primary key default gen_random_uuid(),
  territory_code text not null,
  hs_code text,
  om_rate numeric,
  omr_rate numeric,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.vat_rates (
  id uuid primary key default gen_random_uuid(),
  territory_code text not null,
  hs_code text,
  vat_rate numeric,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.tax_rules_extra (
  id uuid primary key default gen_random_uuid(),
  territory_code text not null,
  rule_name text,
  rate_percent numeric,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz default now()
);

-- Vues KPI non destructives
-- v_kpi_sales_by_zone (legacy)
do $$
begin
  if not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kpi_sales_by_zone') then
    execute $view$
      create view public.v_kpi_sales_by_zone as
      select
        coalesce(market_zone, 'UNKNOWN') as market_zone,
        count(*) as line_count,
        sum(coalesce(net_sales_ht, 0)) as total_ht,
        sum(coalesce(qty, 0)) as total_qty
      from public.sales_lines
      group by 1;
    $view$;
      end if;
    end $$;

do $$
begin
  if not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kpi_sales_by_destination') then
    execute $view$
      create view public.v_kpi_sales_by_destination as
      select
        coalesce(destination, 'UNKNOWN') as destination,
        count(*) as line_count,
        sum(coalesce(net_sales_ht, 0)) as total_ht,
        sum(coalesce(qty, 0)) as total_qty
      from public.sales_lines
      group by 1;
    $view$;
      end if;
    end $$;

-- Nouvelles vues KPI demandées
do $$
begin
  if not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'export_kpi_zones') then
    execute $view$
      create view public.export_kpi_zones as
      select
        coalesce(market_zone, 'UNKNOWN') as market_zone,
        count(*) as line_count,
        sum(coalesce(net_sales_ht, 0)) as total_ht,
        sum(coalesce(qty, 0)) as total_qty
      from public.sales
      group by 1;
    $view$;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'export_kpi_destinations') then
    execute $view$
      create view public.export_kpi_destinations as
      select
        coalesce(destination, 'UNKNOWN') as destination,
        count(*) as line_count,
        sum(coalesce(net_sales_ht, 0)) as total_ht,
        sum(coalesce(qty, 0)) as total_qty
      from public.sales
      group by 1;
    $view$;
  end if;
end $$;
-- ==== 20260201121000_trade_flows.sql ====
create table if not exists public.countries (
  code_iso2 text primary key,
  label text not null,
  zone text null,
  lat numeric null,
  lon numeric null
);

create table if not exists public.trade_flows (
  id uuid primary key default gen_random_uuid(),
  flow_date date not null,
  hs_code text null,
  reporter_country text null references public.countries(code_iso2) on update cascade,
  partner_country text null references public.countries(code_iso2) on update cascade,
  flow_type text null check (flow_type in ('export','import')),
  value_eur numeric null,
  volume_kg numeric null,
  source text null,
  created_at timestamptz default now()
);

create index if not exists trade_flows_date_idx on public.trade_flows(flow_date);
create index if not exists trade_flows_hs_idx on public.trade_flows(hs_code);
create index if not exists trade_flows_reporter_idx on public.trade_flows(reporter_country);
create index if not exists trade_flows_partner_idx on public.trade_flows(partner_country);
create index if not exists trade_flows_type_idx on public.trade_flows(flow_type);
-- ==== 20260201130000_lead_magnet.sql ====
create extension if not exists "pgcrypto";

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'lead_magnet',
  metadata_json jsonb,
  consent_bool boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists simulations (
  id uuid primary key default gen_random_uuid(),
  email text,
  hs_input text,
  product_text text,
  destination text,
  incoterm text,
  value numeric,
  currency text,
  result_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists user_prefs (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  countries_json jsonb,
  hs_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  type text,
  country text,
  hs_prefix text,
  title text not null,
  message text not null,
  severity text not null default 'medium',
  detected_at timestamptz not null default now()
);

create table if not exists duty_rate_mock (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  hs_prefix text not null,
  rate numeric not null
);

create table if not exists vat_rate_mock (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  rate numeric not null
);

create table if not exists docs_mock (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  docs jsonb not null
);

insert into duty_rate_mock (country, hs_prefix, rate) values
  ('US', '3004', 4.5),
  ('US', '8708', 3.2),
  ('CN', '8504', 6.8),
  ('GB', '3304', 2.1)
on conflict do nothing;

insert into vat_rate_mock (country, rate) values
  ('US', 0),
  ('DE', 19),
  ('ES', 21),
  ('GB', 20),
  ('CN', 13)
on conflict do nothing;

insert into docs_mock (country, docs) values
  ('US', '["Commercial invoice","Packing list","Certificate of origin","Export declaration","Transport document"]'),
  ('DE', '["Facture commerciale","Packing list","EORI","CMR/AWB","Declaration export"]'),
  ('CN', '["Commercial invoice","Packing list","BL/AWB","Export declaration","Certificate of origin"]')
on conflict do nothing;

insert into alerts (type, country, hs_prefix, title, message, severity) values
  ('sanctions', 'RU', null, 'Mise a jour sanctions (UE)', 'Verifier les restrictions sur certains pays sensibles.', 'high'),
  ('taxes', 'US', '3004', 'Evolution taxes import US', 'Certaines lignes HS 3004 impactees par un relevement de droits.', 'medium'),
  ('docs', 'CN', '8504', 'Nouveaux documents requis', 'Declaration additionnelle demandee sur CN pour produits electriques.', 'medium')
on conflict do nothing;
-- ==== 20260201131500_audit_requests.sql ====
create extension if not exists "pgcrypto";

create table if not exists audit_requests (
  id uuid primary key default gen_random_uuid(),
  company text,
  email text not null,
  destination text,
  incoterm text,
  value numeric,
  currency text,
  lines_count integer,
  notes text,
  context_json jsonb,
  created_at timestamptz not null default now()
);
-- ==== 20260201134000_sanctions_schema.sql ====
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
-- ==== 20260201135000_alerts_patch.sql ====
alter table alerts add column if not exists country_iso2 text;
alter table alerts add column if not exists source text;

update alerts
set country_iso2 = coalesce(country_iso2, country)
where country_iso2 is null and country is not null;

update alerts
set source = coalesce(source, type, 'manual')
where source is null;

insert into alerts (type, country_iso2, hs_prefix, title, message, severity, source)
select 'sanctions', 'RU', null, 'Mise a jour sanctions (UE)', 'Verifier les restrictions sur certains pays sensibles.', 'high', 'EU'
where not exists (select 1 from alerts where title = 'Mise a jour sanctions (UE)');

insert into alerts (type, country_iso2, hs_prefix, title, message, severity, source)
select 'taxes', 'US', '3004', 'Evolution taxes import US', 'Certaines lignes HS 3004 impactees par un relevement de droits.', 'medium', 'WITS'
where not exists (select 1 from alerts where title = 'Evolution taxes import US');
-- ==== 20260204094804_0f2cca76-948a-4ec5-b755-af07a8393f25.sql ====
-- =====================================================
-- Watch / RSS - Tables et RLS pour la veille export
-- =====================================================

-- 1) ENUM pour les catégories de veille
CREATE TYPE public.watch_category AS ENUM (
  'customs',
  'trade',
  'sanctions',
  'tax_vat',
  'standards',
  'logistics',
  'general'
);

-- 2) Table watch_sources - Sources RSS/web à scanner
CREATE TABLE public.watch_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'rss' CHECK (format IN ('rss', 'web', 'api')),
  type TEXT NOT NULL DEFAULT 'regulatory' CHECK (type IN ('regulatory', 'commercial', 'sanctions', 'logistics')),
  country TEXT,
  category public.watch_category NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(url)
);

-- 3) Table watch_items - Articles/items récupérés
CREATE TABLE public.watch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.watch_sources(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'regulatory',
  title TEXT,
  summary TEXT,
  url TEXT,
  guid TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  country TEXT,
  category public.watch_category,
  impact TEXT CHECK (impact IS NULL OR impact IN ('LOW', 'MED', 'HIGH')),
  tags TEXT[],
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, guid)
);

-- 4) Table watch_prefs - Préférences utilisateur pour la veille
CREATE TABLE public.watch_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  countries TEXT[] DEFAULT '{}',
  categories public.watch_category[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  enabled_digest BOOLEAN NOT NULL DEFAULT false,
  digest_frequency TEXT DEFAULT 'weekly' CHECK (digest_frequency IN ('daily', 'weekly', 'monthly')),
  last_digest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 5) Table watch_digest_log - Historique des digests envoyés
CREATE TABLE public.watch_digest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  items_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT
);

-- =====================================================
-- Indexes pour performances
-- =====================================================
CREATE INDEX idx_watch_items_source_id ON public.watch_items(source_id);
CREATE INDEX idx_watch_items_published_at ON public.watch_items(published_at DESC);
CREATE INDEX idx_watch_items_country ON public.watch_items(country) WHERE country IS NOT NULL;
CREATE INDEX idx_watch_items_category ON public.watch_items(category) WHERE category IS NOT NULL;
CREATE INDEX idx_watch_items_impact ON public.watch_items(impact) WHERE impact IS NOT NULL;
CREATE INDEX idx_watch_sources_enabled ON public.watch_sources(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_watch_prefs_user_id ON public.watch_prefs(user_id);

-- =====================================================
-- Fonction pour updated_at automatique
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers updated_at
CREATE TRIGGER trg_watch_sources_updated_at
  BEFORE UPDATE ON public.watch_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_watch_prefs_updated_at
  BEFORE UPDATE ON public.watch_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RLS - Row Level Security
-- =====================================================

-- watch_sources : lecture publique (tout le monde peut voir les sources)
ALTER TABLE public.watch_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire les sources actives"
  ON public.watch_sources FOR SELECT
  USING (is_enabled = true);

-- watch_items : lecture publique (articles publics)
ALTER TABLE public.watch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire les items"
  ON public.watch_items FOR SELECT
  USING (true);

-- watch_prefs : privé par utilisateur
ALTER TABLE public.watch_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leurs propres prefs"
  ON public.watch_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateurs peuvent créer leurs prefs"
  ON public.watch_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateurs peuvent modifier leurs prefs"
  ON public.watch_prefs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateurs peuvent supprimer leurs prefs"
  ON public.watch_prefs FOR DELETE
  USING (auth.uid() = user_id);

-- watch_digest_log : privé par utilisateur
ALTER TABLE public.watch_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leur historique digest"
  ON public.watch_digest_log FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- Seed initial - Sources RSS fiables
-- =====================================================
INSERT INTO public.watch_sources (name, url, format, type, country, category, is_enabled) VALUES
  -- France
  ('Economie.gouv.fr - Actualités', 'https://www.economie.gouv.fr/rss/toutesactualites', 'rss', 'regulatory', 'FR', 'customs', true),
  ('Service-Public Pro - Actualités', 'https://www.service-public.fr/professionnels-entreprises/actualites/rss', 'rss', 'regulatory', 'FR', 'customs', true),
  ('Douanes FR - Actualités', 'https://www.douane.gouv.fr/rss/actualites.xml', 'rss', 'regulatory', 'FR', 'customs', true),
  
  -- EU
  ('EUR-Lex - Nouveaux actes', 'https://eur-lex.europa.eu/rss/new-oj-daily.xml', 'rss', 'regulatory', 'EU', 'customs', true),
  ('EU Commission - Trade News', 'https://trade.ec.europa.eu/rss/press-releases.xml', 'rss', 'regulatory', 'EU', 'trade', true),
  
  -- UK
  ('UK GOV - HMRC News', 'https://www.gov.uk/government/organisations/hm-revenue-customs.atom', 'rss', 'regulatory', 'GB', 'customs', true),
  ('UK GOV - Trade Policy', 'https://www.gov.uk/government/organisations/department-for-international-trade.atom', 'rss', 'regulatory', 'GB', 'trade', true),
  
  -- International
  ('WTO - Latest News', 'https://www.wto.org/english/news_e/news_rss_e.xml', 'rss', 'regulatory', 'INT', 'trade', true),
  ('UNCTAD - News', 'https://unctad.org/rss/news.xml', 'rss', 'regulatory', 'INT', 'trade', true),
  
  -- Sanctions
  ('OFAC - Sanctions Updates', 'https://ofac.treasury.gov/news-and-sanctions/sanctions-list-updates', 'web', 'sanctions', 'US', 'sanctions', true),
  ('EU Sanctions Map', 'https://www.sanctionsmap.eu/feed', 'rss', 'sanctions', 'EU', 'sanctions', true),
  
  -- Logistics
  ('Freight Waves - News', 'https://www.freightwaves.com/feed', 'rss', 'logistics', 'INT', 'logistics', true),
  ('JOC - Maritime News', 'https://www.joc.com/rss/all', 'rss', 'logistics', 'INT', 'logistics', true)

ON CONFLICT (url) DO NOTHING;
-- ==== 20260204120000_watch_schema.sql ====
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
  for all
  using (auth.role() = 'service_role');

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
-- ==== 20260204121000_company_profiles.sql ====
create extension if not exists "pgcrypto";

create table if not exists company_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postal_code text not null,
  country text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table company_profiles enable row level security;

create policy "company_profiles_owner" on company_profiles
  for all
  using (auth.role() = 'service_role' OR auth.uid() = user_id)
  with check (auth.role() = 'service_role' OR auth.uid() = user_id);
