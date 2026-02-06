import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  BookOpen,
  FileCheck2,
  FileText,
  Globe,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { HeroPremium } from "@/components/marketing/HeroPremium";
import { Section } from "@/components/marketing/Section";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { Steps } from "@/components/marketing/Steps";
import { CTAStrip } from "@/components/marketing/CTAStrip";
import { Footer } from "@/components/marketing/Footer";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

import "@/styles/marketing.css";

type CopyItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export default function Home() {
  const { t, lang } = useI18n();
  const isEN = lang === "en";

  usePageMeta("meta.home.title", "meta.home.description");

  const tt = (key: string, frFallback: string, enFallback: string) => {
    const candidate = t(key);
    if (typeof candidate === "string" && candidate && candidate !== key) return candidate;
    return isEN ? enFallback : frFallback;
  };

  const ttList = <T,>(key: string, frFallback: T[], enFallback: T[]) => {
    const candidate = t(key);
    if (Array.isArray(candidate) && candidate.length > 0) return candidate as T[];
    return isEN ? enFallback : frFallback;
  };

  const heroBullets = ttList<string>(
    "homePremium.hero.bullets",
    [
      "Profil produit + destination pour fiabiliser les regles",
      "Cout rendu, taxes, transport, marge cible",
      "Checklist documents et alertes Incoterms",
      "Veille reglementaire sur vos marches",
    ],
    [
      "Product + destination profile to secure the rules",
      "Landed cost, taxes, transport, target margin",
      "Document checklist and Incoterms alerts",
      "Regulatory watch on your markets",
    ],
  );

  const heroStats = [
    {
      value: tt("homePremium.hero.stats.0.value", "4 blocs", "4 blocks"),
      label: tt("homePremium.hero.stats.0.label", "Cout, docs, risque, veille", "Cost, docs, risk, watch"),
    },
    {
      value: tt("homePremium.hero.stats.1.value", "2 modes", "2 modes"),
      label: tt(
        "homePremium.hero.stats.1.label",
        "Analyse export + controle facture",
        "Export analysis + invoice check",
      ),
    },
    {
      value: tt("homePremium.hero.stats.2.value", "1 profil", "1 profile"),
      label: tt(
        "homePremium.hero.stats.2.label",
        "Produit + destination pour etre fiable",
        "Product + destination for reliable rules",
      ),
    },
  ];

  const pilotageItems = [
    {
      title: tt("homePremium.pilotage.cost.title", "Cout rendu et marge", "Landed cost and margin"),
      description: tt(
        "homePremium.pilotage.cost.desc",
        "Scenarios rapides: droits, taxes, transport, prix cible.",
        "Fast scenarios: duties, taxes, transport, target price.",
      ),
      icon: TrendingUp,
    },
    {
      title: tt("homePremium.pilotage.compliance.title", "Conformite et DDP", "Compliance and DDP"),
      description: tt(
        "homePremium.pilotage.compliance.desc",
        "Alertes sur responsabilites, TVA, clauses et risques pays.",
        "Alerts on responsibilities, VAT, clauses, and country risk.",
      ),
      icon: ShieldCheck,
    },
    {
      title: tt("homePremium.pilotage.docs.title", "Documents clairs", "Clear documents"),
      description: tt(
        "homePremium.pilotage.docs.desc",
        "Checklist par destination, preuves, mentions et formats.",
        "Checklist by destination, proofs, statements, formats.",
      ),
      icon: FileText,
    },
    {
      title: tt("homePremium.pilotage.watch.title", "Veille ciblee", "Targeted watch"),
      description: tt(
        "homePremium.pilotage.watch.desc",
        "Signaux reglementaires et sanctions a surveiller.",
        "Regulatory signals and sanctions to watch.",
      ),
      icon: BellRing,
    },
  ];

  const steps = [
    {
      title: tt("homePremium.steps.0.title", "Definir le profil", "Define the profile"),
      description: tt(
        "homePremium.steps.0.desc",
        "Produit/HS, destination, Incoterm, volumes et contexte.",
        "Product/HS, destination, Incoterm, volumes, context.",
      ),
    },
    {
      title: tt("homePremium.steps.1.title", "Lancer l'analyse", "Run the analysis"),
      description: tt(
        "homePremium.steps.1.desc",
        "Scenario export ou controle facture selon le besoin.",
        "Export scenario or invoice check based on the need.",
      ),
    },
    {
      title: tt("homePremium.steps.2.title", "Decider et partager", "Decide and share"),
      description: tt(
        "homePremium.steps.2.desc",
        "GO/NO GO, actions a mener, documents a fournir.",
        "GO/NO GO, actions to take, documents to provide.",
      ),
    },
  ];

  const tools = [
    {
      title: tt("homePremium.tools.analysis.title", "Analyse export", "Export analysis"),
      description: tt(
        "homePremium.tools.analysis.desc",
        "Lecture pays/produit, cout rendu, Incoterms.",
        "Country/product view, landed cost, Incoterms.",
      ),
      icon: Target,
      link: {
        to: "/analyse",
        label: tt("homePremium.tools.analysis.link", "Ouvrir", "Open"),
      },
      badge: tt("homePremium.tools.analysis.badge", "Public", "Public"),
    },
    {
      title: tt("homePremium.tools.invoice.title", "Controle facture", "Invoice check"),
      description: tt(
        "homePremium.tools.invoice.desc",
        "Verification lignes, totaux, incoherences.",
        "Line checks, totals, inconsistency flags.",
      ),
      icon: FileCheck2,
      link: {
        to: "/app/invoice-check",
        label: tt("homePremium.tools.invoice.link", "Acceder", "Access"),
      },
      badge: tt("homePremium.tools.invoice.badge", "PRO", "PRO"),
    },
    {
      title: tt("homePremium.tools.watch.title", "Veille VIP", "VIP watch"),
      description: tt(
        "homePremium.tools.watch.desc",
        "Alertes personnalisees dans l'outil.",
        "Personalized alerts inside the tool.",
      ),
      icon: BellRing,
      link: {
        to: "/pricing#vip",
        label: tt("homePremium.tools.watch.link", "Voir VIP", "View VIP"),
      },
      badge: "VIP",
    },
    {
      title: tt("homePremium.tools.guides.title", "Guides", "Guides"),
      description: tt(
        "homePremium.tools.guides.desc",
        "Incoterms, DDP, bonnes pratiques.",
        "Incoterms, DDP, best practices.",
      ),
      icon: BookOpen,
      link: {
        to: "/guides",
        label: tt("homePremium.tools.guides.link", "Explorer", "Explore"),
      },
      badge: tt("homePremium.tools.guides.badge", "Public", "Public"),
    },
  ];

  const trustCards: CopyItem[] = [
    {
      title: tt("homePremium.trust.sources.title", "Sources officielles", "Official sources"),
      description: tt(
        "homePremium.trust.sources.desc",
        "Douanes, Incoterms, regimes fiscaux, sanctions. Sources typiques et citees.",
        "Customs, Incoterms, tax regimes, sanctions. Typical sources, cited when possible.",
      ),
      icon: Globe,
    },
    {
      title: tt("homePremium.trust.compliance.title", "Cadre de conformite", "Compliance frame"),
      description: tt(
        "homePremium.trust.compliance.desc",
        "L'outil structure la decision, sans remplacer un agent en douane.",
        "The tool structures the decision without replacing a customs broker.",
      ),
      icon: ShieldCheck,
    },
    {
      title: tt("homePremium.trust.limits.title", "Limites claires", "Clear limits"),
      description: tt(
        "homePremium.trust.limits.desc",
        "Cas sensibles ou DDP: audit express et validation humaine.",
        "Sensitive cases or DDP: express audit and human validation.",
      ),
      icon: FileCheck2,
    },
  ];
  const trustLabel = tt("homePremium.trust.label", "Confiance", "Trust");

  return (
    <MarketingLayout hideBanner hideFooter>
      <div className="marketing-shell">
        <HeroPremium
          eyebrow={tt("homePremium.hero.eyebrow", "MPL Export Navigator", "MPL Export Navigator")}
          title={tt(
            "homePremium.hero.title",
            "Le cockpit export qui clarifie vos decisions.",
            "The export cockpit that clarifies decisions.",
          )}
          subtitle={tt(
            "homePremium.hero.subtitle",
            "Reglez votre profil produits + destinations. Obtenez cout rendu, documents et risques avec alertes DDP/Incoterms.",
            "Set your product + destination profile. Get landed cost, documents, and risk alerts for DDP/Incoterms.",
          )}
          primaryCta={{
            label: tt("homePremium.hero.ctaPrimary", "Voir le cockpit", "View the cockpit"),
            to: "/tool",
          }}
          secondaryCta={{
            label: tt("homePremium.hero.ctaSecondary", "Offre en ligne 65 EUR/mois", "Online plan EUR 65/mo"),
            to: "/pricing",
          }}
          bullets={heroBullets}
          stats={heroStats}
          note={{
            label: tt(
              "homePremium.hero.note",
              "Veille personnalisee dans l'outil = reservee VIP",
              "Personalized watch inside the tool = VIP only",
            ),
            to: "/pricing#vip",
          }}
        />

        <Section
          eyebrow={tt("homePremium.pilotage.eyebrow", "Ce que vous pilotez", "What you control")}
          title={tt(
            "homePremium.pilotage.title",
            "Une lecture claire des decisions export",
            "A clear view of export decisions",
          )}
          description={tt(
            "homePremium.pilotage.desc",
            "Couts, conformite, documents et veille dans un cockpit unique.",
            "Costs, compliance, documents, and watch in one cockpit.",
          )}
          tone="muted"
        >
          <FeatureGrid items={pilotageItems} columns={4} />
        </Section>

        <Section
          eyebrow={tt("homePremium.steps.eyebrow", "Comment ca marche", "How it works")}
          title={tt("homePremium.steps.title", "3 etapes, sans frictions", "3 steps, no friction")}
          description={tt(
            "homePremium.steps.desc",
            "Du profil a la decision en quelques minutes.",
            "From profile to decision in minutes.",
          )}
          tone="plain"
        >
          <Steps items={steps} label={isEN ? "Step" : "Etape"} />
        </Section>

        <Section
          eyebrow={tt("homePremium.tools.eyebrow", "Outils phares", "Featured tools")}
          title={tt("homePremium.tools.title", "Les modules clefs du cockpit", "Key cockpit modules")}
          description={tt(
            "homePremium.tools.desc",
            "Analyse export, controle facture, veille VIP, guides.",
            "Export analysis, invoice check, VIP watch, guides.",
          )}
          tone="muted"
        >
          <FeatureGrid items={tools} columns={4} />
        </Section>

        <Section
          eyebrow={tt("homePremium.trust.eyebrow", "Confiance", "Trust")}
          title={tt(
            "homePremium.trust.title",
            "Sources, conformite, limites claires",
            "Sources, compliance, clear limits",
          )}
          description={tt(
            "homePremium.trust.desc",
            "Un cadre fiable, et une validation humaine quand le risque l'exige.",
            "A reliable framework and human validation when risk requires it.",
          )}
          tone="plain"
        >
          <div className="grid gap-6 md:grid-cols-3">
            {trustCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="marketing-card p-6">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {trustLabel}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
            <Link
              to="/pricing#vip"
              className="font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-700"
            >
              {tt(
                "homePremium.trust.note",
                "Veille personnalisee dans l'outil = reservee VIP",
                "Personalized watch inside the tool = VIP only",
              )}
            </Link>
          </div>
        </Section>

        <CTAStrip
          eyebrow={tt("homePremium.cta.eyebrow", "Audit express", "Express audit")}
          title={tt(
            "homePremium.cta.title",
            "Besoin d'un regard expert avant expedition ?",
            "Need an expert review before shipment?",
          )}
          description={tt(
            "homePremium.cta.desc",
            "Nous validons les cas sensibles (DDP, sanctions, produits a risque) et vous donnons un plan d'action clair.",
            "We validate sensitive cases (DDP, sanctions, risk products) and provide a clear action plan.",
          )}
          primary={{
            label: tt("homePremium.cta.primary", "Demander un audit", "Request an audit"),
            to: "/contact?offer=diagnostic",
          }}
          secondary={{
            label: tt("homePremium.cta.secondary", "Voir le cockpit", "View the cockpit"),
            to: "/tool",
          }}
          tertiary={{
            label: tt("homePremium.cta.tertiary", "Offre 65 EUR/mois", "Plan EUR 65/mo"),
            to: "/pricing",
          }}
          note={tt(
            "homePremium.cta.note",
            "contact@exportfrancefacile.com | 06 76 43 55 51",
            "contact@exportfrancefacile.com | 06 76 43 55 51",
          )}
        />

        <Footer
          brand={{
            title: "MPL Export Navigator",
            description: tt(
              "homePremium.footer.desc",
              "Cockpit export pour PME. Couts rendus, documents, risques et veille.",
              "Export cockpit for SMEs. Landed cost, documents, risks, and watch.",
            ),
          }}
          contact={{
            email: "contact@exportfrancefacile.com",
            phone: "06 76 43 55 51",
            phoneRaw: "0676435551",
          }}
          links={[
            { label: tt("homePremium.footer.links.tool", "Cockpit", "Cockpit"), to: "/tool" },
            { label: tt("homePremium.footer.links.analysis", "Analyse", "Analysis"), to: "/analyse" },
            { label: tt("homePremium.footer.links.watch", "Veille", "Watch"), to: "/veille" },
            { label: tt("homePremium.footer.links.guides", "Guides", "Guides"), to: "/guides" },
            { label: tt("homePremium.footer.links.pricing", "Offres", "Pricing"), to: "/pricing" },
            { label: tt("homePremium.footer.links.contact", "Contact", "Contact"), to: "/contact" },
          ]}
          legalLinks={[
            { label: tt("homePremium.footer.legal.mentions", "Mentions legales", "Legal notice"), to: "/mentions-legales" },
            { label: tt("homePremium.footer.legal.privacy", "Confidentialite", "Privacy"), to: "/confidentialite" },
            { label: tt("homePremium.footer.legal.cookies", "Cookies", "Cookies"), to: "/cookies" },
          ]}
        />
      </div>
    </MarketingLayout>
  );
}
