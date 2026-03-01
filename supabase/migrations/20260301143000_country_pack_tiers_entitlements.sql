-- Offer tiers for watch access: base (FR+EU), free OECD packs, paid non-OECD packs.
-- Date: 2026-03-01

create extension if not exists pgcrypto;

alter table if exists public.territories
  add column if not exists name_fr text,
  add column if not exists name_en text,
  add column if not exists is_oecd boolean not null default false,
  add column if not exists pack_tier text not null default 'base',
  add column if not exists pack_price_monthly integer,
  add column if not exists pack_price_yearly integer;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'territories'
      and column_name = 'name'
  ) then
    update public.territories
    set
      name_fr = coalesce(nullif(name_fr, ''), nullif(name, ''), iso2),
      name_en = coalesce(nullif(name_en, ''), nullif(name, ''), iso2)
    where coalesce(nullif(name_fr, ''), nullif(name_en, '')) is null;
  else
    update public.territories
    set
      name_fr = coalesce(nullif(name_fr, ''), iso2),
      name_en = coalesce(nullif(name_en, ''), iso2)
    where coalesce(nullif(name_fr, ''), nullif(name_en, '')) is null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'territories_pack_tier_chk'
      and conrelid = 'public.territories'::regclass
  ) then
    alter table public.territories
      add constraint territories_pack_tier_chk
      check (pack_tier in ('base', 'free_oecd', 'paid_non_oecd'));
  end if;
end
$$;

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_iso2 text not null references public.territories(iso2) on delete cascade,
  active boolean not null default true,
  source text not null default 'free_oecd' check (source in ('free_oecd', 'stripe')),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_entitlements_user_country_idx
  on public.user_entitlements(user_id, country_iso2);

create index if not exists user_entitlements_active_idx
  on public.user_entitlements(country_iso2, active, expires_at);

alter table if exists public.user_entitlements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_entitlements'
      and policyname = 'user_entitlements_read_own'
  ) then
    create policy user_entitlements_read_own
      on public.user_entitlements
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_entitlements'
      and policyname = 'user_entitlements_service_write'
  ) then
    create policy user_entitlements_service_write
      on public.user_entitlements
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

grant select on public.user_entitlements to authenticated;

alter table if exists public.regulatory_items
  add column if not exists why_relevant text,
  add column if not exists action_required text;

update public.regulatory_items
set
  why_relevant = coalesce(nullif(why_relevant, ''), nullif(summary, ''), title),
  action_required = coalesce(nullif(action_required, ''), 'Verifier impact sur vos flux import/export et mettre a jour vos documents internes.')
where coalesce(nullif(why_relevant, ''), nullif(action_required, '')) is null;

with eu_codes as (
  select unnest(array[
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
  ]::text[]) as iso2
),
oecd_codes as (
  select unnest(array[
    'AU','AT','BE','CA','CL','CO','CR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IL','IT','JP','KR','LV','LT','LU','MX','NL','NZ','NO','PL','PT','SK','SI','ES','SE','CH','TR','GB','US'
  ]::text[]) as iso2
),
seed_union as (
  select distinct o.iso2,
    (e.iso2 is not null) as is_eu,
    true as is_oecd,
    case
      when e.iso2 is not null then 'base'
      else 'free_oecd'
    end as pack_tier
  from oecd_codes o
  left join eu_codes e on e.iso2 = o.iso2
)
insert into public.territories (
  iso2,
  name,
  name_fr,
  name_en,
  aliases,
  region,
  is_eu,
  is_oecd,
  pack_tier,
  pack_price_monthly,
  pack_price_yearly,
  last_checked,
  created_at,
  updated_at
)
select
  s.iso2,
  s.iso2,
  s.iso2,
  s.iso2,
  '{}'::text[],
  null,
  s.is_eu,
  s.is_oecd,
  s.pack_tier,
  null,
  null,
  now(),
  now(),
  now()
from seed_union s
on conflict (iso2) do update
set
  is_eu = excluded.is_eu,
  is_oecd = excluded.is_oecd,
  pack_tier = excluded.pack_tier,
  pack_price_monthly = case when excluded.pack_tier = 'paid_non_oecd' then coalesce(public.territories.pack_price_monthly, 1900) else null end,
  pack_price_yearly = case when excluded.pack_tier = 'paid_non_oecd' then coalesce(public.territories.pack_price_yearly, 19000) else null end,
  name_fr = coalesce(nullif(public.territories.name_fr, ''), excluded.name_fr),
  name_en = coalesce(nullif(public.territories.name_en, ''), excluded.name_en),
  last_checked = now(),
  updated_at = now();

with eu_codes as (
  select unnest(array[
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
  ]::text[]) as iso2
),
oecd_codes as (
  select unnest(array[
    'AU','AT','BE','CA','CL','CO','CR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IL','IT','JP','KR','LV','LT','LU','MX','NL','NZ','NO','PL','PT','SK','SI','ES','SE','CH','TR','GB','US'
  ]::text[]) as iso2
)
update public.territories t
set
  is_eu = exists (select 1 from eu_codes e where e.iso2 = t.iso2),
  is_oecd = exists (select 1 from oecd_codes o where o.iso2 = t.iso2),
  pack_tier = case
    when t.iso2 = 'FR' or exists (select 1 from eu_codes e where e.iso2 = t.iso2) then 'base'
    when exists (select 1 from oecd_codes o where o.iso2 = t.iso2) then 'free_oecd'
    else 'paid_non_oecd'
  end,
  pack_price_monthly = case
    when t.iso2 = 'FR' or exists (select 1 from eu_codes e where e.iso2 = t.iso2) then null
    when exists (select 1 from oecd_codes o where o.iso2 = t.iso2) then null
    else coalesce(t.pack_price_monthly, 1900)
  end,
  pack_price_yearly = case
    when t.iso2 = 'FR' or exists (select 1 from eu_codes e where e.iso2 = t.iso2) then null
    when exists (select 1 from oecd_codes o where o.iso2 = t.iso2) then null
    else coalesce(t.pack_price_yearly, 19000)
  end,
  last_checked = now(),
  updated_at = now();
