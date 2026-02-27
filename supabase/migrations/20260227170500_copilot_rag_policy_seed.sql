-- Copilot policy seed (minimal)
-- Date: 2026-02-27

insert into public.territories (iso2, name, aliases, region, is_eu, last_checked)
values
  ('FR', 'France', array['france','fr'], 'Europe', true, now()),
  ('DE', 'Germany', array['germany','allemagne','de'], 'Europe', true, now()),
  ('ES', 'Spain', array['spain','espagne','es'], 'Europe', true, now()),
  ('IT', 'Italy', array['italy','italie','it'], 'Europe', true, now()),
  ('PT', 'Portugal', array['portugal','pt'], 'Europe', true, now()),
  ('GB', 'United Kingdom', array['uk','gb','united kingdom','royaume uni','angleterre'], 'Europe', false, now()),
  ('US', 'United States', array['usa','us','united states','etats unis'], 'North America', false, now()),
  ('MA', 'Morocco', array['maroc','morocco','ma'], 'Africa', false, now()),
  ('CN', 'China', array['chine','china','cn'], 'Asia', false, now()),
  ('RU', 'Russia', array['russie','russia','ru'], 'Europe/Asia', false, now()),
  ('IR', 'Iran', array['iran','ir'], 'Middle East', false, now())
on conflict (iso2) do update
set
  name = excluded.name,
  aliases = excluded.aliases,
  region = excluded.region,
  is_eu = excluded.is_eu,
  last_checked = now(),
  updated_at = now();

insert into public.product_aliases (term, hs_chapters, examples, priority, last_checked)
values
  ('banane', array['08'], array['banane','banana','fruits tropicaux'], 90, now()),
  ('ferraille', array['72','73'], array['ferraille','steel scrap','dechets acier'], 95, now()),
  ('drone', array['88','85'], array['drone','uav','quadcopter'], 95, now()),
  ('logiciel chiffrement', array['85','90'], array['cryptography software','logiciel encryption'], 92, now()),
  ('capteur', array['90','85'], array['sensor','capteur lidar','module mesure'], 80, now()),
  ('textile', array['61','62'], array['textile','vetement','t-shirt'], 70, now())
on conflict (term) do update
set
  hs_chapters = excluded.hs_chapters,
  examples = excluded.examples,
  priority = excluded.priority,
  last_checked = now(),
  updated_at = now();

insert into public.hs_rules (hs6, to_iso2, topic, rule_text, docs, sources, last_checked)
select
  '080390',
  'WORLD',
  'tariff_docs',
  'Verifier droits de douane, certificat phytosanitaire et regles d''origine pour fruits frais.',
  '[{"name":"Facture commerciale","required":true,"source_url":"https://trade.ec.europa.eu/access-to-markets/en/home"},{"name":"Certificat phytosanitaire","required":true,"source_url":"https://www.douane.gouv.fr"}]'::jsonb,
  '[{"title":"Access2Markets","url":"https://trade.ec.europa.eu/access-to-markets/en/home"},{"title":"FAO Codex","url":"https://www.fao.org/fao-who-codexalimentarius/en/"}]'::jsonb,
  now()
where not exists (
  select 1 from public.hs_rules
  where hs6 = '080390' and coalesce(to_iso2, 'WORLD') = 'WORLD' and topic = 'tariff_docs'
);

insert into public.hs_rules (hs6, to_iso2, topic, rule_text, docs, sources, last_checked)
select
  '720449',
  'WORLD',
  'tariff_docs',
  'Ferrailles de fer/acier: confirmer nature du produit (dechet, barre, tole) avant declaration finale.',
  '[{"name":"Fiche technique matiere","required":true,"source_url":"https://trade.ec.europa.eu/access-to-markets/en/home"}]'::jsonb,
  '[{"title":"EU TARIC","url":"https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=en"}]'::jsonb,
  now()
where not exists (
  select 1 from public.hs_rules
  where hs6 = '720449' and coalesce(to_iso2, 'WORLD') = 'WORLD' and topic = 'tariff_docs'
);

insert into public.hs_rules (hs6, to_iso2, topic, rule_text, docs, sources, last_checked)
select
  '880610',
  'WORLD',
  'dual_use',
  'Drones: verifier eventuel classement dual-use et usage final avant export.',
  '[{"name":"Declaration usage final","required":true,"source_url":"https://eur-lex.europa.eu/eli/reg/2021/821/oj"}]'::jsonb,
  '[{"title":"EU 2021/821","url":"https://eur-lex.europa.eu/eli/reg/2021/821/oj"}]'::jsonb,
  now()
where not exists (
  select 1 from public.hs_rules
  where hs6 = '880610' and coalesce(to_iso2, 'WORLD') = 'WORLD' and topic = 'dual_use'
);

insert into public.country_rules (to_iso2, topic, rule_text, sources, last_checked)
select
  'WORLD',
  'general_customs',
  'Verifier Incoterm + lieu, valeur en douane et preuve de transport avant validation finale.',
  '[{"title":"ICC Incoterms 2020","url":"https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/"}]'::jsonb,
  now()
where not exists (
  select 1 from public.country_rules
  where to_iso2 = 'WORLD' and topic = 'general_customs'
);

insert into public.country_rules (to_iso2, topic, rule_text, sources, last_checked)
select
  'FR',
  'import_vat',
  'Import vers FR: TVA import a gerer via autoliquidation pour entreprise identifiee TVA.',
  '[{"title":"Douane francaise - TVA import","url":"https://www.douane.gouv.fr"}]'::jsonb,
  now()
where not exists (
  select 1 from public.country_rules
  where to_iso2 = 'FR' and topic = 'import_vat'
);

insert into public.country_rules (to_iso2, topic, rule_text, sources, last_checked)
select
  'RU',
  'sanctions',
  'Pays expose aux sanctions UE/OFAC: screening complet et validation juridique avant engagement.',
  '[{"title":"EU Sanctions Map","url":"https://www.sanctionsmap.eu/"},{"title":"OFAC Programs","url":"https://ofac.treasury.gov/sanctions-programs-and-country-information"}]'::jsonb,
  now()
where not exists (
  select 1 from public.country_rules
  where to_iso2 = 'RU' and topic = 'sanctions'
);

insert into public.country_rules (to_iso2, topic, rule_text, sources, last_checked)
select
  'IR',
  'sanctions',
  'Risque sanctions eleve: operation a bloquer tant que screening parties/banques/transit n''est pas valide.',
  '[{"title":"OFAC Programs","url":"https://ofac.treasury.gov/sanctions-programs-and-country-information"},{"title":"UN Consolidated List","url":"https://scsanctions.un.org/consolidated/"}]'::jsonb,
  now()
where not exists (
  select 1 from public.country_rules
  where to_iso2 = 'IR' and topic = 'sanctions'
);

insert into public.sanctions_sources (name, authority, source_url, format, enabled, last_checked)
values
  ('EU Sanctions Map', 'EU', 'https://www.sanctionsmap.eu/', 'web', true, now()),
  ('OFAC SLS', 'US Treasury', 'https://ofac.treasury.gov/sanctions-list-service', 'api', true, now()),
  ('UN Consolidated', 'UN', 'https://scsanctions.un.org/consolidated/', 'dataset', true, now())
on conflict (name) do update
set
  authority = excluded.authority,
  source_url = excluded.source_url,
  format = excluded.format,
  enabled = true,
  last_checked = now(),
  updated_at = now();
