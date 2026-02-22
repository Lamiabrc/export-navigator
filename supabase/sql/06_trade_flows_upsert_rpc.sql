alter table public.trade_flows
  add column if not exists reporter_iso2 text,
  add column if not exists partner_iso2 text,
  add column if not exists flow text,
  add column if not exists year int,
  add column if not exists value_usd numeric;

update public.trade_flows
set reporter_iso2 = coalesce(reporter_iso2, reporter_country),
    partner_iso2 = coalesce(partner_iso2, partner_country),
    flow = coalesce(flow, flow_type),
    year = coalesce(year, extract(year from flow_date)::int),
    value_usd = coalesce(value_usd, value_eur)
where reporter_iso2 is null
   or partner_iso2 is null
   or flow is null
   or year is null
   or value_usd is null;

create unique index if not exists trade_flows_uniq
  on public.trade_flows (reporter_iso2, partner_iso2, flow, year, hs_code);

create or replace function public.rpc_upsert_trade_flows(p_rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count int := 0;
begin
  with input_rows as (
    select
      upper(coalesce(r.reporter_iso2, 'FR')) as reporter_iso2,
      upper(coalesce(r.partner_iso2, 'WORLD')) as partner_iso2,
      case when lower(coalesce(r.flow, 'export')) = 'import' then 'import' else 'export' end as flow,
      coalesce(r.year, extract(year from now())::int - 1) as year,
      coalesce(r.hs_code, 'TOTAL') as hs_code,
      coalesce(r.value_usd, 0)::numeric as value_usd,
      coalesce(r.source, 'uncomtrade_legacy') as source
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
      reporter_iso2 text,
      partner_iso2 text,
      flow text,
      year int,
      hs_code text,
      value_usd numeric,
      source text
    )
  ), upserted as (
    insert into public.trade_flows (
      flow_date,
      hs_code,
      reporter_country,
      partner_country,
      flow_type,
      value_eur,
      source,
      reporter_iso2,
      partner_iso2,
      flow,
      year,
      value_usd
    )
    select
      make_date(year, 1, 1),
      hs_code,
      reporter_iso2,
      partner_iso2,
      flow,
      value_usd,
      source,
      reporter_iso2,
      partner_iso2,
      flow,
      year,
      value_usd
    from input_rows
    on conflict (reporter_iso2, partner_iso2, flow, year, hs_code)
    do update set
      flow_date = make_date(excluded.year, 1, 1),
      reporter_country = excluded.reporter_iso2,
      partner_country = excluded.partner_iso2,
      flow_type = excluded.flow,
      value_eur = excluded.value_usd,
      value_usd = excluded.value_usd,
      source = excluded.source
    returning 1
  )
  select count(*) into v_count from upserted;

  return jsonb_build_object('ok', true, 'upserted', v_count);
end;
$$;
