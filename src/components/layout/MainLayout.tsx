import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Link, useNavigate } from "react-router-dom";
import { Search, FileCheck2, Bot, LogOut, Newspaper, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "../BrandLogo";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import {
  TimeRangePicker,
  AutoRefreshControl,
  RefreshNowButton,
  SavedViewsMenu,
  VariablesBar,
} from "./GlobalFilterControls";

interface MainLayoutProps {
  children: React.ReactNode;
  contentClassName?: string;
  wrapperClassName?: string;
  variant?: "default" | "bare";
}

export function MainLayout({
  children,
  contentClassName,
  wrapperClassName,
  variant = "default",
}: MainLayoutProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Search UX: tu pourras le brancher à un contexte global plus tard (GlobalFiltersContext)
  const [q, setQ] = React.useState("");

  const showSidebar = variant !== "bare";

  return (
    <div
      className={cn(
        "min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden",
        wrapperClassName
      )}
    >
      <CinematicBackdrop variant="app" showMap={false} className="opacity-40" />

      {/* Soft gradients */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 15% 10%, rgba(56,189,248,0.18), transparent 40%), radial-gradient(circle at 85% 0%, rgba(99,102,241,0.12), transparent 35%), radial-gradient(circle at 50% 70%, rgba(14,165,233,0.10), transparent 50%)",
        }}
      />
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {showSidebar ? <Sidebar /> : null}

      <main className={cn("relative z-10", showSidebar ? "pl-64" : "")}>
        <header className="sticky top-0 z-20 border-b border-border/70 bg-[hsl(var(--background))/0.88] backdrop-blur-xl">
          <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
            {/* Row 1 */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <BrandLogo
                  size="md"
                  className="hidden sm:flex min-w-0"
                  textClassName="min-w-0"
                  titleClassName="text-foreground"
                  subtitleClassName="text-muted-foreground"
                  locationClassName="text-muted-foreground/90"
                />
                <BrandLogo
                  size="sm"
                  className="sm:hidden min-w-0"
                  textClassName="min-w-0"
                  imageClassName="drop-shadow-sm"
                  titleClassName="text-foreground"
                  subtitleClassName="text-muted-foreground"
                  locationClassName="text-muted-foreground/90"
                />

                {/* Search */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // simple: on redirige vers l’analyse avec la query
                        // adapte si tu as déjà une page /search
                        navigate(`/app/analyse?q=${encodeURIComponent(q.trim())}`);
                      }
                    }}
                    placeholder="Rechercher client, facture, HS code, pays…"
                    className="pl-9 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground rounded-xl shadow-inner"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                <TimeRangePicker />
                <AutoRefreshControl />
                <RefreshNowButton />
                <SavedViewsMenu />
              </div>
            </div>

            {/* Row 2: CTA actions */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Link
                to="/watch"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                title="Veille réglementaire et marchés (RSS & sources)"
              >
                <Newspaper className="h-4 w-4" />
                Veille
              </Link>

              <Link
                to="/app/analyse"
                className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground border border-border hover:shadow-md hover:-translate-y-0.5 transition shrink-0"
                title="Calcul du prix de revient & aide à la décision"
              >
                <Calculator className="h-4 w-4" />
                Analyse coûts
              </Link>

              <Link
                to="/app/assistant"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                title="Assistant IA export (conformité, docs, incoterms)"
              >
                <Bot className="h-4 w-4" />
                IA Export
              </Link>

              <Link
                to="/app/invoice-check"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 border border-primary/40 hover:shadow-primary/40 hover:-translate-y-0.5 transition shrink-0"
                title="Contrôle cohérence facture (Incoterm, TVA, OM si DROM, etc.)"
              >
                <FileCheck2 className="h-4 w-4" />
                Contrôler une facture
              </Link>

              <Link
                to="/resources"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                title="Initialisation / ressources (admin)"
              >
                Init DB
              </Link>

              <button
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>

          {/* Keep VariablesBar visually attached to header */}
          <div className="border-t border-border/60 bg-[hsl(var(--background))/0.7] backdrop-blur">
            <VariablesBar />
          </div>
        </header>

        <div className={cn("p-4 md:p-10", contentClassName)}>
          {variant === "bare" ? (
            <div className="space-y-4">{children}</div>
          ) : (
            <div className="rounded-2xl bg-card/95 border border-border shadow-xl shadow-black/10">
              <div className="p-4 md:p-8 space-y-4">{children}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
