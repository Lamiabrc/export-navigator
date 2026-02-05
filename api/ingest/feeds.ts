import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { supabaseAdmin } from "../_supabase.js";

type ParsedItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
};

function toIso(value?: string | null) {
  if (!value) return null;
  try {
    const dt = new Date(value);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString();
  } catch {
    return null;
  }
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
  return t.slice(0, n - 1).trimEnd() + "…";
}

function extractTag(block: string, tag: string) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractAttr(block: string, tag: string, attr: string) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*\\/?>(?:<\\/${tag}>)?`, "i");
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

async function fetchTextWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "exportfrancefacile-ingest/1.0" },
    });
    const txt = await res.text();
    return { ok: res.ok, status: res.status, text: txt };
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "exportfrancefacile-ingest/1.0" },
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function parseRssItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
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

    const title = decodeEntities(stripHtml(titleRaw)) || "Sans titre";
    const link = normalizeLink(stripHtml(linkRaw)) || "";
    if (!link) continue;

    const summary = descRaw ? truncate(decodeEntities(stripHtml(descRaw)), 400) : null;
    const publishedAt = toIso(decodeEntities(stripHtml(pubRaw))) || null;

    items.push({
      title,
      link,
      summary,
      publishedAt,
      imageUrl: mediaImg || imgFromDesc || null,
    });
  }
  return items;
}

function parseAtomItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const b of blocks.slice(0, 50)) {
    const titleRaw = extractTag(b, "title");
    const summaryRaw = extractTag(b, "summary") || extractTag(b, "content");
    const pubRaw = extractTag(b, "updated") || extractTag(b, "published");

    const linkHref = extractAttr(b, "link", "href");
    const link = normalizeLink(linkHref) || "";
    if (!link) continue;

    const mediaImg =
      extractAttr(b, "media:content", "url") ||
      extractAttr(b, "media:thumbnail", "url") ||
      extractAttr(b, "enclosure", "url");

    const imgFromSummary = extractFirstImgSrc(summaryRaw);

    const title = decodeEntities(stripHtml(titleRaw)) || "Sans titre";
    const summary = summaryRaw ? truncate(decodeEntities(stripHtml(summaryRaw)), 400) : null;
    const publishedAt = toIso(decodeEntities(stripHtml(pubRaw))) || null;

    items.push({
      title,
      link,
      summary,
      publishedAt,
      imageUrl: mediaImg || imgFromSummary || null,
    });
  }

  return items;
}

function parseJsonItems(payload: any): ParsedItem[] {
  if (!payload) return [];
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.results)
          ? payload.results
          : [];

  return list
    .map((it: any) => {
      const title = String(it?.title || it?.name || "").trim();
      const link = String(it?.link || it?.url || it?.href || "").trim();
      if (!title || !link) return null;

      return {
        title,
        link,
        summary: it?.summary || it?.description || null,
        publishedAt: toIso(it?.published_at || it?.publishedAt || it?.date || it?.updated_at) || null,
        imageUrl: it?.image || it?.image_url || it?.imageUrl || null,
      } as ParsedItem;
    })
    .filter(Boolean) as ParsedItem[];
}

async function getColumns(tableName: string) {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    if (error || !data) return new Set<string>();
    return new Set<string>(data.map((d: any) => d.column_name));
  } catch {
    return new Set<string>();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const expected = process.env.CRON_SECRET;
    if (!expected) {
      res.status(500).json({ ok: false, error: "missing_env", missing: ["CRON_SECRET"] });
      return;
    }

    const provided = String(req.headers["x-cron-secret"] || "");
    if (provided !== expected) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const admin = supabaseAdmin();
    const feedColumns = await getColumns("regulatory_feeds");
    const itemColumns = await getColumns("regulatory_items");

    const feedUrlKey = feedColumns.size
      ? feedColumns.has("source_url")
        ? "source_url"
        : "url"
      : "source_url";
    const feedKindKey = feedColumns.has("kind")
      ? "kind"
      : feedColumns.has("format")
        ? "format"
        : feedColumns.has("type")
          ? "type"
          : "kind";
    const feedEnabledKey = feedColumns.size
      ? feedColumns.has("enabled")
        ? "enabled"
        : feedColumns.has("is_enabled")
          ? "is_enabled"
          : "enabled"
      : "enabled";

    const itemFeedKey = itemColumns.has("feed_id") ? "feed_id" : itemColumns.has("source_id") ? "source_id" : "feed_id";
    const itemUrlKey = itemColumns.has("url") ? "url" : itemColumns.has("link") ? "link" : "url";
    const itemImageKey = itemColumns.has("image_url") ? "image_url" : itemColumns.has("image") ? "image" : null;
    const itemFingerprintKey = itemColumns.has("fingerprint") ? "fingerprint" : itemColumns.has("hash") ? "hash" : null;

    const { data: feeds, error: feedError } = await admin.from("regulatory_feeds").select("*");
    if (feedError) {
      res.status(500).json({ ok: false, error: "supabase_error", detail: feedError.message });
      return;
    }

    const enabledFeeds = (feeds || []).filter((f: any) => {
      const enabled = f?.[feedEnabledKey];
      return enabled !== false;
    });

    const results: Array<{ feedId: string; name: string; status: string; inserted: number; skipped: number; error?: string }> = [];

    for (const feed of enabledFeeds) {
      const feedId = feed.id as string;
      const feedName = String(feed.name || feed.source_name || feedId);
      const feedUrl = String(feed?.[feedUrlKey] || "").trim();

      if (!feedUrl) {
        results.push({ feedId, name: feedName, status: "skipped", inserted: 0, skipped: 0, error: "missing_url" });
        console.log(`[ingest] skip ${feedName}: missing_url`);
        continue;
      }

      const kindRaw = String(feed?.[feedKindKey] || "rss").toLowerCase();
      const kind = kindRaw.includes("api") ? "api" : kindRaw.includes("web") ? "web" : "rss";
      const feedLogo = feed?.logo_url || null;

      if (kind === "web") {
        results.push({ feedId, name: feedName, status: "skipped", inserted: 0, skipped: 0, error: "kind_web_not_supported" });
        console.log(`[ingest] skip ${feedName}: kind=web`);
        continue;
      }

      try {
        let parsed: ParsedItem[] = [];
        if (kind === "api") {
          const r = await fetchJsonWithTimeout(feedUrl, 10000);
          if (!r.ok || !r.json) {
            results.push({ feedId, name: feedName, status: "failed", inserted: 0, skipped: 0, error: `fetch_json_${r.status}` });
            console.log(`[ingest] fail ${feedName}: fetch_json_${r.status}`);
            continue;
          }
          parsed = parseJsonItems(r.json);
        } else {
          const r = await fetchTextWithTimeout(feedUrl, 10000);
          if (!r.ok || !r.text) {
            results.push({ feedId, name: feedName, status: "failed", inserted: 0, skipped: 0, error: `fetch_xml_${r.status}` });
            console.log(`[ingest] fail ${feedName}: fetch_xml_${r.status}`);
            continue;
          }
          const isAtom = /<feed[\s>]/i.test(r.text) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(r.text);
          parsed = isAtom ? parseAtomItems(r.text) : parseRssItems(r.text);
        }

        if (!parsed.length) {
          results.push({ feedId, name: feedName, status: "ok", inserted: 0, skipped: 0 });
          console.log(`[ingest] ok ${feedName}: 0 item`);
          continue;
        }

        const rows = parsed.map((it) => {
          const fingerprint = crypto.createHash("md5").update(`${it.link}|${it.title}`).digest("hex");
          const row: Record<string, any> = {
            title: it.title,
            summary: it.summary,
            published_at: it.publishedAt,
            category: feed.category || null,
            zone: feed.zone || null,
          };
          row[itemFeedKey] = feedId;
          row[itemUrlKey] = it.link;

          if (itemImageKey) {
            row[itemImageKey] = it.imageUrl || feedLogo || null;
          }
          if (itemFingerprintKey) {
            row[itemFingerprintKey] = fingerprint;
          }
          return row;
        });

        const onConflict = itemFingerprintKey ? `${itemFeedKey},${itemFingerprintKey}` : undefined;
        const insertResult = onConflict
          ? await admin.from("regulatory_items").upsert(rows, { onConflict, ignoreDuplicates: true })
          : await admin.from("regulatory_items").insert(rows);

        if (insertResult.error) {
          results.push({ feedId, name: feedName, status: "failed", inserted: 0, skipped: rows.length, error: insertResult.error.message });
          console.log(`[ingest] fail ${feedName}: ${insertResult.error.message}`);
        } else {
          results.push({ feedId, name: feedName, status: "ok", inserted: rows.length, skipped: 0 });
          console.log(`[ingest] ok ${feedName}: inserted ${rows.length}`);
        }

        const updatePayload: Record<string, any> = {};
        if (feedColumns.has("last_fetched_at")) updatePayload.last_fetched_at = new Date().toISOString();
        else if (feedColumns.has("last_checked_at")) updatePayload.last_checked_at = new Date().toISOString();

        if (Object.keys(updatePayload).length) {
          await admin.from("regulatory_feeds").update(updatePayload).eq("id", feedId);
        }
      } catch (err: any) {
        results.push({ feedId, name: feedName, status: "failed", inserted: 0, skipped: 0, error: err?.message || String(err) });
        console.log(`[ingest] fail ${feedName}: ${err?.message || String(err)}`);
      }
    }

    res.status(200).json({
      ok: true,
      feeds: results.length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "server_error", detail: err?.message || String(err) });
  }
}

export const config = {
  runtime: "nodejs",
};
