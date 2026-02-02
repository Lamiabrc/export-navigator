import * as React from "react";

type RssFooterItem = {
  id?: string;
  title?: string;
  link?: string;
  sourceName?: string;
  pubDate?: string;
};

type RssApiResponse = {
  data?: {
    items?: RssFooterItem[];
  };
  error?: string;
};

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

function safeExternalUrl(url?: string) {
  if (!url) return null;
  // Autorise http(s) uniquement pour éviter les liens chelous
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

export function RssFooter() {
  const [items, setItems] = React.useState<RssFooterItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadFeed = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/rss?limit=5&offset=0", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        // Certains backends renvoient parfois du texte/HTML en erreur => on sécurise
        const raw = await response.text();
        let payload: RssApiResponse | null = null;
        try {
          payload = raw ? (JSON.parse(raw) as RssApiResponse) : null;
        } catch {
          payload = null;
        }

        if (!mounted) return;

        if (!response.ok) {
          const msg =
            payload?.error ||
            "Veille indisponible pour le moment. Réessaie dans quelques minutes.";
          throw new Error(msg);
        }

        const feedItems = (payload?.data?.items ?? []) as RssFooterItem[];
        setItems(feedItems.slice(0, 5));
      } catch (err) {
        if (!mounted) return;

        // AbortError quand on quitte la page => on ignore
        const anyErr = err as { name?: string; message?: string };
        if (anyErr?.name === "AbortError") return;

        setError(
          anyErr?.message ||
            "Veille indisponible pour le moment. Réessaie dans quelques minutes."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadFeed();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const hasItems = items.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="text-sm font-semibold text-foreground">
          Veille export — dernières actus
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-xs text-muted-foreground">Chargement…</span>
          ) : null}

          {/* CTA vers la page Veille (à adapter si ton route est /veille) */}
          <a
            href="/watch"
            className="text-xs font-medium text-primary hover:underline"
          >
            Voir toute la veille
          </a>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {loading ? (
            // Skeleton simple (contraste OK)
            <>
              <li className="space-y-2">
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
              </li>
              <li className="space-y-2">
                <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </li>
              <li className="space-y-2">
                <div className="h-4 w-3/6 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/6 animate-pulse rounded bg-muted" />
              </li>
            </>
          ) : !hasItems ? (
            <li className="text-xs text-muted-foreground">
              Aucun article disponible pour le moment.
            </li>
          ) : (
            items.map((item) => {
              const href = safeExternalUrl(item.link);
              const dateLabel = safeDateLabel(item.pubDate);

              return (
                <li
                  key={item.id || `${item.title || "item"}-${item.link || ""}`}
                  className="space-y-1"
                >
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm font-medium text-foreground hover:text-primary"
                    >
                      {item.title || "Sans titre"}
                    </a>
                  ) : (
                    <div className="block text-sm font-medium text-foreground">
                      {item.title || "Sans titre"}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {item.sourceName ? (
                      <span className="font-semibold">{item.sourceName}</span>
                    ) : null}
                    {item.sourceName && dateLabel ? (
                      <span className="mx-1">·</span>
                    ) : null}
                    {dateLabel ? <span>{dateLabel}</span> : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
