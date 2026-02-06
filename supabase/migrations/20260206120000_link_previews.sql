create table if not exists public.link_previews (
  url text not null,
  url_hash text not null,
  title text,
  description text,
  image_url text,
  site_name text,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists link_previews_url_hash_idx on public.link_previews(url_hash);
create index if not exists link_previews_updated_at_idx on public.link_previews(updated_at);

create trigger link_previews_updated_at
  before update on public.link_previews
  for each row execute function public.set_updated_at();

alter table public.link_previews enable row level security;

create policy "link_previews_service_role"
  on public.link_previews for all
  using (auth.role() = 'service_role');
