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
