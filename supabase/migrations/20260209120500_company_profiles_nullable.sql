-- Allow partial company profiles during onboarding
alter table if exists public.company_profiles
  alter column address_line1 drop not null,
  alter column city drop not null,
  alter column postal_code drop not null,
  alter column country drop not null;
