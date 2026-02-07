import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { usePageMeta } from "@/hooks/usePageMeta";
import { INCOTERMS } from "@/data/incoterms";

const ALL_MODES = INCOTERMS.filter((item) => item.mode === "Tous modes").map((item) => item.code);
const MARITIME = INCOTERMS.filter((item) => item.mode === "Maritime").map((item) => item.code);

const CHOICE_QUESTIONS = [
  {
    title: "Quel mode de transport ?",
    detail: "Maritime pur (FAS/FOB/CFR/CIF) ou tous modes (EXW/FCA/CPT/CIP/DAP/DPU/DDP).",
  },
  {
    title: "Qui garde le controle du transport ?",
    detail: "Vendeur si vous voulez securiser la logistique, acheteur si vous laissez le fret a l'autre partie.",
  },
  {
    title: "Qui gere l'import et la douane ?",
    detail: "DAP/DPU/DDP changent la repartition des taxes et formalites a destination.",
  },
];

const PITFALLS = [
  "Utiliser FOB/CIF pour des conteneurs (preferer FCA/CIP).",
  "Sous-estimer l'assurance CIP/CIF (couverture minimale ou inadaptée).",
  "Indiquer un lieu de livraison flou ou incomplet (risque de litige).",
  "Confondre transfert des risques et transfert de propriete.",
];

export default function Incoterms() {
  usePageMeta(
    "Incoterms 2020 : guide complet et tableau",
    "Definition, utilite et choix des 11 Incoterms. Tableau visuel, pieges a eviter et liens vers chaque Incoterm."
  );

  return (
    <PremiumMarketingLayout>
      <section className="mkt-section-dark mkt-section-hero">
        <div className="mkt-container">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Guide Incoterms
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">
              Incoterms 2020 : definition, obligations et tableau comparatif
            </h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              Comprendre les 11 Incoterms et choisir la bonne regle selon le mode de transport, le niveau de controle
              et la gestion de la douane.
            </p>
          </div>
        </div>
      </section>

      <SectionPremium
        eyebrow="Definition"
        title="Un Incoterm clarifie les couts, les risques et les obligations"
        description="Chaque Incoterm fixe qui supporte les couts, qui organise le transport, et a quel moment le risque est transfere."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="mkt-card p-6">
            <h3 className="text-lg font-semibold text-[hsl(var(--mkt-ink))]">Ce que l'Incoterm couvre</h3>
            <ul className="mt-4 space-y-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[hsl(var(--mkt-primary))]" />
                Repartition des couts (pre-acheminement, fret, import).
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[hsl(var(--mkt-primary))]" />
                Moment et lieu du transfert des risques.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[hsl(var(--mkt-primary))]" />
                Obligations documentaires et douanieres.
              </li>
            </ul>
          </div>
          <div className="mkt-card p-6">
            <h3 className="text-lg font-semibold text-[hsl(var(--mkt-ink))]">Toujours un lieu precise</h3>
            <p className="mt-4 text-sm text-[hsl(var(--mkt-ink-muted))]">
              Un Incoterm doit toujours etre suivi d'un lieu nomme (port, terminal, entrepot). Sans lieu precise,
              les responsabilites deviennent floues et les litiges augmentent.
            </p>
            <div className="mt-4 rounded-xl bg-[hsl(var(--mkt-primary)/0.08)] px-4 py-3 text-sm text-[hsl(var(--mkt-ink))]">
              Exemple : <strong>FCA Lyon, terminal X</strong> ou <strong>DAP Madrid, entrepot client</strong>.
            </div>
          </div>
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow="Pourquoi c'est crucial"
        title="Un bon Incoterm securise devis, contrat et douane"
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            "Chiffrer un prix export fiable (transport, assurances, taxes).",
            "Eviter les litiges sur les risques et les dommages en transit.",
            "Aligner transport, douane et assurance sur le meme scenario.",
          ].map((item) => (
            <div key={item} className="mkt-card p-6 text-sm text-[hsl(var(--mkt-ink-muted))]">
              {item}
            </div>
          ))}
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow="7 + 4 regles"
        title="Incoterms tous modes vs maritimes"
        description="Les Incoterms 2020 se divisent en deux familles a ne pas confondre."
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="mkt-card p-6">
            <div className="mb-3 inline-flex items-center rounded-full bg-[hsl(var(--mkt-primary)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--mkt-primary))]">
              Tous modes
            </div>
            <p className="text-sm text-[hsl(var(--mkt-ink-muted))]">
              {ALL_MODES.join(", ")}
            </p>
          </div>
          <div className="mkt-card p-6">
            <div className="mb-3 inline-flex items-center rounded-full bg-[hsl(var(--mkt-accent)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--mkt-accent))]">
              Maritime uniquement
            </div>
            <p className="text-sm text-[hsl(var(--mkt-ink-muted))]">
              {MARITIME.join(", ")}
            </p>
          </div>
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow="Comment choisir"
        title="3 questions simples avant de valider un Incoterm"
      >
        <div className="grid gap-6 md:grid-cols-3">
          {CHOICE_QUESTIONS.map((item, index) => (
            <div key={item.title} className="mkt-card p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--mkt-primary)/0.1)] text-sm font-semibold text-[hsl(var(--mkt-primary))]">
                {index + 1}
              </div>
              <h3 className="text-base font-semibold text-[hsl(var(--mkt-ink))]">{item.title}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow="Points de vigilance"
        title="Les pieges classiques a eviter"
        variant="muted"
      >
        <div className="space-y-4">
          {PITFALLS.map((item) => (
            <div key={item} className="mkt-card flex items-start gap-4 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <p className="text-sm text-[hsl(var(--mkt-ink))]">{item}</p>
            </div>
          ))}
        </div>
      </SectionPremium>

      <SectionPremium
        eyebrow="Tableau Incoterms"
        title="Une vue rapide des responsabilites"
        description="Tableau visuel des 11 Incoterms 2020 pour comparer transport, assurance et import."
      >
        <figure className="mkt-card overflow-hidden p-4">
          <img
            src="/images/incoterms-table.svg"
            alt="Tableau comparatif des 11 Incoterms 2020"
            className="w-full"
            loading="lazy"
          />
          <figcaption className="mt-3 text-xs text-[hsl(var(--mkt-ink-muted))]">
            Resume visuel : qui paie le transport principal, qui assure, qui gere l'import.
          </figcaption>
        </figure>
      </SectionPremium>

      <SectionPremium
        eyebrow="Aller plus loin"
        title="Acceder a chaque Incoterm"
        description="Choisissez une regle pour voir obligations, risques et exemples concrets."
        variant="muted"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INCOTERMS.map((item) => (
            <Link
              key={item.slug}
              to={`/guides/${item.slug}`}
              className="mkt-card flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[hsl(var(--mkt-ink))] hover:text-[hsl(var(--mkt-primary))]"
            >
              <span>{item.code}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/tool" className="mkt-btn mkt-btn-primary">
            Lancer l'outil
          </Link>
          <Link to="/contact" className="mkt-btn mkt-btn-light">
            Contacter un expert
          </Link>
        </div>
      </SectionPremium>
    </PremiumMarketingLayout>
  );
}
