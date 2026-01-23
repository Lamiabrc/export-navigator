create extension if not exists "pgcrypto";

create table if not exists audit_requests (
  id uuid primary key default gen_random_uuid(),
  company text,
  email text not null,
  destination text,
  incoterm text,
  value numeric,
  currency text,
  lines_count integer,
  notes text,
  context_json jsonb,
  created_at timestamptz not null default now()
);
