-- Migration: export_settings

create table if not exists public.export_settings (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
drop trigger if exists trg_export_settings_updated_at on public.export_settings;
create trigger trg_export_settings_updated_at
  before update on public.export_settings
  for each row execute function public.set_updated_at();

alter table public.export_settings enable row level security;

-- read for authenticated
drop policy if exists "export_settings_read_auth" on public.export_settings;
create policy "export_settings_read_auth"
  on public.export_settings
  for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role' or public.is_admin());

-- write for admin/service
drop policy if exists "export_settings_write_admin" on public.export_settings;
create policy "export_settings_write_admin"
  on public.export_settings
  for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

grant select on public.export_settings to anon, authenticated;
grant insert, update, delete on public.export_settings to authenticated;
