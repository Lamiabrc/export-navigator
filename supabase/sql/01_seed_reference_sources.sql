insert into public.reference_sources (source_key, label, url)
values
  ('eu_access2markets', 'EU Access2Markets', 'https://trade.ec.europa.eu/access-to-markets/en/home'),
  ('douane_fr', 'Douane française', 'https://www.douane.gouv.fr/'),
  ('sanctions_map', 'Sanctions Map', 'https://www.sanctionsmap.eu/')
on conflict (source_key) do update
set label = excluded.label,
    url = excluded.url;
