import * as React from "react";
import { ArrowRight, ExternalLink, RefreshCw, Rss } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type HomeRssFeedProps = {
  isEn: boolean;
};

type HomeRssItem = {
  id?: string;
  title?: string;
  link?: string;
  source?: string;
  sourceName?: string;
  summary?: string | null;
  description?: string | null;
  why_relevant?: string | null;
  publishedAt?: string | null;
  pubDate?: string | null;
  imageUrl?: string | null;
};

type HomeRssApiPayload = {
  items?: HomeRssItem[];
  pinned?: string[];
};

type LinkPreview = {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
};

type LinkPreviewPayload = {
  items?: Record<string, LinkPreview>;
};

const SOURCE_PRIORITY_HINTS = [
  "moci",
  "who",
  "google alert",
  "google news",
  "ue dg trade",
  "eu sanctions",
  "douane",
];

const FALLBACK_PINNED_LABELS = [
  "Le Moci",
  "WHO News",
  "Google Alert Export",
  "UE DG Trade",
  "EU Sanctions Updates",
];

function safeExternalUrl(url?: string) {
  const raw = cleanText(url);
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(input?: string | null) {
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

function cleanText(input?: string | null) {
  return decodeHtmlEntities(input).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function safeImageUrl(url?: string | null) {
  const raw = cleanText(url);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return null;
}

function normalizeText(value?: string | null) {
  return cleanText(value).toLowerCase();
}

function sourceLabel(item: HomeRssItem) {
  return cleanText(item.sourceName || item.source || "") || "Source";
}

function sourcePriority(label: string) {
  const text = normalizeText(label);
  const index = SOURCE_PRIORITY_HINTS.findIndex((hint) => text.includes(hint));
  return index === -1 ? SOURCE_PRIORITY_HINTS.length + 1 : index;
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function formatDate(value: string | null | undefined, isEn: boolean) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(isEn ? "en-GB" : "fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function compactText(input: string, max = 180) {
  const text = cleanText(input);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}...`;
}

function previewText(item: HomeRssItem, isEn: boolean) {
  const candidate = cleanText(item.summary || item.why_relevant || item.description || "");
  if (candidate) return compactText(candidate, 190);
  return isEn
    ? "Open the article for a full summary and operational impact."
    : "Ouvrir l'article pour voir le resume complet et son impact operationnel.";
}

function RssArticlePreviewImage({ src, alt, isEn }: { src?: string | null; alt: string; isEn: boolean }) {
  const [hasError, setHasError] = React.useState(false);
  const safeSrc = !hasError ? safeImageUrl(src) : null;

  if (!safeSrc) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[11px] font-medium text-slate-500">
        {isEn ? "No preview image" : "Apercu image indisponible"}
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      className="aspect-[16/9] w-full rounded-lg border border-slate-200 object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

export function HomeRssFeed({ isEn }: HomeRssFeedProps) {
  const [items, setItems] = React.useState<HomeRssItem[]>([]);
  const [pinnedLabels, setPinnedLabels] = React.useState<string[]>(FALLBACK_PINNED_LABELS);
  const [linkPreviews, setLinkPreviews] = React.useState<Record<string, LinkPreview>>({});
  const requestedPreviewLinksRef = React.useRef<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/rss?limit=32&territory=WORLD&official=0", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(
            isEn
              ? "Live feed is temporarily unavailable. Please retry in a moment."
              : "Le fil RSS est temporairement indisponible. Reessayez dans un instant."
          );
        }

        const payload = (await response.json()) as HomeRssApiPayload;
        if (!mounted) return;

        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        const nextPinnedRaw =
          Array.isArray(payload.pinned) && payload.pinned.length ? payload.pinned : FALLBACK_PINNED_LABELS;
        const nextPinned = nextPinnedRaw.map((label) => cleanText(label)).filter(Boolean);

        setItems(nextItems);
        setLinkPreviews({});
        requestedPreviewLinksRef.current = new Set();
        setPinnedLabels(nextPinned);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const anyErr = err as { name?: string; message?: string };
        if (anyErr?.name === "AbortError") return;
        setItems([]);
        setLinkPreviews({});
        requestedPreviewLinksRef.current = new Set();
        setPinnedLabels(FALLBACK_PINNED_LABELS);
        setError(
          anyErr?.message ||
            (isEn
              ? "Unable to load the live feed right now."
              : "Impossible de charger le fil RSS en ce moment.")
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isEn, refreshTick]);

  const prioritizedItems = React.useMemo(() => {
    const dedup = new Map<string, HomeRssItem>();
    for (const item of items) {
      const link = safeExternalUrl(item.link) || cleanText(item.link);
      if (!link) continue;
      if (!dedup.has(link)) dedup.set(link, { ...item, link });
    }

    return Array.from(dedup.values())
      .sort((a, b) => {
        const sourceDiff = sourcePriority(sourceLabel(a)) - sourcePriority(sourceLabel(b));
        if (sourceDiff !== 0) return sourceDiff;
        return toTimestamp(b.publishedAt || b.pubDate) - toTimestamp(a.publishedAt || a.pubDate);
      })
      .slice(0, 9);
  }, [items]);

  React.useEffect(() => {
    const candidates = prioritizedItems
      .filter((item) => {
        const link = safeExternalUrl(item.link);
        if (!link) return false;
        if (safeImageUrl(item.imageUrl)) return false;
        if (requestedPreviewLinksRef.current.has(link)) return false;
        return !safeImageUrl(linkPreviews[link]?.imageUrl);
      })
      .map((item) => safeExternalUrl(item.link))
      .filter((value): value is string => Boolean(value))
      .slice(0, 9);

    if (!candidates.length) return;

    const controller = new AbortController();
    let mounted = true;
    for (const link of candidates) {
      requestedPreviewLinksRef.current.add(link);
    }

    const loadPreviews = async () => {
      try {
        const response = await fetch("/api/link-preview", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ urls: candidates }),
        });

        if (!response.ok) return;

        const payload = (await response.json()) as LinkPreviewPayload;
        if (!mounted) return;
        const incoming = payload?.items || {};
        if (!Object.keys(incoming).length) return;
        setLinkPreviews((prev) => ({ ...prev, ...incoming }));
      } catch (err) {
        const anyErr = err as { name?: string };
        if (anyErr?.name === "AbortError") return;
      }
    };

    loadPreviews();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [prioritizedItems, linkPreviews]);

  const hasItems = prioritizedItems.length > 0;

  return (
    <section className="w-full">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <Rss className="h-4 w-4 text-slate-700" />
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {isEn ? "Live export RSS feed" : "Fil RSS export en direct"}
              </div>
            </div>
            <p className="text-xs text-slate-600">
              {isEn
                ? "Article previews from Le Moci, WHO, Google Alert and key EU sources."
                : "Apercus d'articles issus de Le Moci, WHO, Google Alert et sources UE pertinentes."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRefreshTick((v) => v + 1)}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              {isEn ? "Refresh" : "Actualiser"}
            </Button>
            <a href="/veille" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {isEn ? "Open watch center" : "Ouvrir le centre de veille"}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {pinnedLabels.slice(0, 6).map((label) => (
            <Badge key={`home-rss-source-${label}`} variant="secondary" className="text-[11px]">
              {label}
            </Badge>
          ))}
        </div>

        <div className="mt-4">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-36 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-36 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-36 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : !hasItems ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {isEn
                ? "No article is available right now. The feed updates automatically."
                : "Aucun article disponible pour le moment. Le fil se met a jour automatiquement."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {prioritizedItems.map((item) => {
                const href = safeExternalUrl(item.link);
                const source = sourceLabel(item);
                const publishedLabel = formatDate(item.publishedAt || item.pubDate, isEn);
                const preview = href ? linkPreviews[href] : undefined;
                const title =
                  cleanText(item.title || "") ||
                  cleanText(preview?.title || "") ||
                  (isEn ? "Article" : "Article");
                const image = safeImageUrl(item.imageUrl) || safeImageUrl(preview?.imageUrl || "");
                const summaryCandidate =
                  cleanText(preview?.description || "") ||
                  cleanText(item.summary || item.why_relevant || item.description || "");
                const summary = summaryCandidate
                  ? compactText(summaryCandidate, 190)
                  : previewText(item, isEn);
                const key = String(item.id || item.link || title || Math.random().toString(36));

                return (
                  <article key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                    <RssArticlePreviewImage src={image} alt={title} isEn={isEn} />

                    <div className="mt-3 flex min-h-[66px] items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{title}</h3>
                      {href ? <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> : null}
                    </div>

                    <p className="mt-2 line-clamp-3 text-xs text-slate-600">{summary}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <Badge variant="outline" className="h-5 px-2 text-[11px]">
                        {source}
                      </Badge>
                      {publishedLabel ? <span>{publishedLabel}</span> : null}
                    </div>

                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {isEn ? "Read article" : "Lire l'article"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
