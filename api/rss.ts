import type { VercelRequest, VercelResponse } from "@vercel/node";

type ApiItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  source: string | null;
  zone: string | null; // output compatibility for legacy UIs
  category: string | null;
  tags: string[];
  territory: string | null;
  official: boolean;
  importance: number;
  imageUrl: string | null;
  why_relevant?: string | null;
  action_required?: string | null;
};

type FeedItem = {
  title: string;
  link: string;
  description?: string | null;
  pubDate?: string | null;
  source?: string | null;
  imageUrl?: string | null;
};

type RssSource = { name: string; url: string };

type FeedFilter = {
  territory: string;
  topic: string | null;
  from: string | null;
  to: string | null;
  officialOnly: boolean;
};

type PackTier = "base" | "free_oecd" | "paid_non_oecd";

type TerritoryAccess = {
  territory: string;
  tier: PackTier;
  isEu: boolean;
  isOecd: boolean;
  entitled: boolean;
  locked: boolean;
  priceMonthly: number | null;
  priceYearly: number | null;
  countryLabel: string;
};

const PERMANENT_SOURCES: RssSource[] = [
  { name: "Le Moci", url: "https://www.lemoci.com/feed/" },
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml" },
  {
    name: "Google Alert Export",
    url: "https://news.google.com/rss/search?q=alerte+export+union+europeenne+douane&hl=fr&gl=FR&ceid=FR:fr",
  },
  { name: "Douane francaise", url: "https://www.douane.gouv.fr/meteo/prodouane/pages/rss" },
  { name: "UE DG Trade", url: "https://policy.trade.ec.europa.eu/node/2/rss_en" },
  {
    name: "EU Sanctions Updates",
    url: "https://finance.ec.europa.eu/single-market-economy/eu-rules-sanctions/russian-invasion-ukraine_en?format=rss",
  },
  {
    name: "EU Sanctions FAQ",
    url: "https://finance.ec.europa.eu/single-market-economy/eu-rules-sanctions/russian-invasion-ukraine/sanctions-related-faqs_en?format=rss",
  },
];

const WORLD_SOURCES: RssSource[] = [
  { name: "OMC (WTO)", url: "https://www.wto.org/library/rss/latest_news_e.xml" },
];

const COUNTRY_SOURCES: Record<string, RssSource[]> = {
  FR: [
    { name: "Economie.gouv.fr", url: "https://www.economie.gouv.fr/rss/toutesactualites" },
    { name: "Service-Public Pro", url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss" },
    { name: "France Diplomatie", url: "https://www.diplomatie.gouv.fr/en/backend-fd.php3" },
  ],
  DE: [{ name: "BMWK", url: "https://www.bmwk.de/SiteGlobals/Functions/RSSFeed/RSSFeed-Pressemitteilung.xml" }],
  BE: [{ name: "Belgium News", url: "https://news.belgium.be/en/feeds/all" }],
  NL: [{ name: "Government.nl", url: "https://feeds.government.nl/news.rss" }],
  CH: [
    { name: "FINMA sanctions", url: "https://www.finma.ch/en/rss/rss-internationale-sanktionen.xml" },
    { name: "FINMA news", url: "https://www.finma.ch/en/rss/rss-finma-news.xml" },
  ],
  US: [
    { name: "USTR press releases", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_press_releases_10475.xml" },
    { name: "USTR recent news", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_recent_news_10495.xml" },
  ],
  CA: [
    {
      name: "Global Affairs Canada",
      url: "https://api.io.canada.ca/io-server/gc/news/en/v2?atomtitle=Global+Affairs+Canada+news+releases&dept=departmentofforeignaffairstradeanddevelopment&format=atom&orderBy=desc&pick=1000&publishedDate%3E=2015-01-01&sort=publishedDate&type=newsreleases",
    },
  ],
};

const PROXY_ALLOWED_HOSTS = new Set([
  "news.google.com",
  "www.lemoci.com",
  "lemoci.com",
  "www.who.int",
  "who.int",
  "www.douane.gouv.fr",
  "douane.gouv.fr",
  "www.tresor.economie.gouv.fr",
  "finance.ec.europa.eu",
  "ofsi.blog.gov.uk",
  "www.ecb.europa.eu",
  "policy.trade.ec.europa.eu",
  "www.wto.org",
  "www.economie.gouv.fr",
  "www.service-public.gouv.fr",
  "www.diplomatie.gouv.fr",
  "www.bmwk.de",
  "news.belgium.be",
  "feeds.government.nl",
  "www.finma.ch",
  "api.io.canada.ca",
  "ustr.gov",
]);

const EU_ISO2 = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

const OECD_ISO2 = new Set([
  "AU",
  "AT",
  "BE",
  "CA",
  "CL",
  "CO",
  "CR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IL",
  "IT",
  "JP",
  "KR",
  "LV",
  "LT",
  "LU",
  "MX",
  "NL",
  "NZ",
  "NO",
  "PL",
  "PT",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
  "TR",
  "GB",
  "US",
]);

const RSS_USER_AGENT =
  "Mozilla/5.0 (compatible; ExportNavigatorBot/1.0; +https://www.exportfrancefacile.com)";

function isAllowedProxyUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return PROXY_ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function allowCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

function createAbortController() {
  try {
    return typeof AbortController !== "undefined" ? new AbortController() : null;
  } catch {
    return null;
  }
}

function escapeXml(input: string) {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildBaseUrl(req: VercelRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function truncate(s: string, n: number) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}...`;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(input: string) {
  const toSafeCodePoint = (value: number, fallback: string) => {
    if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return fallback;
    try {
      return String.fromCodePoint(value);
    } catch {
      return fallback;
    }
  };

  let text = String(input || "");
  for (let i = 0; i < 2; i += 1) {
    const decoded = text
      .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
        const code = Number.parseInt(hex, 16);
        return toSafeCodePoint(code, _);
      })
      .replace(/&#([0-9]+);?/g, (_, dec: string) => {
        const code = Number.parseInt(dec, 10);
        return toSafeCodePoint(code, _);
      })
      .replace(/&([a-zA-Z]+);/g, (_, name: string) => NAMED_HTML_ENTITIES[name] ?? _);

    if (decoded === text) break;
    text = decoded;
  }
  return text;
}

function toIsoDate(value: any): string | null {
  if (!value) return null;
  try {
    const dt = new Date(value);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString();
  } catch {
    return null;
  }
}

function normalizeTerritory(value: string) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "WORLD" || raw === "GLOBAL" || raw === "ALL" || raw === "MONDE" || raw === "EU") {
    return "WORLD";
  }
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return "WORLD";
}

function territoryLabel(code: string) {
  if (code === "WORLD") return "Monde";
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

const TOPIC_SYNONYMS: Record<string, string[]> = {
  sanctions: ["sanction", "embargo", "ofac", "asset freeze", "restrictive measure"],
  douane: ["douane", "customs", "tariff", "duty", "import control"],
  taxes: ["vat", "tva", "tax", "fiscal", "cbam"],
  documents: ["document", "certificate", "origin", "packing list", "invoice"],
  logistics: ["transport", "shipping", "maritime", "air freight", "logistics"],
  sante: ["who", "health", "pandemic", "disease", "vaccin"],
  trade: ["trade", "commerce", "wto", "market access", "fta"],
};

const OFFICIAL_SOURCE_HINTS = [
  "gouv",
  ".gov",
  "europa.eu",
  "wto.org",
  "who.int",
  "finma",
  "ustr",
  "service-public",
];

function parseBoolLike(value: unknown, fallback: boolean) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on", "official", "officiel"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function parseIsoDateOrNull(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function parseTopic(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw || null;
}

function normalizeTag(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategoryAndTags(text: string, sourceName: string | null, fallbackCategory: string | null) {
  const haystack = `${text || ""} ${sourceName || ""}`.toLowerCase();
  const found: string[] = [];
  for (const [topic, synonyms] of Object.entries(TOPIC_SYNONYMS)) {
    if (synonyms.some((synonym) => haystack.includes(synonym))) {
      found.push(topic);
    }
  }

  const fallback = fallbackCategory ? [normalizeTag(fallbackCategory)] : [];
  const tags = Array.from(
    new Set(
      [...found, ...fallback]
        .map((tag) => normalizeTag(tag))
        .filter(Boolean)
    )
  );

  return {
    category: fallbackCategory || found[0] || null,
    tags,
  };
}

function isOfficialSource(sourceName: string | null, sourceUrl: string | null) {
  const haystack = `${sourceName || ""} ${sourceUrl || ""}`.toLowerCase();
  return OFFICIAL_SOURCE_HINTS.some((hint) => haystack.includes(hint));
}

function computeImportance(item: Pick<ApiItem, "title" | "summary" | "publishedAt" | "source" | "official" | "category">) {
  let score = 10;
  const text = `${item.title} ${item.summary || ""}`.toLowerCase();

  if (item.official) score += 25;
  if (/(sanction|embargo|ban|urgent|alerte|critical|warning)/i.test(text)) score += 30;
  if (/(douane|customs|tariff|duty|tax|cbam|vat|tva)/i.test(text)) score += 15;
  if (item.category && ["sanctions", "douane", "taxes"].includes(normalizeTag(item.category))) score += 10;

  const publishedAt = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  if (publishedAt > 0) {
    const ageDays = Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60 * 24));
    if (ageDays <= 2) score += 15;
    else if (ageDays <= 7) score += 8;
    else if (ageDays <= 30) score += 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function actionHintForCategory(category: string | null) {
  const key = normalizeTag(category || "");
  if (key === "sanctions") return "Verifier immediatement screening pays/parties avant engagement.";
  if (key === "douane" || key === "taxes") return "Mettre a jour droits/TVA et documents douaniers.";
  if (key === "documents") return "Controler facture, packing list et preuve d'origine avant expedition.";
  if (key === "logistics") return "Valider route transport, delais et surcharges pour l'incoterm retenu.";
  return "Evaluer l'impact sur vos flux et ajuster votre check-list import/export.";
}

function applyItemFilters(items: ApiItem[], filter: FeedFilter) {
  const fromTs = filter.from ? new Date(filter.from).getTime() : null;
  const toTs = filter.to ? new Date(filter.to).getTime() : null;
  const topic = filter.topic ? normalizeTag(filter.topic) : null;

  return items.filter((item) => {
    if (filter.territory !== "WORLD") {
      const itemTerritory = normalizeTerritory(item.territory || item.zone || "");
      if (itemTerritory !== filter.territory) return false;
    }

    if (filter.officialOnly && !item.official) return false;

    if (topic) {
      const categoryTag = item.category ? normalizeTag(item.category) : "";
      const tags = item.tags.map(normalizeTag);
      const inTags = tags.includes(topic) || categoryTag === topic;
      if (!inTags) return false;
    }

    if (fromTs || toTs) {
      const publishedTs = item.publishedAt ? new Date(item.publishedAt).getTime() : null;
      if (!publishedTs || Number.isNaN(publishedTs)) return false;
      if (fromTs && publishedTs < fromTs) return false;
      if (toTs && publishedTs > toTs) return false;
    }

    return true;
  });
}

function dedupeSources(sources: RssSource[]) {
  const map = new Map<string, RssSource>();
  for (const source of sources) {
    if (!source?.url) continue;
    const key = source.url.trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, source);
  }
  return Array.from(map.values());
}

function countryNewsSource(territory: string): RssSource | null {
  if (!territory || territory === "WORLD") return null;
  const label = territoryLabel(territory);
  const query = `${label} export douane commerce international`;
  return {
    name: `Google News ${label}`,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`,
  };
}

function buildSourcesForTerritory(territory: string) {
  const countrySource = countryNewsSource(territory);
  const countrySpecific = territory === "WORLD" ? [] : (COUNTRY_SOURCES[territory] || []);
  const worldExtras = territory === "WORLD" ? WORLD_SOURCES : [];
  const combined = [
    ...PERMANENT_SOURCES,
    ...(countrySource ? [countrySource] : []),
    ...countrySpecific,
    ...worldExtras,
  ];
  return dedupeSources(combined);
}

function toUtcDate(value?: string | null) {
  try {
    if (!value) return new Date().toUTCString();
    const dt = new Date(value);
    if (isNaN(dt.getTime())) return new Date().toUTCString();
    return dt.toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

function stripHtml(html: string) {
  const plain = (html || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return decodeHtmlEntities(plain);
}

function extractTag(block: string, tag: string) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractAttr(block: string, tag: string, attr: string) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*\\/?>(?:<\\/${tag}>)?`, "i");
  const m = block.match(re);
  return decodeHtmlEntities(m?.[1]?.trim() || "");
}

function extractFirstImgSrc(html: string) {
  const m = (html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return decodeHtmlEntities(m?.[1]?.trim() || "");
}

function normalizeLink(link: string) {
  const l = decodeHtmlEntities(link || "").trim();
  if (!l) return "";
  return l.replace(/\s+/g, "");
}

function normalizeImageUrl(raw: string | null | undefined) {
  const value = decodeHtmlEntities(String(raw || "")).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return null;
}

function isAtom(xml: string) {
  return /<feed[\s>]/i.test(xml) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml);
}

function parseRssItems(xml: string) {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const b of blocks.slice(0, 50)) {
    const titleRaw = extractTag(b, "title");
    const linkRaw = extractTag(b, "link") || extractTag(b, "guid");
    const descRaw = extractTag(b, "description") || extractTag(b, "content:encoded");
    const pubRaw = extractTag(b, "pubDate") || extractTag(b, "dc:date");

    const mediaImg =
      extractAttr(b, "media:content", "url") ||
      extractAttr(b, "media:thumbnail", "url") ||
      extractAttr(b, "enclosure", "url");

    const imgFromDesc = extractFirstImgSrc(descRaw);

    const title = stripHtml(titleRaw) || "Sans titre";
    const link = normalizeLink(stripHtml(linkRaw)) || "";
    if (!link) continue;

    const summary = descRaw ? truncate(stripHtml(descRaw), 320) : null;
    const publishedAt = toIsoDate(stripHtml(pubRaw)) || null;

    items.push({
      title,
      link,
      description: summary,
      pubDate: publishedAt,
      imageUrl: normalizeImageUrl(mediaImg || imgFromDesc || null),
    });
  }

  return items;
}

function parseAtomItems(xml: string) {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const b of blocks.slice(0, 50)) {
    const titleRaw = extractTag(b, "title");
    const summaryRaw = extractTag(b, "summary") || extractTag(b, "content");
    const pubRaw = extractTag(b, "updated") || extractTag(b, "published");
    const linkHref = extractAttr(b, "link", "href");

    const mediaImg =
      extractAttr(b, "media:content", "url") ||
      extractAttr(b, "media:thumbnail", "url") ||
      extractAttr(b, "enclosure", "url");

    const imgFromSummary = extractFirstImgSrc(summaryRaw);

    const title = stripHtml(titleRaw) || "Sans titre";
    const link = normalizeLink(linkHref) || "";
    if (!link) continue;

    const summary = summaryRaw ? truncate(stripHtml(summaryRaw), 320) : null;
    const publishedAt = toIsoDate(stripHtml(pubRaw)) || null;

    items.push({
      title,
      link,
      description: summary,
      pubDate: publishedAt,
      imageUrl: normalizeImageUrl(mediaImg || imgFromSummary || null),
    });
  }

  return items;
}

function sortByPublishedDesc(items: ApiItem[]) {
  items.sort((a, b) => {
    const ad = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bd = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bd - ad;
  });
  return items;
}

async function fetchExternalItems(sources: RssSource[], limit: number, territory: string) {
  const controller = createAbortController();
  const timeout = setTimeout(() => controller?.abort?.(), 12_000);

  try {
    const fetched = await Promise.all(
      sources.map(async (src) => {
        try {
          const res = await fetch(src.url, {
            method: "GET",
            headers: {
              Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
              "User-Agent": RSS_USER_AGENT,
              "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            },
            signal: controller?.signal,
            redirect: "follow",
          });
          const text = await res.text();
          if (!res.ok || !text) return { items: [] as ApiItem[], failed: true };
          const parsed = isAtom(text) ? parseAtomItems(text) : parseRssItems(text);
          const zoneValue = territory === "WORLD" ? null : territory;
          const official = isOfficialSource(src.name, src.url);
          return {
            failed: false,
            items: parsed.map((it) => ({
              ...(inferCategoryAndTags(`${it.title} ${it.description || ""}`, src.name, null)),
              title: it.title,
              link: it.link,
              summary: it.description ?? null,
              publishedAt: it.pubDate ?? null,
              source: src.name,
              zone: zoneValue,
              territory: zoneValue,
              official,
              importance: 0,
              imageUrl: it.imageUrl ?? null,
              why_relevant: it.description ? truncate(stripHtml(it.description), 220) : null,
              action_required: null,
            })) as ApiItem[],
          };
        } catch {
          return { items: [] as ApiItem[], failed: true };
        }
      })
    );

    const flat = fetched.flatMap((result) => result.items);
    const dedup = new Map<string, ApiItem>();
    for (const it of flat) if (!dedup.has(it.link)) dedup.set(it.link, it);

    const items = sortByPublishedDesc(Array.from(dedup.values())).slice(0, limit);
    const failedCount = fetched.reduce((acc, result) => acc + (result.failed ? 1 : 0), 0);
    return { items, failedCount };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRssXml(params: { title: string; link: string; description: string; items: FeedItem[] }) {
  const now = new Date().toUTCString();
  const itemsXml = params.items
    .map((it) => {
      const pubDate = toUtcDate(it.pubDate || null);
      const enclosure = it.imageUrl ? `<enclosure url="${escapeXml(it.imageUrl)}" type="image/jpeg" />` : "";
      return `
      <item>
        <title>${escapeXml(it.title)}</title>
        <link>${escapeXml(it.link)}</link>
        <guid isPermaLink="true">${escapeXml(it.link)}</guid>
        <pubDate>${escapeXml(pubDate)}</pubDate>
        ${it.source ? `<source>${escapeXml(it.source)}</source>` : ""}
        ${enclosure}
        ${it.description ? `<description>${escapeXml(it.description)}</description>` : ""}
      </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(params.title)}</title>
    <link>${escapeXml(params.link)}</link>
    <description>${escapeXml(params.description)}</description>
    <language>fr-FR</language>
    <lastBuildDate>${escapeXml(now)}</lastBuildDate>
    <pubDate>${escapeXml(now)}</pubDate>
    ${itemsXml}
  </channel>
</rss>`;
}

function mapRowToItem(row: any): ApiItem | null {
  if (!row) return null;

  const feed = Array.isArray(row.regulatory_feeds) ? row.regulatory_feeds[0] : row.regulatory_feeds;
  const feedEnabled = feed?.enabled ?? feed?.is_enabled;
  const feedPublic = feed?.is_public;
  if (feedEnabled === false || feedPublic === false) return null;

  const link = normalizeLink(String(row.link || ""));
  if (!link) return null;

  const title = decodeHtmlEntities(String(row.title || "").trim()) || "Sans titre";
  const summaryRaw = row.summary ? decodeHtmlEntities(String(row.summary || "")) : "";
  const summary = summaryRaw ? truncate(summaryRaw, 320) : null;
  const publishedAt = toIsoDate(row.published_at) || toIsoDate(row.created_at);

  const sourceRaw = decodeHtmlEntities(String(feed?.source_name || feed?.name || row.source || "").trim());
  const source = sourceRaw || null;
  const zone = (row.territory || feed?.territory || null) as string | null;
  const territory = zone;
  const categoryRaw = decodeHtmlEntities(String(row.category || feed?.category || "").trim());
  const category = categoryRaw || null;
  const tags = Array.isArray(row.tags) ? row.tags : Array.isArray(feed?.tags) ? feed.tags : [];
  const official = isOfficialSource(source, feed?.source_url || null);
  const inferred = inferCategoryAndTags(`${title} ${summary || ""}`, source, category);

  const imageUrl = normalizeImageUrl(row.image_url || row.imageUrl || feed?.logo_url || null);
  const whyRelevantRaw = decodeHtmlEntities(String(row.why_relevant || "").trim());
  const whyRelevant = whyRelevantRaw || summary || null;
  const actionRequiredRaw = decodeHtmlEntities(String(row.action_required || "").trim());
  const actionRequired = actionRequiredRaw || actionHintForCategory(category || inferred.category);
  return {
    title,
    link,
    summary,
    publishedAt,
    source,
    zone,
    territory,
    category: category || inferred.category,
    tags: Array.from(
      new Set([
        ...tags
          .map((tag: unknown) => decodeHtmlEntities(String(tag || "")).trim())
          .filter(Boolean),
        ...inferred.tags,
      ])
    ),
    official,
    importance: 0,
    imageUrl,
    why_relevant: whyRelevant,
    action_required: actionRequired,
  };
}

function parseLimit(req: VercelRequest) {
  const n = Number(req.query?.limit);
  if (!Number.isFinite(n)) return 12;
  return Math.min(Math.max(Math.trunc(n), 1), 50);
}

function parseFilters(req: VercelRequest): FeedFilter {
  const territory = normalizeTerritory(String(req.query?.territory || req.query?.zone || "").trim());
  const topic = parseTopic(req.query?.topic || req.query?.category);
  const from = parseIsoDateOrNull(req.query?.from || req.query?.date_from);
  const to = parseIsoDateOrNull(req.query?.to || req.query?.date_to);
  const officialOnly = parseBoolLike(req.query?.official, true);

  return { territory, topic, from, to, officialOnly };
}

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function inferTierFromIso2(territory: string): { tier: PackTier; isEu: boolean; isOecd: boolean } {
  const isEu = EU_ISO2.has(territory);
  const isOecd = OECD_ISO2.has(territory);
  if (territory === "FR" || isEu) return { tier: "base", isEu, isOecd };
  if (isOecd) return { tier: "free_oecd", isEu, isOecd };
  return { tier: "paid_non_oecd", isEu, isOecd };
}

async function resolveTerritoryAccess(params: {
  req: VercelRequest;
  territory: string;
  adminClient: any | null;
}): Promise<TerritoryAccess> {
  const territory = normalizeTerritory(params.territory);
  const countryLabel = territoryLabel(territory);

  if (territory === "WORLD") {
    return {
      territory,
      tier: "base",
      isEu: false,
      isOecd: false,
      entitled: true,
      locked: false,
      priceMonthly: null,
      priceYearly: null,
      countryLabel,
    };
  }

  let territoryRow: any = null;
  if (params.adminClient) {
    try {
      const { data } = await params.adminClient
        .from("territories")
        .select("iso2,name,name_fr,name_en,is_eu,is_oecd,pack_tier,pack_price_monthly,pack_price_yearly")
        .eq("iso2", territory)
        .maybeSingle();
      territoryRow = data || null;
    } catch {
      territoryRow = null;
    }
  }

  const fallback = inferTierFromIso2(territory);
  const tier = (["base", "free_oecd", "paid_non_oecd"].includes(String(territoryRow?.pack_tier || ""))
    ? territoryRow.pack_tier
    : fallback.tier) as PackTier;
  const isEu = typeof territoryRow?.is_eu === "boolean" ? territoryRow.is_eu : fallback.isEu;
  const isOecd = typeof territoryRow?.is_oecd === "boolean" ? territoryRow.is_oecd : fallback.isOecd;
  const priceMonthly =
    typeof territoryRow?.pack_price_monthly === "number"
      ? territoryRow.pack_price_monthly
      : tier === "paid_non_oecd"
      ? 1900
      : null;
  const priceYearly =
    typeof territoryRow?.pack_price_yearly === "number"
      ? territoryRow.pack_price_yearly
      : tier === "paid_non_oecd"
      ? 19000
      : null;

  if (tier !== "paid_non_oecd") {
    return {
      territory,
      tier,
      isEu,
      isOecd,
      entitled: true,
      locked: false,
      priceMonthly,
      priceYearly,
      countryLabel,
    };
  }

  const token = getBearerToken(params.req);
  if (!token || !params.adminClient) {
    return {
      territory,
      tier,
      isEu,
      isOecd,
      entitled: false,
      locked: true,
      priceMonthly,
      priceYearly,
      countryLabel,
    };
  }

  const { data: userData, error: userError } = await params.adminClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return {
      territory,
      tier,
      isEu,
      isOecd,
      entitled: false,
      locked: true,
      priceMonthly,
      priceYearly,
      countryLabel,
    };
  }

  const nowIso = new Date().toISOString();
  let entitlement: any = null;
  try {
    const { data } = await params.adminClient
      .from("user_entitlements")
      .select("id,active,expires_at")
      .eq("user_id", userData.user.id)
      .eq("country_iso2", territory)
      .eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .limit(1)
      .maybeSingle();
    entitlement = data || null;
  } catch {
    entitlement = null;
  }

  const entitled = Boolean(entitlement?.id);
  return {
    territory,
    tier,
    isEu,
    isOecd,
    entitled,
    locked: !entitled,
    priceMonthly,
    priceYearly,
    countryLabel,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return;

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    // Proxy mode to bypass CORS for known RSS sources
    const proxyUrl = String(req.query?.url || "").trim();
    if (proxyUrl) {
      if (!isAllowedProxyUrl(proxyUrl)) {
        res.status(400).json({ ok: false, error: "URL not allowed" });
        return;
      }

      const controller = createAbortController();
      const timeout = setTimeout(() => controller?.abort?.(), 12_000);
      try {
        const upstream = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            "User-Agent": RSS_USER_AGENT,
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          },
          signal: controller?.signal,
          redirect: "follow",
        });
        const text = await upstream.text();
        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.status(upstream.ok ? 200 : 502).send(text);
        return;
      } catch (err: any) {
        res.status(502).json({ ok: false, error: err?.message || "fetch failed" });
        return;
      } finally {
        clearTimeout(timeout);
      }
    }

    const baseUrl = buildBaseUrl(req);
    const format = String(req.query?.format || "").toLowerCase();
    const accept = String(req.headers.accept || "").toLowerCase();
    const wantsXml = format === "xml" || accept.includes("application/rss+xml") || accept.includes("application/xml");

    const limit = parseLimit(req);
    const queryLimit = Math.min(limit * 4, 120);
    const filters = parseFilters(req);
    const sourcePlan = buildSourcesForTerritory(filters.territory);

    let dbItems: ApiItem[] = [];
    let items: ApiItem[] = [];
    let updatedAt: string | null = null;
    let degraded = false;
    let adminClient: any | null = null;

    try {
      const { supabaseAdmin } = await import("../src/server/supabaseAdmin.js");
      adminClient = supabaseAdmin();

      let q = adminClient
        .from("regulatory_items")
        .select("id,title,summary,link,published_at,category,territory,tags,image_url,why_relevant,action_required,created_at, regulatory_feeds(name,source_name,source_url,logo_url,enabled,is_public,territory,category,tags)")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(queryLimit);

      if (filters.territory !== "WORLD") q = q.eq("territory", filters.territory);

      const { data, error } = await q;

      if (error) {
        console.error("[api/rss] supabase error:", error.message);
      }

      const mapped = (data || []).map(mapRowToItem).filter(Boolean) as ApiItem[];

      const dedup = new Map<string, ApiItem>();
      for (const it of mapped) if (!dedup.has(it.link)) dedup.set(it.link, it);

      dbItems = sortByPublishedDesc(Array.from(dedup.values())).slice(0, queryLimit);
    } catch (err: any) {
      degraded = true;
      console.error("[api/rss] supabase init error:", err?.message || String(err));
    }

    let external = await fetchExternalItems(sourcePlan, queryLimit, filters.territory);
    if (!external.items.length && filters.territory !== "WORLD") {
      const worldFallback = await fetchExternalItems(buildSourcesForTerritory("WORLD"), queryLimit, "WORLD");
      if (worldFallback.items.length) {
        external = worldFallback;
        degraded = true;
      }
    }

    if (external.failedCount > 0) {
      degraded = true;
    }

    const merged = new Map<string, ApiItem>();
    for (const it of dbItems) {
      if (!merged.has(it.link)) merged.set(it.link, it);
    }
    for (const it of external.items) {
      if (!merged.has(it.link)) merged.set(it.link, it);
    }

    const enriched = Array.from(merged.values()).map((item) => {
      const inferred = inferCategoryAndTags(`${item.title} ${item.summary || ""}`, item.source, item.category);
      const territory = item.territory || item.zone || null;
      const official = item.official || isOfficialSource(item.source, item.link);
      const effectiveCategory = item.category || inferred.category;
      const mergedItem: ApiItem = {
        ...item,
        category: effectiveCategory,
        tags: Array.from(new Set([...(item.tags || []), ...inferred.tags])).slice(0, 10),
        territory,
        zone: territory,
        official,
        importance: 0,
        why_relevant: item.why_relevant || item.summary || null,
        action_required: item.action_required || actionHintForCategory(effectiveCategory),
      };
      return {
        ...mergedItem,
        importance: computeImportance(mergedItem),
      };
    });

    let filteredItems = applyItemFilters(sortByPublishedDesc(enriched), filters);
    let officialFallbackUsed = false;
    if (!filteredItems.length && filters.territory !== "WORLD" && filters.officialOnly) {
      filteredItems = applyItemFilters(sortByPublishedDesc(enriched), {
        ...filters,
        officialOnly: false,
      });
      officialFallbackUsed = true;
      degraded = true;
    }

    items = filteredItems.slice(0, limit);
    updatedAt = items[0]?.publishedAt || null;
    const access = await resolveTerritoryAccess({
      req,
      territory: filters.territory,
      adminClient,
    });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    if (wantsXml) {
      const xml = buildRssXml({
        title: "ExportFranceFacile - Veille Export (RSS)",
        link: `${baseUrl}/veille`,
        description: "Mises a jour, signaux faibles, conformite et points de vigilance export.",
        items: items.map((it) => ({
          title: it.title,
          link: it.link,
          description: it.summary,
          pubDate: it.publishedAt,
          source: it.source,
          imageUrl: it.imageUrl,
        })),
      });

      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.status(200).send(xml);
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (access.locked) {
      const previewItems = items.slice(0, Math.min(items.length, 6));
      res.status(200).json({
        ok: true,
        degraded: true,
        locked: true,
        territory: filters.territory,
        topic: filters.topic,
        from: filters.from,
        to: filters.to,
        official_only: filters.officialOnly,
        official_fallback_used: officialFallbackUsed,
        updatedAt,
        items: previewItems,
        preview_items: previewItems,
        pack: {
          tier: access.tier,
          is_eu: access.isEu,
          is_oecd: access.isOecd,
          country_iso2: access.territory,
          country_label: access.countryLabel,
          entitled: access.entitled,
        },
        unlock: {
          price: access.priceMonthly,
          price_monthly: access.priceMonthly,
          price_yearly: access.priceYearly,
          benefits: [
            `Veille detaillee pour ${access.countryLabel}`,
            "Alertes pays + produit (priorisation impact)",
            "Historique des changements reglementaires",
          ],
          cta_url: "/pricing#country-packs",
        },
        sources: sourcePlan.map((source) => source.name),
        pinned: PERMANENT_SOURCES.map((source) => source.name),
      });
      return;
    }

    res.status(200).json({
      ok: true,
      degraded,
      locked: false,
      territory: filters.territory,
      topic: filters.topic,
      from: filters.from,
      to: filters.to,
      official_only: filters.officialOnly,
      official_fallback_used: officialFallbackUsed,
      updatedAt,
      items,
      pack: {
        tier: access.tier,
        is_eu: access.isEu,
        is_oecd: access.isOecd,
        country_iso2: access.territory,
        country_label: access.countryLabel,
        entitled: access.entitled,
      },
      sources: sourcePlan.map((source) => source.name),
      pinned: PERMANENT_SOURCES.map((source) => source.name),
    });
  } catch (err: any) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({
      ok: true,
      degraded: true,
      updatedAt: null,
      items: [],
    });
  }
}

export const config = { runtime: "nodejs" };

