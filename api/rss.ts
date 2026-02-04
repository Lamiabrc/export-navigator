import type { VercelRequest, VercelResponse } from "@vercel/node";

type FeedItem = {
  title: string;
  link: string;
  description?: string;
  pubDate?: string; // UTC string
  source?: string;
  image?: string | null;
};

type JsonItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string | null;
  image: string | null;
};

type FeedSource = { name: string; url: string };

const DEFAULT_FEEDS: FeedSource[] = [
  // ✅ Mets ici tes flux “réels” (fiables) : sanctions / trade / douane
  // (Si un flux change, tu modifies juste la liste ci-dessous)
  { name: "EU Council Press", url: "https://www.consilium.europa.eu/en/press/press-releases/rss/" },
  { name: "WTO News", url: "https://www.wto.org/english/news_e/news_e.rss" },
  { name: "UK GOV News", url: "https://www.gov.uk/government/announcements.atom" },
  { name: "US BIS News", url: "https://www.bis.doc.gov/index.php/component/obrss/bis-news" },
];

function escapeXml(input: string) {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function buildBaseUrl(req: VercelRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function seededCover(seed: string) {
  // fallback image “wow” stable sans stockage
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/960/540`;
}

function stripHtml(html: string) {
  const s = (html || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return decodeEntities(s);
}

function decodeEntities(text: string) {
  // minimal safe decode
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function truncate(s: string, n: number) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + "…";
}

function pickFirst<T>(...vals: Array<T | undefined | null>): T | null {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v as T;
  }
  return null;
}

function extractTag(block: string, tag: string) {
  // capture <tag>...</tag> with possible attrs and CDATA
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractAttr(block: string, tag: string, attr: string) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*\\/?>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractFirstImgSrc(html: string) {
  const m = (html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.trim() || "";
}

function normalizeLink(link: string) {
  const l = (link || "").trim();
  if (!l) return "";
  // some feeds put link as text + whitespace
  return l.replace(/\s+/g, "");
}

function toUtcString(d: string) {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    return dt.toUTCString();
  } catch {
    return "";
  }
}

async function fetchTextWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "exportfrancefacile-rss/1.0" },
    });
    const txt = await res.text();
    return { ok: res.ok, status: res.status, text: txt };
  } finally {
    clearTimeout(t);
  }
}

function parseRssItems(xml: string, sourceName: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const b of blocks.slice(0, 20)) {
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

    const pubDate = toUtcString(stripHtml(pubRaw)) || new Date().toUTCString();

    items.push({
      title,
      link,
      description: descRaw ? truncate(stripHtml(descRaw), 320) : undefined,
      pubDate,
      source: sourceName,
      image: pickFirst(mediaImg, imgFromDesc),
    });
  }
  return items;
}

function parseAtomItems(xml: string, sourceName: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const b of blocks.slice(0, 20)) {
    const titleRaw = extractTag(b, "title");
    const summaryRaw = extractTag(b, "summary") || extractTag(b, "content");
    const pubRaw = extractTag(b, "updated") || extractTag(b, "published");

    // atom link is often <link href="..."/>
    const linkHref = extractAttr(b, "link", "href");
    const link = normalizeLink(linkHref) || "";
    if (!link) continue;

    const mediaImg =
      extractAttr(b, "media:content", "url") ||
      extractAttr(b, "media:thumbnail", "url") ||
      extractAttr(b, "enclosure", "url");

    const imgFromSummary = extractFirstImgSrc(summaryRaw);

    const title = stripHtml(titleRaw) || "Sans titre";
    const pubDate = toUtcString(stripHtml(pubRaw)) || new Date().toUTCString();

    items.push({
      title,
      link,
      description: summaryRaw ? truncate(stripHtml(summaryRaw), 320) : undefined,
      pubDate,
      source: sourceName,
      image: pickFirst(mediaImg, imgFromSummary),
    });
  }

  return items;
}

function buildRssXml(params: { title: string; link: string; description: string; items: FeedItem[] }) {
  const now = new Date().toUTCString();
  const itemsXml = params.items
    .slice(0, 10)
    .map((it) => {
      const pubDate = it.pubDate || now;
      const enclosure = it.image ? `<enclosure url="${escapeXml(it.image)}" type="image/jpeg" />` : "";
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

/**
 * /api/rss
 * - JSON par défaut (pour ton front)
 * - format=xml => RSS XML
 * - debug=1 => JSON debug
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return;

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const baseUrl = buildBaseUrl(req);

    const format = String(req.query?.format || "").toLowerCase(); // "xml" pour RSS XML
    const debug = req.query?.debug === "1";

    // ✅ fallback interne toujours dispo
    const fallbackItems: FeedItem[] = [
      {
        title: "Veille export : sanctions & conformité — check rapide",
        link: `${baseUrl}/veille`,
        description: "Surveillez sanctions, documents et points de vigilance.",
        pubDate: new Date().toUTCString(),
        source: "ExportFranceFacile",
        image: `${baseUrl}/og/veille.png`,
      },
      {
        title: "Checklist documents export (invoice, PL, CO, transport…)",
        link: `${baseUrl}/methodologie`,
        description: "Les indispensables pour éviter les blocages.",
        pubDate: new Date(Date.now() - 86400000).toUTCString(),
        source: "ExportFranceFacile",
        image: `${baseUrl}/og/methodologie.png`,
      },
      {
        title: "Incoterms : focus DDP (risques & bonnes pratiques)",
        link: `${baseUrl}/guides/incoterms-ddp`,
        description: "Comprendre qui paye quoi, et où ça peut casser.",
        pubDate: new Date(Date.now() - 2 * 86400000).toUTCString(),
        source: "ExportFranceFacile",
        image: `${baseUrl}/og/incoterms.png`,
      },
    ];

    const feeds = DEFAULT_FEEDS;

    const errors: Array<{ feed: string; url: string; status?: number; error?: string }> = [];
    const collected: FeedItem[] = [];

    // fetch feeds (timeout 7s)
    await Promise.all(
      feeds.map(async (f) => {
        try {
          const r = await fetchTextWithTimeout(f.url, 7000);
          if (!r.ok || !r.text) {
            errors.push({ feed: f.name, url: f.url, status: r.status, error: "fetch_failed" });
            return;
          }

          const isAtom = /<feed[\s>]/i.test(r.text) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(r.text);
          const items = isAtom ? parseAtomItems(r.text, f.name) : parseRssItems(r.text, f.name);
          for (const it of items) collected.push(it);
        } catch (e: any) {
          errors.push({ feed: f.name, url: f.url, error: e?.message || "unknown_error" });
        }
      })
    );

    // merge + fallback
    const merged = [...collected, ...fallbackItems];

    // dedupe by link
    const map = new Map<string, FeedItem>();
    for (const it of merged) {
      if (!it.link) continue;
      if (!map.has(it.link)) map.set(it.link, it);
    }

    // sort by date desc
    const sorted = Array.from(map.values()).sort((a, b) => {
      const da = new Date(a.pubDate || 0).getTime();
      const db = new Date(b.pubDate || 0).getTime();
      return db - da;
    });

    // build JSON items (with images fallback if missing)
    const jsonItems: JsonItem[] = sorted.slice(0, 24).map((it, idx) => {
      const publishedAt = it.pubDate ? new Date(it.pubDate).toISOString() : null;
      const summary = it.description ? truncate(it.description, 240) : null;
      const source = it.source || "RSS";
      const image = it.image || seededCover(`${source}-${it.title}-${idx}`);
      return {
        title: it.title,
        link: it.link,
        source,
        publishedAt,
        summary,
        image,
      };
    });

    // debug JSON
    if (debug) {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.status(200).send(
        JSON.stringify(
          {
            ok: true,
            route: "/api/rss",
            format: format || "json",
            feeds: feeds.map((x) => x.name),
            fetchedItems: collected.length,
            mergedItems: sorted.length,
            errors,
            sample: jsonItems.slice(0, 3),
          },
          null,
          2
        )
      );
      return;
    }

    // XML RSS (if asked)
    if (format === "xml") {
      const xml = buildRssXml({
        title: "ExportFranceFacile — Veille Export (RSS)",
        link: `${baseUrl}/veille`,
        description: "Mises à jour, signaux faibles, conformité et points de vigilance export.",
        items: sorted,
      });

      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
      res.status(200).send(xml);
      return;
    }

    // JSON default (for front)
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json({
      ok: true,
      updatedAt: new Date().toISOString(),
      items: jsonItems,
    });
  } catch (err: any) {
    const baseUrl = buildBaseUrl(req);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({
      ok: true,
      degraded: true,
      updatedAt: new Date().toISOString(),
      items: [
        {
          title: "Flux RSS indisponible temporairement",
          link: `${baseUrl}/veille`,
          source: "ExportFranceFacile",
          publishedAt: new Date().toISOString(),
          summary: "Erreur côté serveur. Réessayez dans quelques minutes.",
          image: seededCover("degraded"),
        },
      ],
    });
  }
}
