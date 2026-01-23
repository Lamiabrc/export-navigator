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
