-- Allow partial company profiles at signup (complete later in app)
alter table public.company_profiles
  alter column address_line1 drop not null,
  alter column city drop not null,
  alter column postal_code drop not null;

alter table public.company_profiles
  alter column country set default 'FR';

-- Auto-create company profile from auth metadata on signup
create or replace function public.handle_new_user_company_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_name text;
  v_country text;
begin
  v_company_name := nullif(trim(coalesce(new.raw_user_meta_data->>'company_name','')), '');
  v_country := nullif(trim(coalesce(new.raw_user_meta_data->>'country','')), '');

  if v_company_name is null then
    return new;
  end if;

  insert into public.company_profiles (user_id, company_name, country)
  values (new.id, v_company_name, coalesce(v_country, 'FR'))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_company_profile on auth.users;
create trigger on_auth_user_created_company_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_company_profile();
