create extension if not exists "pgcrypto";

create table if not exists public.lead (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new',
  phone text,
  email text,
  country_iso2 text,
  message text,
  preferred_time text,
  source text,
  page_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ga_client_id text,
  user_id uuid null references auth.users(id) on delete set null,
  consent boolean not null default false
);

alter table public.lead
  add column if not exists created_at timestamptz,
  add column if not exists status text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists country_iso2 text,
  add column if not exists message text,
  add column if not exists preferred_time text,
  add column if not exists source text,
  add column if not exists page_url text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists ga_client_id text,
  add column if not exists user_id uuid,
  add column if not exists consent boolean;

update public.lead
set
  created_at = coalesce(created_at, now()),
  status = coalesce(nullif(status, ''), 'new'),
  source = coalesce(nullif(source, ''), 'cta_callback'),
  consent = coalesce(consent, false)
where created_at is null
   or status is null
   or status = ''
   or source is null
   or source = ''
   or consent is null;

alter table public.lead
  alter column created_at set default now(),
  alter column status set default 'new',
  alter column consent set default false;

alter table public.lead
  alter column created_at set not null,
  alter column status set not null,
  alter column consent set not null;

create index if not exists lead_created_at_idx on public.lead(created_at desc);
create index if not exists lead_status_idx on public.lead(status);

alter table public.lead enable row level security;

revoke all on public.lead from anon;
revoke all on public.lead from authenticated;
grant all on public.lead to service_role;

drop policy if exists lead_insert_service_only on public.lead;
create policy lead_insert_service_only
  on public.lead
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists lead_update_service_only on public.lead;
create policy lead_update_service_only
  on public.lead
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists lead_delete_service_only on public.lead;
create policy lead_delete_service_only
  on public.lead
  for delete
  using (auth.role() = 'service_role');

do $$
begin
  drop policy if exists lead_select_admin_only on public.lead;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin'
  ) then
    execute $sql$
      create policy lead_select_admin_only
        on public.lead
        for select
        using (public.is_admin() or auth.role() = 'service_role')
    $sql$;
  else
    execute $sql$
      create policy lead_select_admin_only
        on public.lead
        for select
        using (auth.role() = 'service_role')
    $sql$;
  end if;
end
$$;
