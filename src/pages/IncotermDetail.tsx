import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getIncotermByCode, getIncotermBySlug } from "@/data/incoterms";
import type { IncotermEntry } from "@/data/incoterms";

export default function IncotermDetail() {
  const params = useParams();
  const rawCode = params.code || "";
  const incoterm = getIncotermByCode(rawCode) || getIncotermBySlug(`incoterms-${rawCode}`);

  if (!incoterm) {
    return (
      <PremiumMarketingLayout>
        <SectionPremium eyebrow="Erreur" title="Incoterm introuvable">
          <p className="text-[hsl(var(--mkt-ink-muted))]">
            L'Incoterm demande n'existe pas ou a ete deplace.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link to="/guides/incoterms" className="mkt-btn mkt-btn-primary">
              Voir le guide Incoterms
            </Link>
            <Link to="/guides" className="mkt-btn mkt-btn-outline">
              Voir les guides
            </Link>
          </div>
        </SectionPremium>
      </PremiumMarketingLayout>
    );
  }

  const pageTitle = `Incoterm ${incoterm.code} : definition, obligations, risques, exemple`;
  const pageDescription = incoterm.intro;
  usePageMeta(pageTitle, pageDescription);

  const nearby = incoterm.nearby
    .map((code) => getIncotermByCode(code))
    .filter((item): item is IncotermEntry => Boolean(item));

  return (
    <PremiumMarketingLayout>
      <section className="mkt-section-dark mkt-section-hero">
        <div className="mkt-container">
          <div className="mx-auto max-w-3xl">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Incoterms 2020
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">{pageTitle}</h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {incoterm.intro}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="mkt-badge">{incoterm.mode}</span>
              <Link to="/guides/incoterms" className="text-sm text-white/70 hover:text-white">
                Voir le guide general
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SectionPremium eyebrow="Quand l'utiliser" title="Cas typiques">
        <ul className="space-y-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
          {incoterm.whenToUse.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[hsl(var(--mkt-primary))]" />
              {item}
            </li>
          ))}
        </ul>
      </SectionPremium>

      <SectionPremium eyebrow="Repartition" title="Qui paie quoi ?" variant="muted">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {incoterm.costs.map((item) => (
            <div key={item.label} className="mkt-card p-5">
              <h3 className="text-sm font-semibold text-[hsl(var(--mkt-ink))]">{item.label}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionPremium>

      <SectionPremium eyebrow="Transfert des risques" title="Moment et lieu">
        <div className="mkt-card p-6 text-sm text-[hsl(var(--mkt-ink-muted))]">
          {incoterm.riskTransfer}
        </div>
      </SectionPremium>

      <SectionPremium eyebrow="Documents" title="Documents frequents" variant="muted">
        <ul className="grid gap-3 sm:grid-cols-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
          {incoterm.documents.map((doc) => (
            <li key={doc} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[hsl(var(--mkt-primary))]" />
              {doc}
            </li>
          ))}
        </ul>
      </SectionPremium>

      <SectionPremium eyebrow="Exemple" title="Exemple simple">
        <div className="mkt-card p-6 text-sm text-[hsl(var(--mkt-ink-muted))]">
          {incoterm.example}
        </div>
      </SectionPremium>

      <SectionPremium eyebrow="Erreurs frequentes" title="Points de vigilance" variant="muted">
        <div className="space-y-4">
          {incoterm.mistakes.map((mistake) => (
            <div key={mistake} className="mkt-card flex items-start gap-4 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <p className="text-sm text-[hsl(var(--mkt-ink))]">{mistake}</p>
            </div>
          ))}
        </div>
      </SectionPremium>

      <SectionPremium eyebrow="Incoterms proches" title="Comparer avec des regles proches">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nearby.map((item) => (
            <Link
              key={item.slug}
              to={`/guides/${item.slug}`}
              className="mkt-card flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[hsl(var(--mkt-ink))] hover:text-[hsl(var(--mkt-primary))]"
            >
              <span>{item.code}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
          <Link
            to="/guides/incoterms"
            className="mkt-card flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[hsl(var(--mkt-ink))] hover:text-[hsl(var(--mkt-primary))]"
          >
            <span>Guide Incoterms</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </SectionPremium>

      <CTAStripPremium
        eyebrow="Passer a l'action"
        title="Besoin d'un scenario fiable ?"
        description="Simulez votre operation ou demandez un avis pour securiser le contrat."
        primaryCta={{ label: "Lancer l'outil", to: "/tool" }}
        secondaryCta={{ label: "Contacter un expert", to: "/contact" }}
      />
    </PremiumMarketingLayout>
  );
}
