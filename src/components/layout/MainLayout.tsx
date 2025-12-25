import React from "react";
import { Sidebar } from "./Sidebar";
import { Link } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface MainLayoutProps {
  children: React.ReactNode;
  /** Optional: some pages (tables) may need more space */
  contentClassName?: string;
}

export function MainLayout({ children, contentClassName }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden">
      {/* Futuristic glow + grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.15), transparent 35%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.12), transparent 32%), radial-gradient(circle at 50% 60%, rgba(14,165,233,0.10), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-6"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Sidebar desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Sidebar mobile (drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[90] md:hidden">
          {/* overlay */}
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          {/* panel */}
          <Sidebar
            onNavigate={() => setSidebarOpen(false)}
            className="z-[95] bg-slate-900/90 shadow-2xl shadow-black/40"
          />
        </div>
      )}

      <main className="relative z-10 md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-border/60 bg-[hsl(var(--background))/0.7] backdrop-blur-xl dark:border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <button
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">
                Export Navigator
              </div>
              <div className="text-xs text-muted-foreground truncate">
                Pilotage export - factures - conformite - marges
              </div>
            </div>

            <div className="flex items-center gap-2 w-full max-w-md">
              <div className="relative flex-1 hidden sm:block">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Rechercher facture, client, circuit…"
                  className="pl-9 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground rounded-xl shadow-inner dark:bg-white/5 dark:border-white/10"
                />
              </div>
              <Link
                to="/imports"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 border border-primary/50 hover:shadow-primary/50 hover:-translate-y-0.5 transition"
              >
                Importer
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className={cn("p-4 md:p-10", contentClassName)}>
          <div className="glass rounded-2xl bg-card/90 border border-border shadow-xl shadow-black/20 dark:border-white/10 dark:bg-white/5">
            <div className="p-4 md:p-8 space-y-4">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
