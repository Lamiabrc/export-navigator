create extension if not exists "pgcrypto";
create extension if not exists unaccent;

-- Guard for environments where extension objects are in schema "extensions"
-- and callers expect public.unaccent(text).
do $$
declare
  ext_schema text;
begin
  if to_regprocedure('public.unaccent(text)') is null then
    select n.nspname
    into ext_schema
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'unaccent'
      and p.pronargs = 1
      and p.proargtypes = '25'::oidvector
      and n.nspname <> 'public'
    order by case when n.nspname = 'extensions' then 0 else 1 end
    limit 1;

    if ext_schema is not null then
      execute format(
        'create function public.unaccent(text) returns text language sql immutable strict as $f$ select %I.unaccent($1) $f$',
        ext_schema
      );
    else
      execute 'create function public.unaccent(text) returns text language sql immutable strict as $f$ select $1 $f$';
    end if;
  end if;
end
$$;

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

-- Drift guard for environments where legacy tables already exist
-- with missing columns required by this baseline migration.
alter table if exists products
  add column if not exists hs_code text;

alter table if exists alerts
  add column if not exists country_iso2 text;

alter table if exists regulatory_feeds
  add column if not exists category text,
  add column if not exists zone text,
  add column if not exists enabled boolean default true;

alter table if exists regulatory_items
  add column if not exists published_at timestamptz,
  add column if not exists category text,
  add column if not exists zone text,
  add column if not exists severity text;

create index if not exists idx_products_hs_code on products (hs_code);
create index if not exists idx_regulatory_items_published_at on regulatory_items (published_at);
create index if not exists idx_regulatory_items_zone on regulatory_items (zone);
create index if not exists idx_regulatory_items_category on regulatory_items (category);
create index if not exists idx_alerts_country_iso2 on alerts (country_iso2);

-- Guard seed for environments where products.hs_code already has a FK to hs_codes.
-- Supports hs_codes code column variants: hs6 / hs_code / code.
do $$
declare
  code_col text;
  has_label_fr boolean;
  has_label_en boolean;
  has_chapter boolean;
begin
  if to_regclass('public.hs_codes') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'hs_codes' and column_name = 'hs6'
  ) then
    code_col := 'hs6';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'hs_codes' and column_name = 'hs_code'
  ) then
    code_col := 'hs_code';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'hs_codes' and column_name = 'code'
  ) then
    code_col := 'code';
  else
    raise notice 'hs_codes exists without recognized code column (hs6/hs_code/code). Seed skipped.';
    return;
  end if;

  has_label_fr := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hs_codes' and column_name = 'label_fr'
  );
  has_label_en := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hs_codes' and column_name = 'label_en'
  );
  has_chapter := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hs_codes' and column_name = 'chapter'
  );

  if has_label_fr then
    execute format(
      $sql$
        insert into public.hs_codes (%1$I, label_fr%2$s%3$s)
        select
          v.code,
          v.label_fr%4$s%5$s
        from (
          values
            ('3004', 'Preparations medicamenteuses', 'Medicaments and pharmaceutical products', '30'),
            ('8708', 'Parties et accessoires de vehicules automobiles', 'Motor vehicle parts and accessories', '87'),
            ('2204', 'Vins de raisins frais', 'Wine of fresh grapes', '22'),
            ('3304', 'Produits de beaute, de maquillage et soins de la peau', 'Beauty, make-up and skin-care preparations', '33'),
            ('9403', 'Autres meubles et leurs parties', 'Other furniture and parts thereof', '94'),
            ('8504', 'Transformateurs electriques, convertisseurs statiques', 'Electrical transformers and static converters', '85'),
            ('4202', 'Malles, valises, sacs et contenants similaires', 'Travel goods and similar containers', '42'),
            ('8471', 'Machines automatiques de traitement de l''information', 'Automatic data-processing machines', '84'),
            ('3923', 'Articles de transport ou d''emballage en matieres plastiques', 'Plastic packing and transport articles', '39'),
            ('7616', 'Autres ouvrages en aluminium', 'Other articles of aluminium', '76')
        ) as v(code, label_fr, label_en, chapter)
        where not exists (
          select 1
          from public.hs_codes h
          where h.%1$I = v.code
        )
      $sql$,
      code_col,
      case when has_label_en then ', label_en' else '' end,
      case when has_chapter then ', chapter' else '' end,
      case when has_label_en then ', v.label_en' else '' end,
      case when has_chapter then ', v.chapter' else '' end
    );
  else
    execute format(
      $sql$
        insert into public.hs_codes (%1$I)
        select v.code
        from (
          values
            ('3004'),
            ('8708'),
            ('2204'),
            ('3304'),
            ('9403'),
            ('8504'),
            ('4202'),
            ('8471'),
            ('3923'),
            ('7616')
        ) as v(code)
        where not exists (
          select 1
          from public.hs_codes h
          where h.%1$I = v.code
        )
      $sql$,
      code_col
    );
  end if;
end
$$;

insert into products (code, label, hs_code, tva, manufacturer)
select v.code, v.label, v.hs_code, v.tva, v.manufacturer
from (
  values
    ('P-3004', 'Gel dermique apaisant', '3004', 20::numeric, 'Laboratoires MPL'),
    ('P-8708', 'Kit freinage premium', '8708', 20::numeric, 'MPL Auto'),
    ('P-2204', 'Coffret vin rouge 2022', '2204', 20::numeric, 'Domaine Atlantique'),
    ('P-3304', 'Soin hydratant visage', '3304', 20::numeric, 'MPL Cosmetique'),
    ('P-9403', 'Chaise bureau ergonomique', '9403', 20::numeric, 'Atelier Nord'),
    ('P-8504', 'Transformateur 220V industriel', '8504', 20::numeric, 'ElectroMPL'),
    ('P-4202', 'Sac de transport textile', '4202', 20::numeric, 'MPL Bags'),
    ('P-8471', 'Kit capteurs IoT export', '8471', 20::numeric, 'MPL Tech'),
    ('P-3923', 'Emballage recyclable', '3923', 20::numeric, 'PackMPL'),
    ('P-7616', 'Profil aluminium sur mesure', '7616', 20::numeric, 'MPL Metal')
) as v(code, label, hs_code, tva, manufacturer)
where not exists (
  select 1
  from products p
  where p.code = v.code
);

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
