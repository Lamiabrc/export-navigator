import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";

const NAV_ITEMS = [
  { label: "Analyse", to: "/analyse" },
  { label: "Veille", to: "/veille" },
  { label: "Methodologie", to: "/methodologie" },
  { label: "Guides", to: "/guides/incoterms-ddp" },
  { label: "Contact", to: "/contact" },
];

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Backdrop + voile clair pour éviter l’effet “trop sombre” */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <CinematicBackdrop variant="public" className="h-full w-full opacity-35" />
        <div className="absolute inset-0 bg-background/85" />
      </div>

      <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo size="lg" showText={false} imageClassName="h-14 md:h-16" className="shrink-0" />

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "transition hover:text-foreground",
                  location.pathname === item.to && "text-foreground font-semibold"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="border-border text-foreground hover:bg-muted">
              <Link to="/veille">Veille export</Link>
            </Button>

            <Button asChild variant="default">
              <Link to="/contact?offer=audit">Demander un audit</Link>
            </Button>

            <Button asChild variant="ghost" className="hidden text-muted-foreground hover:text-foreground md:inline-flex">
              <Link to="/login">Connexion</Link>
            </Button>
          </div>
        </div>

        <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
        {children ?? <Outlet />}
      </main>

      <footer className="relative z-10 border-t border-border bg-background/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            MPL Export Conseil — outil gratuit d'aide à la décision export.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link to="/methodologie" className="hover:text-foreground">
              Methodologie
            </Link>
            <Link to="/guides/incoterms-ddp" className="hover:text-foreground">
              Guides
            </Link>
            <Link to="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
