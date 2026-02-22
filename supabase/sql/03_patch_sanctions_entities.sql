do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sanctions_entities'
  ) then
    alter table public.sanctions_entities
      add column if not exists source_key text,
      add column if not exists source_url text,
      add column if not exists entity_type text,
      add column if not exists name_norm text;

    create index if not exists sanctions_entities_name_norm_idx
      on public.sanctions_entities (name_norm);
  end if;
end $$;
