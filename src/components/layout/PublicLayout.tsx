import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import { RssFooter } from "@/components/RssFooter";

const NAV_ITEMS = [
  { label: "Analyse", to: "/analyse" },
  { label: "Veille", to: "/veille" },
  { label: "Methodologie", to: "/methodologie" },
  { label: "Guides", to: "/guides/incoterms-ddp" },
  { label: "Contact", to: "/contact" },
  { label: "Export to France", to: "/export-to-france" },
];

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <CinematicBackdrop variant="public" className="z-0 opacity-50" />
      <header className="border-b border-border bg-white/80 text-foreground/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo
            size="lg"
            showText={false}
            imageClassName="h-16 md:h-20"
            className="shrink-0"
          />
          <nav className="hidden items-center gap-6 text-sm text-foreground/70 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "transition hover:text-foreground font-normal",
                  location.pathname === item.to && "text-foreground font-semibold"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary/5">
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
        <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-border bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
          <RssFooter />
          <div className="flex flex-col gap-3 text-sm text-foreground/70 md:flex-row md:items-center md:justify-between">
            <div>MPL Export Conseil - outil gratuit d'aide à la décision export.</div>
            <div className="flex flex-wrap gap-4">
              <Link to="/methodologie" className="underline decoration-dotted underline-offset-4 hover:text-foreground/90">
                Methodologie
              </Link>
              <Link to="/guides/incoterms-ddp" className="underline decoration-dotted underline-offset-4 hover:text-foreground/90">
                Guides
              </Link>
              <Link to="/contact" className="underline decoration-dotted underline-offset-4 hover:text-foreground/90">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
