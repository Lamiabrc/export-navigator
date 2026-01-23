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
