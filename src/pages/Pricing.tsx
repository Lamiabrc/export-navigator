import { useMemo } from "react";
import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type TierSlug = "FREE" | "TOOL" | "PRO" | "VIP";

function safeLangGuess(): string {
  try {
    const lsLang =
      (typeof window !== "undefined" &&
        (window.localStorage?.getItem("lang") || window.localStorage?.getItem("language"))) ||
      "";
    const docLang = typeof document !== "undefined" ? document.documentElement.lang : "";
    const navLang = typeof navigator !== "undefined" ? navigator.language : "";
    return (lsLang || docLang || navLang || "fr").toLowerCase();
  } catch {
    return "fr";
  }
}

export default function Pricing() {
  const { t } = useI18n();
  const isFR = useMemo(() => safeLangGuess().startsWith("fr"), []);

  const pricingMeta =
    (t("pricing") as {
      headline: string;
      subhead: string;
      description: string;
      cta: string;
      tiers: Record<
        TierSlug,
        {
          name: string;
          price: string;
          description: string;
          features: string[];
        }
      >;
    }) ?? null;

  const defaults = useMemo(() => {
    if (!isFR) {
      return {
        headline: "Replace a fixed export admin hire with a tool + expert follow-up",
        subhead: "Simulator + invoice checks from €149/mo. Premium watch is VIP-only.",
        description:
          "Instead of adding headcount (salary + ramp-up + turnover risk), secure shipments with a structured tool and targeted support on critical points.",
        cta: "Talk to us",
        tiers: {
          FREE: {
            name: "FREE",
            price: "€0 (one-time)",
            description: "Try once: reduced simulator (single use).",
            features: [
              "1 reduced simulation (single use)",
              "Basic risk flags (level 1)",
              "No history / no ops tracking",
              "No watch (VIP only)",
            ],
          },
          TOOL: {
            name: "TOOL",
            price: "€149 / month",
            description: "100% online access: simulator + import/export invoice checks.",
            features: [
              "Full simulator (landed cost / cost-to-serve)",
              "Invoice verification (import/export): incoterms, totals, fees, currency, consistency alerts",
              "Operations tracking: docs, tasks, milestones, checklists",
              "History & repeatable controls",
              "Standard support (async)",
              "No watch (VIP only)",
            ],
          },
          PRO: {
            name: "PRO",
            price: "€250 / month",
            description: "TOOL + 1 hour/week follow-up (video or on-site).",
            features: [
              "Everything in TOOL",
              "1h/week follow-up (video or on-site) — corrections & action plan",
              "Operational templates (docs, checklists, shipment readiness)",
              "Standard priority handling",
            ],
          },
          VIP: {
            name: "VIP",
            price: "€480 / month",
            description: "Full package: PRO + premium watch + 1 day/month export pilot.",
            features: [
              "Everything in PRO",
              "Premium watch tool (destination-based) — VIP only",
              "Advanced invoice checks (rules, thresholds, exceptions)",
              "1 day/month export follow-up (workshop + operational setup)",
              "Priority support",
            ],
          },
        } as Record<TierSlug, { name: string; price: string; description: string; features: string[] }>,
      };
    }

    return {
      headline: "Évitez un recrutement ADV export : prenez l’outil + le suivi ciblé",
      subhead: "Simulateur + vérification facture dès 149€/mois. La veille premium est réservée au VIP.",
      description:
        "Plutôt que d’ajouter un coût fixe (salaire + charges + formation + risque de turnover), sécurisez vos opérations avec un outil structurant et un accompagnement sur les points qui coûtent cher.",
      cta: "Nous contacter",
      tiers: {
        FREE: {
          name: "FREE",
          price: "0 € (usage unique)",
          description: "Tester une fois : simulateur réduit (usage unique).",
          features: [
            "1 simulation réduite (usage unique)",
            "Alertes basiques (niveau 1)",
            "Pas d’historique / pas de suivi opération",
            "Pas de veille (réservée VIP)",
          ],
        },
        TOOL: {
          name: "TOOL",
          price: "149 € / mois",
          description: "Accès 100% en ligne : simulateur complet + vérification facture import/export.",
          features: [
            "Simulateur complet (coût rendu / landed cost)",
            "Vérification facture (import/export) : incoterm, totaux, frais, devise, alertes de cohérence",
            "Suivi d’opérations export : docs, tâches, jalons, checklists",
            "Historique & contrôles réutilisables",
            "Support standard (asynchrone)",
            "Pas de veille (réservée VIP)",
          ],
        },
        PRO: {
          name: "PRO",
          price: "250 € / mois",
          description: "TOOL + 1h/semaine de suivi (visio ou visite).",
          features: [
            "Tout TOOL",
            "1h/semaine de suivi (visio ou visite) — corrections & plan d’actions",
            "Templates opérationnels (docs, checklists, readiness expédition)",
            "Traitement standard priorisé",
          ],
        },
        VIP: {
          name: "VIP",
          price: "480 € / mois",
          description: "Formule complète : PRO + veille premium + 1 journée/mois de pilotage export.",
          features: [
            "Tout PRO",
            "Veille premium dans l’outil (par destination) — VIP uniquement",
            "Contrôles facture avancés (règles, seuils, exceptions)",
            "1 journée/mois de suivi export (atelier + mise en place opérationnelle)",
            "Support prioritaire",
          ],
        },
      } as Record<TierSlug, { name: string; price: string; description: string; features: string[] }>,
    };
  }, [isFR]);

  const resolved = useMemo(() => {
    if (!pricingMeta) return defaults;

    const tierKeys: TierSlug[] = ["FREE", "TOOL", "PRO", "VIP"];
    const tiers = {} as Record<TierSlug, { name: string; price: string; description: string; features: string[] }>;

    for (const k of tierKeys) {
      const tTier = pricingMeta.tiers?.[k];
      const dTier = defaults.tiers[k];

      tiers[k] = {
        name: tTier?.name?.trim() ? tTier.name : dTier.name,
        price: tTier?.price?.trim() ? tTier.price : dTier.price,
        description: tTier?.description?.trim() ? tTier.description : dTier.description,
        features: Array.isArray(tTier?.features) && tTier.features.length > 0 ? tTier.features : dTier.features,
      };
    }

    return {
      headline: pricingMeta.headline?.trim() ? pricingMeta.headline : defaults.headline,
      subhead: pricingMeta.subhead?.trim() ? pricingMeta.subhead : defaults.subhead,
      description: pricingMeta.description?.trim() ? pricingMeta.description : defaults.description,
      cta: pricingMeta.cta?.trim() ? pricingMeta.cta : defaults.cta,
      tiers,
    };
  }, [pricingMeta, defaults]);

  const tierKeys: TierSlug[] = ["FREE", "TOOL", "PRO", "VIP"];

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="bg-[#0B1220] py-16 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">Export Navigator</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{resolved.headline}</h1>
          <p className="mt-4 text-lg text-white/80">{resolved.subhead}</p>
          <p className="mt-2 text-sm text-white/70">{resolved.description}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="border-white/20 text-white/80">
              {isFR ? "FREE : 1 usage" : "FREE: 1 use"}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/80">
              {isFR ? "TOOL : 149€/mois (en ligne)" : "TOOL: €149/mo (online)"}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/80">
              {isFR ? "PRO : 1h/semaine" : "PRO: 1h/week"}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/80">
              {isFR ? "VIP : veille + 1 journée/mois" : "VIP: watch + 1 day/month"}
            </Badge>
          </div>

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
                      ? "Pourquoi ça remplace souvent une assistante ADV export"
                      : "Why this often replaces an export admin assistant"}
                  </CardTitle>
                  <Badge variant="outline">ROI</Badge>
                </div>
                <CardDescription>
                  {isFR
                    ? "Objectif : éviter un coût fixe et réduire les erreurs (factures, incoterms, frais, documents) qui font perdre du temps et de l’argent."
                    : "Goal: avoid fixed cost and reduce costly mistakes (invoices, incoterms, fees, documents)."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm text-slate-700">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      {isFR ? "Coût fixe" : "Fixed cost"}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {isFR ? "Recruter (salaire + charges + formation)" : "Hiring (salary + overhead + ramp-up)"}
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li>• {isFR ? "Temps de montée en compétence" : "Ramp-up time"}</li>
                      <li>• {isFR ? "Dépendance à une personne / turnover" : "Single-person dependency / turnover risk"}</li>
                      <li>• {isFR ? "Contrôles facture souvent “à la main”" : "Invoice checks often manual"}</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      {isFR ? "Alternative utile" : "Practical alternative"}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {isFR ? "Outil + suivi ciblé (TOOL/PRO/VIP)" : "Tool + targeted follow-up (TOOL/PRO/VIP)"}
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li>• {isFR ? "Vérification facture import/export outillée" : "Tooled import/export invoice checks"}</li>
                      <li>• {isFR ? "Simulateur = décisions plus sûres (coût rendu)" : "Simulator = safer decisions (landed cost)"}</li>
                      <li>• {isFR ? "Suivi opération = docs/jalons/checklists" : "Ops tracking = docs/milestones/checklists"}</li>
                      <li>• {isFR ? "Veille premium (VIP) = moins de surprises" : "Premium watch (VIP) = fewer surprises"}</li>
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
                <CardTitle className="text-lg">{isFR ? "Ce que l’outil couvre" : "What the tool covers"}</CardTitle>
                <CardDescription>
                  {isFR ? "Du concret : calculer, vérifier, suivre." : "Concrete: calculate, verify, track."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Simulateur complet" : "Full simulator"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR
                      ? "Coût rendu/landed cost : frais, surcharges, minimums, scénarios."
                      : "Landed cost: fees, surcharges, minimums, scenarios."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Vérification facture" : "Invoice verification"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR
                      ? "Import/export : incoterm, devise, totaux, frais, cohérences, alertes."
                      : "Import/export: incoterms, currency, totals, fees, consistency alerts."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Suivi opération" : "Ops tracking"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR ? "Documents, tâches, jalons, checklists d’expédition." : "Docs, tasks, milestones, shipment checklists."}
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
                  ? "TOOL = en ligne. PRO = suivi hebdo. VIP = formule complète + veille + journée de pilotage."
                  : "TOOL = online. PRO = weekly follow-up. VIP = full package + watch + monthly pilot day."}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {isFR ? "Sans engagement • Upgrade à tout moment" : "No commitment • Upgrade anytime"}
            </Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {tierKeys.map((key) => {
              const tier = resolved.tiers[key];
              const isPrimary = key === "PRO";
              const isTool = key === "TOOL";
              const isVip = key === "VIP";

              return (
                <article
                  key={key}
                  id={key.toLowerCase()}
                  className={[
                    "flex h-full flex-col justify-between gap-6 rounded-3xl border p-6 shadow-xl scroll-mt-24",
                    isPrimary ? "border-[#1E3A8A]/40 bg-white" : "border-slate-200/70 bg-slate-50",
                  ].join(" ")}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.5em] text-slate-500">{tier.name}</p>

                      {isTool && (
                        <Badge className="rounded-full bg-slate-900 text-white">
                          {isFR ? "Outil" : "Tool"}
                        </Badge>
                      )}

                      {isPrimary && (
                        <Badge className="rounded-full bg-[#1E3A8A] text-white">
                          {isFR ? "Recommandé" : "Recommended"}
                        </Badge>
                      )}

                      {isVip && (
                        <Badge className="rounded-full bg-amber-500 text-slate-900">
                          VIP
                        </Badge>
                      )}
                    </div>

                    <p className="mt-2 text-3xl font-semibold text-slate-900">{tier.price}</p>
                    <p className="mt-3 text-sm text-slate-600">{tier.description}</p>

                    {key === "VIP" && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        {isFR ? (
                          <>
                            <span className="font-semibold text-slate-900">Veille premium :</span> accessible uniquement en VIP (outil + alertes).
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-slate-900">Premium watch:</span> VIP only (tool + alerts).
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
                        isPrimary
                          ? "bg-[#1E3A8A] text-white hover:bg-[#162864]"
                          : "bg-slate-900 text-white hover:bg-slate-800",
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
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                  {isFR ? "Important" : "Important"}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {isFR
                    ? "TOOL = accès en ligne. PRO = suivi hebdo. VIP = veille premium + journée de pilotage."
                    : "TOOL = online access. PRO = weekly follow-up. VIP = premium watch + monthly pilot day."}
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
