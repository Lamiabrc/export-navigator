import React from "react";
import { Sidebar } from "./Sidebar";
import { Link, useNavigate } from "react-router-dom";
import { Search, FileCheck2, Bot, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "../BrandLogo";
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

export function MainLayout({ children, contentClassName, wrapperClassName, variant = "default" }: MainLayoutProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden",
        wrapperClassName
      )}
    >
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

      <Sidebar />

      <main className="relative z-10 pl-64">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-[hsl(var(--background))/0.85] backdrop-blur-xl">
          <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
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

                <div className="relative flex-1 min-w-[220px]">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Rechercher client, facture, produit..."
                    className="pl-9 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground rounded-xl shadow-inner"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                <TimeRangePicker />
                <AutoRefreshControl />
                <RefreshNowButton />
                <SavedViewsMenu />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Link
                to="/app/assistant"
                className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground border border-border hover:shadow-md hover:-translate-y-0.5 transition shrink-0"
              >
                <Bot className="h-4 w-4" />
                IA Export
              </Link>

              <Link
                to="/app/invoice-check"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 border border-primary/40 hover:shadow-primary/40 hover:-translate-y-0.5 transition shrink-0"
              >
                <FileCheck2 className="h-4 w-4" />
                Contrôler une facture
              </Link>

              <button
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>
          <VariablesBar />
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
