import * as React from "react";

type RssFooterItem = {
  id?: string;
  title?: string;
  link?: string;
  sourceName?: string;
  pubDate?: string;
};

export function RssFooter() {
  const [items, setItems] = React.useState<RssFooterItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadFeed = async () => {
      try {
        const response = await fetch("/api/rss?limit=5&offset=0", {
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!mounted) return;

        if (!response.ok) {
          throw new Error(payload?.error || "Veille indisponible");
        }

        const feedItems = (payload?.data?.items || []) as RssFooterItem[];
        setItems(feedItems.slice(0, 5));
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Veille indisponible");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadFeed();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="text-sm font-semibold text-foreground">Dernières actus veille (RSS)</div>
        {loading && <span className="text-xs text-muted-foreground">Chargement...</span>}
      </div>
      {error ? (
        <p className="mt-3 text-xs text-destructive-foreground">{error}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-foreground/90">
          {items.length === 0 && !loading ? (
            <li className="text-xs text-muted-foreground">Aucun article disponible pour le moment.</li>
          ) : null}
          {items.map((item) => {
            const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
            const formattedDate = publishedAt
              ? publishedAt.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : null;
            return (
              <li key={item.id || `${item.title}-${item.link}`}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm font-medium text-foreground hover:text-primary"
                >
                  {item.title || "Sans titre"}
                </a>
                <div className="text-xs text-muted-foreground">
                  {item.sourceName && (
                    <span className="font-semibold text-muted-foreground">{item.sourceName}</span>
                  )}
                  {item.sourceName && formattedDate && <span className="mx-1">·</span>}
                  {formattedDate}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
