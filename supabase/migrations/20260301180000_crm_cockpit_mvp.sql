-- CRM MVP for sales + prospecting + compliance cockpit.
-- Tables: accounts, contacts, deals, deal_items, deal_activities, tasks
-- Date: 2026-03-01

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

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  country_iso2 text null,
  industry text null,
  website text null,
  status text not null default 'active' check (status in ('active', 'inactive', 'prospect')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text null,
  phone text null,
  role text null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid null references public.accounts(id) on delete set null,
  contact_id uuid null references public.contacts(id) on delete set null,
  title text not null,
  stage text not null default 'new' check (stage in ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  amount numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  probability integer not null default 20 check (probability >= 0 and probability <= 100),
  expected_close_date date null,
  from_country text null,
  to_country text null,
  product_text text null,
  incoterm text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null
);

create table if not exists public.deal_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  line_no integer not null default 1,
  product_text text not null,
  hs6 text null,
  quantity numeric(14,3) null,
  unit_price numeric(14,2) null,
  total_value numeric(14,2) null,
  currency text null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  activity_type text not null default 'note' check (activity_type in ('note', 'call', 'email', 'meeting', 'status_change')),
  content text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  due_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id uuid null references public.deals(id) on delete cascade,
  account_id uuid null references public.accounts(id) on delete cascade,
  title text not null,
  description text null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_owner_idx on public.accounts(owner_user_id, updated_at desc);
create index if not exists contacts_owner_account_idx on public.contacts(owner_user_id, account_id, updated_at desc);
create index if not exists deals_owner_stage_idx on public.deals(owner_user_id, stage, updated_at desc);
create index if not exists deals_owner_country_idx on public.deals(owner_user_id, to_country, from_country);
create index if not exists deal_items_owner_deal_idx on public.deal_items(owner_user_id, deal_id, line_no);
create index if not exists deal_activities_owner_deal_idx on public.deal_activities(owner_user_id, deal_id, created_at desc);
create index if not exists tasks_owner_status_idx on public.tasks(owner_user_id, status, due_at);

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

drop trigger if exists trg_deal_items_updated_at on public.deal_items;
create trigger trg_deal_items_updated_at
before update on public.deal_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_deal_activities_updated_at on public.deal_activities;
create trigger trg_deal_activities_updated_at
before update on public.deal_activities
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.deal_items enable row level security;
alter table public.deal_activities enable row level security;
alter table public.tasks enable row level security;

drop policy if exists accounts_owner_all on public.accounts;
create policy accounts_owner_all
on public.accounts
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists contacts_owner_all on public.contacts;
create policy contacts_owner_all
on public.contacts
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists deals_owner_all on public.deals;
create policy deals_owner_all
on public.deals
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists deal_items_owner_all on public.deal_items;
create policy deal_items_owner_all
on public.deal_items
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists deal_activities_owner_all on public.deal_activities;
create policy deal_activities_owner_all
on public.deal_activities
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all
on public.tasks
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.deal_items to authenticated;
grant select, insert, update, delete on public.deal_activities to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

