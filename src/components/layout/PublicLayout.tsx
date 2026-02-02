import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";

const NAV_ITEMS = [
  { label: "Analyse", to: "/analyse" },
  { label: "Veille", to: "/veille" },
  { label: "Méthodologie", to: "/methodologie" },
  { label: "Guides", to: "/guides/incoterms-ddp" },
  { label: "Export to France", to: "/export-to-france" },
  { label: "Contact", to: "/contact" },
];

type RssItem = { title: string; link: string; pubDate?: string };

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function safeExternalUrl(url?: string) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

/**
 * "Active" rules:
 * - exact match for root pages
 * - prefix match for sections like /guides/... or /veille/...
 */
function isActivePath(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

function FooterRss() {
  const [items, setItems] = React.useState<RssItem[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        setStatus("loading");

        const res = await fetch("/api/rss", {
          signal: controller.signal,
          headers: {
            Accept: "application/xml,text/xml,application/rss+xml,*/*",
          },
        });

        const text = await res.text();
        if (!res.ok) throw new Error(text || "RSS error");

        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "application/xml");
        const parseError = xml.querySelector("parsererror");
        if (parseError) throw new Error("RSS XML invalide");

        const nodes = Array.from(xml.querySelectorAll("item")).slice(0, 6);
        const parsed = nodes
          .map((n) => {
            const title = (n.querySelector("title")?.textContent || "").trim();
            const link = (n.querySelector("link")?.textContent || "").trim();
            const pubDate = (n.querySelector("pubDate")?.textContent || "").trim();
            return { title, link, pubDate };
          })
          .filter((x) => x.title && safeExternalUrl(x.link));

        if (!cancelled) {
          setItems(parsed);
          setStatus("ok");
        }
      } catch (e: any) {
        if (cancelled) return;
        if (e?.name === "AbortError") return;
        setStatus("error");
      }
    };

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Veille export (RSS)
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Sanctions, douanes, conformité, marchés — mises à jour en continu.
          </div>
        </div>

        <Button asChild variant="outline" className="shrink-0">
          <a href="/api/rss" target="_blank" rel="noreferrer">
            Ouvrir le flux
          </a>
        </Button>
      </div>

      <div className="mt-4">
        {status === "loading" && (
          <div className="space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-foreground">
            Le flux RSS n’est pas lisible pour le moment. Vérifie que{" "}
            <span className="font-semibold">/api/rss</span> renvoie bien un XML RSS (status 200 + content-type xml).
          </div>
        )}

        {status === "ok" && items.length === 0 && (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-foreground">
            Aucun item RSS à afficher (flux vide).
          </div>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => {
              const href = safeExternalUrl(it.link);
              return (
                <li key={it.link} className="flex items-start justify-between gap-4">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {it.title}
                    </a>
                  ) : (
                    <div className="min-w-0 text-sm font-medium text-foreground">{it.title}</div>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(it.pubDate)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/veille">Voir la veille</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/contact?offer=express">Validation express</Link>
        </Button>
      </div>
    </div>
  );
}

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Backdrop “light-friendly” */}
      <CinematicBackdrop variant="public" className="z-0 opacity-25" />
      <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-background/80 via-background/85 to-background" />

      <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo size="lg" showText={false} imageClassName="h-14 md:h-16" className="shrink-0" />

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "transition hover:text-foreground",
                    active && "text-foreground font-semibold"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link to="/veille">Veille export</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/contact?offer=audit">Demander un audit</Link>
            </Button>
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link to="/login">Connexion</Link>
            </Button>
          </div>
        </div>

        {/* Tricolore */}
        <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
        {children ?? <Outlet />}
      </main>

      <footer className="relative z-10 border-t border-border bg-background/80">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:px-10 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">MPL Export Conseil</div>
            <div className="text-sm text-muted-foreground">
              Audit, conformité, veille personnalisée — et outils gratuits pour décider vite.
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link to="/methodologie" className="hover:text-foreground hover:underline">
                Méthodologie
              </Link>
              <Link to="/guides/incoterms-ddp" className="hover:text-foreground hover:underline">
                Guides
              </Link>
              <Link to="/export-to-france" className="hover:text-foreground hover:underline">
                Export to France
              </Link>
              <Link to="/contact" className="hover:text-foreground hover:underline">
                Contact
              </Link>
            </div>

            <div className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} MPL Export Conseil — outil d’aide à la décision.
            </div>
          </div>

          {/* RSS visible sur toutes les pages publiques */}
          <FooterRss />
        </div>
      </footer>
    </div>
  );
}
