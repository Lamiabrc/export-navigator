import { useMemo } from "react";
import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type TierSlug = "FREE" | "PRO" | "VIP";

function safeLangGuess(): string {
  try {
    const lsLang =
      (typeof window !== "undefined" && (window.localStorage?.getItem("lang") || window.localStorage?.getItem("language"))) ||
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
    }) ?? {
      headline: "",
      subhead: "",
      description: "",
      cta: "Choisir",
      tiers: {
        FREE: { name: "FREE", price: "0 €", description: "", features: [] },
        PRO: { name: "PRO", price: "290 €/mois", description: "", features: [] },
        VIP: { name: "VIP", price: "690 €/mois", description: "", features: [] },
      },
    };

  const defaults = useMemo(() => {
    if (!isFR) {
      return {
        headline: "Plans that cost less than one hire — and secure every export operation",
        subhead: "Tool + consulting: track, verify, decide. Stop paying for blind spots.",
        description:
          "Instead of hiring an export admin, use a specialized stack: landed cost, compliance checks, invoice verification and real-time watch — backed by export consulting when you need it.",
        cta: "Talk to us",
        tiers: {
          FREE: {
            name: "FREE",
            price: "€0",
            description: "Discover the tool, run your first checks, get a structured export view.",
            features: [
              "Access to basic calculators (structure, checklists)",
              "Country/destination overview (Incoterms + key docs)",
              "Watch feed (public sources) — limited view",
              "1 export project saved (starter workspace)",
            ],
          },
          PRO: {
            name: "PRO",
            price: "€149 / month",
            description: "SMEs: run operations with the tool + reliable controls + monthly support.",
            features: [
              "Operations tracking (status, documents, tasks)",
              "Import/Export invoice checker (Incoterms, currency, totals, fees, consistency alerts)",
              "Landed cost calculator (transport, minimum fees, surcharges)",
              "Watch & regulatory events (filtered by destination)",
              "1h/month consulting included (audit & corrections)",
            ],
          },
          VIP: {
            name: "VIP",
            price: "€399 / month",
            description: "High intensity export: full controls, deeper watch, priority support.",
            features: [
              "Everything in PRO",
              "Advanced invoice verification rules (custom controls & thresholds)",
              "Team workspace + audit trail (who changed what, when)",
              "Priority consulting included (4h/month) + SLA response",
              "VIP insights (risk & profitability signals) — when data is configured",
            ],
          },
        } as Record<TierSlug, { name: string; price: string; description: string; features: string[] }>,
      };
    }

    return {
      headline: "Des offres moins chères qu’un recrutement — et plus fiables pour vos exports",
      subhead: "Outil + consultation : suivez, vérifiez, décidez. Sans payer les angles morts.",
      description:
        "Plutôt que recruter une assistante ADV export, vous accédez à un outil de pilotage + des contrôles facture import/export + une veille ciblée, avec de la consultation quand vous en avez besoin.",
      cta: "Nous contacter",
      tiers: {
        FREE: {
          name: "FREE",
          price: "0 €",
          description: "Découvrir l’outil, structurer un premier export, lancer des vérifications simples.",
          features: [
            "Accès aux bases (checklists, structure d’un dossier export)",
            "Aperçu destination (Incoterms + docs clés)",
            "Veille (sources publiques) — accès limité",
            "1 projet export sauvegardé (espace de travail starter)",
          ],
        },
        PRO: {
          name: "PRO",
          price: "149 € / mois",
          description: "PME : outil + contrôles fiables + accompagnement mensuel.",
          features: [
            "Suivi d’opérations export (statuts, documents, tâches, jalons)",
            "Vérification facture import/export (Incoterms, devise, totaux, frais, alertes de cohérence)",
            "Calcul coût rendu / landed cost (transport, minimums, surcharges)",
            "Veille & événements réglementaires (filtrés par destination)",
            "1h/mois de consultation incluse (audit & corrections)",
          ],
        },
        VIP: {
          name: "VIP",
          price: "399 € / mois",
          description: "Export soutenu : contrôles avancés, veille approfondie, support prioritaire.",
          features: [
            "Tout PRO",
            "Règles de vérification facture avancées (contrôles personnalisés, seuils)",
            "Espace équipe + traçabilité (qui a modifié quoi, quand)",
            "4h/mois de consultation incluse + réponse prioritaire",
            "Insights VIP (risque & rentabilité) — si référentiels configurés",
          ],
        },
      } as Record<TierSlug, { name: string; price: string; description: string; features: string[] }>,
    };
  }, [isFR]);

  const tierKeys: TierSlug[] = ["FREE", "PRO", "VIP"];

  // Fusion i18n -> fallback : si tes traductions sont remplies, elles gagnent.
  const resolved = useMemo(() => {
    const safeHeadline = pricingMeta.headline?.trim() ? pricingMeta.headline : defaults.headline;
    const safeSubhead = pricingMeta.subhead?.trim() ? pricingMeta.subhead : defaults.subhead;
    const safeDesc = pricingMeta.description?.trim() ? pricingMeta.description : defaults.description;
    const safeCta = pricingMeta.cta?.trim() ? pricingMeta.cta : defaults.cta;

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

    return { headline: safeHeadline, subhead: safeSubhead, description: safeDesc, cta: safeCta, tiers };
  }, [pricingMeta, defaults]);

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
            <Button asChild className="rounded-full bg-[#1E3A8A] px-6 py-5 text-xs font-semibold uppercase tracking-[0.35em] hover:bg-[#162864]">
              <Link to="/contact">{resolved.cta}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-white/20 bg-transparent px-6 py-5 text-xs font-semibold uppercase tracking-[0.35em] text-white hover:bg-white/10"
            >
              <Link to="/import/check-invoice">{isFR ? "Voir l’outil de vérification" : "See the invoice checker"}</Link>
            </Button>
          </div>

          <p className="mt-3 text-xs text-white/55">
            {isFR
              ? "NB : l’outil détecte des incohérences et risques — la validation finale reste de votre responsabilité (ou de votre conseil)."
              : "Note: the tool flags inconsistencies and risks — final validation remains your responsibility (or your advisor’s)."}
          </p>
        </div>
      </section>

      {/* ROI / WHY NOT HIRE */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="rounded-3xl border-slate-200/70 shadow-sm lg:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">
                    {isFR ? "Pourquoi recruter une ADV export n’est pas la meilleure option" : "Why hiring an export admin is often the wrong move"}
                  </CardTitle>
                  <Badge variant="outline">{isFR ? "ROI" : "ROI"}</Badge>
                </div>
                <CardDescription>
                  {isFR
                    ? "Un recrutement coûte cher, prend du temps, et ne couvre pas toujours la conformité / la data / les contrôles facture."
                    : "Hiring is expensive, slow, and doesn’t reliably cover compliance, data, and invoice controls."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-700">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      {isFR ? "Option A" : "Option A"}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {isFR ? "Recruter une assistante ADV export" : "Hire an export admin"}
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li>• {isFR ? "Coût employeur souvent ~ 45–65 k€/an (selon profil/charges)" : "Employer cost often ~ €45–65k/year (depending on profile & charges)"}</li>
                      <li>• {isFR ? "Montée en compétence + dépendance à une personne" : "Ramp-up time + dependency on one person"}</li>
                      <li>• {isFR ? "Contrôles facture & conformité = rarement outillés" : "Invoice controls & compliance are rarely properly tooled"}</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      {isFR ? "Option B" : "Option B"}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {isFR ? "Export Navigator + consultation ciblée" : "Export Navigator + targeted consulting"}
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li>• {isFR ? "Outil de pilotage + vérification facture import/export" : "Operations tool + import/export invoice verification"}</li>
                      <li>• {isFR ? "Veille destination + alertes (réglementaire/commercial)" : "Destination watch + alerts (regulatory/commercial)"}</li>
                      <li>• {isFR ? "Expertise mobilisable à la demande (sans salaire fixe)" : "On-demand expertise (no fixed salary)"}</li>
                    </ul>
                  </div>
                </div>

                <Separator />

                <p className="text-xs text-slate-500">
                  {isFR
                    ? "Estimation indicative : le coût employeur dépend du contrat, du niveau, du lieu et des charges. L’argument clé : vous remplacez un salaire fixe par un outil + de l’expertise ponctuelle."
                    : "Indicative estimate: employer cost depends on contract, seniority, location and charges. Key idea: replace fixed salary with a tool + on-demand expertise."}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{isFR ? "Ce que vous obtenez (concret)" : "What you get (concrete)"}</CardTitle>
                <CardDescription>
                  {isFR ? "Moins d’erreurs, moins d’allers-retours, plus de visibilité." : "Fewer errors, fewer back-and-forths, more visibility."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Suivi d’opérations" : "Operations tracking"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR ? "Statuts, docs, checklists, tâches, jalons." : "Statuses, documents, checklists, tasks, milestones."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Vérification facture" : "Invoice verification"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR
                      ? "Contrôles Incoterms, devise, totaux, frais, cohérences."
                      : "Checks Incoterms, currency, totals, fees, consistency."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{isFR ? "Décision & conformité" : "Decision & compliance"}</p>
                  <p className="mt-1 text-slate-600">
                    {isFR ? "Coût rendu / landed cost + veille destination." : "Landed cost + destination watch."}
                  </p>
                </div>

                <Button asChild className="mt-2 w-full rounded-full bg-[#1E3A8A] text-xs font-semibold uppercase tracking-[0.35em] hover:bg-[#162864]">
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
              <h2 className="text-2xl font-semibold text-slate-900">{isFR ? "Choisissez votre niveau d’autonomie" : "Choose your autonomy level"}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {isFR
                  ? "L’outil vous structure. La consultation vous sécurise sur les points critiques (factures, incoterms, coûts, conformité)."
                  : "The tool structures your process. Consulting secures critical points (invoices, Incoterms, costs, compliance)."}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {isFR ? "Sans engagement • Upgrade à tout moment" : "No commitment • Upgrade anytime"}
            </Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {tierKeys.map((key) => {
              const tier = resolved.tiers[key];

              const isPrimary = key === "PRO";
              return (
                <article
                  key={key}
                  className={[
                    "flex h-full flex-col justify-between gap-6 rounded-3xl border p-6 shadow-xl",
                    isPrimary ? "border-[#1E3A8A]/40 bg-white" : "border-slate-200/70 bg-slate-50",
                  ].join(" ")}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.5em] text-slate-500">{tier.name}</p>
                      {isPrimary && <Badge className="rounded-full bg-[#1E3A8A] text-white">{isFR ? "Recommandé" : "Recommended"}</Badge>}
                    </div>

                    <p className="mt-2 text-3xl font-semibold text-slate-900">{tier.price}</p>
                    <p className="mt-3 text-sm text-slate-600">{tier.description}</p>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      {isFR ? (
                        <>
                          <span className="font-semibold text-slate-900">Repère ROI :</span> même le plan VIP coûte bien moins qu’un salaire mensuel chargé.
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-900">ROI marker:</span> even VIP costs far less than one loaded monthly salary.
                        </>
                      )}
                    </div>
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

                    {key !== "FREE" && (
                      <p className="text-center text-xs text-slate-500">
                        {isFR
                          ? "Besoin d’un audit facture ponctuel ? On peut intervenir sans abonnement."
                          : "Need a one-off invoice audit? We can intervene without subscription."}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* ADD-ONS / USE CASES */}
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <Card className="rounded-3xl border-slate-200/70">
              <CardHeader>
                <CardTitle className="text-base">{isFR ? "Cas d’usage : vérification facture" : "Use case: invoice verification"}</CardTitle>
                <CardDescription>
                  {isFR
                    ? "Avant paiement / avant dédouanement : réduire les litiges et coûts cachés."
                    : "Before payment / before clearance: reduce disputes and hidden costs."}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="space-y-2">
                  <li>• {isFR ? "Frais incohérents (transport, surcharges, minimums)" : "Inconsistent fees (transport, surcharges, minimums)"}</li>
                  <li>• {isFR ? "Mauvais Incoterm / mauvaise base de calcul" : "Wrong Incoterm / wrong calculation basis"}</li>
                  <li>• {isFR ? "Erreurs de devise, quantités, totaux, conversions" : "Currency, quantities, totals, conversion errors"}</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/70">
              <CardHeader>
                <CardTitle className="text-base">{isFR ? "Cas d’usage : suivi d’opérations export" : "Use case: export ops tracking"}</CardTitle>
                <CardDescription>
                  {isFR ? "Un dossier clair = moins d’allers-retours et moins d’oubli." : "Clear files = fewer back-and-forths and fewer misses."}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="space-y-2">
                  <li>• {isFR ? "Checklist docs (facture, packing list, BL/AWB, origine…)" : "Doc checklist (invoice, packing list, BL/AWB, origin…)"}</li>
                  <li>• {isFR ? "Statuts & jalons, tâches, rappels" : "Statuses & milestones, tasks, reminders"}</li>
                  <li>• {isFR ? "Historique + traçabilité" : "History + audit trail"}</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/70">
              <CardHeader>
                <CardTitle className="text-base">{isFR ? "Cas d’usage : veille et conformité" : "Use case: watch & compliance"}</CardTitle>
                <CardDescription>
                  {isFR ? "Rester aligné avec les règles selon la destination." : "Stay aligned with rules per destination."}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="space-y-2">
                  <li>• {isFR ? "Veille par pays/zone (douane, commerce, alertes)" : "Watch by country/zone (customs, trade, alerts)"}</li>
                  <li>• {isFR ? "Événements réglementaires (suivi + preuves)" : "Regulatory events (tracking + evidence)"}</li>
                  <li>• {isFR ? "Référentiels internes (incoterms, destinations, taux…)" : "Internal references (Incoterms, destinations, rates…)"}</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                  {isFR ? "Conclusion" : "Bottom line"}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {isFR
                    ? "Évitez un salaire fixe : outillez vos opérations + sécurisez vos points critiques avec nous."
                    : "Avoid a fixed salary: tool your operations + secure critical points with us."}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {isFR
                    ? "On intervient quand c’est utile (factures, coûts, incoterms, conformité) — le reste, l’outil le structure."
                    : "We step in when it matters (invoices, costs, Incoterms, compliance) — the tool structures the rest."}
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
