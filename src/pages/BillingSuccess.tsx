import * as React from "react";
import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlan } from "@/auth/PlanContext";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function BillingSuccess() {
  const { refreshPlan, loading, plan } = usePlan();
  const { lang } = useI18n();
  const isEN = lang === "en";

  usePageMeta("meta.billingSuccess.title", "meta.billingSuccess.description");

  React.useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  const planLabel = plan ? String(plan) : isEN ? "—" : "—";

  return (
    <MarketingLayout>
      <section className="bg-background py-14">
        <div className="mx-auto max-w-3xl px-6">
          <Card className="rounded-3xl border border-border shadow-sm">
            <CardHeader className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                {isEN ? "Payment confirmed" : "Paiement confirmé"}
              </p>

              <CardTitle className="mt-2 text-3xl">
                {isEN ? "Your subscription is active" : "Votre abonnement est actif"}
              </CardTitle>

              <CardDescription className="mt-2">
                {loading
                  ? isEN
                    ? "We’re updating your plan…"
                    : "Nous mettons à jour votre plan…"
                  : isEN
                    ? "You can start using the platform now."
                    : "Vous pouvez utiliser la plateforme dès maintenant."}
              </CardDescription>

              <div className="mt-4 flex items-center justify-center gap-2">
                <Badge variant="secondary">
                  {isEN ? "Current plan" : "Plan actuel"} :{" "}
                  <span className="ml-1 font-semibold">{planLabel}</span>
                </Badge>
                {loading ? (
                  <Badge variant="outline">{isEN ? "Syncing…" : "Sync…"}</Badge>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                {isEN ? (
                  <>
                    Tip: If you don’t see the right plan immediately, wait a few seconds and refresh this page.
                  </>
                ) : (
                  <>
                    Astuce : si votre plan n’apparaît pas tout de suite, attendez quelques secondes et rafraîchissez la page.
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="rounded-full">
                  <Link to="/app/control-tower">{isEN ? "Open my dashboard" : "Ouvrir mon cockpit"}</Link>
                </Button>

                <Button asChild variant="secondary" className="rounded-full">
                  <Link to="/app/simulator">{isEN ? "Run a simulation" : "Lancer une simulation"}</Link>
                </Button>

                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/account">{isEN ? "Manage subscription" : "Gérer mon abonnement"}</Link>
                </Button>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                {isEN ? (
                  <>Need help? Contact support from the Contact page.</>
                ) : (
                  <>Besoin d’aide ? Contactez-nous via la page Contact.</>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
