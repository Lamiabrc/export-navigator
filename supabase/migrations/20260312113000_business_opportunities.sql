create extension if not exists "pgcrypto";

create table if not exists public.business_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  title text not null,
  summary text not null,
  opportunity_type text not null check (
    opportunity_type in ('buyer', 'seller', 'distributor', 'partner', 'investor', 'service')
  ),
  sector text,
  origin_country text,
  target_country text,
  website text,
  status text not null default 'published' check (status in ('published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_opportunities
  add column if not exists user_id uuid default auth.uid(),
  add column if not exists company_name text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists opportunity_type text,
  add column if not exists sector text,
  add column if not exists origin_country text,
  add column if not exists target_country text,
  add column if not exists website text,
  add column if not exists status text default 'published',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.business_opportunities
set
  status = coalesce(nullif(status, ''), 'published'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where status is null
   or created_at is null
   or updated_at is null;

alter table public.business_opportunities
  alter column user_id set default auth.uid(),
  alter column company_name set not null,
  alter column contact_name set not null,
  alter column contact_email set not null,
  alter column title set not null,
  alter column summary set not null,
  alter column opportunity_type set not null,
  alter column status set default 'published',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists business_opportunities_status_created_idx
  on public.business_opportunities (status, created_at desc);

create index if not exists business_opportunities_type_idx
  on public.business_opportunities (opportunity_type);

create index if not exists business_opportunities_target_country_idx
  on public.business_opportunities (target_country);

drop trigger if exists business_opportunities_updated_at on public.business_opportunities;
create trigger business_opportunities_updated_at
  before update on public.business_opportunities
  for each row execute function public.set_updated_at();

alter table public.business_opportunities enable row level security;

drop policy if exists "business_opportunities_public_select" on public.business_opportunities;
create policy "business_opportunities_public_select"
  on public.business_opportunities for select
  using (
    status = 'published'
    or auth.uid() = user_id
    or public.is_admin()
    or auth.role() = 'service_role'
  );

drop policy if exists "business_opportunities_insert_authenticated" on public.business_opportunities;
create policy "business_opportunities_insert_authenticated"
  on public.business_opportunities for insert to authenticated
  with check (
    auth.uid() = user_id
    and status in ('published', 'archived')
  );

drop policy if exists "business_opportunities_update_owner" on public.business_opportunities;
create policy "business_opportunities_update_owner"
  on public.business_opportunities for update to authenticated
  using (auth.uid() = user_id or public.is_admin() or auth.role() = 'service_role')
  with check (auth.uid() = user_id or public.is_admin() or auth.role() = 'service_role');

drop policy if exists "business_opportunities_delete_owner" on public.business_opportunities;
create policy "business_opportunities_delete_owner"
  on public.business_opportunities for delete to authenticated
  using (auth.uid() = user_id or public.is_admin() or auth.role() = 'service_role');

grant select on public.business_opportunities to anon, authenticated;
grant insert, update, delete on public.business_opportunities to authenticated;
grant all on public.business_opportunities to service_role;
