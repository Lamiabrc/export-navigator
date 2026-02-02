import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { useResolvedPricing, TierSlug } from "@/hooks/useResolvedPricing";

export default function Pricing() {
  const { t } = useI18n();
  const { isFR, resolved, tierKeys } = useResolvedPricing(t);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="bg-[#0B1220] py-16 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">Export Navigator</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{resolved.headline}</h1>
          <p className="mt-4 text-lg text-white/80">{resolved.subhead}</p>
          <p className="mt-2 text-sm text-white/70">{resolved.description}</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="rounded-full bg-[#1E3A8A] px-6 py-5 text-xs font-semibold uppercase tracking-[0.35em] hover:bg-[#162864]"
            >
              <Link to="/contact">{resolved.cta}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-white/20 bg-transparent px-6 py-5 text-xs font-semibold uppercase tracking-[0.35em] text-white hover:bg-white/10"
            >
              <Link to="/import/check-invoice">
                {isFR ? "Voir l’outil de vérification" : "See the invoice checker"}
              </Link>
            </Button>
          </div>

          <p className="mt-3 text-xs text-white/55">
            {isFR
              ? "Nous signalons les incohérences et risques opérationnels. La validation finale reste sous votre responsabilité (ou celle de vos conseils)."
              : "We flag inconsistencies and operational risks. Final validation remains your responsibility (or your advisors’)."}
          </p>
        </div>
      </section>

      {/* ROI BLOCK */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="rounded-3xl border-slate-200/70 shadow-sm lg:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">
                    {isFR
                      ? "Pourquoi ça remplace souvent un recrutement ADV export"
                      : "Why this often replaces an export admin hire"}
                  </CardTitle>
                  <Badge variant="outline">{isFR ? "ROI" : "ROI"}</Badge>
                </div>
                <CardDescription>
                  {isFR
                    ? "Vous remplacez un coût fixe par un outil + un suivi régulier, focalisé sur les erreurs qui coûtent cher."
                    : "Replace fixed cost with a tool + regular follow-up focused on costly mistakes."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-700">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      {isFR ? "Fixe" : "Fixed"}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {isFR ? "Recruter (coût + temps + dépendance)" : "Hiring (cost + time + dependency)"}
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li>• {isFR ? "Coût fixe mensuel + charges + gestion" : "Fixed monthly cost + overhead"}</li>
                      <li>• {isFR ? "Montée en compétence et turnover possible" : "Ramp-up time + turnover risk"}</li>
                      <li>• {isFR ? "Contrôles facture souvent non outillés" : "Invoice controls often not tooled"}</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      {isFR ? "Flexible" : "Flexible"}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {isFR ? "Outil + suivi (PRO/VIP)" : "Tool + follow-up (PRO/VIP)"}
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li>
                        •{" "}
                        {isFR
                          ? "Simulateur + vérification facture = décisions plus sûres"
                          : "Simulator + invoice checks = safer decisions"}
                      </li>
                      <li>
                        •{" "}
                        {isFR
                          ? "Suivi hebdo / journée VIP = sécurisation des points critiques"
                          : "Weekly follow-up / VIP day = critical-point security"}
                      </li>
                      <li>• {isFR ? "Veille destination réservée VIP = moins de surprises" : "VIP watch = fewer surprises"}</li>
                    </ul>
                  </div>
                </div>

                <Separator />

                <p className="text-xs text-slate-500">
                  {isFR
                    ? "Visio incluse. Visite sur site possible selon zone, frais de déplacement éventuels."
                    : "Video included. On-site possible depending on location; travel costs may apply."}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{isFR ? "Ce que l’outil fait" : "What the tool does"}</CardTitle>
                <CardDescription>{isFR ? "Du concret : calculer, vérifier, suivre." : "Concrete: calculate, verify, track."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Simulateur complet" : "Full simulator"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR ? "Coût rendu / landed cost, frais, surcharges, minimums." : "Landed cost, fees, surcharges, minimums."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Vérification facture" : "Invoice verification"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR ? "Incoterm, devise, totaux, frais, cohérences, alertes." : "Incoterms, currency, totals, fees, consistency alerts."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Suivi opération" : "Ops tracking"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR ? "Docs, tâches, jalons, checklists." : "Docs, tasks, milestones, checklists."}
                  </p>
                </div>

                <Button
                  asChild
                  className="mt-2 w-full rounded-full bg-[#1E3A8A] text-xs font-semibold uppercase tracking-[0.35em] hover:bg-[#162864]"
                >
                  <Link to="/contact">{isFR ? "Demander une démo" : "Request a demo"}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* PRICING TIERS */}
      <section className="bg-white pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {isFR ? "Choisissez votre niveau d’accompagnement" : "Choose your support level"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {isFR
                  ? "PRO = suivi hebdo. VIP = formule complète + veille + journée de pilotage."
                  : "PRO = weekly follow-up. VIP = full tool + watch + a monthly pilot day."}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {isFR ? "Sans engagement • Upgrade à tout moment" : "No commitment • Upgrade anytime"}
            </Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {tierKeys.map((key: TierSlug) => {
              const tier = resolved.tiers[key];
              const isPrimary = key === "PRO";

              return (
                <article
                  key={key}
                  id={key}
                  className={[
                    "scroll-mt-24 flex h-full flex-col justify-between gap-6 rounded-3xl border p-6 shadow-xl",
                    isPrimary ? "border-[#1E3A8A]/40 bg-white" : "border-slate-200/70 bg-slate-50",
                  ].join(" ")}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.5em] text-slate-500">{tier.name}</p>
                      {isPrimary && (
                        <Badge className="rounded-full bg-[#1E3A8A] text-white">{isFR ? "Recommandé" : "Recommended"}</Badge>
                      )}
                    </div>

                    <p className="mt-2 text-3xl font-semibold text-slate-900">{tier.price}</p>
                    <p className="mt-3 text-sm text-slate-600">{tier.description}</p>

                    {key === "VIP" && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        {isFR ? (
                          <>
                            <span className="font-semibold text-slate-900">Veille :</span> accessible uniquement en VIP.
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-slate-900">Watch:</span> VIP only.
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 text-sm text-slate-700">
                    {tier.features.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-[#1E3A8A]" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-2">
                    <Link
                      to="/contact"
                      className={[
                        "inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.4em] transition",
                        isPrimary ? "bg-[#1E3A8A] text-white hover:bg-[#162864]" : "bg-slate-900 text-white hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {resolved.cta}
                    </Link>

                    <p className="text-center text-xs text-slate-500">
                      {isFR
                        ? "Visio incluse. Visite sur site possible selon zone, frais de déplacement éventuels."
                        : "Video included. On-site possible depending on location; travel costs may apply."}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">{isFR ? "Important" : "Important"}</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {isFR
                    ? "La veille est réservée au VIP. PRO se concentre sur le calcul + la vérification facture + le suivi hebdo."
                    : "Watch is VIP-only. PRO focuses on calculation + invoice verification + weekly follow-up."}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {isFR
                    ? "Nous signalons des incohérences et risques opérationnels. La validation finale reste sous votre responsabilité (ou celle de vos conseils)."
                    : "We flag inconsistencies and operational risks. Final validation remains your responsibility (or your advisors’)."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/import/check-invoice">{isFR ? "Tester la vérification" : "Try the checker"}</Link>
                </Button>
                <Button asChild className="rounded-full bg-[#1E3A8A] hover:bg-[#162864]">
                  <Link to="/contact">{isFR ? "Demander un devis" : "Get a quote"}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
