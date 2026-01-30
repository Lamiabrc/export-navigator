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
    <div className="relative min-h-screen bg-slate-950 text-white">
      <CinematicBackdrop variant="public" className="z-0" />
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo
            size="lg"
            showText={false}
            imageClassName="h-16 md:h-20"
            className="shrink-0"
          />
          <nav className="hidden items-center gap-6 text-sm text-slate-200 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "transition hover:text-white",
                  location.pathname === item.to && "text-white font-semibold"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="border-white/20 text-slate-100 hover:bg-white/10">
              <Link to="/veille">Veille export</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/contact?offer=audit">Demander un audit</Link>
            </Button>
            <Button asChild variant="ghost" className="hidden text-slate-200 hover:text-white md:inline-flex">
              <Link to="/login">Connexion</Link>
            </Button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-12 text-slate-100 md:px-10">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-400">
            MPL Export Conseil - outil gratuit d'aide a la decision export.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <Link to="/methodologie" className="hover:text-white">Methodologie</Link>
            <Link to="/guides/incoterms-ddp" className="hover:text-white">Guides</Link>
            <Link to="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
