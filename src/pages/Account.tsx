import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/auth/PlanContext";
import { openBillingPortal } from "@/lib/billing";

export default function Account() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);

  const isEN = useMemo(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement?.lang?.toLowerCase().startsWith("en");
  }, []);

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

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
              {isEN ? "Account" : "Compte"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              {isEN ? "Manage your subscription" : "Gérer votre abonnement"}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              {isEN
                ? "View your current plan and access the Stripe customer portal."
                : "Consultez votre plan actuel et accédez au portail Stripe."}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 text-sm text-slate-600">
              <span>
                {isEN ? "Email" : "Email"}:{" "}
                <span className="font-semibold text-slate-900">{user?.email ?? "-"}</span>
              </span>
              <span>
                {isEN ? "Plan" : "Plan"}:{" "}
                <span className="font-semibold text-slate-900">
                  {planLoading ? (isEN ? "Loading..." : "Chargement...") : plan}
                </span>
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                className="rounded-full bg-[#1E3A8A] text-xs font-semibold uppercase tracking-[0.35em] hover:bg-[#162864]"
                onClick={handlePortal}
                disabled={!isAuthenticated || isLoading || portalLoading}
              >
                {portalLoading
                  ? isEN
                    ? "Opening..."
                    : "Ouverture..."
                  : isEN
                    ? "Manage subscription"
                    : "Gérer mon abonnement"}
              </Button>
              {!isAuthenticated && (
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/login">{isEN ? "Sign in" : "Se connecter"}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
