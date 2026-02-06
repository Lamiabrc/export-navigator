import { Link } from "react-router-dom";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Target,
  FileCheck2,
  BellRing,
} from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { FeatureGridPremium } from "@/components/marketing/FeatureGridPremium";
import { StepsPremium } from "@/components/marketing/StepsPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function ToolPage() {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  usePageMeta("meta.tool.title", "meta.tool.description");

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY
  // ═══════════════════════════════════════════════════════════════════════════

  const heroCopy = {
    eyebrow: isFr ? "Outil gratuit" : "Free tool",
    title: isFr
      ? "Calcul rapide du coût export (landed cost)"
      : "Quick export cost calculation (landed cost)",
    subtitle: isFr
      ? "Estimez votre coût rendu (transport, assurance, droits, TVA, frais) et prenez une décision éclairée en quelques minutes."
      : "Estimate your landed cost (transport, insurance, duties, VAT, fees) and make an informed decision in minutes.",
    reassurance: isFr
      ? "Sans inscription • Résultat immédiat • Pensé pour les PME qui exportent"
      : "No registration • Instant result • Designed for exporting SMEs",
  };

  const trustItems = [
    {
      title: isFr ? "Résultat clair & exploitable" : "Clear & actionable result",
      description: isFr
        ? "Total, coût unitaire, et ventilation des postes pour piloter vos marges."
        : "Total, unit cost, and breakdown by line to manage your margins.",
      icon: CheckCircle2,
    },
    {
      title: isFr ? "Alerte sur les points sensibles" : "Alerts on sensitive points",
      description: isFr
        ? "L'outil signale les zones d'incertitude (données manquantes, hypothèses, risques)."
        : "The tool flags uncertainty areas (missing data, assumptions, risks).",
      icon: AlertTriangle,
    },
    {
      title: isFr ? "Option validation humaine" : "Human validation option",
      description: isFr
        ? "Pour sécuriser conformité & documents avant engagement (audit export sur demande)."
        : "To secure compliance & documents before commitment (export audit on request).",
      icon: ShieldCheck,
    },
  ];

  const steps = [
    {
      title: isFr ? "Saisissez vos paramètres" : "Enter your parameters",
      description: isFr
        ? "Destination, Incoterm, mode de transport, valeur, quantités et frais."
        : "Destination, Incoterm, transport mode, value, quantities, and fees.",
    },
    {
      title: isFr ? "Obtenez un coût rendu" : "Get a landed cost",
      description: isFr
        ? "Total + coût unitaire + ventilation détaillée par poste."
        : "Total + unit cost + detailed breakdown by line.",
    },
    {
      title: isFr ? "Sécurisez la décision" : "Secure the decision",
      description: isFr
        ? "En cas de doute : audit / revue humaine (conformité, risques, doc)."
        : "When in doubt: audit / human review (compliance, risks, doc).",
    },
  ];

  const features = [
    {
      title: isFr ? "Calcul rapide" : "Quick calculation",
      description: isFr
        ? "Résultat en quelques secondes, sans inscription ni complexité."
        : "Result in seconds, no registration or complexity.",
      icon: Sparkles,
    },
    {
      title: isFr ? "Ventilation détaillée" : "Detailed breakdown",
      description: isFr
        ? "Chaque poste visible : transport, droits, taxes, frais annexes."
        : "Each line visible: transport, duties, taxes, ancillary fees.",
      icon: Target,
    },
    {
      title: isFr ? "Avertissements intégrés" : "Built-in warnings",
      description: isFr
        ? "Alertes sur les points de vigilance (DDP, sanctions, licences)."
        : "Alerts on watch points (DDP, sanctions, licenses).",
      icon: AlertTriangle,
    },
    {
      title: isFr ? "Décision facilitée" : "Easier decision",
      description: isFr
        ? "Un récapitulatif clair pour négocier ou valider votre prix export."
        : "A clear summary to negotiate or validate your export price.",
      icon: FileCheck2,
    },
  ];

  const limitations = isFr
    ? [
        "Les tarifs réels varient selon devis et saison (fret, assurances).",
        "Les droits/TVA dépendent du classement (HS), origine, accords, régimes.",
        "Certains pays/produits nécessitent licences, contrôles, docs spécifiques.",
        "Les sanctions/embargos et règles de conformité doivent être vérifiés.",
      ]
    : [
        "Actual rates vary by quote and season (freight, insurance).",
        "Duties/VAT depend on classification (HS), origin, agreements, regimes.",
        "Some countries/products require licenses, controls, specific docs.",
        "Sanctions/embargoes and compliance rules must be verified.",
      ];

  const auditCases = isFr
    ? [
        "Montants importants / marge serrée",
        "Nouveau pays ou nouveau produit",
        "Doute HS code / origine / accords préférentiels",
        "Risque sanctions / exigences documentaires",
      ]
    : [
        "Large amounts / tight margin",
        "New country or new product",
        "HS code / origin / preferential agreements uncertainty",
        "Sanctions risk / document requirements",
      ];

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <PremiumMarketingLayout>
      {/* Hero */}
      <section className="mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden">
        <div className="mkt-container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {heroCopy.eyebrow}
            </p>

            <h1 className="mkt-display mkt-display-xl mt-4 text-white">
              {heroCopy.title}
            </h1>

            <p className="mt-6 text-lg leading-relaxed" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {heroCopy.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/analyse" className="mkt-btn mkt-btn-primary">
                {isFr ? "Lancer une analyse" : "Start an analysis"}
              </Link>
              <Link to="/contact" className="mkt-btn mkt-btn-light">
                {isFr ? "Demander une validation humaine" : "Request human validation"}
              </Link>
            </div>

            <p className="mt-6 text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {heroCopy.reassurance}
            </p>
          </div>

          {/* Trust cards */}
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item.title}
                className="mkt-card-dark rounded-2xl border border-white/10 p-6"
              >
                <div className="flex items-center gap-3 text-white">
                  <item.icon className="h-5 w-5" />
                  <span className="font-semibold">{item.title}</span>
                </div>
                <p className="mt-3 text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <SectionPremium
        eyebrow={isFr ? "Comment ça marche" : "How it works"}
        title={isFr ? "En 3 étapes : saisie → calcul → décision" : "3 steps: input → calculation → decision"}
        description={
          isFr
            ? "Simple, rapide, et utile pour cadrer un prix de vente à l'international."
            : "Simple, fast, and useful for framing an international selling price."
        }
      >
        <StepsPremium items={steps} label={isFr ? "Étape" : "Step"} />
      </SectionPremium>

      {/* Features */}
      <SectionPremium
        eyebrow={isFr ? "Fonctionnalités" : "Features"}
        title={isFr ? "Ce que l'outil vous apporte" : "What the tool gives you"}
        description={
          isFr
            ? "Une base solide pour estimer et comparer, avant d'aller plus loin."
            : "A solid base to estimate and compare, before going further."
        }
        variant="muted"
      >
        <FeatureGridPremium items={features} columns={4} />

        <div className="mt-10 flex flex-wrap gap-4">
          <Link to="/analyse" className="mkt-btn mkt-btn-secondary">
            {isFr ? "Lancer une analyse" : "Start an analysis"}
          </Link>
          <Link to="/contact" className="mkt-btn mkt-btn-outline">
            {isFr ? "Demander une validation humaine" : "Request human validation"}
          </Link>
        </div>
      </SectionPremium>

      {/* Limitations */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-section-dark rounded-3xl p-8 md:p-12">
            <div className="mb-8">
              <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                {isFr ? "Limites & hypothèses" : "Limits & assumptions"}
              </p>
              <h2 className="mkt-display mkt-display-md mt-2 text-white">
                {isFr ? "Ce que l'outil ne fait pas" : "What the tool doesn't do"}
              </h2>
              <p className="mt-4 max-w-2xl text-lg" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                {isFr
                  ? "Cet outil est une estimation. Pour une décision engageante, une revue humaine reste recommandée."
                  : "This tool is an estimate. For binding decisions, human review is still recommended."}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Limitations */}
              <div className="mkt-card-dark rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 text-white">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">{isFr ? "À garder en tête" : "Keep in mind"}</span>
                </div>
                <ul className="mt-4 space-y-3">
                  {limitations.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/50 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* When to audit */}
              <div className="mkt-card-dark rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 text-white">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="font-semibold">{isFr ? "Quand demander un audit" : "When to request an audit"}</span>
                </div>
                <ul className="mt-4 space-y-3">
                  {auditCases.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/50 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link to="/contact" className="mkt-btn mkt-btn-primary text-xs">
                    {isFr ? "Demander une validation" : "Request validation"}
                  </Link>
                  <span className="text-xs" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                    {isFr ? "Réponse sous 24-48h" : "Response within 24-48h"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
              {isFr
                ? "Note : l'outil aide à cadrer une décision, il ne remplace pas un conseil réglementaire ni un devis transport / douane."
                : "Note: the tool helps frame a decision, it does not replace regulatory advice or a transport/customs quote."}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTAStripPremium
        eyebrow={isFr ? "Prêt à estimer ?" : "Ready to estimate?"}
        title={isFr ? "Lancez votre première analyse export" : "Start your first export analysis"}
        description={
          isFr
            ? "Gratuit, sans inscription, résultat immédiat."
            : "Free, no registration, instant result."
        }
        primaryCta={{
          label: isFr ? "Lancer l'analyse" : "Start analysis",
          to: "/analyse",
        }}
        secondaryCta={{
          label: isFr ? "Voir les tarifs" : "See pricing",
          to: "/pricing",
        }}
        note="contact@exportfrancefacile.com | 06 76 43 55 51"
      />
    </PremiumMarketingLayout>
  );
}
