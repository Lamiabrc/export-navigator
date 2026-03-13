create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.business_relations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opportunity_id uuid null references public.business_opportunities(id) on delete set null,
  opportunity_title text null,
  direction text not null check (direction in ('inbound', 'outbound')),
  relation_source text not null default 'manual' check (relation_source in ('manual', 'board_request', 'board_outreach', 'intro_request')),
  relation_status text not null default 'new' check (relation_status in ('new', 'contacted', 'qualified', 'closed')),
  company_name text not null,
  contact_name text not null default '',
  contact_email text null,
  contact_phone text null,
  message text not null default '',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_relations_owner_direction_idx
  on public.business_relations (owner_user_id, direction, created_at desc);

create index if not exists business_relations_owner_status_idx
  on public.business_relations (owner_user_id, relation_status, created_at desc);

create index if not exists business_relations_opportunity_idx
  on public.business_relations (opportunity_id, created_at desc);

drop trigger if exists trg_business_relations_updated_at on public.business_relations;
create trigger trg_business_relations_updated_at
before update on public.business_relations
for each row execute function public.set_updated_at();

alter table public.business_relations enable row level security;

drop policy if exists business_relations_owner_all on public.business_relations;
create policy business_relations_owner_all
on public.business_relations
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

grant select, insert, update, delete on public.business_relations to authenticated;
grant select, insert, update, delete on public.business_relations to service_role;
