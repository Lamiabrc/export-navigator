import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, FileCheck2, Bot, LogOut, Newspaper, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/auth/PlanContext";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "../BrandLogo";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import { TricolorBanner } from "@/components/layout/TricolorBanner";
import { getBannerContent } from "@/config/bannerContent";
import SupportChatWidget from "@/components/support/SupportChatWidget";

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
  const { signOut, user } = useAuth();
  const { plan } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const banner = getBannerContent(location.pathname);
  const [supportReady, setSupportReady] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);

  // Search UX: tu pourras le brancher à un contexte global plus tard (GlobalFiltersContext)
  const [q, setQ] = React.useState("");

  const showSidebar = variant !== "bare";
  const displayName =
    (user?.user_metadata?.company_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Compte";
  const planLabel = plan === "FREE" ? "Free" : plan.replace(/_/g, " ");

  React.useEffect(() => {
    const handler = () => {
      setSupportReady(true);
      setSupportOpen(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("support-widget:open", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("support-widget:open", handler as EventListener);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "min-h-screen bg-white text-foreground relative overflow-hidden",
        wrapperClassName
      )}
    >
      <CinematicBackdrop variant="public" className="z-0 opacity-20" />
      <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-white/85 via-white/90 to-white" />

      {showSidebar ? <Sidebar /> : null}

      <main className={cn("relative z-10", showSidebar ? "pl-64" : "")}>
        <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/85 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
            {/* Row 1 */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <BrandLogo
                  size="md"
                  href="/app/control-tower"
                  className="hidden sm:flex min-w-0"
                  textClassName="min-w-0"
                  titleClassName="text-foreground"
                  subtitleClassName="text-muted-foreground"
                  locationClassName="text-muted-foreground/90"
                />
                <BrandLogo
                  size="sm"
                  href="/app/control-tower"
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

              <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900 shadow-sm">
                  <span className="truncate max-w-[150px]">{displayName}</span>
                  <Badge variant="outline" className="border-blue-200 text-blue-700 text-[10px]">
                    Plan {planLabel}
                  </Badge>
                </div>
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
                title="Contrôle cohérence facture (Incoterm, TVA, OM si applicable, etc.)"
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

          <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
        </header>

        <div className={cn("p-4 md:p-10", contentClassName)}>
          <div className="mb-4">
            <TricolorBanner title={banner.title} question={banner.question} />
          </div>
          {variant === "bare" ? (
            <div className="space-y-4">{children}</div>
          ) : (
            <div className="rounded-2xl bg-card/95 border border-border shadow-xl shadow-black/10">
              <div className="p-4 md:p-8 space-y-4">{children}</div>
            </div>
          )}
        </div>
      </main>

      {supportReady ? (
        <SupportChatWidget open={supportOpen} onOpenChange={setSupportOpen} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setSupportReady(true);
            setSupportOpen(true);
          }}
          className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a]"
          aria-label="Ouvrir l'aide IA"
        >
          Aide IA
        </button>
      )}
    </div>
  );
}
