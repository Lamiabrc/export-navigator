import type { VercelRequest, VercelResponse } from "@vercel/node";

type FeedItem = {
  title: string;
  link: string;
  description?: string;
  pubDate?: string; // UTC string
};

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

function buildRssXml(params: {
  title: string;
  link: string;
  description: string;
  items: FeedItem[];
}) {
  const now = new Date().toUTCString();

  const itemsXml = params.items
    .slice(0, 10)
    .map((it) => {
      const pubDate = it.pubDate || now;
      return `
      <item>
        <title>${escapeXml(it.title)}</title>
        <link>${escapeXml(it.link)}</link>
        <guid isPermaLink="true">${escapeXml(it.link)}</guid>
        <pubDate>${escapeXml(pubDate)}</pubDate>
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
 * - Always returns valid RSS (XML)
 * - Never crashes (hard try/catch)
 * - Optional debug via ?debug=1 (no secrets leaked)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return;

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const baseUrl = buildBaseUrl(req);

    // ✅ Fallback items (always available)
    const fallbackItems: FeedItem[] = [
      {
        title: "Veille export : sanctions & conformité — check rapide",
        link: `${baseUrl}/veille`,
        description: "Surveillez sanctions, documents et points de vigilance.",
        pubDate: new Date().toUTCString(),
      },
      {
        title: "Checklist documents export (invoice, PL, CO, transport…)",
        link: `${baseUrl}/methodologie`,
        description: "Les indispensables pour éviter les blocages.",
        pubDate: new Date(Date.now() - 86400000).toUTCString(),
      },
      {
        title: "Incoterms : focus DDP (risques & bonnes pratiques)",
        link: `${baseUrl}/guides/incoterms-ddp`,
        description: "Comprendre qui paye quoi, et où ça peut casser.",
        pubDate: new Date(Date.now() - 2 * 86400000).toUTCString(),
      },
    ];

    // ✅ Optional: if you later store watch items in Supabase, you can plug it here safely.
    // For now we avoid any mandatory Supabase dependency to prevent crashes.

    const debug = req.query?.debug === "1";
    if (debug) {
      // Helpful debug without leaking secrets:
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.status(200).send(
        JSON.stringify(
          {
            ok: true,
            route: "/api/rss",
            baseUrl,
            items: fallbackItems.length,
            note: "RSS generated from fallback items (no Supabase dependency).",
          },
          null,
          2
        )
      );
      return;
    }

    const xml = buildRssXml({
      title: "MPL Export Conseil — Veille Export (RSS)",
      link: `${baseUrl}/veille`,
      description: "Mises à jour, signaux faibles, conformité et points de vigilance export.",
      items: fallbackItems,
    });

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(xml);
  } catch (err: any) {
    // ✅ Never crash: return a minimal RSS with the error embedded (safe)
    const baseUrl = buildBaseUrl(req);
    const xml = buildRssXml({
      title: "MPL Export Conseil — Veille Export (RSS)",
      link: `${baseUrl}/veille`,
      description: "Flux temporairement dégradé.",
      items: [
        {
          title: "Flux RSS indisponible temporairement",
          link: `${baseUrl}/veille`,
          description: "Erreur côté serveur. Réessayez dans quelques minutes.",
          pubDate: new Date().toUTCString(),
        },
      ],
    });

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.status(200).send(xml);
  }
}
