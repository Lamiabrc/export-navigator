-- Billing schema for Stripe subscriptions (no profiles table required).
create extension if not exists "pgcrypto";

-- Helper for updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text,
  plan text default 'free',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists billing_customers_user_id_idx on public.billing_customers(user_id);
create index if not exists billing_subscriptions_user_id_idx on public.billing_subscriptions(user_id);

drop trigger if exists billing_customers_updated_at on public.billing_customers;
create trigger billing_customers_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();

drop trigger if exists billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger billing_subscriptions_updated_at
  before update on public.billing_subscriptions
  for each row execute function public.set_updated_at();

-- RLS
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;

-- Customers: owner can read/update. Inserts are handled by service role only.
drop policy if exists "billing_customers_owner_read" on public.billing_customers;
create policy "billing_customers_owner_read"
  on public.billing_customers for select
  using (auth.uid() = user_id);

drop policy if exists "billing_customers_owner_insert" on public.billing_customers;
create policy "billing_customers_owner_insert"
  on public.billing_customers for insert
  with check (auth.uid() = user_id);

drop policy if exists "billing_customers_owner_update" on public.billing_customers;
create policy "billing_customers_owner_update"
  on public.billing_customers for update
  using (auth.uid() = user_id);

-- Subscriptions: owner can read. Updates via service role (no client update policy).
drop policy if exists "billing_subscriptions_owner_read" on public.billing_subscriptions;
create policy "billing_subscriptions_owner_read"
  on public.billing_subscriptions for select
  using (auth.uid() = user_id);
