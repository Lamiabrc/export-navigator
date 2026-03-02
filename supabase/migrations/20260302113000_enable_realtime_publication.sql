-- Enable Realtime postgres_changes publication for key tables (idempotent)
do $$
declare
  tbl text;
  target_tables text[] := array[
    'company_profiles',
    'hs_search_logs',
    'chat_events',
    'regulatory_items',
    'deals'
  ];
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise notice 'publication supabase_realtime is missing, realtime table registration skipped';
    return;
  end if;

  foreach tbl in array target_tables loop
    if to_regclass(format('public.%I', tbl)) is null then
      raise notice 'table public.% does not exist, skip', tbl;
      continue;
    end if;

    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      raise notice 'table public.% already in publication supabase_realtime', tbl;
      continue;
    end if;

    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
      raise notice 'added public.% to publication supabase_realtime', tbl;
    exception
      when duplicate_object then
        raise notice 'table public.% already attached (duplicate_object), skip', tbl;
      when undefined_object then
        raise notice 'publication/table undefined while adding public.%, skip', tbl;
      when insufficient_privilege then
        raise notice 'insufficient privilege to alter publication for public.%, skip', tbl;
      when others then
        raise notice 'cannot add public.% to supabase_realtime: %', tbl, sqlerrm;
    end;
  end loop;
end
$$;
