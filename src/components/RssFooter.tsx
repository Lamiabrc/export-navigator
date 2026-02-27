import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ExternalLink, RefreshCw, Rss, ShieldCheck } from "lucide-react";

type RssFooterItem = {
  id?: string;
  title?: string;
  link?: string;
  sourceName?: string;
  pubDate?: string;
};

type RssMeta = {
  title?: string;
  description?: string;
  link?: string;
  lastBuildDate?: string;
};

type RssApiJsonResponse = {
  data?: { items?: Array<Record<string, unknown>> };
  items?: Array<Record<string, unknown>>;
  meta?: RssMeta;
  sources?: string[];
  pinned?: string[];
  territory?: string;
  error?: string;
  message?: string;
};

type RssFooterProps = {
  territory?: string | null;
  territoryLabel?: string | null;
  topic?: string | null;
};

const PINNED_SOURCE_LABELS = [
  "Le Moci",
  "WHO News",
  "Douane francaise",
  "UE DG Trade",
];

function safeExternalUrl(url?: string) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function safeDateLabel(pubDate?: string) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function safeDateTimeLabel(pubDate?: string) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function normalizeTerritory(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "WORLD" || raw === "GLOBAL" || raw === "ALL" || raw === "MONDE" || raw === "EU") {
    return "WORLD";
  }
  return /^[A-Z]{2}$/.test(raw) ? raw : "WORLD";
}

function normalizeTopic(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/[^a-z0-9_-]/g, "");
}

function toStringOrUndefined(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function pickItemsJson(payload: RssApiJsonResponse | null): RssFooterItem[] {
  const a = payload?.data?.items;
  const b = payload?.items;
  const items = (Array.isArray(a) ? a : Array.isArray(b) ? b : []) as Array<Record<string, unknown>>;
  return (items
    .map((it, idx) => {
      const title = toStringOrUndefined(it.title) || "Article";
      const link = toStringOrUndefined(it.link) || toStringOrUndefined(it.url);
      const sourceName =
        toStringOrUndefined(it.sourceName) ||
        toStringOrUndefined(it.source) ||
        toStringOrUndefined(it.feed) ||
        toStringOrUndefined(it.siteName);
      const pubDate =
        toStringOrUndefined(it.pubDate) ||
        toStringOrUndefined(it.publishedAt) ||
        toStringOrUndefined(it.published_at);

      if (!link) return null;
      return {
        id: toStringOrUndefined(it.id) || `${link}-${idx}`,
        title,
        link,
        sourceName,
        pubDate,
      } satisfies RssFooterItem;
    })
    .filter((it) => it !== null) as RssFooterItem[])
    .slice(0, 6);
}

function parseRssXml(xml: string): { meta: RssMeta; items: RssFooterItem[] } {
  // DOMParser dispo cÃ´tÃ© navigateur
  if (typeof window === "undefined") return { meta: {}, items: [] };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");

    const channel = doc.querySelector("channel");
    const meta: RssMeta = {
      title: channel?.querySelector("title")?.textContent?.trim() || undefined,
      description: channel?.querySelector("description")?.textContent?.trim() || undefined,
      link: channel?.querySelector("link")?.textContent?.trim() || undefined,
      lastBuildDate: channel?.querySelector("lastBuildDate")?.textContent?.trim() || undefined,
    };

    const nodes = Array.from(doc.querySelectorAll("item"));
    const items: RssFooterItem[] = nodes.slice(0, 6).map((n, idx) => {
      const title = n.querySelector("title")?.textContent?.trim() || "Article";
      const link = n.querySelector("link")?.textContent?.trim() || undefined;
      const pubDate = n.querySelector("pubDate")?.textContent?.trim() || undefined;

      // sourceName : parfois <source> ou <dc:creator> selon feed. On met le mieux possible.
      const source =
        n.querySelector("source")?.textContent?.trim() ||
        n.querySelector("dc\\:creator")?.textContent?.trim() ||
        undefined;

      return {
        id: `${link || title}-${idx}`,
        title,
        link,
        pubDate,
        sourceName: source,
      };
    });

    return { meta, items };
  } catch {
    return { meta: {}, items: [] };
  }
}

async function fetchRaw(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: "*/*" } });
  const raw = await res.text();

  if (!res.ok) {
    // certains backends renvoient HTML en erreur â†’ on renvoie un message gÃ©nÃ©rique
    throw new Error("Veille indisponible pour le moment. RÃ©essayez dans quelques minutes.");
  }

  return { raw, contentType: res.headers.get("content-type") || "" };
}

export function RssFooter({ territory, territoryLabel, topic }: RssFooterProps) {
  const effectiveTerritory = React.useMemo(() => normalizeTerritory(territory), [territory]);
  const effectiveTopic = React.useMemo(() => normalizeTopic(topic), [topic]);
  const [items, setItems] = React.useState<RssFooterItem[]>([]);
  const [meta, setMeta] = React.useState<RssMeta>({});
  const [sourceLabels, setSourceLabels] = React.useState<string[]>([]);
  const [pinnedLabels, setPinnedLabels] = React.useState<string[]>(PINNED_SOURCE_LABELS);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      // Flux dynamique lie au territoire selectionne (map -> RSS).
      const topicParam = effectiveTopic ? `&topic=${encodeURIComponent(effectiveTopic)}` : "";
      const endpoint = `/api/rss?limit=18&territory=${encodeURIComponent(effectiveTerritory)}${topicParam}`;

      try {
        const { raw, contentType } = await fetchRaw(endpoint, controller.signal);
        if (!mounted) return;

        const looksXml = contentType.includes("xml") || raw.trim().startsWith("<rss") || raw.trim().startsWith("<?xml");
        const looksJson = contentType.includes("json") || raw.trim().startsWith("{") || raw.trim().startsWith("[");

        if (looksXml) {
          const parsed = parseRssXml(raw);
          setMeta(parsed.meta);
          setItems(parsed.items);
          setSourceLabels([]);
          setPinnedLabels(PINNED_SOURCE_LABELS);
          setError(null);
        } else if (looksJson) {
          let payload: RssApiJsonResponse | null = null;
          try {
            payload = raw ? (JSON.parse(raw) as RssApiJsonResponse) : null;
          } catch {
            payload = null;
          }
          const territoryText = territoryLabel || (effectiveTerritory === "WORLD" ? "Monde" : effectiveTerritory);
          setMeta({
            title: payload?.meta?.title || `Veille export - ${territoryText}`,
            description:
              payload?.meta?.description ||
              `Flux dynamique relie a la carte (territoire: ${territoryText}${effectiveTopic ? `, focus: ${effectiveTopic}` : ""}).`,
            link: payload?.meta?.link || "/veille",
            lastBuildDate: payload?.meta?.lastBuildDate,
          });
          setItems(pickItemsJson(payload));
          setSourceLabels(Array.isArray(payload?.sources) ? payload.sources.slice(0, 8) : []);
          setPinnedLabels(
            Array.isArray(payload?.pinned) && payload.pinned.length
              ? payload.pinned
              : PINNED_SOURCE_LABELS
          );
          if (payload?.error) setError(payload.error);
          else setError(null);
        } else {
          // format inattendu
          setMeta({});
          setItems([]);
          setSourceLabels([]);
          setPinnedLabels(PINNED_SOURCE_LABELS);
          setError("Format de veille non reconnu.");
        }
      } catch (err) {
        if (!mounted) return;
        const anyErr = err as { name?: string; message?: string };
        if (anyErr?.name === "AbortError") return;
        setMeta({});
        setItems([]);
        setSourceLabels([]);
        setPinnedLabels(PINNED_SOURCE_LABELS);
        setError(anyErr?.message || "Veille indisponible pour le moment. RÃ©essayez dans quelques minutes.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [effectiveTerritory, effectiveTopic, refreshTick, territoryLabel]);

  const hasItems = items.length > 0;
  const lastBuild = safeDateTimeLabel(meta.lastBuildDate);
  const selectedLabel = territoryLabel || (effectiveTerritory === "WORLD" ? "Monde" : effectiveTerritory);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted">
              <Rss className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Veille export</div>
              <div className="text-sm font-semibold text-foreground">
                {meta.title ? meta.title : "Alertes rÃ©centes"}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {meta.description ? meta.description : "Signaux faibles, conformitÃ© et points de vigilance."}
            {lastBuild ? <span className="ml-2">Â· DerniÃ¨re mise Ã  jour : <b>{lastBuild}</b></span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">Pays/zone: {selectedLabel}</Badge>
          {effectiveTopic ? <Badge variant="secondary">Focus: {effectiveTopic}</Badge> : null}
          {pinnedLabels.map((label) => (
            <Badge key={`pinned-${label}`} variant="outline">
              {label}
            </Badge>
          ))}
          {sourceLabels.length ? <Badge variant="outline">+{sourceLabels.length} source(s) pays</Badge> : null}
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
            Actualiser
          </Button>

          {/* /watch redirige dÃ©jÃ  vers /veille chez toi */}
          <a href="/veille" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Centre de veille <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : !hasItems ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Aucune actualitÃ© disponible pour le moment.</div>
              <div className="mt-1 text-xs">
                Ton RSS est valide mais il ne contient aucun <code>&lt;item&gt;</code>. DÃ¨s que le flux est alimentÃ©,
                les alertes apparaÃ®tront ici automatiquement.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const href = safeExternalUrl(item.link);
                const dateLabel = safeDateLabel(item.pubDate);
                const key = item.id || item.link || item.title || Math.random().toString(36);

                return (
                  <div key={key} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sm font-semibold text-foreground hover:text-primary"
                          >
                            <span className="line-clamp-2">{item.title || "Article"}</span>
                          </a>
                        ) : (
                          <div className="block text-sm font-semibold text-foreground">
                            <span className="line-clamp-2">{item.title || "Article"}</span>
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {item.sourceName ? (
                            <Badge variant="outline" className="h-5 px-2 text-[11px]">
                              {item.sourceName}
                            </Badge>
                          ) : null}
                          {dateLabel ? <span>{dateLabel}</span> : null}
                        </div>
                      </div>

                      {href ? <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-[11px] text-muted-foreground">
            Astuce : dans le Centre de veille, tu peux aller plus loin (filtres, suivi, historique).
          </div>
        </div>

        {/* CTA / Conversion */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">DÃ©bloquez le suivi et lâ€™historique</div>
              <div className="text-xs text-muted-foreground">
                Compte gratuit : sauvegarde de vos contrÃ´les + accÃ¨s aux vues avancÃ©es.
              </div>
            </div>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-foreground/90">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Historique des vÃ©rifications & export des rÃ©sultats</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Veille plus ciblÃ©e (pays/secteur) dans lâ€™app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>AccÃ¨s aux outils : Control Tower, simulateur, conformitÃ©</span>
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/register?next=%2Fapp%2Finvoice-check" className="w-full">
              <Button className="w-full gap-2">
                CrÃ©er un compte gratuit <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Se connecter
              </Button>
            </a>
          </div>

          {meta.link ? (
            <div className="mt-3 text-[11px] text-muted-foreground">
              Source :{" "}
              <a href={meta.link} target="_blank" rel="noreferrer" className="underline">
                {meta.link}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

