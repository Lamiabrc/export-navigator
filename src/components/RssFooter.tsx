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
  data?: { items?: RssFooterItem[] };
  items?: RssFooterItem[];
  meta?: RssMeta;
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
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function safeDateTimeLabel(pubDate?: string) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pickItemsJson(payload: RssApiJsonResponse | null): RssFooterItem[] {
  const a = payload?.data?.items;
  const b = payload?.items;
  const items = (Array.isArray(a) ? a : Array.isArray(b) ? b : []) as RssFooterItem[];
  return items
    .filter((it) => (it?.title || "").trim() || (it?.link || "").trim())
    .slice(0, 6);
}

function parseRssXml(xml: string): { meta: RssMeta; items: RssFooterItem[] } {
  // DOMParser dispo côté navigateur
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
    // certains backends renvoient HTML en erreur → on renvoie un message générique
    throw new Error("Veille indisponible pour le moment. Réessayez dans quelques minutes.");
  }

  return { raw, contentType: res.headers.get("content-type") || "" };
}

export function RssFooter() {
  const [items, setItems] = React.useState<RssFooterItem[]>([]);
  const [meta, setMeta] = React.useState<RssMeta>({});
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      // Endpoint configurable : par défaut ton RSS XML sur exportfrancefacile
      const envEndpoint = (import.meta as any)?.env?.VITE_RSS_ENDPOINT as string | undefined;
      const endpoint = (envEndpoint && envEndpoint.trim()) ? envEndpoint.trim() : "https://www.exportfrancefacile.com/api/rss";

      try {
        const { raw, contentType } = await fetchRaw(endpoint, controller.signal);
        if (!mounted) return;

        const looksXml = contentType.includes("xml") || raw.trim().startsWith("<rss") || raw.trim().startsWith("<?xml");
        const looksJson = contentType.includes("json") || raw.trim().startsWith("{") || raw.trim().startsWith("[");

        if (looksXml) {
          const parsed = parseRssXml(raw);
          setMeta(parsed.meta);
          setItems(parsed.items);
          setError(null);
        } else if (looksJson) {
          let payload: RssApiJsonResponse | null = null;
          try {
            payload = raw ? (JSON.parse(raw) as RssApiJsonResponse) : null;
          } catch {
            payload = null;
          }
          setMeta(payload?.meta || {});
          setItems(pickItemsJson(payload));
          if (payload?.error) setError(payload.error);
          else setError(null);
        } else {
          // format inattendu
          setMeta({});
          setItems([]);
          setError("Format de veille non reconnu.");
        }
      } catch (err) {
        if (!mounted) return;
        const anyErr = err as { name?: string; message?: string };
        if (anyErr?.name === "AbortError") return;
        setMeta({});
        setItems([]);
        setError(anyErr?.message || "Veille indisponible pour le moment. Réessayez dans quelques minutes.");
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
  const lastBuild = safeDateTimeLabel(meta.lastBuildDate);

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
                {meta.title ? meta.title : "Alertes récentes"}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {meta.description ? meta.description : "Signaux faibles, conformité et points de vigilance."}
            {lastBuild ? <span className="ml-2">· Dernière mise à jour : <b>{lastBuild}</b></span> : null}
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

          {/* /watch redirige déjà vers /veille chez toi */}
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
              <div className="font-medium text-foreground">Aucune actualité disponible pour le moment.</div>
              <div className="mt-1 text-xs">
                Ton RSS est valide mais il ne contient aucun <code>&lt;item&gt;</code>. Dès que le flux est alimenté,
                les alertes apparaîtront ici automatiquement.
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
              <div className="text-sm font-semibold text-foreground">Débloquez le suivi et l’historique</div>
              <div className="text-xs text-muted-foreground">
                Compte gratuit : sauvegarde de vos contrôles + accès aux vues avancées.
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
              <span>Veille plus ciblée (pays/secteur) dans l’app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Accès aux outils : Control Tower, simulateur, conformité</span>
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
