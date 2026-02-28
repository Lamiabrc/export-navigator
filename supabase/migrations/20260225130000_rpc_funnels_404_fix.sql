-- Fix missing RPC endpoints: rpc_country_funnel / rpc_hs_funnel (404 on PostgREST)
-- Also harden unaccent resolution regardless of caller search_path.

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.unaccent(text)
returns text
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select extensions.unaccent($1);
$$;

-- Avoid "cannot change return type of existing function" on environments
-- that already have legacy funnel RPCs with a different TABLE shape.
do $$
declare
  v_result text;
begin
  select pg_get_function_result('public.rpc_country_funnel(text,text,integer,boolean)'::regprocedure)
    into v_result;

  if v_result is not null
     and v_result <> 'TABLE(iso2 text, label text, zone text, confidence numeric)' then
    execute format(
      'alter function public.rpc_country_funnel(text, text, integer, boolean) rename to %I',
      'rpc_country_funnel_archived_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    );
  end if;
exception
  when undefined_function then
    null;
end $$;

do $$
declare
  v_result text;
begin
  select pg_get_function_result('public.rpc_hs_funnel(text,text,integer)'::regprocedure)
    into v_result;

  if v_result is not null
     and v_result <> 'TABLE(hs_code text, label text, chapter text, confidence numeric)' then
    execute format(
      'alter function public.rpc_hs_funnel(text, text, integer) rename to %I',
      'rpc_hs_funnel_archived_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    );
  end if;
exception
  when undefined_function then
    null;
end $$;

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
language plpgsql
stable
set search_path = pg_catalog, public, extensions
as $$
declare
  v_limit integer := greatest(1, coalesce(lim, 8));
  v_has_countries_zone boolean := false;
begin
  if to_regclass('public.ref_countries') is not null then
    return query execute $sql$
      with scored as (
        select
          c.iso2,
          case
            when lower(coalesce($2, 'fr')) = 'en' then coalesce(c.name_en, c.name_fr, c.iso2)
            else coalesce(c.name_fr, c.name_en, c.iso2)
          end as label,
          c.zone::text as zone,
          greatest(
            case when upper(coalesce($1, '')) ~ ('\\m' || c.iso2 || '\\M') then 1 else 0 end,
            case when lower(coalesce($1, '')) like '%' || lower(c.name_fr) || '%' then 0.92 else 0 end,
            case when coalesce(c.name_en, '') <> '' and lower(coalesce($1, '')) like '%' || lower(c.name_en) || '%' then 0.9 else 0 end
          )::numeric as confidence
        from public.ref_countries c
      )
      select iso2, label, zone, round(confidence, 3)
      from scored
      where confidence > 0
      order by confidence desc, label asc
      limit $3
    $sql$
    using q, lang, v_limit;

    return;
  end if;

  if to_regclass('public.countries') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'countries'
        and column_name = 'zone'
    )
    into v_has_countries_zone;

    if v_has_countries_zone then
      return query execute $sql$
        with scored as (
          select
            c.iso2,
            case
              when lower(coalesce($2, 'fr')) = 'en' then coalesce(c.name_en, c.name_fr, c.iso2)
              else coalesce(c.name_fr, c.name_en, c.iso2)
            end as label,
            c.zone::text as zone,
            greatest(
              case when upper(coalesce($1, '')) ~ ('\\m' || c.iso2 || '\\M') then 1 else 0 end,
              case when lower(coalesce($1, '')) like '%' || lower(c.name_fr) || '%' then 0.92 else 0 end,
              case when coalesce(c.name_en, '') <> '' and lower(coalesce($1, '')) like '%' || lower(c.name_en) || '%' then 0.9 else 0 end
            )::numeric as confidence
          from public.countries c
        )
        select iso2, label, zone, round(confidence, 3)
        from scored
        where confidence > 0
        order by confidence desc, label asc
        limit $3
      $sql$
      using q, lang, v_limit;
    else
      return query execute $sql$
        with scored as (
          select
            c.iso2,
            case
              when lower(coalesce($2, 'fr')) = 'en' then coalesce(c.name_en, c.name_fr, c.iso2)
              else coalesce(c.name_fr, c.name_en, c.iso2)
            end as label,
            null::text as zone,
            greatest(
              case when upper(coalesce($1, '')) ~ ('\\m' || c.iso2 || '\\M') then 1 else 0 end,
              case when lower(coalesce($1, '')) like '%' || lower(c.name_fr) || '%' then 0.92 else 0 end,
              case when coalesce(c.name_en, '') <> '' and lower(coalesce($1, '')) like '%' || lower(c.name_en) || '%' then 0.9 else 0 end
            )::numeric as confidence
          from public.countries c
        )
        select iso2, label, zone, round(confidence, 3)
        from scored
        where confidence > 0
        order by confidence desc, label asc
        limit $3
      $sql$
      using q, lang, v_limit;
    end if;
  end if;
end;
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
language plpgsql
stable
set search_path = pg_catalog, public, extensions
as $$
declare
  v_limit integer := greatest(1, coalesce(lim, 8));
begin
  if to_regclass('public.ref_hs') is not null then
    return query execute $sql$
      with scored as (
        select
          h.hs6 as hs_code,
          case
            when lower(coalesce($2, 'fr')) = 'en' then coalesce(h.description_en, h.description_fr, h.hs6)
            else coalesce(h.description_fr, h.description_en, h.hs6)
          end as label,
          h.hs2 as chapter,
          greatest(
            case
              when regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g') <> ''
               and h.hs6 like left(regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g'), 6) || '%'
              then 1 else 0
            end,
            case when lower(coalesce($1, '')) like '%' || lower(h.description_fr) || '%' then 0.82 else 0 end,
            case when lower(coalesce($1, '')) like '%' || lower(h.description_en) || '%' then 0.80 else 0 end
          )::numeric as confidence
        from public.ref_hs h
      )
      select hs_code, label, chapter, round(confidence, 3)
      from scored
      where confidence > 0
      order by confidence desc, hs_code asc
      limit $3
    $sql$
    using q, lang, v_limit;

    return;
  end if;

  if to_regclass('public.hs_codes') is not null then
    return query execute $sql$
      with scored as (
        select
          h.hs6 as hs_code,
          case
            when lower(coalesce($2, 'fr')) = 'en' then coalesce(h.label_en, h.label_fr, h.hs6)
            else coalesce(h.label_fr, h.label_en, h.hs6)
          end as label,
          h.chapter::text as chapter,
          greatest(
            case
              when regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g') <> ''
               and h.hs6 like left(regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g'), 6) || '%'
              then 1 else 0
            end,
            case when lower(coalesce($1, '')) like '%' || lower(h.label_fr) || '%' then 0.82 else 0 end,
            case when coalesce(h.label_en, '') <> '' and lower(coalesce($1, '')) like '%' || lower(h.label_en) || '%' then 0.80 else 0 end
          )::numeric as confidence
        from public.hs_codes h
      )
      select hs_code, label, chapter, round(confidence, 3)
      from scored
      where confidence > 0
      order by confidence desc, hs_code asc
      limit $3
    $sql$
    using q, lang, v_limit;
  end if;
end;
$$;

-- Compatibility aliases used by frontend fallback logic.
create or replace function public.country_funnel(
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
  select * from public.rpc_country_funnel(q, lang, lim, ignore_learning);
$$;

create or replace function public.hs_funnel(
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
  select * from public.rpc_hs_funnel(q, lang, lim);
$$;

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
  select * from public.rpc_country_funnel(q, lang, lim, false);
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
  select * from public.rpc_hs_funnel(q, lang, lim);
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
  select *
  from public.rpc_hs_funnel(q, lang, lim)
  where chapter = left(regexp_replace(coalesce(rpc_suggest_hs_in_chapter.chapter, ''), '[^0-9]', '', 'g'), 2)
     or rpc_suggest_hs_in_chapter.chapter is null;
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
  select * from public.rpc_suggest_hs_in_chapter(q, chapter, lang, lim);
$$;

grant execute on function public.unaccent(text) to anon, authenticated, service_role;
grant execute on function public.rpc_country_funnel(text, text, integer, boolean) to anon, authenticated, service_role;
grant execute on function public.rpc_hs_funnel(text, text, integer) to anon, authenticated, service_role;
grant execute on function public.country_funnel(text, text, integer, boolean) to anon, authenticated, service_role;
grant execute on function public.hs_funnel(text, text, integer) to anon, authenticated, service_role;
grant execute on function public.rpc_suggest_country_bi(text, text, integer) to anon, authenticated, service_role;
grant execute on function public.rpc_suggest_hs_bi(text, text, integer) to anon, authenticated, service_role;
grant execute on function public.rpc_suggest_hs_in_chapter(text, text, text, integer) to anon, authenticated, service_role;
grant execute on function public.suggest_hs_in_chapter(text, text, text, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
