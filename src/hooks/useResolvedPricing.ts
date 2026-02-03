import { useMemo } from "react";

export type TierSlug = "FREE" | "PRO_ONLINE" | "PRO_VISIO" | "PILOTAGE";

export type PricingTier = {
  name: string;
  price: string;
  description: string;
  features: string[];
};

export type PricingResolved = {
  headline: string;
  subhead: string;
  description: string;
  cta: string;
  tiers: Record<TierSlug, PricingTier>;
};

type PricingMeta = Partial<{
  headline: string;
  subhead: string;
  description: string;
  cta: string;
  // On accepte aussi les anciens slugs ("PRO","VIP") via Record<string,...> pour éviter de casser si des traductions traînent.
  tiers: Partial<Record<string, Partial<PricingTier>>>;
}>;

function safeLangGuess(): string {
  try {
    const lsLang =
      (typeof window !== "undefined" &&
        (window.localStorage?.getItem("lang") || window.localStorage?.getItem("language"))) ||
      "";
    const docLang = typeof document !== "undefined" ? document.documentElement.lang : "";
    const navLang = typeof navigator !== "undefined" ? navigator.language : "";
    return (lsLang || docLang || navLang || "fr").toLowerCase();
  } catch {
    return "fr";
  }
}

function getDefaults(isFR: boolean): PricingResolved {
  if (!isFR) {
    return {
      headline: "Your digital export department for SMEs",
      subhead: "Costs, documents, compliance watch — without hiring.",
      description:
        "Simulate landed cost, generate document checklists and PDF reports, and monitor regulatory updates. Self-serve or with coaching.",
      cta: "Contact us",
      tiers: {
        FREE: {
          name: "FREE",
          price: "€0 / month",
          description: "Discovery version (company + address required to unlock free access).",
          features: [
            "Company + address required to activate FREE",
            "Simulator (screen results)",
            "1 PDF / month",
            "Watch demo (limited history & scope)",
            "No email alerts",
          ],
        },
        PRO_ONLINE: {
          name: "PRO ONLINE",
          price: "€59 / month",
          description: "100% self-serve: the full tool + automated watch.",
          features: [
            "Full simulator (Incoterms, transport, fees)",
            "Standard document checklists",
            "Unlimited PDF reports (or very high quota)",
            "Full Watch Center (filters, search, tags)",
            "Automated weekly email digest",
            "History & exports",
          ],
        },
        PRO_VISIO: {
          name: "PRO + VIDEO",
          price: "€149 / month",
          description: "Everything in PRO ONLINE + 1 monthly video session.",
          features: [
            "Everything in PRO ONLINE",
            "1 video session / month (booking included)",
            "Pre-call form + document upload",
            "Meeting summary PDF template",
            "Priority support",
          ],
        },
        PILOTAGE: {
          name: "WEEKLY PILOTING",
          price: "€560 / month",
          description: "Everything in PRO ONLINE + 1 hour per week.",
          features: [
            "Everything in PRO ONLINE",
            "1 hour / week (video)",
            "Weekly action plan & prioritization",
            "Risk & compliance review",
            "Priority support (fast track)",
          ],
        },
      },
    };
  }

  return {
    headline: "Le département export digital des PME",
    subhead: "Simulation, documents, conformité et veille — sans recruter.",
    description:
      "Simulez votre coût rendu, générez des checklists et des rapports PDF, et suivez les évolutions réglementaires. En autonome ou avec accompagnement.",
    cta: "Nous contacter",
    tiers: {
      FREE: {
        name: "FREE",
        price: "0 € / mois",
        description: "Version découverte (société + adresse obligatoires pour activer le gratuit).",
        features: [
          "Société + adresse obligatoires pour activer le FREE",
          "Simulateur (résultats à l’écran)",
          "1 PDF / mois",
          "Veille démo (historique & périmètre limités)",
          "Pas d’alertes email",
        ],
      },
      PRO_ONLINE: {
        name: "PRO ONLINE",
        price: "59 € / mois",
        description: "100% en ligne : l’outil complet + veille automatisée.",
        features: [
          "Simulateur complet (Incoterms, transport, frais)",
          "Checklists documentaires standardisées",
          "PDF illimités (ou quota très élevé)",
          "Watch Center complet (filtres, recherche, tags)",
          "Digest email hebdo automatique",
          "Historique & exports",
        ],
      },
      PRO_VISIO: {
        name: "PRO + VISIO",
        price: "149 € / mois",
        description: "Tout PRO ONLINE + 1 visio mensuelle.",
        features: [
          "Tout PRO ONLINE",
          "1 visio / mois (réservation incluse)",
          "Pré-formulaire + dépôt documents",
          "Compte-rendu PDF (template)",
          "Support prioritaire",
        ],
      },
      PILOTAGE: {
        name: "PILOTAGE HEBDO",
        price: "560 € / mois",
        description: "Tout PRO ONLINE + 1h/semaine.",
        features: [
          "Tout PRO ONLINE",
          "1h / semaine (visio)",
          "Priorisation + plan d’actions hebdo",
          "Revue risques & conformité",
          "Support prioritaire (fast track)",
        ],
      },
    },
  };
}

function resolvePricing(meta: PricingMeta | null, defaults: PricingResolved): PricingResolved {
  if (!meta) return defaults;

  const tierKeys: TierSlug[] = ["FREE", "PRO_ONLINE", "PRO_VISIO", "PILOTAGE"];
  const tiers = {} as Record<TierSlug, PricingTier>;

  // Compatibilité : si les traductions utilisent encore PRO/VIP
  const alias: Record<TierSlug, string[]> = {
    FREE: ["FREE"],
    PRO_ONLINE: ["PRO_ONLINE", "PRO"],
    PRO_VISIO: ["PRO_VISIO", "VIP"],
    PILOTAGE: ["PILOTAGE"],
  };

  for (const k of tierKeys) {
    const candidates = alias[k];
    const tTier =
      candidates.map((ck) => meta.tiers?.[ck]).find(Boolean) ?? undefined;

    const dTier = defaults.tiers[k];

    tiers[k] = {
      name: tTier?.name?.trim() ? (tTier.name as string) : dTier.name,
      price: tTier?.price?.trim() ? (tTier.price as string) : dTier.price,
      description: tTier?.description?.trim()
        ? (tTier.description as string)
        : dTier.description,
      features:
        Array.isArray(tTier?.features) && (tTier.features as string[]).length > 0
          ? (tTier.features as string[])
          : dTier.features,
    };
  }

  return {
    headline: meta.headline?.trim() ? meta.headline : defaults.headline,
    subhead: meta.subhead?.trim() ? meta.subhead : defaults.subhead,
    description: meta.description?.trim() ? meta.description : defaults.description,
    cta: meta.cta?.trim() ? meta.cta : defaults.cta,
    tiers,
  };
}

export function useResolvedPricing(t: (key: string) => unknown) {
  const isFR = useMemo(() => safeLangGuess().startsWith("fr"), []);
  const defaults = useMemo(() => getDefaults(isFR), [isFR]);

  const pricingMeta = (t("pricing") as PricingMeta) ?? null;

  const resolved = useMemo(() => resolvePricing(pricingMeta, defaults), [pricingMeta, defaults]);

  const tierKeys: TierSlug[] = ["FREE", "PRO_ONLINE", "PRO_VISIO", "PILOTAGE"];

  return { isFR, defaults, resolved, tierKeys };
}
