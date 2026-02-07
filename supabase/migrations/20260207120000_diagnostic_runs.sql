create extension if not exists "pgcrypto";

create table if not exists user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  consent boolean not null default true,
  consent_version text not null,
  consent_text_hash text not null,
  consented_at timestamptz not null default now()
);

create unique index if not exists user_consents_user_scope_version_idx
  on user_consents(user_id, scope, consent_version);

create index if not exists user_consents_user_id_idx on user_consents(user_id);

alter table user_consents enable row level security;

create policy "user_consents_owner" on user_consents
  for all
  using (auth.role() = 'service_role' OR auth.uid() = user_id)
  with check (auth.role() = 'service_role' OR auth.uid() = user_id);

create table if not exists diagnostic_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  destination_country text,
  hs_code text,
  product_label text,
  origin_country text,
  incoterm text,
  quantity numeric,
  unit_price numeric,
  currency text,
  inputs jsonb,
  outputs jsonb,
  consent_id uuid references user_consents(id) on delete set null,
  consent_version text
);

create index if not exists diagnostic_runs_user_id_idx on diagnostic_runs(user_id);
create index if not exists diagnostic_runs_created_at_idx on diagnostic_runs(created_at);

alter table diagnostic_runs enable row level security;

create policy "diagnostic_runs_owner" on diagnostic_runs
  for all
  using (auth.role() = 'service_role' OR auth.uid() = user_id)
  with check (auth.role() = 'service_role' OR auth.uid() = user_id);
