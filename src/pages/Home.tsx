import { Link } from "react-router-dom";
import {
  TrendingUp,
  FileText,
  ShieldCheck,
  BellRing,
  Target,
  FileCheck2,
  BookOpen,
  Globe,
  CheckCircle2,
} from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { HeroCockpit } from "@/components/marketing/HeroCockpit";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { FeatureGridPremium } from "@/components/marketing/FeatureGridPremium";
import { StepsPremium } from "@/components/marketing/StepsPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Home() {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  usePageMeta("meta.home.title", "meta.home.description");

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY
  // ═══════════════════════════════════════════════════════════════════════════

  const heroCopy = {
    eyebrow: "MPL Export Navigator",
    title: isFr
      ? "Le cockpit export qui clarifie vos décisions."
      : "The export cockpit that clarifies your decisions.",
    subtitle: isFr
      ? "Réglez votre profil produits + destinations. Obtenez coût rendu, documents et risques avec alertes DDP/Incoterms."
      : "Set your product + destination profile. Get landed cost, documents, and risk alerts for DDP/Incoterms.",
    bullets: isFr
      ? [
          "Profil produit + destination pour fiabiliser les règles",
          "Coût rendu, taxes, transport, marge cible",
          "Checklist documents et alertes Incoterms",
          "Veille réglementaire sur vos marchés",
        ]
      : [
          "Product + destination profile to secure the rules",
          "Landed cost, taxes, transport, target margin",
          "Document checklist and Incoterms alerts",
          "Regulatory watch on your markets",
        ],
    primaryCta: { label: isFr ? "Voir le cockpit" : "View cockpit", to: "/analyse" },
    secondaryCta: { label: isFr ? "Offre en ligne 65 €/mois" : "Online €65/mo", to: "/pricing" },
    vipNote: {
      label: isFr
        ? "Veille personnalisée dans l'outil = réservée VIP"
        : "Personalized watch in the tool = VIP only",
      to: "/pricing#vip",
    },
    stats: [
      {
        value: isFr ? "4 blocs" : "4 blocks",
        label: isFr ? "Coût, docs, risque, veille" : "Cost, docs, risk, watch",
      },
      {
        value: isFr ? "2 modes" : "2 modes",
        label: isFr ? "Analyse export + contrôle facture" : "Export analysis + invoice check",
      },
      {
        value: isFr ? "1 profil" : "1 profile",
        label: isFr ? "Produit + destination pour être fiable" : "Product + destination for reliable rules",
      },
    ],
  };

  const pilotageCopy = {
    eyebrow: isFr ? "Ce que vous pilotez" : "What you control",
    title: isFr ? "Une lecture claire des décisions export" : "A clear view of export decisions",
    description: isFr
      ? "Coûts, conformité, documents et veille dans un cockpit unique."
      : "Costs, compliance, documents, and watch in one cockpit.",
    items: [
      {
        title: isFr ? "Coût rendu et marge" : "Landed cost and margin",
        description: isFr
          ? "Scénarios rapides : droits, taxes, transport, prix cible."
          : "Fast scenarios: duties, taxes, transport, target price.",
        icon: TrendingUp,
      },
      {
        title: isFr ? "Conformité et DDP" : "Compliance and DDP",
        description: isFr
          ? "Alertes sur responsabilités, TVA, clauses et risques pays."
          : "Alerts on responsibilities, VAT, clauses, and country risk.",
        icon: ShieldCheck,
      },
      {
        title: isFr ? "Documents clairs" : "Clear documents",
        description: isFr
          ? "Checklist par destination, preuves, mentions et formats."
          : "Checklist by destination, proofs, statements, formats.",
        icon: FileText,
      },
      {
        title: isFr ? "Veille ciblée" : "Targeted watch",
        description: isFr
          ? "Signaux réglementaires et sanctions à surveiller."
          : "Regulatory signals and sanctions to watch.",
        icon: BellRing,
      },
    ],
  };

  const stepsCopy = {
    eyebrow: isFr ? "Comment ça marche" : "How it works",
    title: isFr ? "3 étapes, sans frictions" : "3 steps, no friction",
    description: isFr ? "Du profil à la décision en quelques minutes." : "From profile to decision in minutes.",
    label: isFr ? "Étape" : "Step",
    items: [
      {
        title: isFr ? "Définir le profil" : "Define the profile",
        description: isFr
          ? "Produit/HS, destination, Incoterm, volumes et contexte."
          : "Product/HS, destination, Incoterm, volumes, context.",
      },
      {
        title: isFr ? "Lancer l'analyse" : "Run the analysis",
        description: isFr
          ? "Scénario export ou contrôle facture selon le besoin."
          : "Export scenario or invoice check based on the need.",
      },
      {
        title: isFr ? "Décider et partager" : "Decide and share",
        description: isFr
          ? "GO/NO GO, actions à mener, documents à fournir."
          : "GO/NO GO, actions to take, documents to provide.",
      },
    ],
  };

  const toolsCopy = {
    eyebrow: isFr ? "Outils phares" : "Featured tools",
    title: isFr ? "Les modules clés du cockpit" : "Key cockpit modules",
    description: isFr
      ? "Analyse export, contrôle facture, veille VIP, guides."
      : "Export analysis, invoice check, VIP watch, guides.",
    items: [
      {
        title: isFr ? "Analyse export" : "Export analysis",
        description: isFr
          ? "Lecture pays/produit, coût rendu, Incoterms."
          : "Country/product view, landed cost, Incoterms.",
        icon: Target,
        badge: isFr ? "Public" : "Public",
        link: { to: "/analyse", label: isFr ? "Ouvrir" : "Open" },
      },
      {
        title: isFr ? "Contrôle facture" : "Invoice check",
        description: isFr
          ? "Vérification lignes, totaux, incohérences."
          : "Line checks, totals, inconsistency flags.",
        icon: FileCheck2,
        badge: "PRO",
        link: { to: "/import/check-invoice", label: isFr ? "Accéder" : "Access" },
      },
      {
        title: isFr ? "Veille VIP" : "VIP watch",
        description: isFr
          ? "Alertes personnalisées dans l'outil."
          : "Personalized alerts inside the tool.",
        icon: BellRing,
        badge: "VIP",
        link: { to: "/pricing#vip", label: isFr ? "Voir VIP" : "View VIP" },
      },
      {
        title: isFr ? "Guides" : "Guides",
        description: isFr
          ? "Incoterms, DDP, bonnes pratiques."
          : "Incoterms, DDP, best practices.",
        icon: BookOpen,
        badge: isFr ? "Public" : "Public",
        link: { to: "/guides", label: isFr ? "Explorer" : "Explore" },
      },
    ],
  };

  const trustCopy = {
    eyebrow: isFr ? "Confiance" : "Trust",
    title: isFr ? "Sources, conformité, limites claires" : "Sources, compliance, clear limits",
    description: isFr
      ? "Un cadre fiable, et une validation humaine quand le risque l'exige."
      : "A reliable framework and human validation when risk requires it.",
    items: [
      {
        title: isFr ? "Sources officielles" : "Official sources",
        description: isFr
          ? "Douanes, Incoterms, régimes fiscaux, sanctions. Sources typiques et citées."
          : "Customs, Incoterms, tax regimes, sanctions. Typical sources, cited when possible.",
        icon: Globe,
      },
      {
        title: isFr ? "Cadre de conformité" : "Compliance frame",
        description: isFr
          ? "L'outil structure la décision, sans remplacer un agent en douane."
          : "The tool structures the decision without replacing a customs broker.",
        icon: ShieldCheck,
      },
      {
        title: isFr ? "Limites claires" : "Clear limits",
        description: isFr
          ? "Cas sensibles ou DDP : audit express et validation humaine."
          : "Sensitive cases or DDP: express audit and human validation.",
        icon: FileCheck2,
      },
    ],
  };

  const ctaCopy = {
    eyebrow: isFr ? "Audit express" : "Express audit",
    title: isFr
      ? "Besoin d'un regard expert avant expédition ?"
      : "Need an expert review before shipment?",
    description: isFr
      ? "Nous validons les cas sensibles (DDP, sanctions, produits à risque) et vous donnons un plan d'action clair."
      : "We validate sensitive cases (DDP, sanctions, risk products) and provide a clear action plan.",
    primaryCta: {
      label: isFr ? "Demander un diagnostic" : "Request a diagnostic",
      to: "/contact?offer=diagnostic",
    },
    secondaryCta: { label: isFr ? "Voir le cockpit" : "View cockpit", to: "/analyse" },
    note: "contact@exportfrancefacile.com | 06 76 43 55 51",
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <PremiumMarketingLayout>
      {/* Hero */}
      <HeroCockpit
        eyebrow={heroCopy.eyebrow}
        title={heroCopy.title}
        subtitle={heroCopy.subtitle}
        bullets={heroCopy.bullets}
        primaryCta={heroCopy.primaryCta}
        secondaryCta={heroCopy.secondaryCta}
        stats={heroCopy.stats}
        vipNote={heroCopy.vipNote}
      />

      {/* Pilotage */}
      <SectionPremium
        eyebrow={pilotageCopy.eyebrow}
        title={pilotageCopy.title}
        description={pilotageCopy.description}
        variant="muted"
      >
        <FeatureGridPremium items={pilotageCopy.items} columns={4} />
      </SectionPremium>

      {/* Steps */}
      <SectionPremium
        eyebrow={stepsCopy.eyebrow}
        title={stepsCopy.title}
        description={stepsCopy.description}
      >
        <StepsPremium items={stepsCopy.items} label={stepsCopy.label} />
      </SectionPremium>

      {/* Tools */}
      <SectionPremium
        eyebrow={toolsCopy.eyebrow}
        title={toolsCopy.title}
        description={toolsCopy.description}
        variant="muted"
      >
        <FeatureGridPremium items={toolsCopy.items} columns={4} />
      </SectionPremium>

      {/* Trust */}
      <SectionPremium
        eyebrow={trustCopy.eyebrow}
        title={trustCopy.title}
        description={trustCopy.description}
      >
        <FeatureGridPremium items={trustCopy.items} columns={3} />

        {/* VIP Note */}
        <div className="mt-8 rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <p className="text-sm font-medium text-[hsl(var(--mkt-ink))]">
                {isFr
                  ? "Veille personnalisée dans l'outil = réservée VIP"
                  : "Personalized watch in the tool = VIP only"}
              </p>
            </div>
            <Link
              to="/pricing#vip"
              className="mkt-btn mkt-btn-secondary text-xs"
            >
              {isFr ? "Voir l'offre VIP" : "See VIP offer"}
            </Link>
          </div>
        </div>
      </SectionPremium>

      {/* CTA Strip */}
      <CTAStripPremium
        eyebrow={ctaCopy.eyebrow}
        title={ctaCopy.title}
        description={ctaCopy.description}
        primaryCta={ctaCopy.primaryCta}
        secondaryCta={ctaCopy.secondaryCta}
        note={ctaCopy.note}
      />
    </PremiumMarketingLayout>
  );
}
