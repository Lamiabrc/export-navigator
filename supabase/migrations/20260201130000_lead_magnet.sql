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
