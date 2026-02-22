create or replace function public.rpc_export_answer(destination_iso2 text, hs_code text, lang text default 'fr')
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'destination', jsonb_build_object(
      'iso2', c.iso2,
      'name', case when lang = 'en' then c.name_en else c.name_fr end,
      'zone', case when upper(coalesce(c.zone, '')) = 'DROM' then 'Territoires' else c.zone end
    ),
    'country_rules', coalesce(cr.rules, '{}'::jsonb),
    'product_rules', coalesce(pr.rules, '[]'::jsonb),
    'update_sources', coalesce(src.sources, '[]'::jsonb)
  )
  into result
  from public.countries c
  left join lateral (
    select jsonb_object_agg(rule_key, rule_value) as rules
    from public.country_rule_cards crc
    where crc.iso2 = c.iso2
      and crc.lang = rpc_export_answer.lang
  ) cr on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('title', card_title, 'body', card_body)) as rules
    from public.product_rule_cards prc
    where prc.hs2 = left(rpc_export_answer.hs_code, 2)
      and prc.lang = rpc_export_answer.lang
  ) pr on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('source_key', rs.source_key, 'label', rs.label, 'url', rs.url)) as sources
    from public.reference_sources rs
  ) src on true
  where c.iso2 = upper(rpc_export_answer.destination_iso2)
  limit 1;

  return coalesce(result, '{}'::jsonb);
end;
$$;
