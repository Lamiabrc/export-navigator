import React from "react";
import { Sidebar } from "./Sidebar";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Search, FileCheck2, Bot, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

interface MainLayoutProps {
  children: React.ReactNode;
  contentClassName?: string;
}

export function MainLayout({ children, contentClassName }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden">
      {/* Glow clair + grid subtil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 15% 10%, rgba(56,189,248,0.18), transparent 40%), radial-gradient(circle at 85% 0%, rgba(99,102,241,0.12), transparent 35%), radial-gradient(circle at 50% 70%, rgba(14,165,233,0.10), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* Sidebar desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Sidebar mobile (drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[90] md:hidden">
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
          <Sidebar
            onNavigate={() => setSidebarOpen(false)}
            className="z-[95] bg-card/95 backdrop-blur-xl border-r border-border shadow-2xl"
          />
        </div>
      )}

      <main className="relative z-10 md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-border/70 bg-[hsl(var(--background))/0.75] backdrop-blur-xl">
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
                Hub contrôle facture, veille, IA Export
              </div>
            </div>

            <div className="flex items-center gap-2 w-full max-w-xl">
              <div className="relative flex-1 hidden sm:block">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Rechercher client, facture, produit…"
                  className="pl-9 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground rounded-xl shadow-inner"
                />
              </div>

              <Link
                to="/assistant"
                className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground border border-border hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <Bot className="h-4 w-4" />
                IA Export
              </Link>

              <Link
                to="/verifier"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 border border-primary/40 hover:shadow-primary/40 hover:-translate-y-0.5 transition"
              >
                <FileCheck2 className="h-4 w-4" />
                Contrôler une facture
              </Link>

              <button
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className={cn("p-4 md:p-10", contentClassName)}>
          <div className="rounded-2xl bg-card/95 border border-border shadow-xl shadow-black/10">
            <div className="p-4 md:p-8 space-y-4">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
