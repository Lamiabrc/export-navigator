import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

import { supabaseAdmin } from "../supabaseAdmin.js";

type ParsedItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
};

type FeedRow = {
  id: string;
  name: string | null;
  source_name: string | null;
  source_url: string | null;
  kind: string | null;
  enabled: boolean | null;
  is_public: boolean | null;
  logo_url: string | null;
  category: string | null;
  territory: string | null;
  tags: string[] | null;
};

type FeedResult = {
  feedId: string;
  name: string;
  status: "ok" | "skipped" | "failed";
  httpStatus: number | null;
  fetched: number;
  inserted: number;
  deduped: number;
  error?: string;
};

const TOPIC_SYNONYMS: Record<string, string[]> = {
  sanctions: ["sanction", "embargo", "ofac", "restricted"],
  douane: ["douane", "customs", "tariff", "duty"],
  taxes: ["tax", "vat", "tva", "cbam"],
  documents: ["document", "certificate", "invoice", "packing list", "origin"],
  logistics: ["transport", "shipping", "maritime", "freight", "logistics"],
  health: ["who", "health", "pandemic"],
};

function toIso(value?: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function stripHtml(html: string) {
  return (html || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text: string) {
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
  return `${t.slice(0, n - 1).trimEnd()}...`;
}

function extractTag(block: string, tag: string) {
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
  return l.replace(/\s+/g, "");
}

function normalizeTag(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => normalizeTag(String(v || ""))).filter(Boolean);
  }
  const one = normalizeTag(String(value || ""));
  return one ? [one] : [];
}

function inferTopicTags(item: ParsedItem) {
  const haystack = `${item.title} ${item.summary || ""}`.toLowerCase();
  const topics: string[] = [];

  for (const [topic, synonyms] of Object.entries(TOPIC_SYNONYMS)) {
    if (synonyms.some((synonym) => haystack.includes(synonym))) {
      topics.push(normalizeTag(topic));
    }
  }

  return Array.from(new Set(topics));
}

function inferTerritoryFromText(item: ParsedItem, fallbackTerritory: string | null) {
  if (fallbackTerritory) return fallbackTerritory;
  const haystack = `${item.title} ${item.summary || ""}`.toLowerCase();
  const known = ["FR", "DE", "ES", "IT", "BE", "NL", "US", "CA", "GB", "CH", "CN", "JP"];
  for (const code of known) {
    if (new RegExp(`\\b${code.toLowerCase()}\\b`, "i").test(haystack)) return code;
  }
  return "WORLD";
}

function itemFingerprint(item: ParsedItem) {
  const key = `${item.link}|${item.title}|${item.publishedAt ? item.publishedAt.slice(0, 10) : ""}`;
  return crypto.createHash("md5").update(key).digest("hex");
}

async function fetchTextWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "export-navigator-ingest/1.0",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

function parseRssItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const block of blocks.slice(0, 80)) {
    const titleRaw = extractTag(block, "title");
    const linkRaw = extractTag(block, "link") || extractTag(block, "guid");
    const descRaw = extractTag(block, "description") || extractTag(block, "content:encoded");
    const pubRaw = extractTag(block, "pubDate") || extractTag(block, "dc:date");

    const mediaImg =
      extractAttr(block, "media:content", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "enclosure", "url");

    const title = decodeEntities(stripHtml(titleRaw)) || "Sans titre";
    const link = normalizeLink(stripHtml(linkRaw));
    if (!link) continue;

    const summary = descRaw ? truncate(decodeEntities(stripHtml(descRaw)), 500) : null;
    const publishedAt = toIso(decodeEntities(stripHtml(pubRaw))) || null;

    items.push({
      title,
      link,
      summary,
      publishedAt,
      imageUrl: mediaImg || extractFirstImgSrc(descRaw) || null,
    });
  }

  return items;
}

function parseAtomItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const block of blocks.slice(0, 80)) {
    const titleRaw = extractTag(block, "title");
    const summaryRaw = extractTag(block, "summary") || extractTag(block, "content");
    const pubRaw = extractTag(block, "updated") || extractTag(block, "published");

    const link = normalizeLink(extractAttr(block, "link", "href"));
    if (!link) continue;

    const mediaImg =
      extractAttr(block, "media:content", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "enclosure", "url");

    const title = decodeEntities(stripHtml(titleRaw)) || "Sans titre";
    const summary = summaryRaw ? truncate(decodeEntities(stripHtml(summaryRaw)), 500) : null;
    const publishedAt = toIso(decodeEntities(stripHtml(pubRaw))) || null;

    items.push({
      title,
      link,
      summary,
      publishedAt,
      imageUrl: mediaImg || extractFirstImgSrc(summaryRaw) || null,
    });
  }

  return items;
}

function isAtom(xml: string) {
  return /<feed[\s>]/i.test(xml) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml);
}

async function createFetchLog(admin: ReturnType<typeof supabaseAdmin>, feedId: string, territory: string | null) {
  try {
    const { data } = await admin
      .from("feed_fetch_logs")
      .insert({ feed_id: feedId, status: "started", territory })
      .select("id")
      .single();
    return String(data?.id || "") || null;
  } catch {
    return null;
  }
}

async function finalizeFetchLog(
  admin: ReturnType<typeof supabaseAdmin>,
  logId: string | null,
  payload: {
    status: "ok" | "failed" | "skipped";
    httpStatus: number | null;
    fetched: number;
    inserted: number;
    deduped: number;
    error: string | null;
  },
) {
  if (!logId) return;
  try {
    await admin
      .from("feed_fetch_logs")
      .update({
        finished_at: new Date().toISOString(),
        status: payload.status,
        http_status: payload.httpStatus,
        fetched_count: payload.fetched,
        inserted_count: payload.inserted,
        deduped_count: payload.deduped,
        error: payload.error,
      })
      .eq("id", logId);
  } catch {
    // no-op
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const expected = String(process.env.CRON_SECRET || "").trim();
    if (!expected) {
      res.status(500).json({ ok: false, error: "missing_env", missing: ["CRON_SECRET"] });
      return;
    }

    const provided = String(req.headers["x-cron-secret"] || req.query?.key || "").trim();
    if (!provided || provided !== expected) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const admin = supabaseAdmin();
    const { data: feeds, error: feedError } = await admin
      .from("regulatory_feeds")
      .select("id,name,source_name,source_url,kind,enabled,is_public,logo_url,category,territory,tags")
      .eq("enabled", true)
      .neq("is_public", false)
      .order("created_at", { ascending: true });

    if (feedError) {
      res.status(500).json({ ok: false, error: "feeds_select_failed", detail: feedError.message });
      return;
    }

    const enabledFeeds = (feeds || []) as FeedRow[];
    const results: FeedResult[] = [];

    for (const feed of enabledFeeds) {
      const feedId = String(feed.id || "");
      const feedName = String(feed.source_name || feed.name || feedId);
      const feedUrl = String(feed.source_url || "").trim();
      const kind = String(feed.kind || "rss").toLowerCase();
      const feedTerritory = String(feed.territory || "").trim().toUpperCase() || null;
      const feedTags = normalizeTags(feed.tags);
      const logId = await createFetchLog(admin, feedId, feedTerritory);

      if (!feedUrl) {
        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: "missing_source_url",
        };
        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: result.error || null,
        });
        continue;
      }

      if (!(kind.includes("rss") || kind.includes("atom"))) {
        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: `kind_${kind}_not_supported`,
        };
        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: result.error || null,
        });
        continue;
      }

      try {
        const response = await fetchTextWithTimeout(feedUrl, 15000);
        if (!response.ok || !response.text) {
          const result: FeedResult = {
            feedId,
            name: feedName,
            status: "failed",
            httpStatus: response.status,
            fetched: 0,
            inserted: 0,
            deduped: 0,
            error: `fetch_${response.status}`,
          };
          results.push(result);
          await finalizeFetchLog(admin, logId, {
            status: "failed",
            httpStatus: result.httpStatus,
            fetched: 0,
            inserted: 0,
            deduped: 0,
            error: result.error || null,
          });
          continue;
        }

        const parsed = isAtom(response.text) ? parseAtomItems(response.text) : parseRssItems(response.text);
        if (!parsed.length) {
          await admin.from("regulatory_feeds").update({ last_fetched_at: new Date().toISOString() }).eq("id", feedId);
          const result: FeedResult = {
            feedId,
            name: feedName,
            status: "ok",
            httpStatus: response.status,
            fetched: 0,
            inserted: 0,
            deduped: 0,
          };
          results.push(result);
          await finalizeFetchLog(admin, logId, {
            status: "ok",
            httpStatus: response.status,
            fetched: 0,
            inserted: 0,
            deduped: 0,
            error: null,
          });
          continue;
        }

        const dedupInput = new Map<string, ParsedItem>();
        for (const item of parsed) {
          const fp = itemFingerprint(item);
          if (!dedupInput.has(fp)) dedupInput.set(fp, item);
        }
        const uniqueItems = Array.from(dedupInput.values());

        const rows = uniqueItems.map((item) => {
          const inferredTags = inferTopicTags(item);
          const tags = Array.from(new Set([...feedTags, ...inferredTags])).slice(0, 12);
          return {
            source_id: feedId,
            title: item.title,
            link: item.link,
            summary: item.summary,
            published_at: item.publishedAt,
            category: feed.category,
            territory: inferTerritoryFromText(item, feedTerritory),
            tags,
            image_url: item.imageUrl || feed.logo_url || null,
            fingerprint: itemFingerprint(item),
          };
        });

        const { data: insertedRows, error: upsertError } = await admin
          .from("regulatory_items")
          .upsert(rows, { onConflict: "source_id,fingerprint", ignoreDuplicates: true })
          .select("id");

        if (upsertError) {
          const result: FeedResult = {
            feedId,
            name: feedName,
            status: "failed",
            httpStatus: response.status,
            fetched: uniqueItems.length,
            inserted: 0,
            deduped: uniqueItems.length,
            error: upsertError.message,
          };
          results.push(result);
          await finalizeFetchLog(admin, logId, {
            status: "failed",
            httpStatus: response.status,
            fetched: result.fetched,
            inserted: 0,
            deduped: result.deduped,
            error: result.error || null,
          });
          continue;
        }

        const insertedCount = Array.isArray(insertedRows) ? insertedRows.length : 0;
        const dedupedCount = Math.max(0, uniqueItems.length - insertedCount);

        await admin.from("regulatory_feeds").update({ last_fetched_at: new Date().toISOString() }).eq("id", feedId);

        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "ok",
          httpStatus: response.status,
          fetched: uniqueItems.length,
          inserted: insertedCount,
          deduped: dedupedCount,
        };

        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "ok",
          httpStatus: result.httpStatus,
          fetched: result.fetched,
          inserted: result.inserted,
          deduped: result.deduped,
          error: null,
        });
      } catch (err: any) {
        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "failed",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: String(err?.message || "ingest_failed"),
        };
        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "failed",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: result.error || null,
        });
      }
    }

    res.status(200).json({ ok: true, feeds: enabledFeeds.length, results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "server_error", detail: String(err?.message || err) });
  }
}

export const config = { runtime: "nodejs" };
