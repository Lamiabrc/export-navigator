import { Link } from "react-router-dom";
import { ArrowRight, Check, Compass, FileCheck2, Route, ShieldCheck, TrendingUp } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { useI18n } from "@/contexts/LanguageContext";

export default function Pricing() {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const heroCopy = isFr
    ? {
        headline: "Intégrer l'IA à l'export, sans s'y perdre",
        subhead:
          "Un atelier sur mesure pour donner du sens aux assistants et aux équipes déjà en place : assistante export, commercial, ADV, transitaire.",
        description:
          "MPL Export Conseil part de vos produits, de vos marchés et de la réglementation qui les concerne, puis fait travailler votre équipe sur ses cas réels.",
        primaryCta: "Demander un devis",
        secondaryCta: "Essayer le copilote IA",
      }
    : {
        headline: "Bring AI into your export work, without getting lost",
        subhead:
          "A tailored workshop that gives purpose to the assistants and teams you already have: export assistant, sales, order desk, forwarder.",
        description:
          "MPL Export Conseil starts from your products, your markets and the regulations that apply to them, then has your team work on its real cases.",
        primaryCta: "Request a quote",
        secondaryCta: "Try the AI copilot",
      };

  const focusAreas = isFr
    ? [
        {
          title: "1. Devis et cadrage",
          body: "Tout commence par un devis : je me renseigne sur vos produits, vos marchés et la réglementation qui les concerne, pour préparer un atelier qui vous ressemble.",
          icon: Compass,
        },
        {
          title: "2. Atelier sur mesure",
          body: "Une demi-journée ou une journée, sur vos dossiers et vos outils. Chaque personne repart avec un usage clair de l'IA pour son poste.",
          icon: Route,
        },
        {
          title: "3. Ancrage",
          body: "Des demi-journées de suivi pour corriger, approfondir et faire tenir les nouveaux usages dans la durée.",
          icon: FileCheck2,
        },
      ]
    : [
        {
          title: "1. Quote and scoping",
          body: "It all starts with a quote: I study your products, your markets and the regulations that apply to them, to prepare a workshop that fits you.",
          icon: Compass,
        },
        {
          title: "2. Tailored workshop",
          body: "Half a day or a full day, on your own files and tools. Each person leaves with a clear use of AI for their role.",
          icon: Route,
        },
        {
          title: "3. Follow-up",
          body: "Half-day follow-up sessions to adjust, go deeper and make the new habits last.",
          icon: FileCheck2,
        },
      ];

  const supportSteps = isFr
    ? [
        "Premier échange et devis : votre équipe, vos produits, vos marchés et vos objectifs.",
        "Cadrage : réglementation de vos produits, outils déjà utilisés, tâches qui prennent le plus de temps.",
        "Atelier : étude de marché, prospection, documents et suivi client, sur vos cas réels.",
        "Suivi : demi-journées pour ancrer les usages et répondre aux questions du terrain.",
      ]
    : [
        "First call and quote: your team, your products, your markets and your goals.",
        "Scoping: regulations for your products, tools already in use, most time-consuming tasks.",
        "Workshop: market research, prospecting, documents and customer follow-up, on your real cases.",
        "Follow-up: half-day sessions to anchor the habits and answer field questions.",
      ];

  const deliverables = isFr
    ? [
        "Un rôle clair de l'IA pour chaque poste de l'équipe export",
        "Des exemples de demandes à l'IA adaptés à vos produits et à vos marchés",
        "La liste de ce qui se vérifie toujours auprès de sources officielles",
        "Les tâches export où l'IA fait gagner du temps, par ordre de priorité",
        "Un plan d'action simple pour les semaines qui suivent",
        "Des demi-journées de suivi, au rythme de votre équipe",
      ]
    : [
        "A clear role for AI in each position of the export team",
        "Example AI requests adapted to your products and markets",
        "The list of what must always be checked with official sources",
        "The export tasks where AI saves time, in order of priority",
        "A simple action plan for the following weeks",
        "Half-day follow-up sessions, at your team's pace",
      ];

  const audiences = isFr
    ? [
        "PME et ETI qui exportent déjà et veulent faire gagner du temps à leur équipe.",
        "Équipes export, ADV et commerciales qui utilisent déjà des assistants IA, sans cadre commun.",
        "Dirigeants qui veulent démarrer l'IA à l'export avec un petit budget et sans tout changer.",
      ]
    : [
        "SMEs and mid-caps that already export and want to save their team time.",
        "Export, order-desk and sales teams already using AI assistants without a shared framework.",
        "Managers who want to start AI in export on a small budget, without changing everything.",
      ];

  return (
    <PremiumMarketingLayout>
      <section className="mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden">
        <div className="mkt-container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {isFr ? "Atelier IA & Export" : "AI & Export workshop"}
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">{heroCopy.headline}</h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.78)" }}>
              {heroCopy.subhead}
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm" style={{ color: "rgba(255, 255, 255, 0.58)" }}>
              {heroCopy.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/contact?offer=atelier" className="mkt-btn mkt-btn-primary">
                {heroCopy.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/copilote" className="mkt-btn mkt-btn-light">
                {heroCopy.secondaryCta}
              </Link>
            </div>

            <p className="mt-4 text-xs" style={{ color: "rgba(255, 255, 255, 0.42)" }}>
              {isFr
                ? "L'IA prépare le travail, elle ne remplace ni votre équipe ni un professionnel de la douane. Les points sensibles se vérifient auprès de sources officielles."
                : "AI prepares the work; it replaces neither your team nor a customs professional. Sensitive points must be checked with official sources."}
            </p>
          </div>
        </div>
      </section>

      <SectionPremium
        eyebrow={isFr ? "L'offre" : "The offer"}
        title={isFr ? "Trois temps, à partir de votre réalité" : "Three steps, starting from your reality"}
        description={
          isFr
            ? "L'objectif n'est pas d'ajouter un outil de plus, mais de donner à chacun un usage clair de l'IA dans son travail export."
            : "The goal is not to add one more tool, but to give everyone a clear use of AI in their export work."
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
            ? "On part de votre équipe et de vos dossiers, pas d'un discours général sur l'IA."
            : "We start from your team and your files, not from a general talk about AI."
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
        title={isFr ? "Ce que votre équipe garde après l'atelier" : "What your team keeps after the workshop"}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <article className="mkt-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
                {isFr ? "À l'issue de l'atelier" : "After the workshop"}
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
        eyebrow={isFr ? "Usages" : "Use cases"}
        title={isFr ? "Où l'IA aide vraiment à l'export" : "Where AI really helps in export"}
        description={
          isFr
            ? "Trois moments du travail export où une petite équipe gagne du temps, à condition de garder la main sur la vérification."
            : "Three moments of export work where a small team saves time, provided it keeps control of the checks."
        }
        variant="muted"
      >
        <div className="mkt-card border-[hsl(var(--mkt-primary)/0.35)] p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="mkt-label">{isFr ? "Marchés et prospection" : "Markets and prospecting"}</p>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {isFr ? "Comparer des pays cibles, préparer une première liste de distributeurs et un message d'approche adapté." : "Compare target countries, prepare a first list of distributors and a tailored outreach message."}
              </p>
            </div>
            <div>
              <p className="mkt-label">{isFr ? "Documents et réglementation" : "Documents and regulations"}</p>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {isFr ? "Préparer et relire factures, listes de colisage et Incoterms, et suivre la veille réglementaire." : "Prepare and review invoices, packing lists and Incoterms, and keep up with regulatory changes."}
              </p>
            </div>
            <div>
              <p className="mkt-label">{isFr ? "Suivi client" : "Customer follow-up"}</p>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {isFr ? "Répondre en plusieurs langues, adapter les offres et suivre les commandes sans perdre le fil." : "Reply in several languages, adapt offers and track orders without losing the thread."}
              </p>
            </div>
          </div>
        </div>
      </SectionPremium>

      <CTAStripPremium
        eyebrow={isFr ? "Demarrer" : "Start"}
        title={isFr ? "Parlez-moi de votre équipe export" : "Tell me about your export team"}
        primaryCta={{
          label: isFr ? "Demander un devis" : "Request a quote",
          to: "/contact?offer=atelier",
        }}
        secondaryCta={{
          label: isFr ? "Essayer le copilote IA" : "Try the AI copilot",
          to: "/copilote",
        }}
        note="contact@exportfrancefacile.com | 06 76 43 55 51"
      />
    </PremiumMarketingLayout>
  );
}
