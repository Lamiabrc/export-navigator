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

type RssApiResponse = {
  data?: { items?: RssFooterItem[] };
  items?: RssFooterItem[];
  error?: string;
  message?: string;
};

function safeExternalUrl(url?: string) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function safeDateLabel(pubDate?: string) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pickItems(payload: RssApiResponse | null): RssFooterItem[] {
  const a = payload?.data?.items;
  const b = payload?.items;
  const items = (Array.isArray(a) ? a : Array.isArray(b) ? b : []) as RssFooterItem[];
  // Nettoyage léger
  return items
    .filter((it) => (it?.title || "").trim() || (it?.link || "").trim())
    .slice(0, 6);
}

async function fetchJsonSafe(url: string, signal: AbortSignal) {
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  const raw = await res.text();
  let payload: RssApiResponse | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as RssApiResponse) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const msg =
      payload?.error ||
      payload?.message ||
      "Veille indisponible pour le moment. Réessayez dans quelques minutes.";
    throw new Error(msg);
  }
  return payload;
}

export function RssFooter() {
  const [items, setItems] = React.useState<RssFooterItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      // 1) endpoint interne (si tu as une route proxy /api/rss)
      // 2) fallback direct vers exportfrancefacile (si CORS OK côté API)
      const envEndpoint = (import.meta as any)?.env?.VITE_RSS_ENDPOINT as string | undefined;
      const primary = (envEndpoint && envEndpoint.trim()) ? envEndpoint.trim() : "/api/rss";
      const endpoints = [
        `${primary}?limit=6&offset=0`,
        `https://www.exportfrancefacile.com/api/rss?limit=6&offset=0`,
      ];

      try {
        let payload: RssApiResponse | null = null;

        // essaie le 1er, sinon fallback
        for (const url of endpoints) {
          try {
            payload = await fetchJsonSafe(url, controller.signal);
            break;
          } catch (e) {
            // continue sur fallback
            payload = null;
          }
        }

        if (!mounted) return;

        const picked = pickItems(payload);
        if (!picked.length) {
          setItems([]);
          setError(null);
        } else {
          setItems(picked);
          setError(null);
        }
      } catch (err) {
        if (!mounted) return;
        const anyErr = err as { name?: string; message?: string };
        if (anyErr?.name === "AbortError") return;
        setError(anyErr?.message || "Veille indisponible pour le moment. Réessayez dans quelques minutes.");
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [refreshTick]);

  const hasItems = items.length > 0;

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
              <div className="text-sm font-semibold text-foreground">Alertes récentes (sélection)</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Un aperçu utile en bas de page. Pour tout explorer : filtres, historique et suivi.
          </div>
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
              Aucun article disponible pour le moment.
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
            Astuce : la veille complète (filtres + suivi) est disponible dans le Centre de veille.
          </div>
        </div>

        {/* CTA / Conversion */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">Débloquez la veille + vos contrôles</div>
              <div className="text-xs text-muted-foreground">
                Compte gratuit : vous gardez une trace de vos tests, et vous accédez aux vues avancées.
              </div>
            </div>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-foreground/90">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Historique des vérifications & export des résultats</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Veille par pays/secteur + alertes plus ciblées</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Accès aux outils : Control Tower, simulateur, centre de veille</span>
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/register?next=%2Fapp%2Finvoice-check" className="w-full">
              <Button className="w-full gap-2">
                Créer un compte gratuit <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Se connecter
              </Button>
            </a>
          </div>

          <div className="mt-3 text-[11px] text-muted-foreground">
            Endpoint RSS :{" "}
            <a
              href="https://www.exportfrancefacile.com/api/rss"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              exportfrancefacile.com/api/rss
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
