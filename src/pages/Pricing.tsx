import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Check, Sparkles, Users, Shield, BellRing } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/auth/PlanContext";
import { useResolvedPricing, TierSlug } from "@/hooks/useResolvedPricing";
import { startOnlineCheckout } from "@/lib/billing";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Pricing() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { plan } = usePlan();
  const { isFR, resolved, tierKeys } = useResolvedPricing(t);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const isFr = lang === "fr";

  const handleOnlineCheckout = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setCheckoutLoading(true);
      await startOnlineCheckout();
    } catch (err: any) {
      toast({
        title: isFr ? "Paiement indisponible" : "Checkout unavailable",
        description: err?.message ?? (isFr ? "Impossible de démarrer le paiement." : "Unable to start checkout."),
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const roiPoints = isFr
    ? [
        { title: "Coût fixe mensuel + charges", side: "hire" },
        { title: "Montée en compétence + turnover", side: "hire" },
        { title: "Contrôles facture non outillés", side: "hire" },
        { title: "Simulateur + vérification facture", side: "tool" },
        { title: "Visio mensuelle ou audit sur site", side: "tool" },
        { title: "Veille incluse dès l'offre en ligne", side: "tool" },
      ]
    : [
        { title: "Fixed monthly cost + overhead", side: "hire" },
        { title: "Ramp-up time + turnover risk", side: "hire" },
        { title: "Invoice controls often not tooled", side: "hire" },
        { title: "Simulator + invoice verification", side: "tool" },
        { title: "Monthly video or on-site audit", side: "tool" },
        { title: "Watch included from online plan", side: "tool" },
      ];

  return (
    <PremiumMarketingLayout>
      {/* Hero */}
      <section className="mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden">
        <div className="mkt-container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Export Navigator
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">
              {resolved.headline}
            </h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {resolved.subhead}
            </p>
            <p className="mt-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {resolved.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/contact" className="mkt-btn mkt-btn-primary">
                {resolved.cta}
              </Link>
              <Link to="/analyse" className="mkt-btn mkt-btn-light">
                {isFr ? "Essayer l'outil" : "Try the tool"}
              </Link>
            </div>

            <p className="mt-4 text-xs" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
              {isFr
                ? "Nous signalons les incohérences et risques. La validation finale reste sous votre responsabilité."
                : "We flag inconsistencies and risks. Final validation remains your responsibility."}
            </p>
          </div>
        </div>
      </section>

      {/* ROI Comparison */}
      <SectionPremium
        eyebrow={isFr ? "ROI" : "ROI"}
        title={isFr ? "Pourquoi ça remplace souvent un recrutement" : "Why this often replaces a hire"}
        description={
          isFr
            ? "Remplacez un coût fixe par un outil + un suivi régulier, focalisé sur les erreurs qui coûtent cher."
            : "Replace fixed cost with a tool + regular follow-up focused on costly mistakes."
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="mkt-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-5 w-5 text-[hsl(var(--mkt-ink-muted))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
                {isFr ? "Recruter (coût fixe)" : "Hire (fixed cost)"}
              </h3>
            </div>
            <ul className="space-y-3">
              {roiPoints.filter((p) => p.side === "hire").map((point) => (
                <li key={point.title} className="flex items-start gap-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--mkt-ink-muted))] shrink-0" />
                  {point.title}
                </li>
              ))}
            </ul>
          </div>

          <div className="mkt-card border-[hsl(var(--mkt-primary)/0.3)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
                {isFr ? "Outil + suivi (flexible)" : "Tool + follow-up (flexible)"}
              </h3>
            </div>
            <ul className="space-y-3">
              {roiPoints.filter((p) => p.side === "tool").map((point) => (
                <li key={point.title} className="flex items-start gap-3 text-sm text-[hsl(var(--mkt-ink))]">
                  <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                  {point.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionPremium>

      {/* Pricing Tiers */}
      <SectionPremium
        eyebrow={isFr ? "Tarifs" : "Pricing"}
        title={isFr ? "Choisissez votre niveau d'accompagnement" : "Choose your support level"}
        description={
          isFr
            ? "En ligne = outils + veille. Visio = 1 rdv/mois. Audit = audit physique + suivi hebdo."
            : "Online = tools + watch. Video = 1 call/month. Audit = on-site + weekly follow-up."
        }
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tierKeys.map((key: TierSlug) => {
            const tier = resolved.tiers[key];
            const isPrimary = key === "PRO_ONLINE";
            const isOnlinePlan = key === "PRO_ONLINE";
            const isActiveOnline = plan === "PRO_ONLINE";

            return (
              <article
                key={key}
                id={key.toLowerCase()}
                className={cn(
                  "mkt-card flex flex-col p-6 scroll-mt-24",
                  isPrimary && "border-[hsl(var(--mkt-primary)/0.4)] ring-2 ring-[hsl(var(--mkt-primary)/0.1)]"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-4">
                  <p className="mkt-label">{tier.name}</p>
                  {isPrimary && (
                    <span className="mkt-badge">{isFr ? "Recommandé" : "Recommended"}</span>
                  )}
                </div>

                <p className="mkt-display text-3xl font-semibold text-[hsl(var(--mkt-ink))]">
                  {tier.price}
                </p>

                <p className="mt-3 text-sm text-[hsl(var(--mkt-ink-muted))] flex-1">
                  {tier.description}
                </p>

                <ul className="mt-6 space-y-2 mb-6">
                  {tier.features.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                      <span className="text-[hsl(var(--mkt-ink))]">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isOnlinePlan ? (
                  isActiveOnline ? (
                    <Link to="/account" className="mkt-btn mkt-btn-secondary text-xs">
                      {isFr ? "Gérer mon abonnement" : "Manage subscription"}
                    </Link>
                  ) : (
                    <Button
                      className="mkt-btn mkt-btn-secondary w-full text-xs"
                      onClick={handleOnlineCheckout}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading
                        ? isFr ? "Ouverture..." : "Opening..."
                        : isFr ? "S'abonner" : "Subscribe"}
                    </Button>
                  )
                ) : (
                  <Link
                    to="/contact"
                    className={cn(
                      "mkt-btn text-xs",
                      isPrimary ? "mkt-btn-primary" : "mkt-btn-outline"
                    )}
                  >
                    {resolved.cta}
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        {/* VIP Note */}
        <div id="vip" className="mt-10 rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-white p-6 scroll-mt-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <div>
                <p className="font-semibold text-[hsl(var(--mkt-ink))]">
                  {isFr ? "Veille personnalisée dans l'outil" : "Personalized watch in the tool"}
                </p>
                <p className="text-sm text-[hsl(var(--mkt-ink-muted))]">
                  {isFr
                    ? "Alertes ciblées sur vos marchés et codes HS = réservé VIP"
                    : "Targeted alerts on your markets and HS codes = VIP only"}
                </p>
              </div>
            </div>
            <Link to="/contact?offer=vip" className="mkt-btn mkt-btn-primary text-xs shrink-0">
              {isFr ? "Demander l'offre VIP" : "Request VIP offer"}
            </Link>
          </div>
        </div>
      </SectionPremium>

      {/* FAQ Note */}
      <SectionPremium
        eyebrow={isFr ? "Important" : "Important"}
        title={isFr ? "Ce que comprend chaque offre" : "What each plan includes"}
      >
        <div className="grid gap-6 md:grid-cols-3">
          <div className="mkt-card p-6">
            <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Simulateur complet" : "Full simulator"}
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Coût rendu / landed cost, frais, surcharges, minimums."
                : "Landed cost, fees, surcharges, minimums."}
            </p>
          </div>
          <div className="mkt-card p-6">
            <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Vérification facture" : "Invoice verification"}
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Incoterm, devise, totaux, frais, cohérences, alertes."
                : "Incoterms, currency, totals, fees, consistency alerts."}
            </p>
          </div>
          <div className="mkt-card p-6">
            <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Suivi opération" : "Ops tracking"}
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr ? "Docs, tâches, jalons, checklists." : "Docs, tasks, milestones, checklists."}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-6">
          <p className="text-sm text-[hsl(var(--mkt-ink-muted))]">
            {isFr
              ? "Nous signalons des incohérences et risques opérationnels. La validation finale reste sous votre responsabilité (ou celle de vos conseils). Visio incluse. Visite sur site possible selon zone, frais de déplacement éventuels."
              : "We flag inconsistencies and operational risks. Final validation remains your responsibility (or your advisors'). Video included. On-site possible depending on location; travel costs may apply."}
          </p>
        </div>
      </SectionPremium>

      {/* CTA */}
      <CTAStripPremium
        eyebrow={isFr ? "Prêt à commencer ?" : "Ready to start?"}
        title={isFr ? "Essayez l'outil ou demandez une démo" : "Try the tool or request a demo"}
        primaryCta={{
          label: isFr ? "Demander un devis" : "Get a quote",
          to: "/contact",
        }}
        secondaryCta={{
          label: isFr ? "Essayer l'analyse" : "Try analysis",
          to: "/analyse",
        }}
        note="contact@exportfrancefacile.com | 06 76 43 55 51"
      />
    </PremiumMarketingLayout>
  );
}
