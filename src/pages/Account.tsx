import * as React from "react";
import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/auth/PlanContext";
import { openBillingPortal } from "@/lib/billing";

function useIsEN() {
  const [isEN, setIsEN] = React.useState(false);

  React.useEffect(() => {
    try {
      const lang =
        typeof document !== "undefined" && document.documentElement?.lang
          ? document.documentElement.lang.toLowerCase()
          : "fr";
      setIsEN(lang.startsWith("en"));
    } catch {
      setIsEN(false);
    }
  }, []);

  return isEN;
}

export default function Account() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = React.useState(false);

  const isEN = useIsEN();

  const handlePortal = async () => {
    try {
      setPortalLoading(true);
      await openBillingPortal();
    } catch (err: any) {
      toast({
        title: isEN ? "Portal error" : "Erreur portail",
        description: err?.message ?? (isEN ? "Unable to open portal." : "Impossible d'ouvrir le portail."),
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const busy = isLoading || planLoading || portalLoading;

  return (
    <MarketingLayout>
      <section className="py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              {isEN ? "Account" : "Compte"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {isEN ? "Manage your subscription" : "Gérer votre abonnement"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {isEN
                ? "View your current plan and access the customer portal."
                : "Consultez votre plan actuel et accédez au portail client."}
            </p>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">{isEN ? "Email" : "Email"}:</span>
                <span className="font-semibold">{user?.email ?? "-"}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">{isEN ? "Plan" : "Plan"}:</span>
                <span className="font-semibold">
                  {planLoading ? (isEN ? "Loading…" : "Chargement…") : (plan ?? "-")}
                </span>
              </div>

              {!isAuthenticated && !isLoading ? (
                <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {isEN
                    ? "Sign in to access the customer portal."
                    : "Connectez-vous pour accéder au portail client."}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={handlePortal}
                disabled={!isAuthenticated || busy}
                className="rounded-full"
              >
                {portalLoading
                  ? isEN
                    ? "Opening…"
                    : "Ouverture…"
                  : isEN
                    ? "Manage subscription"
                    : "Gérer mon abonnement"}
              </Button>

              {!isAuthenticated && (
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/login">{isEN ? "Sign in" : "Se connecter"}</Link>
                </Button>
              )}

              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/pricing">{isEN ? "View pricing" : "Voir les tarifs"}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
