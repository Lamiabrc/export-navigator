import { Link } from "react-router-dom";
import { Check, Sparkles, Users } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { useI18n } from "@/contexts/LanguageContext";

export default function Pricing() {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const heroCopy = isFr
    ? {
        headline: "Une offre simple : tout est gratuit",
        subhead:
          "Accedez a l'outil complet (simulation, verification, veille) sans abonnement ni paiement.",
        description:
          "Si vous avez besoin de plus d'accompagnement humain, utilisez la demande de devis sur la page contact.",
        toolCta: "Acceder gratuitement a l'outil",
        quoteCta: "Demander un devis",
      }
    : {
        headline: "One simple offer: everything is free",
        subhead:
          "Access the full tool (simulation, verification, watch) with no subscription and no payment.",
        description:
          "If you need more hands-on support, use the quote request on the contact page.",
        toolCta: "Open the free tool",
        quoteCta: "Request a quote",
      };

  const roiPoints = isFr
    ? [
        { title: "Cout fixe mensuel + charges", side: "hire" },
        { title: "Montee en competence + turnover", side: "hire" },
        { title: "Controles facture peu outilles", side: "hire" },
        { title: "Simulateur + verification facture", side: "tool" },
        { title: "Veille reglementaire integree", side: "tool" },
        { title: "Accompagnement sur devis si necessaire", side: "tool" },
      ]
    : [
        { title: "Fixed monthly cost + overhead", side: "hire" },
        { title: "Ramp-up time + turnover risk", side: "hire" },
        { title: "Invoice controls often not tooled", side: "hire" },
        { title: "Simulator + invoice verification", side: "tool" },
        { title: "Integrated regulatory watch", side: "tool" },
        { title: "Dedicated support available via quote", side: "tool" },
      ];

  const freeFeatures = isFr
    ? [
        "Simulateur complet (Incoterms, transport, frais)",
        "Verification facture et coherence",
        "Watch Center, filtres et historique",
        "Checklists documentaires et rapports PDF",
        "Acces immediat sans paiement",
      ]
    : [
        "Full simulator (Incoterms, transport, fees)",
        "Invoice and consistency checks",
        "Watch Center, filters and history",
        "Document checklists and PDF reports",
        "Immediate access without payment",
      ];

  const supportFeatures = isFr
    ? [
        "Audit de vos flux import/export",
        "Priorisation des risques TVA, douane, documents",
        "Plan d'actions personnalise",
        "Restitution et suivi selon vos besoins",
      ]
    : [
        "Audit of your import/export flows",
        "Prioritization of VAT, customs and document risks",
        "Customized action plan",
        "Follow-up aligned with your needs",
      ];

  return (
    <PremiumMarketingLayout>
      <section className="mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden">
        <div className="mkt-container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Export Navigator
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">{heroCopy.headline}</h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {heroCopy.subhead}
            </p>
            <p className="mt-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {heroCopy.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/analyse" className="mkt-btn mkt-btn-primary">
                {heroCopy.toolCta}
              </Link>
              <Link to="/contact" className="mkt-btn mkt-btn-light">
                {heroCopy.quoteCta}
              </Link>
            </div>

            <p className="mt-4 text-xs" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
              {isFr
                ? "Nous signalons les incoherences et risques. La validation finale reste sous votre responsabilite."
                : "We flag inconsistencies and risks. Final validation remains your responsibility."}
            </p>
          </div>
        </div>
      </section>

      <SectionPremium
        eyebrow={isFr ? "ROI" : "ROI"}
        title={isFr ? "Pourquoi ca remplace souvent un recrutement" : "Why this often replaces a hire"}
        description={
          isFr
            ? "Remplacez un cout fixe par un outil gratuit et un suivi sur devis seulement si necessaire."
            : "Replace fixed cost with a free tool and quote-based support only when needed."
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="mkt-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-[hsl(var(--mkt-ink-muted))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
                {isFr ? "Recruter (cout fixe)" : "Hire (fixed cost)"}
              </h3>
            </div>
            <ul className="space-y-3">
              {roiPoints
                .filter((point) => point.side === "hire")
                .map((point) => (
                  <li key={point.title} className="flex items-start gap-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--mkt-ink-muted))]" />
                    {point.title}
                  </li>
                ))}
            </ul>
          </div>

          <div className="mkt-card border-[hsl(var(--mkt-primary)/0.3)] p-6">
            <div className="mb-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
                {isFr ? "Outil gratuit + support optionnel" : "Free tool + optional support"}
              </h3>
            </div>
            <ul className="space-y-3">
              {roiPoints
                .filter((point) => point.side === "tool")
                .map((point) => (
                  <li key={point.title} className="flex items-start gap-3 text-sm text-[hsl(var(--mkt-ink))]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--mkt-primary))]" />
                    {point.title}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow={isFr ? "Offre" : "Offer"}
        title={isFr ? "Tout l'outil est gratuit" : "The full tool is free"}
        description={
          isFr
            ? "Une seule offre gratuite pour tous. Pour un accompagnement dedie, faites une demande de devis."
            : "One free offer for everyone. For dedicated support, request a quote."
        }
        variant="muted"
      >
        <div id="plans" className="grid scroll-mt-24 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="mkt-card flex flex-col border-[hsl(var(--mkt-primary)/0.4)] p-6 ring-2 ring-[hsl(var(--mkt-primary)/0.1)]">
            <div className="mb-4 flex items-start justify-between gap-2">
              <p className="mkt-label">{isFr ? "Acces plateforme" : "Platform access"}</p>
              <span className="mkt-badge">{isFr ? "100% gratuit" : "100% free"}</span>
            </div>

            <p className="mkt-display text-3xl font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Gratuit" : "Free"}
            </p>
            <p className="mt-3 flex-1 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Vous utilisez l'outil complet sans abonnement."
                : "Use the full platform with no subscription."}
            </p>

            <ul className="mb-6 mt-6 space-y-2">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--mkt-primary))]" />
                  <span className="text-[hsl(var(--mkt-ink))]">{feature}</span>
                </li>
              ))}
            </ul>

            <Link to="/analyse" className="mkt-btn mkt-btn-secondary text-xs">
              {isFr ? "Acceder a l'outil" : "Open the tool"}
            </Link>
          </article>

          <article className="mkt-card flex flex-col p-6">
            <p className="mkt-label">{isFr ? "Accompagnement" : "Support"}</p>
            <h3 className="mt-2 text-xl font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Besoin d'un accompagnement dedie ?" : "Need dedicated support?"}
            </h3>
            <p className="mt-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Demandez un devis via la page contact pour un accompagnement adapte."
                : "Request a quote from the contact page for tailored support."}
            </p>

            <ul className="mb-6 mt-6 space-y-2">
              {supportFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--mkt-primary))]" />
                  <span className="text-[hsl(var(--mkt-ink))]">{feature}</span>
                </li>
              ))}
            </ul>

            <Link to="/contact" className="mkt-btn mkt-btn-primary text-xs">
              {isFr ? "Demander un devis" : "Request a quote"}
            </Link>
          </article>
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow={isFr ? "Important" : "Important"}
        title={isFr ? "Ce que comprend l'offre gratuite" : "What the free offer includes"}
      >
        <div className="grid gap-6 md:grid-cols-3">
          <div className="mkt-card p-6">
            <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Simulateur complet" : "Full simulator"}
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Cout rendu / landed cost, frais, surcharges, minimums."
                : "Landed cost, fees, surcharges, minimums."}
            </p>
          </div>
          <div className="mkt-card p-6">
            <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Verification facture" : "Invoice verification"}
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Incoterm, devise, totaux, frais, coherences, alertes."
                : "Incoterms, currency, totals, fees, consistency alerts."}
            </p>
          </div>
          <div className="mkt-card p-6">
            <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">
              {isFr ? "Suivi operation" : "Ops tracking"}
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {isFr ? "Docs, taches, jalons, checklists." : "Docs, tasks, milestones, checklists."}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-6">
          <p className="text-sm text-[hsl(var(--mkt-ink-muted))]">
            {isFr
              ? "Nous signalons des incoherences et risques operationnels. La validation finale reste sous votre responsabilite (ou celle de vos conseils)."
              : "We flag inconsistencies and operational risks. Final validation remains your responsibility (or your advisors')."}
          </p>
        </div>
      </SectionPremium>

      <CTAStripPremium
        eyebrow={isFr ? "Besoin de plus d'accompagnement ?" : "Need more support?"}
        title={isFr ? "Demandez un devis pour un accompagnement dedie" : "Request a quote for dedicated support"}
        primaryCta={{
          label: isFr ? "Demander un devis" : "Get a quote",
          to: "/contact",
        }}
        secondaryCta={{
          label: isFr ? "Acceder gratuitement a l'outil" : "Open the free tool",
          to: "/analyse",
        }}
        note="contact@exportfrancefacile.com | 06 76 43 55 51"
      />
    </PremiumMarketingLayout>
  );
}
