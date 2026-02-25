-- Harden HS funnel RPC against schema drift and prevent PostgREST 400 errors.
-- This keeps API compatibility for frontend calls using rpc_hs_funnel(q, lang, lim).

do $$
declare
  v_result text;
begin
  select pg_get_function_result('public.rpc_suggest_hs_bi(text,text,integer)'::regprocedure)
    into v_result;

  if v_result is not null
     and v_result <> 'TABLE(hs_code text, label text, chapter text, confidence numeric)' then
    execute format(
      'alter function public.rpc_suggest_hs_bi(text, text, integer) rename to %I',
      'rpc_suggest_hs_bi_legacy_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
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
      'rpc_hs_funnel_legacy_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    );
  end if;
exception
  when undefined_function then
    null;
end $$;

create or replace function public.rpc_suggest_hs_bi(
  q text default '',
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
  v_q text := trim(coalesce(q, ''));
  v_lang text := lower(coalesce(lang, 'fr'));
  v_limit integer := greatest(1, coalesce(lim, 8));
  v_digits text := regexp_replace(trim(coalesce(q, '')), '[^0-9]', '', 'g');
begin
  if v_q = '' then
    return;
  end if;

  if to_regclass('public.ref_hs') is not null then
    return query execute $sql$
      with normalized as (
        select
          coalesce(
            nullif(to_jsonb(h)->>'hs6', ''),
            nullif(regexp_replace(coalesce(to_jsonb(h)->>'hs_code', ''), '[^0-9]', '', 'g'), '')
          ) as hs_code,
          coalesce(
            nullif(to_jsonb(h)->>'description_fr', ''),
            nullif(to_jsonb(h)->>'label_fr', ''),
            nullif(to_jsonb(h)->>'description_en', ''),
            nullif(to_jsonb(h)->>'label_en', '')
          ) as label_fr,
          coalesce(
            nullif(to_jsonb(h)->>'description_en', ''),
            nullif(to_jsonb(h)->>'label_en', ''),
            nullif(to_jsonb(h)->>'description_fr', ''),
            nullif(to_jsonb(h)->>'label_fr', '')
          ) as label_en,
          coalesce(
            nullif(to_jsonb(h)->>'hs2', ''),
            nullif(to_jsonb(h)->>'chapter', ''),
            left(
              coalesce(
                nullif(to_jsonb(h)->>'hs6', ''),
                nullif(regexp_replace(coalesce(to_jsonb(h)->>'hs_code', ''), '[^0-9]', '', 'g'), '')
              ),
              2
            )
          ) as chapter
        from public.ref_hs h
      ),
      scored as (
        select
          n.hs_code,
          case
            when $2 = 'en' then coalesce(n.label_en, n.label_fr, n.hs_code)
            else coalesce(n.label_fr, n.label_en, n.hs_code)
          end as label,
          n.chapter,
          greatest(
            case
              when $1 <> '' and n.hs_code like left($1, 6) || '%'
              then 1 else 0
            end,
            case
              when $3 <> '' and lower($3) like '%' || lower(coalesce(n.label_fr, '')) || '%'
              then 0.82 else 0
            end,
            case
              when $3 <> '' and lower($3) like '%' || lower(coalesce(n.label_en, '')) || '%'
              then 0.80 else 0
            end
          )::numeric as confidence
        from normalized n
        where n.hs_code is not null
          and n.hs_code <> ''
      )
      select hs_code, label, chapter, round(confidence, 3)
      from scored
      where confidence > 0
      order by confidence desc, hs_code asc
      limit $4
    $sql$
    using v_digits, v_lang, v_q, v_limit;

    return;
  end if;

  if to_regclass('public.hs_codes') is not null then
    return query execute $sql$
      with normalized as (
        select
          coalesce(
            nullif(to_jsonb(h)->>'hs6', ''),
            nullif(regexp_replace(coalesce(to_jsonb(h)->>'hs_code', ''), '[^0-9]', '', 'g'), '')
          ) as hs_code,
          coalesce(
            nullif(to_jsonb(h)->>'label_fr', ''),
            nullif(to_jsonb(h)->>'description_fr', ''),
            nullif(to_jsonb(h)->>'label_en', ''),
            nullif(to_jsonb(h)->>'description_en', '')
          ) as label_fr,
          coalesce(
            nullif(to_jsonb(h)->>'label_en', ''),
            nullif(to_jsonb(h)->>'description_en', ''),
            nullif(to_jsonb(h)->>'label_fr', ''),
            nullif(to_jsonb(h)->>'description_fr', '')
          ) as label_en,
          coalesce(
            nullif(to_jsonb(h)->>'chapter', ''),
            nullif(to_jsonb(h)->>'hs2', ''),
            left(
              coalesce(
                nullif(to_jsonb(h)->>'hs6', ''),
                nullif(regexp_replace(coalesce(to_jsonb(h)->>'hs_code', ''), '[^0-9]', '', 'g'), '')
              ),
              2
            )
          ) as chapter
        from public.hs_codes h
      ),
      scored as (
        select
          n.hs_code,
          case
            when $2 = 'en' then coalesce(n.label_en, n.label_fr, n.hs_code)
            else coalesce(n.label_fr, n.label_en, n.hs_code)
          end as label,
          n.chapter,
          greatest(
            case
              when $1 <> '' and n.hs_code like left($1, 6) || '%'
              then 1 else 0
            end,
            case
              when $3 <> '' and lower($3) like '%' || lower(coalesce(n.label_fr, '')) || '%'
              then 0.82 else 0
            end,
            case
              when $3 <> '' and lower($3) like '%' || lower(coalesce(n.label_en, '')) || '%'
              then 0.80 else 0
            end
          )::numeric as confidence
        from normalized n
        where n.hs_code is not null
          and n.hs_code <> ''
      )
      select hs_code, label, chapter, round(confidence, 3)
      from scored
      where confidence > 0
      order by confidence desc, hs_code asc
      limit $4
    $sql$
    using v_digits, v_lang, v_q, v_limit;
  end if;
end;
$$;

create or replace function public.rpc_hs_funnel(
  q text default '',
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

create or replace function public.hs_funnel(
  q text default '',
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

grant execute on function public.rpc_suggest_hs_bi(text, text, integer) to anon, authenticated, service_role;
grant execute on function public.rpc_hs_funnel(text, text, integer) to anon, authenticated, service_role;
grant execute on function public.hs_funnel(text, text, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
