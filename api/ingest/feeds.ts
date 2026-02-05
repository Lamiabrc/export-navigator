import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { supabaseAdmin } from "../_supabase.js";

type ParsedItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null; // ISO
  imageUrl: string | null;
};

function toIso(value?: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return null;
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

function isAtom(xml: string) {
  return /<feed[\s>]/i.test(xml) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml);
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

    // ✅ On ne sélectionne que les champs standardisés (no schema guessing)
    const { data: feeds, error: feedError } = await admin
      .from("regulatory_feeds")
      .select("id, source_name, source_url, kind, enabled, logo_url")
      .eq("enabled", true);

    if (feedError) {
      res.status(500).json({ ok: false, error: "supabase_error", detail: feedError.message });
      return;
    }

    const enabledFeeds = feeds || [];
    const results: Array<{
      feedId: string;
      name: string;
      status: "ok" | "skipped" | "failed";
      inserted: number;
      error?: string;
    }> = [];

    for (const feed of enabledFeeds) {
      const feedId = String(feed.id);
      const feedName = String(feed.source_name || feedId);
      const feedUrl = String(feed.source_url || "").trim();
      const kindRaw = String(feed.kind || "rss").toLowerCase();
      const kind = kindRaw.includes("atom") ? "atom" : kindRaw.includes("rss") ? "rss" : kindRaw.includes("api") ? "api" : "web";
      const feedLogo = feed.logo_url || null;

      if (!feedUrl) {
        results.push({ feedId, name: feedName, status: "skipped", inserted: 0, error: "missing_source_url" });
        continue;
      }

      if (kind === "web" || kind === "api") {
        results.push({ feedId, name: feedName, status: "skipped", inserted: 0, error: `kind_${kind}_not_supported` });
        continue;
      }

      try {
        const r = await fetchTextWithTimeout(feedUrl, 12000);
        if (!r.ok || !r.text) {
          results.push({ feedId, name: feedName, status: "failed", inserted: 0, error: `fetch_${r.status}` });
          continue;
        }

        const parsed = isAtom(r.text) ? parseAtomItems(r.text) : parseRssItems(r.text);
        if (!parsed.length) {
          results.push({ feedId, name: feedName, status: "ok", inserted: 0 });
          continue;
        }

        // ✅ Schéma standard regulatory_items
        const rows = parsed.map((it) => {
          const fingerprint = crypto.createHash("md5").update(`${it.link}|${it.title}`).digest("hex");
          return {
            source_id: feedId,
            title: it.title,
            link: it.link,
            summary: it.summary,
            published_at: it.publishedAt,
            image_url: it.imageUrl || feedLogo,
            fingerprint,
          };
        });

        // ✅ nécessite contrainte unique (source_id, fingerprint)
        const { error: upsertError } = await admin
          .from("regulatory_items")
          .upsert(rows, { onConflict: "source_id,fingerprint" });

        if (upsertError) {
          results.push({ feedId, name: feedName, status: "failed", inserted: 0, error: upsertError.message });
          continue;
        }

        // Update last_fetched_at si la colonne existe (si tu l’as dans le SQL)
        await admin.from("regulatory_feeds").update({ last_fetched_at: new Date().toISOString() }).eq("id", feedId);

        results.push({ feedId, name: feedName, status: "ok", inserted: rows.length });
      } catch (err: any) {
        results.push({ feedId, name: feedName, status: "failed", inserted: 0, error: err?.message || String(err) });
      }
    }

    res.status(200).json({ ok: true, feeds: enabledFeeds.length, results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "server_error", detail: err?.message || String(err) });
  }
}

// ✅ Node runtime (crypto + fetch)
export const config = { runtime: "nodejs" };
