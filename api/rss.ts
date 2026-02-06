import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "./_supabase.js";

type ApiItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  source: string | null;
  zone: string | null;        // sortie API (compat)
  category: string | null;
  imageUrl: string | null;
};

type FeedItem = {
  title: string;
  link: string;
  description?: string | null;
  pubDate?: string | null;
  source?: string | null;
  imageUrl?: string | null;
};

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
  return t.slice(0, n - 1).trimEnd() + "…";
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

  const link = String(row.link || "").trim();
  if (!link) return null;

  const title = String(row.title || "").trim() || "Sans titre";
  const summary = row.summary ? truncate(String(row.summary), 320) : null;
  const publishedAt = toIsoDate(row.published_at) || toIsoDate(row.created_at);

  const source = (feed?.source_name || feed?.name || row.source || null) as string | null;

  // ✅ ton schéma: territory (pas zone)
  const zone = (row.territory || feed?.territory || null) as string | null;
  const category = (row.category || feed?.category || null) as string | null;

  const imageUrl = (row.image_url || row.imageUrl || feed?.logo_url || null) as string | null;

  return { title, link, summary, publishedAt, source, zone, category, imageUrl };
}

function parseLimit(req: VercelRequest) {
  const n = Number(req.query?.limit);
  if (!Number.isFinite(n)) return 12;
  return Math.min(Math.max(Math.trunc(n), 1), 30);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return;

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const baseUrl = buildBaseUrl(req);
    const format = String(req.query?.format || "").toLowerCase();
    const accept = String(req.headers.accept || "").toLowerCase();
    const wantsXml = format === "xml" || accept.includes("application/rss+xml") || accept.includes("application/xml");

    const limit = parseLimit(req);
    const queryLimit = Math.min(limit * 2, 60);

    // filtres (optionnels)
    const categoryQ = String(req.query?.category || "").trim();
    const zoneQ = String(req.query?.zone || req.query?.territory || "").trim(); // compat

    const admin = supabaseAdmin();

    let q = admin
      .from("regulatory_items")
      .select("id,title,summary,link,published_at,category,territory,image_url,created_at, regulatory_feeds(name,source_name,source_url,logo_url,enabled,is_public,territory,category)")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(queryLimit);

    if (categoryQ) q = q.eq("category", categoryQ);
    if (zoneQ) q = q.eq("territory", zoneQ);

    const { data, error } = await q;

    if (error) {
      console.error("[api/rss] supabase error:", error.message);
    }

    const mapped = (data || []).map(mapRowToItem).filter(Boolean) as ApiItem[];

    const dedup = new Map<string, ApiItem>();
    for (const it of mapped) if (!dedup.has(it.link)) dedup.set(it.link, it);

    const items = Array.from(dedup.values()).slice(0, limit);
    const updatedAt = items[0]?.publishedAt || null;

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    if (wantsXml) {
      const xml = buildRssXml({
        title: "ExportFranceFacile — Veille Export (RSS)",
        link: `${baseUrl}/veille`,
        description: "Mises à jour, signaux faibles, conformité et points de vigilance export.",
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
    res.status(200).json({ ok: true, degraded: false, updatedAt, items });
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
