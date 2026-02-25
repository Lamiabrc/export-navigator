-- Fix unaccent resolution in RPCs (especially rpc_country_funnel)

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.unaccent(text)
returns text
language sql
immutable
as $$
  select extensions.unaccent($1);
$$;

grant execute on function public.unaccent(text) to anon, authenticated, service_role;

-- Optional hardening: patch existing rpc_country_funnel definitions to use public.unaccent(...)
-- and ensure search_path includes extensions.
do $$
declare
  rec record;
  v_def text;
  v_patched text;
begin
  for rec in
    select
      p.oid,
      n.nspname as schema_name,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_country_funnel'
  loop
    v_def := pg_get_functiondef(rec.oid);

    -- Avoid double-prefixing existing qualified calls.
    v_patched := replace(v_def, 'public.unaccent(', '__PUBLIC_UNACCENT__');
    v_patched := replace(v_patched, 'extensions.unaccent(', '__EXT_UNACCENT__');
    v_patched := replace(v_patched, 'unaccent(', 'public.unaccent(');
    v_patched := replace(v_patched, '__PUBLIC_UNACCENT__', 'public.unaccent(');
    v_patched := replace(v_patched, '__EXT_UNACCENT__', 'extensions.unaccent(');

    if v_patched <> v_def then
      execute v_patched;
    end if;

    execute format(
      'alter function %I.%I(%s) set search_path = ''pg_catalog, public, extensions''',
      rec.schema_name,
      rec.proname,
      rec.args
    );
  end loop;
end $$;
