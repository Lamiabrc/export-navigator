import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/auth/PlanContext";

export default function BillingSuccess() {
  const { refreshPlan, loading, plan } = usePlan();

  const isEN = useMemo(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement?.lang?.toLowerCase().startsWith("en");
  }, []);

  useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
            {isEN ? "Payment confirmed" : "Paiement confirmé"}
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            {isEN ? "Your subscription is active" : "Votre abonnement est actif"}
          </h1>
          <p className="text-sm text-slate-600">
            {loading
              ? isEN
                ? "Updating your plan..."
                : "Mise à jour de votre plan..."
              : isEN
                ? `Current plan: ${plan}`
                : `Plan actuel : ${plan}`}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full bg-[#1E3A8A] hover:bg-[#162864]">
              <Link to="/tool">{isEN ? "Go to the tool" : "Aller à l'outil"}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/account">{isEN ? "Manage subscription" : "Gérer mon abonnement"}</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
