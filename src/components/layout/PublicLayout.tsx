import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";

const NAV_ITEMS = [
  { label: "Solutions", to: "/solutions" },
  { label: "Veille", to: "/veille" },
  { label: "Ressources", to: "/resources" },
  { label: "Tarifs", to: "/tarifs" },
  { label: "Contact", to: "/contact" },
];

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <CinematicBackdrop variant="public" className="z-0" />
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <BrandLogo imageClassName="h-9" titleClassName="text-base font-semibold" subtitleClassName="text-xs" />
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "transition hover:text-slate-900",
                  location.pathname === item.to && "text-slate-900 font-semibold"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link to="/app/centre-veille">Centre veille</Link>
            </Button>
            <Button asChild>
              <Link to="/contact?offer=express">Validation express</Link>
            </Button>
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link to="/login">Connexion</Link>
            </Button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-12 text-slate-900 md:px-10">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            MPL Export Navigator — Audit, veille et pilotage export premium.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <Link to="/resources" className="hover:text-slate-900">Documentation</Link>
            <Link to="/newsletter" className="hover:text-slate-900">Newsletter</Link>
            <Link to="/contact" className="hover:text-slate-900">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
