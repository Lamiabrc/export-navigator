-- Seed permanent regulatory feeds used by Control Tower + RSS API.

create unique index if not exists regulatory_feeds_source_url_uidx
  on public.regulatory_feeds ((lower(source_url)))
  where source_url is not null;

insert into public.regulatory_feeds (
  name,
  source_name,
  source_url,
  kind,
  category,
  territory,
  tags,
  enabled,
  is_public
)
select
  src.name,
  src.source_name,
  src.source_url,
  src.kind,
  src.category,
  src.territory,
  src.tags,
  true,
  true
from (
  values
    ('Le Moci', 'Le Moci', 'https://www.lemoci.com/feed/', 'rss', 'trade', 'WORLD', array['trade','official']),
    ('WHO News', 'WHO News', 'https://www.who.int/rss-feeds/news-english.xml', 'rss', 'health', 'WORLD', array['health','official']),
    ('Douane francaise', 'Douane francaise', 'https://www.douane.gouv.fr/meteo/prodouane/pages/rss', 'rss', 'douane', 'FR', array['douane','france','official']),
    ('UE DG Trade', 'UE DG Trade', 'https://policy.trade.ec.europa.eu/node/2/rss_en', 'rss', 'trade', 'EU', array['trade','eu','official'])
) as src(name, source_name, source_url, kind, category, territory, tags)
where not exists (
  select 1
  from public.regulatory_feeds rf
  where lower(rf.source_url) = lower(src.source_url)
);

update public.regulatory_feeds
set
  enabled = true,
  is_public = true,
  kind = coalesce(nullif(kind, ''), 'rss'),
  source_name = coalesce(nullif(source_name, ''), nullif(name, ''))
where lower(source_url) in (
  lower('https://www.lemoci.com/feed/'),
  lower('https://www.who.int/rss-feeds/news-english.xml'),
  lower('https://www.douane.gouv.fr/meteo/prodouane/pages/rss'),
  lower('https://policy.trade.ec.europa.eu/node/2/rss_en')
);
