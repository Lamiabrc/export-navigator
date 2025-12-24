import React from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  /** Optionnel: certains écrans (tableaux) peuvent demander plus d’espace */
  contentClassName?: string;
}

export function MainLayout({ children, contentClassName }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden">
      {/* Futuristic glow + grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.15), transparent 35%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.12), transparent 32%), radial-gradient(circle at 50% 60%, rgba(14,165,233,0.10), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-12"
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

      {/* Sidebar mobile (drawer simple) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* overlay */}
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-[61]">
            <Sidebar />
          </div>
        </div>
      )}

      <main className="relative z-10 md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <button
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">
                Export Navigator
              </div>
              <div className="text-xs text-white/60 truncate">
                Pilotage export • factures • conformité • marges
              </div>
            </div>

            {/* Slot actions (plus tard: search, quick import, etc.) */}
            <div className="flex items-center gap-2">
              {/* placeholder */}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className={cn("p-4 md:p-10", contentClassName)}>
          <div className="glass rounded-2xl">
            <div className="p-4 md:p-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
