import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type Preview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

export const config = { runtime: "nodejs" };

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function isHttpUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// anti-SSRF simple (suffisant si tes feeds sont maîtrisés)
function isBlockedHost(host: string) {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("169.254.") ||
    h.startsWith("100.64.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h === "0.0.0.0" ||
    h === "::1"
  );
}

function pickMeta(html: string, key: { prop?: string; name?: string }) {
  const re = key.prop
    ? new RegExp(`<meta[^>]+property=["']${key.prop}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i")
    : new RegExp(`<meta[^>]+name=["']${key.name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const m = html.match(re);
  return m?.[1]?.trim() || null;
}

function pickTitleTag(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function absolutize(baseUrl: string, maybeUrl: string | null) {
  if (!maybeUrl) return null;
  try {
    const u = new URL(maybeUrl, baseUrl);
    return u.toString();
  } catch {
    return maybeUrl;
  }
}

async function fetchHtml(url: string, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": "exportfrancefacile-preview/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const ct = String(res.headers.get("content-type") || "");
    if (!ct.toLowerCase().includes("text/html")) return null;
    // limite soft (évite pages énormes)
    const text = await res.text();
    return text.slice(0, 700_000);
  } finally {
    clearTimeout(t);
  }
}

async function buildPreview(url: string): Promise<Preview> {
  const u = new URL(url);
  if (isBlockedHost(u.hostname)) {
    return { url, title: null, description: null, imageUrl: null, siteName: null };
  }

  const html = await fetchHtml(url);
  if (!html) return { url, title: null, description: null, imageUrl: null, siteName: null };

  const ogTitle = pickMeta(html, { prop: "og:title" });
  const twTitle = pickMeta(html, { name: "twitter:title" });
  const title = ogTitle || twTitle || pickTitleTag(html);

  const ogDesc = pickMeta(html, { prop: "og:description" });
  const desc = ogDesc || pickMeta(html, { name: "description" }) || pickMeta(html, { name: "twitter:description" });

  const ogImage = pickMeta(html, { prop: "og:image" });
  const twImage = pickMeta(html, { name: "twitter:image" }) || pickMeta(html, { prop: "twitter:image" });
  const imageUrl = absolutize(url, ogImage || twImage);

  const siteName = pickMeta(html, { prop: "og:site_name" }) || u.hostname.replace(/^www\./, "");

  return {
    url,
    title: title ? title.slice(0, 180) : null,
    description: desc ? desc.slice(0, 280) : null,
    imageUrl: imageUrl ? imageUrl.slice(0, 900) : null,
    siteName,
  };
}

type LinkPreviewRequest = {
  urls?: unknown;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const body = await readJson<LinkPreviewRequest>(req);
    const rawUrls = Array.isArray(body?.urls) ? (body.urls as unknown[]) : [];
    const urls: string[] = rawUrls.map((x) => String(x ?? "").trim()).filter((x) => x.length > 0);
    const clean = Array.from(new Set(urls)).filter(isHttpUrl).slice(0, 30);

    if (!clean.length) {
      res.status(200).json({ ok: true, items: {} });
      return;
    }

    const admin = supabaseAdmin();
    const hashes = clean.map((u) => sha256(u));

    // TTL cache: 7 jours
    const ttlMs = 7 * 24 * 60 * 60 * 1000;
    const cutoffMs = Date.now() - ttlMs;

    const { data: cached } = await admin
      .from("link_previews")
      .select("url,url_hash,title,description,image_url,site_name,updated_at")
      .in("url_hash", hashes);

    const cachedMap = new Map<string, any>();
    for (const row of cached || []) cachedMap.set(row.url_hash, row);

    const need: string[] = [];
    for (let i = 0; i < clean.length; i++) {
      const h = hashes[i];
      const c = cachedMap.get(h);
      const updatedMs = c?.updated_at ? Date.parse(c.updated_at) : 0;
      if (!c || !updatedMs || updatedMs < cutoffMs) need.push(clean[i]);
    }

    const fetched = await Promise.all(need.map((u) => buildPreview(u)));

    if (fetched.length) {
      const upserts = fetched.map((p) => {
        const cachedRow = cachedMap.get(sha256(p.url));
        return {
          url: p.url,
          url_hash: sha256(p.url),
          title: p.title ?? cachedRow?.title ?? null,
          description: p.description ?? cachedRow?.description ?? null,
          image_url: p.imageUrl ?? cachedRow?.image_url ?? null,
          site_name: p.siteName ?? cachedRow?.site_name ?? null,
          fetched_at: new Date().toISOString(),
        };
      });

      await admin.from("link_previews").upsert(upserts, { onConflict: "url_hash" });
    }

    // réponse finale
    const out: Record<string, any> = {};
    for (const u of clean) {
      const h = sha256(u);
      const c = cachedMap.get(h);
      const f = fetched.find((x) => x.url === u);

      const title = f?.title ?? c?.title ?? null;
      const description = f?.description ?? c?.description ?? null;
      const imageUrl = f?.imageUrl ?? c?.image_url ?? null;
      const siteName = f?.siteName ?? c?.site_name ?? null;

      out[u] = { title, description, imageUrl, siteName };
    }

    res.status(200).json({ ok: true, items: out });
  } catch (e: any) {
    res.status(200).json({ ok: true, degraded: true, items: {} });
  }
}
