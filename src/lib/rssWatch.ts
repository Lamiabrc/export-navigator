export type WatchItem = {
  title: string;
  link: string;
  publishedAt?: string;
  source?: string;
};

type RssSource = {
  id: string;
  name: string;
  url: string;
};

const DEFAULT_FEEDS: RssSource[] = [
  {
    id: "economie-gouv-actu",
    name: "Economie.gouv.fr",
    url: "https://www.economie.gouv.fr/rss/toutesactualites",
  },
  {
    id: "service-public-pro",
    name: "Service-Public Pro",
    url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss",
  },
  {
    id: "wto-news",
    name: "OMC",
    url: "http://www.wto.org/library/rss/latest_news_e.xml",
  },
];

const COUNTRY_FEEDS: Record<string, RssSource[]> = {
  FR: DEFAULT_FEEDS,
  DE: DEFAULT_FEEDS,
  BE: DEFAULT_FEEDS,
  NL: DEFAULT_FEEDS,
  CH: DEFAULT_FEEDS,
  US: DEFAULT_FEEDS,
  CA: DEFAULT_FEEDS,
};

const FALLBACK_TERRITORY = "EU";

const API_LIMIT = 6;

function normalizeIso2(value: string) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  const match = raw.match(/\(([A-Z]{2})\)/);
  if (match?.[1]) return match[1];
  return "";
}

function toIsoDate(value?: string | null) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function normalizeLink(link?: string | null) {
  const href = String(link || "").trim();
  if (!href) return "";
  if (!/^https?:\/\//i.test(href)) return "";
  return href;
}

async function fetchApiItems(territory: string, limit = API_LIMIT): Promise<WatchItem[]> {
  try {
    const res = await fetch(`/api/rss?limit=${limit}&territory=${encodeURIComponent(territory)}`);
    const json = await res.json().catch(() => ({}));
    const rawItems = Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.data?.items)
      ? json.data.items
      : [];

    const normalized = rawItems
      .map((it: any) => {
        const link = normalizeLink(it?.link || it?.url);
        if (!link) return null;
        return {
          title: String(it?.title || "Sans titre"),
          link,
          publishedAt: toIsoDate(it?.publishedAt || it?.published_at || it?.pubDate),
          source: it?.source || it?.feed || it?.sourceName || it?.siteName || undefined,
        } as WatchItem;
      })
      .filter(Boolean) as WatchItem[];

    return normalized.slice(0, limit);
  } catch {
    return [];
  }
}

function parseXml(text: string) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  if (xml.querySelector("parsererror")) return null;
  return xml;
}

function parseFeedItems(xml: Document, source: RssSource) {
  const nodes = Array.from(xml.querySelectorAll("item")).slice(0, 12);
  return nodes
    .map((node) => {
      const title = (node.querySelector("title")?.textContent || "").trim();
      const link = normalizeLink(node.querySelector("link")?.textContent || "");
      const pubDate = (node.querySelector("pubDate")?.textContent || "").trim();
      if (!title || !link) return null;
      return {
        title,
        link,
        publishedAt: toIsoDate(pubDate),
        source: source.name,
      } as WatchItem;
    })
    .filter(Boolean) as WatchItem[];
}

async function fetchFeedSource(source: RssSource): Promise<WatchItem[]> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}`;
    const res = await fetch(proxyUrl, {
      headers: { Accept: "application/xml,text/xml,application/rss+xml,*/*" },
    });
    if (!res.ok) return [];
    const text = await res.text();
    const xml = parseXml(text);
    if (!xml) return [];
    return parseFeedItems(xml, source);
  } catch {
    return [];
  }
}

export async function fetchCountryWatch(countryIso2: string, limit = API_LIMIT): Promise<WatchItem[]> {
  const iso = normalizeIso2(countryIso2);
  if (!iso) return [];

  const fromApi = await fetchApiItems(iso, limit);
  if (fromApi.length) return fromApi.slice(0, limit);

  const fromApiFallback = await fetchApiItems(FALLBACK_TERRITORY, limit);
  if (fromApiFallback.length) return fromApiFallback.slice(0, limit);

  const sources = COUNTRY_FEEDS[iso] || DEFAULT_FEEDS;
  const lists = await Promise.all(sources.map((src) => fetchFeedSource(src)));
  const merged = lists.flat();

  const dedup = new Map<string, WatchItem>();
  for (const it of merged) {
    if (!dedup.has(it.link)) dedup.set(it.link, it);
  }

  const sorted = Array.from(dedup.values()).sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db - da;
  });

  return sorted.slice(0, limit);
}
