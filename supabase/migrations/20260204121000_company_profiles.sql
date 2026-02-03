create extension if not exists "pgcrypto";

create table if not exists company_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postal_code text not null,
  country text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table company_profiles enable row level security;

create policy "company_profiles_owner" on company_profiles
  for all
  using (auth.role() = 'service_role' OR auth.uid() = user_id)
  with check (auth.role() = 'service_role' OR auth.uid() = user_id);
