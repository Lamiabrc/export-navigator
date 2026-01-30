import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { DEFAULT_FEEDS } from "../src/lib/rss/feeds";
import { scoreImpact } from "../src/lib/rss/scoreImpact";
import type { RssFeedSource, RssItem } from "../src/lib/rss/types";

type FeedFetchResult = {
  source: RssFeedSource;
  items: RssItem[];
};

const CACHE_SECONDS = 600;
const STALE_SECONDS = 3600;
const MAX_LIMIT = 100;

function parseNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((v) => String(v).split(","));
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string) {
  return /^https?:\\/\\//i.test(value);
}

function decodeHtml(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ");
}

function normalizeText(input: string) {
  return decodeHtml(stripHtml(input)).replace(/\s+/g, " ").trim();
}

function extractTag(block: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? match[1].trim() : "";
}

function extractLink(block: string) {
  const direct = extractTag(block, "link");
  if (direct) return direct.trim();

  const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
  return hrefMatch ? hrefMatch[1].trim() : "";
}

function parseDate(raw: string) {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function buildId(sourceId: string, link: string, title: string) {
  const hash = crypto.createHash("sha1").update(`${sourceId}-${link}-${title}`).digest("hex");
  return hash;
}

function parseRssItems(xml: string, source: RssFeedSource): RssItem[] {
  const items: RssItem[] = [];
  const blocks = [
    ...(xml.match(/<item[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []),
  ];

  for (const block of blocks) {
    const titleRaw = extractTag(block, "title");
    const linkRaw = extractLink(block);
    const summaryRaw =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content:encoded") ||
      extractTag(block, "content");
    const dateRaw = extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published");

    const title = normalizeText(titleRaw || "");
    const link = normalizeText(linkRaw || "");
    const summary = normalizeText(summaryRaw || "");
    const pubDate = parseDate(dateRaw) || new Date().toISOString();

    if (!title || !link) continue;

    const impactData = scoreImpact(`${title} ${summary}`);

    items.push({
      id: buildId(source.id, link, title),
      title,
      link,
      pubDate,
      sourceName: source.name,
      sourceUrl: source.url,
      summary: summary.length > 320 ? `${summary.slice(0, 317)}...` : summary,
      impact: impactData.impact,
      reasons: impactData.reasons,
      tags: impactData.tags,
    });
  }

  return items;
}

async function fetchFeed(source: RssFeedSource): Promise<FeedFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MPL Export Conseil RSS/1.0",
        Accept: "application/rss+xml, application/atom+xml, text/xml",
      },
    });

    if (!response.ok) {
      console.error("[api/rss] feed fetch failed", source.url, response.status, response.statusText);
      return { source, items: [] };
    }

    const xml = await response.text();
    return { source, items: parseRssItems(xml, source) };
  } catch (error: any) {
    console.error("[api/rss] feed error", source.url, error?.message || error);
    return { source, items: [] };
  } finally {
    clearTimeout(timeout);
  }
}

function dedupe(items: RssItem[]) {
  const seen = new Set<string>();
  const result: RssItem[] = [];
  for (const item of items) {
    const key = item.link || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const limit = Math.min(parseNumber(req.query.limit, 60), MAX_LIMIT);
    const offset = Math.max(parseNumber(req.query.offset, 0), 0);
    const sourceIds = new Set(parseList(req.query.sources));
    const customUrls = parseList(req.query.feed)
      .filter((url) => isHttpUrl(url))
      .slice(0, 5);

    const baseSources = sourceIds.size
      ? DEFAULT_FEEDS.filter((feed) => sourceIds.has(feed.id))
      : DEFAULT_FEEDS;

    const customSources: RssFeedSource[] = customUrls.map((url, index) => ({
      id: `custom-${index + 1}`,
      name: `Feed personnalise ${index + 1}`,
      url,
    }));

    const sources = [...baseSources, ...customSources];

    const results = await Promise.all(sources.map(fetchFeed));
    const allItems = dedupe(results.flatMap((r) => r.items)).sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const paged = allItems.slice(offset, offset + limit);

    res.setHeader(
      "Cache-Control",
      `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`
    );

    return res.status(200).json({
      ok: true,
      data: {
        items: paged,
        total: allItems.length,
        sources,
      },
    });
  } catch (error: any) {
    console.error("[api/rss] handler error", error?.message || error);
    return res.status(500).json({ ok: false, error: "RSS fetch failed" });
  }
}
