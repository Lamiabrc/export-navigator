import { Link } from "react-router-dom";
import { ArrowRight, Check, Compass, FileCheck2, Handshake, Route, ShieldCheck, TrendingUp } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { useI18n } from "@/contexts/LanguageContext";

export default function Pricing() {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const heroCopy = isFr
    ? {
        headline: "Accompagnement strategique import-export Europe-Maghreb",
        subhead:
          "Un appui clair pour structurer vos flux, trouver les bons partenaires et securiser vos operations, avec un focus France-Algerie.",
        description:
          "MPL vous aide a cadrer le marche, les couts, les documents, les risques douaniers et les prochaines actions avant de vous engager.",
        primaryCta: "Demander un accompagnement",
        secondaryCta: "Voir les annonces",
      }
    : {
        headline: "Strategic import-export support between Europe and the Maghreb",
        subhead:
          "Clear support to structure flows, find the right partners and secure operations, with a strong France-Algeria focus.",
        description:
          "MPL helps frame market access, costs, documents, customs risks and next actions before you commit.",
        primaryCta: "Request support",
        secondaryCta: "View announcements",
      };

  const focusAreas = isFr
    ? [
        {
          title: "France-Algerie en priorite",
          body: "Analyse de faisabilite, documents, facture, transport, partenaires et points de blocage propres aux flux France-Algerie.",
          icon: Route,
        },
        {
          title: "Europe-Maghreb",
          body: "Cadrage des opportunites entre France, Algerie, Maroc, Tunisie et autres pays europeens selon produit, secteur et objectif.",
          icon: Compass,
        },
        {
          title: "Decision avant engagement",
          body: "Verification des couts rendus, Incoterms, droits/taxes, marge, delais, documents et risques operationnels.",
          icon: FileCheck2,
        },
      ]
    : [
        {
          title: "France-Algeria first",
          body: "Feasibility, documents, invoice, freight, partners and blocking points specific to France-Algeria flows.",
          icon: Route,
        },
        {
          title: "Europe-Maghreb",
          body: "Opportunity framing between France, Algeria, Morocco, Tunisia and other European countries by product, sector and goal.",
          icon: Compass,
        },
        {
          title: "Decision before commitment",
          body: "Checks on landed costs, Incoterms, duties/taxes, margin, timing, documents and operational risks.",
          icon: FileCheck2,
        },
      ];

  const supportSteps = isFr
    ? [
        "Cadrage du besoin: produit, pays, volume, objectif commercial et contraintes.",
        "Lecture stratégique: opportunite, route possible, risques, partenaires et priorites.",
        "Chiffrage: prix rendu, transport, droits/taxes, marge et points de vigilance.",
        "Preparation operationnelle: documents, facture, Incoterm, contact et prochaine action.",
      ]
    : [
        "Need framing: product, country, volume, commercial goal and constraints.",
        "Strategic reading: opportunity, possible route, risks, partners and priorities.",
        "Costing: landed price, freight, duties/taxes, margin and red flags.",
        "Operational preparation: documents, invoice, Incoterm, contact and next action.",
      ];

  const deliverables = isFr
    ? [
        "Diagnostic court de votre projet import/export",
        "Liste des points bloquants ou a verifier",
        "Scenario d'entree marche ou de sourcing",
        "Plan d'action priorise pour avancer",
        "Aide a la preparation des documents et contacts",
        "Suivi des annonces et opportunites qualifiees",
      ]
    : [
        "Short diagnostic of your import/export project",
        "List of blocking points or checks",
        "Market entry or sourcing scenario",
        "Prioritized action plan",
        "Support on documents and contacts",
        "Follow-up of curated announcements and opportunities",
      ];

  const audiences = isFr
    ? [
        "Entreprises europeennes qui veulent vendre ou sourcer au Maghreb.",
        "Entreprises algeriennes ou maghrebines qui veulent approcher la France ou l'Europe.",
        "Porteurs de projet qui ont besoin d'un cadrage avant d'investir du temps ou de l'argent.",
      ]
    : [
        "European companies that want to sell or source in the Maghreb.",
        "Algerian or Maghreb companies that want to approach France or Europe.",
        "Project owners who need framing before spending time or money.",
      ];

  return (
    <PremiumMarketingLayout>
      <section className="mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden">
        <div className="mkt-container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {isFr ? "Strategie import-export" : "Import-export strategy"}
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">{heroCopy.headline}</h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.78)" }}>
              {heroCopy.subhead}
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm" style={{ color: "rgba(255, 255, 255, 0.58)" }}>
              {heroCopy.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/contact" className="mkt-btn mkt-btn-primary">
                {heroCopy.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/coin-business" className="mkt-btn mkt-btn-light">
                {heroCopy.secondaryCta}
              </Link>
            </div>

            <p className="mt-4 text-xs" style={{ color: "rgba(255, 255, 255, 0.42)" }}>
              {isFr
                ? "Accompagnement strategique et operationnel. La validation finale reste sous votre responsabilite ou celle de vos conseils specialises."
                : "Strategic and operational support. Final validation remains your responsibility or your specialist advisors'."}
            </p>
          </div>
        </div>
      </section>

      <SectionPremium
        eyebrow={isFr ? "Positionnement" : "Positioning"}
        title={isFr ? "Un accompagnement pour avancer sans improviser" : "Support to move forward without improvising"}
        description={
          isFr
            ? "L'objectif n'est pas de vendre un abonnement, mais de vous aider a prendre de meilleures decisions sur vos flux Europe-Maghreb."
            : "The goal is not to sell a subscription, but to help you make better decisions on Europe-Maghreb flows."
        }
      >
        <div className="grid gap-6 md:grid-cols-3">
          {focusAreas.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="mkt-card p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--mkt-primary)/0.1)] text-[hsl(var(--mkt-primary))]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">{item.title}</h3>
                <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{item.body}</p>
              </article>
            );
          })}
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow={isFr ? "Methode" : "Method"}
        title={isFr ? "Une demarche simple en 4 temps" : "A simple 4-step approach"}
        description={
          isFr
            ? "On part de votre projet reel, puis on clarifie la route, les couts, les documents et l'action suivante."
            : "We start from your real project, then clarify the route, costs, documents and next action."
        }
        variant="muted"
      >
        <div className="grid gap-4 md:grid-cols-4">
          {supportSteps.map((step, index) => (
            <div key={step} className="mkt-card p-5">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[hsl(var(--mkt-primary))]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <p className="text-sm text-[hsl(var(--mkt-ink))]">{step}</p>
            </div>
          ))}
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow={isFr ? "Ce que vous obtenez" : "What you get"}
        title={isFr ? "Des livrables utiles pour decider et agir" : "Useful outputs to decide and act"}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <article className="mkt-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
                {isFr ? "Livrables d'accompagnement" : "Support outputs"}
              </h3>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {deliverables.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--mkt-primary))]" />
                  <span className="text-[hsl(var(--mkt-ink))]">{feature}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="mkt-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
                {isFr ? "Pour qui ?" : "Who is it for?"}
              </h3>
            </div>
            <ul className="space-y-3">
              {audiences.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--mkt-primary))]" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow={isFr ? "France-Algerie" : "France-Algeria"}
        title={isFr ? "Un focus special sur les flux France-Algerie" : "A special focus on France-Algeria flows"}
        description={
          isFr
            ? "Parce que ces operations demandent souvent plus de cadrage: documents, interlocuteurs, transport, controle facture, delais et interpretation operationnelle."
            : "Because these operations often need more framing: documents, contacts, freight, invoice control, timelines and operational interpretation."
        }
        variant="muted"
      >
        <div className="mkt-card border-[hsl(var(--mkt-primary)/0.35)] p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="mkt-label">{isFr ? "Avant" : "Before"}</p>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {isFr ? "Verifier si le projet est realiste et quelle route suivre." : "Check if the project is realistic and which route to follow."}
              </p>
            </div>
            <div>
              <p className="mkt-label">{isFr ? "Pendant" : "During"}</p>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {isFr ? "Structurer les couts, documents, contacts et points de vigilance." : "Structure costs, documents, contacts and red flags."}
              </p>
            </div>
            <div>
              <p className="mkt-label">{isFr ? "Apres" : "After"}</p>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {isFr ? "Suivre les actions, les annonces et les opportunites qualifiees." : "Track actions, announcements and qualified opportunities."}
              </p>
            </div>
          </div>
        </div>
      </SectionPremium>

      <CTAStripPremium
        eyebrow={isFr ? "Demarrer" : "Start"}
        title={isFr ? "Parlez-moi de votre projet Europe-Maghreb" : "Tell me about your Europe-Maghreb project"}
        primaryCta={{
          label: isFr ? "Demander un accompagnement" : "Request support",
          to: "/contact",
        }}
        secondaryCta={{
          label: isFr ? "Voir les annonces" : "View announcements",
          to: "/coin-business",
        }}
        note="contact@exportfrancefacile.com | 06 76 43 55 51"
      />
    </PremiumMarketingLayout>
  );
}
