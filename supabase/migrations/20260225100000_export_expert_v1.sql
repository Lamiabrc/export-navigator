
-- export_expert_v1
-- Deterministic export expert schema + RPC built only from DB facts.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  select
    (auth.jwt() ->> 'email') = 'lamia.brechet@outlook.fr'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

-- =========================================================
-- B) Reference tables
-- =========================================================

create table if not exists public.ref_countries (
  iso2 text primary key check (iso2 ~ '^[A-Z]{2}$'),
  iso3 text null check (iso3 is null or iso3 ~ '^[A-Z]{3}$'),
  name_fr text not null,
  name_en text not null,
  region text null,
  zone text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ref_currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name_fr text not null,
  name_en text not null,
  symbol text null,
  minor_units int null check (minor_units is null or (minor_units >= 0 and minor_units <= 6)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ref_hs (
  hs6 text primary key check (hs6 ~ '^[0-9]{6}$'),
  hs4 text generated always as (left(hs6, 4)) stored,
  hs2 text generated always as (left(hs6, 2)) stored,
  description_fr text not null,
  description_en text not null,
  search_fr tsvector generated always as (
    to_tsvector('simple', coalesce(description_fr, ''))
  ) stored,
  search_en tsvector generated always as (
    to_tsvector('simple', coalesce(description_en, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ref_hs_hs2_idx on public.ref_hs(hs2);
create index if not exists ref_hs_hs4_idx on public.ref_hs(hs4);
create index if not exists ref_hs_search_fr_idx on public.ref_hs using gin(search_fr);
create index if not exists ref_hs_search_en_idx on public.ref_hs using gin(search_en);

create table if not exists public.ref_incoterms (
  code text primary key,
  group_letter text not null check (group_letter in ('E', 'F', 'C', 'D')),
  responsibilities jsonb not null default '{}'::jsonb,
  notes_fr text null,
  notes_en text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ref_payment_terms (
  code text primary key,
  label_fr text not null,
  label_en text not null,
  risk_level int not null check (risk_level between 1 and 5),
  typical_docs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ref_transport_modes (
  code text primary key,
  name_fr text not null,
  name_en text not null,
  notes_fr text null,
  notes_en text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ref_documents (
  code text primary key,
  category text not null,
  name_fr text not null,
  name_en text not null,
  description_fr text null,
  description_en text null,
  required_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ref_documents_category_idx on public.ref_documents(category);

create table if not exists public.ref_contract_types (
  code text primary key,
  name_fr text not null,
  name_en text not null,
  when_to_use_fr text null,
  when_to_use_en text null,
  risk_notes_fr text null,
  risk_notes_en text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ref_contract_clauses (
  code text primary key,
  category text not null,
  title_fr text not null,
  title_en text not null,
  body_fr text not null,
  body_en text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ref_contract_clauses_category_idx on public.ref_contract_clauses(category);

-- =========================================================
-- B) Compliance
-- =========================================================

create table if not exists public.trade_measures (
  id uuid primary key default gen_random_uuid(),
  country_iso2 text not null references public.ref_countries(iso2) on delete cascade,
  hs6 text null references public.ref_hs(hs6) on delete set null,
  measure_type text not null,
  summary_fr text not null,
  summary_en text not null,
  legal_ref text null,
  source text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists trade_measures_country_hs_idx on public.trade_measures(country_iso2, hs6);
create index if not exists trade_measures_updated_at_idx on public.trade_measures(updated_at desc);

create table if not exists public.sanctions_lists (
  id uuid primary key default gen_random_uuid(),
  authority text not null,
  list_name text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(authority, list_name)
);

create table if not exists public.sanctions_entities (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.sanctions_lists(id) on delete cascade,
  name text not null,
  alt_names text[] not null default '{}'::text[],
  country_iso2 text null references public.ref_countries(iso2) on delete set null,
  identifiers jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists sanctions_entities_list_idx on public.sanctions_entities(list_id);
create index if not exists sanctions_entities_country_idx on public.sanctions_entities(country_iso2);
create index if not exists sanctions_entities_name_idx on public.sanctions_entities using gin(to_tsvector('simple', coalesce(name, '')));

-- =========================================================
-- B) Tax & customs
-- =========================================================

create table if not exists public.tax_vat_rules (
  id uuid primary key default gen_random_uuid(),
  country_iso2 text not null references public.ref_countries(iso2) on delete cascade,
  standard_rate numeric(6,3) null,
  reduced_rates jsonb not null default '[]'::jsonb,
  export_zero_rated boolean not null default true,
  import_vat_applicable boolean not null default true,
  notes_fr text null,
  notes_en text null,
  source text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(country_iso2)
);

create table if not exists public.customs_procedures (
  code text primary key,
  name_fr text not null,
  name_en text not null,
  description_fr text null,
  description_en text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customs_tax_concepts (
  code text primary key,
  name_fr text not null,
  name_en text not null,
  description_fr text null,
  description_en text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- B) Requirement links
-- =========================================================

create table if not exists public.doc_requirements (
  id uuid primary key default gen_random_uuid(),
  origin_iso2 text null references public.ref_countries(iso2) on delete cascade,
  destination_iso2 text null references public.ref_countries(iso2) on delete cascade,
  hs6 text null references public.ref_hs(hs6) on delete cascade,
  incoterm text null references public.ref_incoterms(code) on delete set null,
  transport_mode text null references public.ref_transport_modes(code) on delete set null,
  payment_term text null references public.ref_payment_terms(code) on delete set null,
  doc_code text not null references public.ref_documents(code) on delete cascade,
  required boolean not null default true,
  notes_fr text null,
  notes_en text null,
  priority int not null default 3 check (priority between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists doc_requirements_lookup_idx
  on public.doc_requirements(destination_iso2, hs6, incoterm, transport_mode, payment_term, priority);

create table if not exists public.contract_playbooks (
  id uuid primary key default gen_random_uuid(),
  contract_type_code text not null references public.ref_contract_types(code) on delete cascade,
  country_iso2 text null references public.ref_countries(iso2) on delete cascade,
  hs6 text null references public.ref_hs(hs6) on delete cascade,
  clauses jsonb not null default '[]'::jsonb,
  notes_fr text null,
  notes_en text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contract_playbooks_lookup_idx
  on public.contract_playbooks(contract_type_code, country_iso2, hs6);

create table if not exists public.compliance_playbooks (
  id uuid primary key default gen_random_uuid(),
  destination_iso2 text null references public.ref_countries(iso2) on delete cascade,
  hs6 text null references public.ref_hs(hs6) on delete cascade,
  red_flags jsonb not null default '[]'::jsonb,
  notes_fr text null,
  notes_en text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists compliance_playbooks_lookup_idx
  on public.compliance_playbooks(destination_iso2, hs6);
-- =========================================================
-- B) Chat threads and message compatibility
-- =========================================================

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lang text null check (lang is null or lang in ('fr', 'en')),
  created_at timestamptz not null default now()
);
create index if not exists chat_threads_user_created_idx on public.chat_threads(user_id, created_at desc);

do $$
begin
  if to_regclass('public.chat_sessions') is not null then
    insert into public.chat_threads(id, user_id, lang, created_at)
    select cs.id, cs.user_id, null, cs.created_at
    from public.chat_sessions cs
    on conflict (id) do nothing;
  end if;
end $$;

do $$
declare
  v_role_constraint text;
begin
  if to_regclass('public.chat_messages') is not null then
    execute 'alter table public.chat_messages add column if not exists thread_id uuid';
    execute 'alter table public.chat_messages add column if not exists entities jsonb not null default ''{}''::jsonb';
    execute 'alter table public.chat_messages add column if not exists dossier jsonb not null default ''{}''::jsonb';

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'chat_messages'
        and column_name = 'session_id'
    ) then
      execute 'update public.chat_messages set thread_id = session_id where thread_id is null';
    end if;

    select c.conname
    into v_role_constraint
    from pg_constraint c
    where c.conrelid = 'public.chat_messages'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
    limit 1;

    if v_role_constraint is not null then
      execute format('alter table public.chat_messages drop constraint %I', v_role_constraint);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.chat_messages'::regclass
        and conname = 'chat_messages_role_check_v2'
    ) then
      execute 'alter table public.chat_messages add constraint chat_messages_role_check_v2 check (role in (''user'', ''assistant'', ''tool'', ''system''))';
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.chat_messages'::regclass
        and conname = 'chat_messages_thread_id_fkey'
    ) then
      execute 'alter table public.chat_messages add constraint chat_messages_thread_id_fkey foreign key (thread_id) references public.chat_threads(id) on delete cascade';
    end if;

    execute 'create index if not exists chat_messages_thread_created_idx on public.chat_messages(thread_id, created_at)';
  end if;
end $$;

create or replace function public.sync_chat_session_to_thread()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  insert into public.chat_threads(id, user_id, lang, created_at)
  values (new.id, new.user_id, null, new.created_at)
  on conflict (id) do update
    set user_id = excluded.user_id;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.chat_sessions') is not null then
    execute 'drop trigger if exists trg_chat_sessions_sync_thread on public.chat_sessions';
    execute 'create trigger trg_chat_sessions_sync_thread after insert on public.chat_sessions for each row execute function public.sync_chat_session_to_thread()';
  end if;
end $$;

create or replace function public.chat_messages_set_thread_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.thread_id is null then
    new.thread_id := new.session_id;
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.chat_messages') is not null then
    execute 'drop trigger if exists trg_chat_messages_set_thread_id on public.chat_messages';
    execute 'create trigger trg_chat_messages_set_thread_id before insert on public.chat_messages for each row execute function public.chat_messages_set_thread_id()';
  end if;
end $$;

-- =========================================================
-- RLS: references can be public read; chat is strict owner-only
-- =========================================================

do $$
declare
  t text;
  reference_tables text[] := array[
    'ref_countries',
    'ref_currencies',
    'ref_hs',
    'ref_incoterms',
    'ref_payment_terms',
    'ref_transport_modes',
    'ref_documents',
    'ref_contract_types',
    'ref_contract_clauses',
    'trade_measures',
    'sanctions_lists',
    'sanctions_entities',
    'tax_vat_rules',
    'customs_procedures',
    'customs_tax_concepts',
    'doc_requirements',
    'contract_playbooks',
    'compliance_playbooks'
  ];
begin
  foreach t in array reference_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_public', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_select_public',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin() or auth.role() = ''service_role'') with check (public.is_admin() or auth.role() = ''service_role'')',
      t || '_write_admin',
      t
    );
  end loop;
end $$;

alter table public.chat_threads enable row level security;
drop policy if exists chat_threads_owner_all on public.chat_threads;
create policy chat_threads_owner_all
  on public.chat_threads
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.chat_messages enable row level security;
drop policy if exists chat_messages_owner on public.chat_messages;
drop policy if exists chat_messages_owner_all on public.chat_messages;
create policy chat_messages_owner_all
  on public.chat_messages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.chat_threads to authenticated;
grant insert, update, delete on public.chat_threads to authenticated;
grant select on public.chat_messages to authenticated;
grant insert, update, delete on public.chat_messages to authenticated;

do $$
declare
  t text;
  reference_tables text[] := array[
    'ref_countries',
    'ref_currencies',
    'ref_hs',
    'ref_incoterms',
    'ref_payment_terms',
    'ref_transport_modes',
    'ref_documents',
    'ref_contract_types',
    'ref_contract_clauses',
    'trade_measures',
    'sanctions_lists',
    'sanctions_entities',
    'tax_vat_rules',
    'customs_procedures',
    'customs_tax_concepts',
    'doc_requirements',
    'contract_playbooks',
    'compliance_playbooks'
  ];
begin
  foreach t in array reference_tables loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
-- =========================================================
-- C) Compatibility wrappers
-- =========================================================

create or replace function public.rpc_suggest_country_bi(
  q text,
  lang text default 'fr',
  lim integer default 8
)
returns table (
  iso2 text,
  label text,
  zone text,
  confidence numeric
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  select
    c.iso2,
    case
      when lower(coalesce(lang, 'fr')) = 'en' then coalesce(c.name_en, c.name_fr, c.iso2)
      else coalesce(c.name_fr, c.name_en, c.iso2)
    end as label,
    c.zone,
    round(
      greatest(
        case when upper(coalesce(q, '')) ~ ('\m' || c.iso2 || '\M') then 1 else 0 end,
        case when c.iso3 is not null and upper(coalesce(q, '')) ~ ('\m' || c.iso3 || '\M') then 0.96 else 0 end,
        case when lower(coalesce(q, '')) like '%' || lower(c.name_fr) || '%' then 0.9 else 0 end,
        case when lower(coalesce(q, '')) like '%' || lower(c.name_en) || '%' then 0.88 else 0 end
      )::numeric,
      3
    ) as confidence
  from public.ref_countries c
  where coalesce(trim(q), '') <> ''
    and (
      lower(c.name_fr) like '%' || lower(q) || '%'
      or lower(c.name_en) like '%' || lower(q) || '%'
      or upper(q) like '%' || c.iso2 || '%'
      or (c.iso3 is not null and upper(q) like '%' || c.iso3 || '%')
    )
  order by confidence desc, label asc
  limit greatest(1, coalesce(lim, 8));
$$;

create or replace function public.rpc_country_funnel(
  q text,
  lang text default 'fr',
  lim integer default 8,
  ignore_learning boolean default false
)
returns table (
  iso2 text,
  label text,
  zone text,
  confidence numeric
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  select s.iso2, s.label, s.zone, s.confidence
  from public.rpc_suggest_country_bi(q, lang, lim) s;
$$;

create or replace function public.rpc_suggest_hs_bi(
  q text,
  lang text default 'fr',
  lim integer default 8
)
returns table (
  hs_code text,
  label text,
  chapter text,
  confidence numeric
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  with params as (
    select
      trim(coalesce(q, '')) as q_raw,
      regexp_replace(coalesce(q, ''), '[^0-9]', '', 'g') as q_digits
  ), scored as (
    select
      h.hs6 as hs_code,
      case
        when lower(coalesce(lang, 'fr')) = 'en' then coalesce(h.description_en, h.description_fr, h.hs6)
        else coalesce(h.description_fr, h.description_en, h.hs6)
      end as label,
      h.hs2 as chapter,
      round(
        greatest(
          case when p.q_digits <> '' and h.hs6 like left(p.q_digits, 6) || '%' then 1 else 0 end,
          case when lower(p.q_raw) like '%' || lower(h.description_fr) || '%' then 0.82 else 0 end,
          case when lower(p.q_raw) like '%' || lower(h.description_en) || '%' then 0.8 else 0 end,
          case when p.q_raw <> '' and h.search_fr @@ plainto_tsquery('simple', p.q_raw) then 0.72 else 0 end,
          case when p.q_raw <> '' and h.search_en @@ plainto_tsquery('simple', p.q_raw) then 0.7 else 0 end
        )::numeric,
        3
      ) as confidence
    from public.ref_hs h
    cross join params p
    where p.q_raw <> ''
  )
  select hs_code, label, chapter, confidence
  from scored
  where confidence > 0
  order by confidence desc, hs_code asc
  limit greatest(1, coalesce(lim, 8));
$$;

create or replace function public.rpc_hs_funnel(
  q text,
  lang text default 'fr',
  lim integer default 8
)
returns table (
  hs_code text,
  label text,
  chapter text,
  confidence numeric
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  select s.hs_code, s.label, s.chapter, s.confidence
  from public.rpc_suggest_hs_bi(q, lang, lim) s;
$$;

create or replace function public.rpc_suggest_hs_in_chapter(
  q text,
  chapter text,
  lang text default 'fr',
  lim integer default 8
)
returns table (
  hs_code text,
  label text,
  chapter text,
  confidence numeric
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  select s.hs_code, s.label, s.chapter, s.confidence
  from public.rpc_suggest_hs_bi(q, lang, lim) s
  where s.chapter = left(regexp_replace(coalesce(chapter, ''), '[^0-9]', '', 'g'), 2)
     or chapter is null;
$$;

create or replace function public.suggest_hs_in_chapter(
  q text,
  chapter text,
  lang text default 'fr',
  lim integer default 8
)
returns table (
  hs_code text,
  label text,
  chapter text,
  confidence numeric
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  select *
  from public.rpc_suggest_hs_in_chapter(q, chapter, lang, lim);
$$;
-- =========================================================
-- C) rpc_detect_entities
-- =========================================================

create or replace function public.rpc_detect_entities(
  q text,
  ui_lang text default null
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public, extensions
as $$
declare
  v_q text := trim(coalesce(q, ''));
  v_lang text := 'fr';
  v_countries jsonb := '[]'::jsonb;
  v_hs jsonb := '[]'::jsonb;
  v_keywords_found text[] := array[]::text[];
  v_in_scope boolean := false;
  v_intent text := 'out_of_scope';
  v_scope_keywords constant text[] := array[
    'import', 'export', 'incoterm', 'incoterms', 'douane', 'customs', 'logistique', 'logistics',
    'paiement', 'payment', 'sanction', 'sanctions', 'embargo', 'compliance', 'vat', 'tva',
    'fiscalite', 'tax', 'duty', 'duties', 'hs', 'shipping', 'transport', 'distribution',
    'contrat', 'contract', 'franchise', 'licence', 'license', 'oem', 'agent', 'retenue', 'withholding'
  ];
begin
  if lower(coalesce(ui_lang, '')) in ('fr', 'en') then
    v_lang := lower(ui_lang);
  elsif v_q ~* '[àâçéèêëîïôùûüÿœæ]' then
    v_lang := 'fr';
  elsif lower(v_q) ~ '(\m(the|which|what|import|export|customs|duty|vat|logistics|payment|shipping)\M)' then
    v_lang := 'en';
  else
    v_lang := 'fr';
  end if;

  if v_q = '' then
    return jsonb_build_object(
      'lang', v_lang,
      'countries', '[]'::jsonb,
      'hs', '[]'::jsonb,
      'intent', 'out_of_scope',
      'in_scope', false,
      'keywords_found', '[]'::jsonb
    );
  end if;

  select coalesce(array_agg(distinct kw), array[]::text[])
  into v_keywords_found
  from unnest(regexp_split_to_array(lower(unaccent(v_q)), '[^a-z0-9]+')) kw
  where kw <> ''
    and kw = any(v_scope_keywords);

  v_in_scope := coalesce(array_length(v_keywords_found, 1), 0) > 0
    or v_q ~* '(import|export|incoterm|douane|customs|sanction|embargo|hs\s?code|vat|tva|fiscal|contract|contrat|logistique|shipping|paiement|payment|distribution|franchise|license|licence|oem)';

  v_intent := case
    when not v_in_scope then 'out_of_scope'
    when v_q ~* '(sanction|embargo|ofac|denied|blacklist)' then 'sanctions'
    when v_q ~* '(incoterm|\m(exw|fca|cpt|cip|dap|dpu|ddp|fas|fob|cfr|cif)\M)' then 'incoterm'
    when v_q ~* '(vat|tva|douane|customs|duty|tax|fiscal)' then 'tax_customs'
    when v_q ~* '(contrat|contract|distribution|agency|franchise|licen[cs]e|oem|sous[- ]traitance)' then 'contracts'
    when v_q ~* '(paiement|payment|lc|letter of credit|cad|open account|oa|tt|t/t)' then 'payment'
    when v_q ~* '(transport|shipping|logistique|road|rail|sea|air|courier)' then 'logistics'
    else 'general_export'
  end;

  select coalesce(jsonb_agg(row_json order by score desc), '[]'::jsonb)
  into v_countries
  from (
    select
      score,
      jsonb_build_object(
        'iso2', iso2,
        'name', case when v_lang = 'en' then coalesce(name_en, name_fr, iso2) else coalesce(name_fr, name_en, iso2) end,
        'score', score
      ) as row_json
    from (
      select
        c.iso2,
        c.name_fr,
        c.name_en,
        round(
          greatest(
            case when upper(v_q) ~ ('\m' || c.iso2 || '\M') then 1 else 0 end,
            case when c.iso3 is not null and upper(v_q) ~ ('\m' || c.iso3 || '\M') then 0.97 else 0 end,
            case when lower(v_q) like '%' || lower(c.name_fr) || '%' then 0.92 else 0 end,
            case when lower(v_q) like '%' || lower(c.name_en) || '%' then 0.9 else 0 end
          )::numeric,
          3
        ) as score
      from public.ref_countries c
    ) ranked
    where score > 0
    order by score desc, iso2 asc
    limit 5
  ) s;

  select coalesce(jsonb_agg(row_json order by score desc), '[]'::jsonb)
  into v_hs
  from (
    with explicit_codes as (
      select distinct left(m[1], 6) as hs6, 1.0::numeric as score
      from regexp_matches(v_q, '([0-9]{6,10})', 'g') m
    ), text_scores as (
      select
        h.hs6,
        greatest(
          case when lower(v_q) like '%' || lower(h.description_fr) || '%' then 0.82 else 0 end,
          case when lower(v_q) like '%' || lower(h.description_en) || '%' then 0.8 else 0 end,
          case when h.search_fr @@ plainto_tsquery('simple', v_q) then 0.72 else 0 end,
          case when h.search_en @@ plainto_tsquery('simple', v_q) then 0.7 else 0 end
        )::numeric as score
      from public.ref_hs h
    ), merged as (
      select hs6, max(score) as score
      from (
        select * from explicit_codes
        union all
        select * from text_scores
      ) x
      group by hs6
    )
    select
      m.score,
      jsonb_build_object(
        'hs6', h.hs6,
        'desc', case when v_lang = 'en' then coalesce(h.description_en, h.description_fr) else coalesce(h.description_fr, h.description_en) end,
        'score', round(m.score, 3)
      ) as row_json
    from merged m
    join public.ref_hs h on h.hs6 = m.hs6
    where m.score > 0
    order by m.score desc, h.hs6 asc
    limit 5
  ) hs_rows;

  if jsonb_array_length(v_countries) = 0 then
    begin
      if to_regprocedure('public.rpc_suggest_country_bi(text,text,integer)') is not null then
        execute $sql$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'iso2', upper(coalesce(to_jsonb(t) ->> 'iso2', to_jsonb(t) ->> 'code_iso2', to_jsonb(t) ->> 'country_iso2')),
                'name', coalesce(to_jsonb(t) ->> 'label', to_jsonb(t) ->> 'name', to_jsonb(t) ->> 'country_name'),
                'score', coalesce((to_jsonb(t) ->> 'confidence')::numeric, (to_jsonb(t) ->> 'score')::numeric, 0.5)
              )
            ),
            '[]'::jsonb
          )
          from public.rpc_suggest_country_bi($1, $2, $3) t
        $sql$
        into v_countries
        using v_q, v_lang, 5;
      end if;
    exception when others then
      v_countries := '[]'::jsonb;
    end;
  end if;

  if jsonb_array_length(v_hs) = 0 then
    begin
      if to_regprocedure('public.rpc_suggest_hs_bi(text,text,integer)') is not null then
        execute $sql$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'hs6', coalesce(to_jsonb(t) ->> 'hs_code', to_jsonb(t) ->> 'hs6', to_jsonb(t) ->> 'code'),
                'desc', coalesce(to_jsonb(t) ->> 'label', to_jsonb(t) ->> 'description', to_jsonb(t) ->> 'name'),
                'score', coalesce((to_jsonb(t) ->> 'confidence')::numeric, (to_jsonb(t) ->> 'score')::numeric, 0.5)
              )
            ),
            '[]'::jsonb
          )
          from public.rpc_suggest_hs_bi($1, $2, $3) t
        $sql$
        into v_hs
        using v_q, v_lang, 5;
      end if;
    exception when others then
      v_hs := '[]'::jsonb;
    end;
  end if;

  return jsonb_build_object(
    'lang', v_lang,
    'countries', coalesce(v_countries, '[]'::jsonb),
    'hs', coalesce(v_hs, '[]'::jsonb),
    'intent', v_intent,
    'in_scope', v_in_scope,
    'keywords_found', to_jsonb(coalesce(v_keywords_found, array[]::text[]))
  );
end;
$$;
-- =========================================================
-- C) rpc_build_export_dossier
-- =========================================================

create or replace function public.rpc_build_export_dossier(input jsonb)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public, extensions
as $$
declare
  v_lang text := case when lower(coalesce(input ->> 'lang', '')) = 'en' then 'en' else 'fr' end;
  v_origin text := upper(nullif(trim(coalesce(input ->> 'origin', '')), ''));
  v_destination text := upper(nullif(trim(coalesce(input ->> 'destination', '')), ''));
  v_hs6 text := regexp_replace(coalesce(input ->> 'hs6', ''), '[^0-9]', '', 'g');
  v_incoterm text := upper(nullif(trim(coalesce(input ->> 'incoterm', '')), ''));
  v_payment text := upper(nullif(trim(coalesce(input ->> 'payment', '')), ''));
  v_transport text := lower(nullif(trim(coalesce(input ->> 'transport', '')), ''));
  v_currency text := upper(nullif(trim(coalesce(input ->> 'currency', '')), ''));
  v_contract_type text := lower(nullif(trim(coalesce(input ->> 'contract_type', '')), ''));

  v_questions text[] := array[]::text[];
  v_next_actions text[] := array[]::text[];

  v_origin_country jsonb := '{}'::jsonb;
  v_destination_country jsonb := '{}'::jsonb;
  v_hs jsonb := '{}'::jsonb;
  v_currency_json jsonb := '{}'::jsonb;
  v_summary jsonb := '{}'::jsonb;

  v_documents jsonb := '[]'::jsonb;
  v_restrictions jsonb := '[]'::jsonb;
  v_compliance_playbook jsonb := '{}'::jsonb;
  v_sanctions jsonb := '{}'::jsonb;
  v_incoterm_json jsonb := '{}'::jsonb;
  v_payment_json jsonb := '{}'::jsonb;
  v_transport_json jsonb := '{}'::jsonb;
  v_contract_type_json jsonb := '{}'::jsonb;
  v_clause_codes jsonb := '[]'::jsonb;
  v_contract_clauses jsonb := '[]'::jsonb;
  v_contracts jsonb := '{}'::jsonb;
  v_vat jsonb := '{}'::jsonb;
  v_duties_concepts jsonb := '[]'::jsonb;
  v_customs_procedures jsonb := '[]'::jsonb;
  v_tax_customs jsonb := '{}'::jsonb;
  v_kb_hint text := null;
begin
  if length(v_hs6) >= 6 then
    v_hs6 := left(v_hs6, 6);
  else
    v_hs6 := null;
  end if;

  v_payment := case
    when v_payment in ('L/C', 'LC', 'LETTER OF CREDIT', 'CREDOC') then 'LC'
    when v_payment in ('CAD', 'DOCUMENTS AGAINST PAYMENT') then 'CAD'
    when v_payment in ('OA', 'OPEN ACCOUNT') then 'OA'
    when v_payment in ('T/T', 'TT', 'WIRE', 'BANK TRANSFER') then 'TT'
    else v_payment
  end;

  v_transport := case
    when v_transport in ('truck', 'road', 'route') then 'road'
    when v_transport in ('sea', 'ocean', 'maritime', 'mer') then 'sea'
    when v_transport in ('air', 'airfreight', 'aerien', 'aerienne') then 'air'
    when v_transport in ('rail', 'train') then 'rail'
    when v_transport in ('courier', 'express') then 'courier'
    else v_transport
  end;

  if v_destination is null then
    v_questions := array_append(v_questions, case when v_lang = 'en' then 'What is the destination country?' else 'Quel est le pays de destination ?' end);
  end if;
  if v_hs6 is null then
    v_questions := array_append(v_questions, case when v_lang = 'en' then 'What is the HS code (6 digits) or product description?' else 'Quel est le code HS (6 chiffres) ou la description produit ?' end);
  end if;
  if v_incoterm is null then
    v_questions := array_append(v_questions, case when v_lang = 'en' then 'Which Incoterm do you plan to use?' else 'Quel Incoterm prevoyez-vous ?' end);
  end if;
  if v_payment is null then
    v_questions := array_append(v_questions, case when v_lang = 'en' then 'What payment term is planned (LC, CAD, OA, TT)?' else 'Quel mode de paiement est prevu (LC, CAD, OA, TT) ?' end);
  end if;
  if v_transport is null then
    v_questions := array_append(v_questions, case when v_lang = 'en' then 'Which transport mode is planned (air, sea, road, rail, courier)?' else 'Quel mode de transport est prevu (air, sea, road, rail, courier) ?' end);
  end if;

  if coalesce(array_length(v_questions, 1), 0) > 3 then
    v_questions := v_questions[1:3];
  end if;

  if v_origin is not null then
    select jsonb_build_object(
      'iso2', c.iso2,
      'name', case when v_lang = 'en' then coalesce(c.name_en, c.name_fr) else coalesce(c.name_fr, c.name_en) end,
      'region', c.region,
      'zone', c.zone
    )
    into v_origin_country
    from public.ref_countries c
    where c.iso2 = v_origin;

    if v_origin_country is null then
      v_origin_country := jsonb_build_object('iso2', v_origin);
    end if;
  end if;

  if v_destination is not null then
    select jsonb_build_object(
      'iso2', c.iso2,
      'name', case when v_lang = 'en' then coalesce(c.name_en, c.name_fr) else coalesce(c.name_fr, c.name_en) end,
      'region', c.region,
      'zone', c.zone
    )
    into v_destination_country
    from public.ref_countries c
    where c.iso2 = v_destination;

    if v_destination_country is null then
      v_destination_country := jsonb_build_object('iso2', v_destination);
    end if;
  end if;

  if v_hs6 is not null then
    select jsonb_build_object(
      'hs6', h.hs6,
      'hs4', h.hs4,
      'hs2', h.hs2,
      'description', case when v_lang = 'en' then coalesce(h.description_en, h.description_fr) else coalesce(h.description_fr, h.description_en) end
    )
    into v_hs
    from public.ref_hs h
    where h.hs6 = v_hs6;

    if v_hs is null then
      v_hs := jsonb_build_object('hs6', v_hs6);
    end if;
  end if;

  if v_currency is not null then
    select jsonb_build_object(
      'code', cur.code,
      'name', case when v_lang = 'en' then coalesce(cur.name_en, cur.name_fr) else coalesce(cur.name_fr, cur.name_en) end,
      'symbol', cur.symbol,
      'minor_units', cur.minor_units
    )
    into v_currency_json
    from public.ref_currencies cur
    where cur.code = v_currency;

    if v_currency_json is null then
      v_currency_json := jsonb_build_object('code', v_currency);
    end if;
  end if;

  v_summary := jsonb_build_object(
    'lang', v_lang,
    'origin', coalesce(v_origin_country, '{}'::jsonb),
    'destination', coalesce(v_destination_country, '{}'::jsonb),
    'hs', coalesce(v_hs, '{}'::jsonb),
    'incoterm', coalesce(v_incoterm, ''),
    'payment', coalesce(v_payment, ''),
    'transport', coalesce(v_transport, ''),
    'currency', coalesce(v_currency_json, '{}'::jsonb)
  );

  select coalesce(jsonb_agg(doc_row order by required desc, priority asc, code), '[]'::jsonb)
  into v_documents
  from (
    select
      d.code,
      d.category,
      case when v_lang = 'en' then coalesce(d.name_en, d.name_fr) else coalesce(d.name_fr, d.name_en) end as name,
      case when v_lang = 'en'
        then coalesce(r.notes_en, d.description_en, d.description_fr)
        else coalesce(r.notes_fr, d.description_fr, d.description_en)
      end as description,
      d.required_fields,
      r.required,
      r.priority,
      (
        case when r.origin_iso2 is not null then 1 else 0 end
        + case when r.destination_iso2 is not null then 1 else 0 end
        + case when r.hs6 is not null then 1 else 0 end
        + case when r.incoterm is not null then 1 else 0 end
        + case when r.transport_mode is not null then 1 else 0 end
        + case when r.payment_term is not null then 1 else 0 end
      ) as specificity
    from public.doc_requirements r
    join public.ref_documents d on d.code = r.doc_code
    where (r.origin_iso2 is null or r.origin_iso2 = v_origin)
      and (r.destination_iso2 is null or r.destination_iso2 = v_destination)
      and (r.hs6 is null or r.hs6 = v_hs6)
      and (r.incoterm is null or r.incoterm = v_incoterm)
      and (r.transport_mode is null or r.transport_mode = v_transport)
      and (r.payment_term is null or r.payment_term = v_payment)
    order by specificity desc, r.required desc, r.priority asc, d.code asc
    limit 20
  ) doc_row;

  if jsonb_array_length(v_documents) = 0 then
    select coalesce(jsonb_agg(doc_row), '[]'::jsonb)
    into v_documents
    from (
      select
        d.code,
        d.category,
        case when v_lang = 'en' then coalesce(d.name_en, d.name_fr) else coalesce(d.name_fr, d.name_en) end as name,
        case when v_lang = 'en' then coalesce(d.description_en, d.description_fr) else coalesce(d.description_fr, d.description_en) end as description,
        d.required_fields,
        true as required,
        3 as priority
      from public.ref_documents d
      order by d.code asc
      limit 10
    ) doc_row;
  end if;

  select coalesce(jsonb_agg(measure_row), '[]'::jsonb)
  into v_restrictions
  from (
    select
      tm.measure_type,
      case when v_lang = 'en' then coalesce(tm.summary_en, tm.summary_fr) else coalesce(tm.summary_fr, tm.summary_en) end as summary,
      tm.legal_ref,
      tm.source,
      tm.updated_at
    from public.trade_measures tm
    where (v_destination is null or tm.country_iso2 = v_destination)
      and (tm.hs6 is null or tm.hs6 = v_hs6)
    order by tm.updated_at desc
    limit 12
  ) measure_row;

  select jsonb_build_object(
    'red_flags', cp.red_flags,
    'notes', case when v_lang = 'en' then cp.notes_en else cp.notes_fr end
  )
  into v_compliance_playbook
  from public.compliance_playbooks cp
  where (cp.destination_iso2 is null or cp.destination_iso2 = v_destination)
    and (cp.hs6 is null or cp.hs6 = v_hs6)
  order by
    (case when cp.destination_iso2 is null then 0 else 1 end
     + case when cp.hs6 is null then 0 else 1 end) desc,
    cp.updated_at desc
  limit 1;

  if v_compliance_playbook is not null and v_compliance_playbook <> '{}'::jsonb then
    v_restrictions := v_restrictions || jsonb_build_array(v_compliance_playbook);
  end if;

  select jsonb_build_object(
    'lists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'authority', l.authority,
        'list_name', l.list_name,
        'updated_at', l.updated_at
      ))
      from (
        select authority, list_name, updated_at
        from public.sanctions_lists
        order by updated_at desc
        limit 8
      ) l
    ), '[]'::jsonb),
    'entities_hint', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', e.name,
        'status', e.status,
        'country_iso2', e.country_iso2,
        'updated_at', e.updated_at
      ))
      from (
        select name, status, country_iso2, updated_at
        from public.sanctions_entities
        where (v_destination is null or country_iso2 = v_destination)
        order by updated_at desc
        limit 8
      ) e
    ), '[]'::jsonb),
    'updated_at', (select max(updated_at) from public.sanctions_lists)
  )
  into v_sanctions;

  if v_incoterm is not null then
    select jsonb_build_object(
      'code', i.code,
      'group_letter', i.group_letter,
      'notes', case when v_lang = 'en' then i.notes_en else i.notes_fr end,
      'responsibilities', i.responsibilities
    )
    into v_incoterm_json
    from public.ref_incoterms i
    where i.code = v_incoterm;
  end if;
  v_incoterm_json := coalesce(v_incoterm_json, '{}'::jsonb);

  if v_payment is not null then
    select jsonb_build_object(
      'code', p.code,
      'label', case when v_lang = 'en' then p.label_en else p.label_fr end,
      'risk_level', p.risk_level,
      'typical_docs', p.typical_docs
    )
    into v_payment_json
    from public.ref_payment_terms p
    where p.code = v_payment;
  end if;
  v_payment_json := coalesce(v_payment_json, '{}'::jsonb);

  if v_transport is not null then
    select jsonb_build_object(
      'code', t.code,
      'name', case when v_lang = 'en' then t.name_en else t.name_fr end,
      'notes', case when v_lang = 'en' then t.notes_en else t.notes_fr end
    )
    into v_transport_json
    from public.ref_transport_modes t
    where t.code = v_transport;
  end if;
  v_transport_json := coalesce(v_transport_json, '{}'::jsonb);
  if v_contract_type is not null then
    select jsonb_build_object(
      'code', c.code,
      'name', case when v_lang = 'en' then c.name_en else c.name_fr end,
      'when_to_use', case when v_lang = 'en' then c.when_to_use_en else c.when_to_use_fr end,
      'risk_notes', case when v_lang = 'en' then c.risk_notes_en else c.risk_notes_fr end
    )
    into v_contract_type_json
    from public.ref_contract_types c
    where c.code = v_contract_type;
  end if;

  select cp.clauses
  into v_clause_codes
  from public.contract_playbooks cp
  where (v_contract_type is null or cp.contract_type_code = v_contract_type)
    and (cp.country_iso2 is null or cp.country_iso2 = v_destination)
    and (cp.hs6 is null or cp.hs6 = v_hs6)
  order by
    (case when cp.country_iso2 is null then 0 else 1 end
     + case when cp.hs6 is null then 0 else 1 end) desc,
    cp.updated_at desc
  limit 1;

  if v_clause_codes is not null
    and jsonb_typeof(v_clause_codes) = 'array'
    and jsonb_array_length(v_clause_codes) > 0 then

    select coalesce(jsonb_agg(clause_row), '[]'::jsonb)
    into v_contract_clauses
    from (
      select
        c.code,
        c.category,
        case when v_lang = 'en' then c.title_en else c.title_fr end as title,
        case when v_lang = 'en' then c.body_en else c.body_fr end as body
      from public.ref_contract_clauses c
      where c.code in (
        select jsonb_array_elements_text(v_clause_codes)
      )
      order by c.code asc
    ) clause_row;
  else
    select coalesce(jsonb_agg(clause_row), '[]'::jsonb)
    into v_contract_clauses
    from (
      select
        c.code,
        c.category,
        case when v_lang = 'en' then c.title_en else c.title_fr end as title,
        case when v_lang = 'en' then c.body_en else c.body_fr end as body
      from public.ref_contract_clauses c
      order by c.category asc, c.code asc
      limit 10
    ) clause_row;
  end if;

  v_contracts := jsonb_build_object(
    'type', coalesce(v_contract_type_json, '{}'::jsonb),
    'clauses', coalesce(v_contract_clauses, '[]'::jsonb)
  );

  if v_destination is not null then
    select jsonb_build_object(
      'country_iso2', t.country_iso2,
      'standard_rate', t.standard_rate,
      'reduced_rates', t.reduced_rates,
      'export_zero_rated', t.export_zero_rated,
      'import_vat_applicable', t.import_vat_applicable,
      'notes', case when v_lang = 'en' then t.notes_en else t.notes_fr end,
      'source', t.source,
      'updated_at', t.updated_at
    )
    into v_vat
    from public.tax_vat_rules t
    where t.country_iso2 = v_destination;
  end if;
  v_vat := coalesce(v_vat, '{}'::jsonb);

  select coalesce(jsonb_agg(concept_row), '[]'::jsonb)
  into v_duties_concepts
  from (
    select
      c.code,
      case when v_lang = 'en' then c.name_en else c.name_fr end as name,
      case when v_lang = 'en' then c.description_en else c.description_fr end as description
    from public.customs_tax_concepts c
    order by c.code asc
    limit 10
  ) concept_row;

  select coalesce(jsonb_agg(proc_row), '[]'::jsonb)
  into v_customs_procedures
  from (
    select
      p.code,
      case when v_lang = 'en' then p.name_en else p.name_fr end as name,
      case when v_lang = 'en' then p.description_en else p.description_fr end as description
    from public.customs_procedures p
    order by p.code asc
    limit 10
  ) proc_row;

  v_tax_customs := jsonb_build_object(
    'vat', v_vat,
    'duties_concept', v_duties_concepts,
    'procedures', v_customs_procedures
  );

  if v_destination is null then
    v_next_actions := array_append(v_next_actions, case when v_lang = 'en' then 'Confirm destination country and transit countries.' else 'Confirmer le pays de destination et les pays de transit.' end);
  end if;
  if v_hs6 is null then
    v_next_actions := array_append(v_next_actions, case when v_lang = 'en' then 'Validate HS code (6 digits) with product technical specs.' else 'Valider le code HS (6 chiffres) avec les specifications techniques produit.' end);
  end if;
  if v_incoterm is null then
    v_next_actions := array_append(v_next_actions, case when v_lang = 'en' then 'Select Incoterm and align transfer of risk/payment obligations.' else 'Choisir l''Incoterm et aligner transfert de risque/obligations de paiement.' end);
  end if;

  if jsonb_array_length(v_documents) > 0 then
    v_next_actions := array_append(v_next_actions, case when v_lang = 'en' then 'Prepare document checklist and mandatory fields before shipment.' else 'Preparer la checklist documentaire et les champs obligatoires avant expedition.' end);
  end if;

  if jsonb_array_length(v_restrictions) > 0 then
    v_next_actions := array_append(v_next_actions, case when v_lang = 'en' then 'Review restrictions, sanctions references and red flags before booking.' else 'Verifier restrictions, references sanctions et signaux rouges avant booking.' end);
  end if;

  if to_regclass('public.kb_articles') is not null then
    begin
      select k.title
      into v_kb_hint
      from public.kb_articles k
      where k.enabled = true
        and (
          (v_hs6 is not null and k.body_md ilike '%' || v_hs6 || '%')
          or (v_destination is not null and (k.title ilike '%' || v_destination || '%' or k.body_md ilike '%' || v_destination || '%'))
        )
      order by k.updated_at desc
      limit 1;

      if v_kb_hint is not null then
        v_next_actions := array_append(
          v_next_actions,
          case when v_lang = 'en'
            then 'Cross-check with knowledge base card: ' || v_kb_hint
            else 'Croiser avec la fiche base de connaissance : ' || v_kb_hint
          end
        );
      end if;
    exception when others then
      -- kb_articles is optional.
      null;
    end;
  end if;

  if coalesce(array_length(v_next_actions, 1), 0) = 0 then
    v_next_actions := array[
      case when v_lang = 'en'
        then 'Document assumptions and run final legal/tax validation before execution.'
        else 'Documenter les hypotheses et faire la validation finale juridique/fiscale avant execution.'
      end
    ];
  end if;

  if coalesce(array_length(v_next_actions, 1), 0) > 8 then
    v_next_actions := v_next_actions[1:8];
  end if;

  return jsonb_build_object(
    'summary', v_summary,
    'questions_missing', to_jsonb(coalesce(v_questions, array[]::text[])),
    'documents', coalesce(v_documents, '[]'::jsonb),
    'restrictions', coalesce(v_restrictions, '[]'::jsonb),
    'sanctions', coalesce(v_sanctions, '{}'::jsonb),
    'incoterm', coalesce(v_incoterm_json, '{}'::jsonb),
    'payment', coalesce(v_payment_json, '{}'::jsonb),
    'transport', coalesce(v_transport_json, '{}'::jsonb),
    'contracts', coalesce(v_contracts, jsonb_build_object('type', '{}'::jsonb, 'clauses', '[]'::jsonb)),
    'tax_and_customs', coalesce(v_tax_customs, jsonb_build_object('vat', '{}'::jsonb, 'duties_concept', '[]'::jsonb, 'procedures', '[]'::jsonb)),
    'next_actions', to_jsonb(coalesce(v_next_actions, array[]::text[]))
  );
end;
$$;

grant execute on function public.rpc_detect_entities(text, text) to anon, authenticated;
grant execute on function public.rpc_build_export_dossier(jsonb) to anon, authenticated;
grant execute on function public.rpc_suggest_country_bi(text, text, integer) to anon, authenticated;
grant execute on function public.rpc_country_funnel(text, text, integer, boolean) to anon, authenticated;
grant execute on function public.rpc_suggest_hs_bi(text, text, integer) to anon, authenticated;
grant execute on function public.rpc_hs_funnel(text, text, integer) to anon, authenticated;
grant execute on function public.rpc_suggest_hs_in_chapter(text, text, text, integer) to anon, authenticated;
grant execute on function public.suggest_hs_in_chapter(text, text, text, integer) to anon, authenticated;

-- =========================================================
-- C) Search path fix for existing functions (all overloads)
-- =========================================================

do $$
declare
  fn text;
  rec record;
  fns text[] := array[
    'is_admin',
    'set_updated_at',
    'kb_search',
    'rpc_export_answer',
    'rpc_suggest_country_bi',
    'rpc_suggest_hs_bi',
    'rpc_country_funnel',
    'rpc_hs_funnel',
    'rpc_suggest_hs_in_chapter',
    'suggest_hs_in_chapter',
    'rpc_detect_entities',
    'rpc_build_export_dossier',
    'match_kb_chunks',
    'has_pro_access',
    'user_org_has_pro_access',
    'sync_chat_session_to_thread',
    'chat_messages_set_thread_id'
  ];
begin
  foreach fn in array fns loop
    for rec in
      select
        n.nspname as schema_name,
        p.proname,
        pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = fn
    loop
      execute format(
        'alter function %I.%I(%s) set search_path = ''pg_catalog, public, extensions''',
        rec.schema_name,
        rec.proname,
        rec.args
      );
    end loop;
  end loop;
end $$;

