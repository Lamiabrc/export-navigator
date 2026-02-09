import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_HOSTS = new Set([
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

function isAllowedUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (allowCors(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const rawUrl = String(req.query?.url || "").trim();
  if (!rawUrl || !isAllowedUrl(rawUrl)) {
    res.status(400).json({ ok: false, error: "URL not allowed" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const upstream = await fetch(rawUrl, {
      method: "GET",
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    const text = await upstream.text();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.status(upstream.ok ? 200 : 502).send(text);
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message || "fetch failed" });
  } finally {
    clearTimeout(timeout);
  }
}

export const config = { runtime: "nodejs" };
