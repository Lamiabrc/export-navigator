import { Link } from "react-router-dom";
import { Check, FileText, ShieldCheck, Sparkles, Target, Users } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Prospection() {
  return (
    <PremiumMarketingLayout>
      {/* Hero */}
      <section className="mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden">
        <div className="mkt-container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.55)" }}>
              Forfait Prospection
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">
              Prospection & représentation commerciale
            </h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
              Un contrat clair, une prospection structurée, et un accompagnement mensuel à 150€.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/contact?offer=prospection" className="mkt-btn mkt-btn-primary">
                Demander le contrat
              </Link>
              <Link to="/pricing#prospection" className="mkt-btn mkt-btn-light">
                Voir le forfait 150€/mois
              </Link>
            </div>

            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              Option exclusivité disponible · Commission ajustée
            </div>
          </div>
        </div>
      </section>

      {/* Offer summary */}
      <SectionPremium
        eyebrow="Forfait"
        title="150€ / mois + commission sur résultats"
        description="Un modèle simple : forfait mensuel + commission sur les ventes générées."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Prospection active",
              desc: "Ciblage, messages et séquences adaptés à votre produit et marché.",
              icon: Target,
            },
            {
              title: "Représentation",
              desc: "Présence commerciale et qualification des leads avec suivi régulier.",
              icon: Users,
            },
            {
              title: "Reporting",
              desc: "Pipeline hebdomadaire : contacts, avancées, points bloquants.",
              icon: ShieldCheck,
            },
          ].map((item) => (
            <article key={item.title} className="mkt-card p-6">
              <item.icon className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="mt-4 font-semibold text-[hsl(var(--mkt-ink))]">{item.title}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{item.desc}</p>
            </article>
          ))}
        </div>
      </SectionPremium>

      {/* Commission options */}
      <SectionPremium
        eyebrow="Options"
        title="Commission claire, option exclusivité"
        description="Le contrat de prospection de représentation prévoit deux modalités simples."
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="mkt-card p-6">
            <p className="mkt-label">Option standard</p>
            <h3 className="mt-2 text-2xl font-semibold text-[hsl(var(--mkt-ink))]">25% de commission</h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              Sans exclusivité. Vous gardez la liberté de travailler avec d'autres canaux en parallèle.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[hsl(var(--mkt-ink))]">
              {[
                "Liberté totale de prospection",
                "Commission sur ventes générées",
                "Reporting hebdomadaire",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn("mkt-card p-6", "border-[hsl(var(--mkt-primary)/0.25)]") }>
            <p className="mkt-label">Option exclusivité</p>
            <h3 className="mt-2 text-2xl font-semibold text-[hsl(var(--mkt-ink))]">15% de commission</h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              Exclusivité sur le périmètre défini. La commission est réduite à 15%.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[hsl(var(--mkt-ink))]">
              {[
                "Exclusivité par territoire ou segment",
                "Commission réduite",
                "Priorité sur les leads",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionPremium>

      {/* Contract summary */}
      <SectionPremium
        eyebrow="Contrat"
        title="Contrat de prospection de représentation (résumé)"
        description="Un cadre clair pour démarrer vite, sans ambiguïté."
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="mkt-card p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">Clauses essentielles</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[hsl(var(--mkt-ink))]">
              {[
                "Objet : prospection & représentation commerciale pour vos produits.",
                "Commission : 25% standard, 15% si exclusivité.",
                "Périmètre : territoires, segments et objectifs définis ensemble.",
                "Reporting : suivi hebdomadaire, pipeline et actions prioritaires.",
                "Confidentialité : protection des données clients et produits.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--mkt-primary))]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="mkt-card p-6">
              <h4 className="font-semibold text-[hsl(var(--mkt-ink))]">À fournir après signature</h4>
              <ul className="mt-3 space-y-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {[
                  "Liste produits + quantités + tarifs",
                  "Documents de l'entreprise (Kbis, RIB, statuts si besoin)",
                  "Brochures, fiches techniques, visuels",
                  "Certifications / normes / conformité",
                  "Conditions commerciales & SAV",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-5 text-sm text-[hsl(var(--mkt-ink-muted))]">
              <p className="font-semibold text-[hsl(var(--mkt-ink))]">Important</p>
              <p className="mt-2">
                Ce résumé est informatif. Le contrat complet précise les modalités juridiques et
                opérationnelles.
              </p>
            </div>
          </div>
        </div>
      </SectionPremium>

      {/* Process */}
      <SectionPremium
        eyebrow="Process"
        title="Comment ça se passe"
        description="Un parcours simple, orienté résultat."
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-4">
          {[
            { step: "01", title: "Cadrage", desc: "Cibles, marchés, positionnement." },
            { step: "02", title: "Contrat", desc: "Signature + option d'exclusivité." },
            { step: "03", title: "Onboarding", desc: "Docs, produits, brochures, quantités." },
            { step: "04", title: "Prospection", desc: "Contacts, relances, reporting." },
          ].map((item) => (
            <div key={item.step} className="mkt-card p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-[hsl(var(--mkt-ink-muted))]">{item.step}</p>
              <h3 className="mt-2 font-semibold text-[hsl(var(--mkt-ink))]">{item.title}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionPremium>

      {/* CTA */}
      <section className="bg-white py-16">
        <div className="mkt-container">
          <div className="mkt-card flex flex-col items-center gap-6 p-10 text-center">
            <h2 className="text-3xl font-semibold text-[hsl(var(--mkt-ink))]">Prêt à lancer la prospection ?</h2>
            <p className="max-w-2xl text-sm text-[hsl(var(--mkt-ink-muted))]">
              Demandez le contrat, choisissez l'option d'exclusivité et démarrez une prospection structurée.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild className="mkt-btn mkt-btn-primary">
                <Link to="/contact?offer=prospection">Demander le contrat</Link>
              </Button>
              <Button asChild variant="outline" className="mkt-btn mkt-btn-outline">
                <Link to="/pricing#prospection">Voir le forfait 150€/mois</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PremiumMarketingLayout>
  );
}
