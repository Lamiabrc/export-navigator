create extension if not exists "pgcrypto";

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company_name text,
  country text,
  hs_code text,
  frequency text not null default 'weekly',
  source text,
  consent boolean not null default true,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.newsletter_subscribers
  add column if not exists company_name text,
  add column if not exists country text,
  add column if not exists hs_code text,
  add column if not exists frequency text default 'weekly',
  add column if not exists source text,
  add column if not exists consent boolean default true,
  add column if not exists consented_at timestamptz default now();

create unique index if not exists newsletter_subscribers_email_idx
  on public.newsletter_subscribers (email);

drop trigger if exists newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter_subscribers_insert" on public.newsletter_subscribers;
create policy "newsletter_subscribers_insert" on public.newsletter_subscribers
  for insert with check (true);

drop policy if exists "newsletter_subscribers_select_service_role" on public.newsletter_subscribers;
create policy "newsletter_subscribers_select_service_role" on public.newsletter_subscribers
  for select using (auth.role() = 'service_role');

drop policy if exists "newsletter_subscribers_update_service_role" on public.newsletter_subscribers;
create policy "newsletter_subscribers_update_service_role" on public.newsletter_subscribers
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
