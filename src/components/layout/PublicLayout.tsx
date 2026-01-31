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

function FooterRss() {
  const [items, setItems] = React.useState<RssItem[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setStatus("loading");
        const res = await fetch("/api/rss", { headers: { accept: "application/xml,text/xml,*/*" } });
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
          .filter((x) => x.title && x.link);

        if (!cancelled) {
          setItems(parsed);
          setStatus("ok");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Dernières actus veille (RSS)
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Mises à jour réglementation, sanctions, douanes — en continu.
          </div>
        </div>

        <Button asChild variant="outline" className="border-slate-200 bg-white">
          <a href="/api/rss" target="_blank" rel="noreferrer">
            Ouvrir le flux
          </a>
        </Button>
      </div>

      <div className="mt-4">
        {status === "loading" && (
          <div className="space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Le flux RSS n’est pas lisible pour le moment. Vérifie que <span className="font-semibold">/api/rss</span>{" "}
            renvoie bien un XML RSS (status 200 + Content-Type xml).
          </div>
        )}

        {status === "ok" && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Aucun item RSS à afficher (flux vide).
          </div>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.link} className="flex items-start justify-between gap-4">
                <a
                  href={it.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-slate-900 hover:underline"
                >
                  {it.title}
                </a>
                <span className="shrink-0 text-xs text-slate-500">{formatDate(it.pubDate)}</span>
              </li>
            ))}
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
      {/* Backdrop mais “light-friendly” */}
      <CinematicBackdrop variant="public" className="z-0 opacity-25" />
      <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-white/80 via-white/85 to-white" />

      <header className="relative z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo size="lg" showText={false} imageClassName="h-14 md:h-16" className="shrink-0" />

          <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "transition hover:text-slate-900",
                    active && "text-slate-900 font-semibold"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="border-slate-200 bg-white hover:bg-slate-50">
              <Link to="/veille">Veille export</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/contact?offer=audit">Demander un audit</Link>
            </Button>
            <Button asChild variant="ghost" className="hidden text-slate-700 hover:text-slate-900 md:inline-flex">
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

      <footer className="relative z-10 border-t border-slate-200 bg-white/80">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:px-10 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">MPL Export Conseil</div>
            <div className="text-sm text-slate-600">
              Audit, conformité, veille personnalisée — et outils gratuits pour décider vite.
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <Link to="/methodologie" className="hover:text-slate-900 hover:underline">
                Méthodologie
              </Link>
              <Link to="/guides/incoterms-ddp" className="hover:text-slate-900 hover:underline">
                Guides
              </Link>
              <Link to="/export-to-france" className="hover:text-slate-900 hover:underline">
                Export to France
              </Link>
              <Link to="/contact" className="hover:text-slate-900 hover:underline">
                Contact
              </Link>
            </div>

            <div className="text-xs text-slate-500">
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
