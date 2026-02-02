import { useMemo } from "react";

export type TierSlug = "FREE" | "PRO" | "VIP";

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
  tiers: Partial<Record<TierSlug, Partial<PricingTier>>>;
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
      headline: "Replace a fixed hire with a tool + export follow-up",
      subhead: "Invoice checks + full simulator. Watch is VIP-only.",
      description:
        "Instead of hiring an export admin, secure operations with a structured tool and regular expert follow-up.",
      cta: "Talk to us",
      tiers: {
        FREE: {
          name: "FREE",
          price: "€0 (one-time)",
          description: "Try once: reduced simulator + express invoice check.",
          features: [
            "1 reduced simulation (single use)",
            "1 express invoice check (level 1 consistency)",
            "No history / no PDF report",
            "No watch (VIP only)",
          ],
        },
        PRO: {
          name: "PRO",
          price: "€250 / month",
          description: "Tool + 1 hour/week follow-up (video or on-site).",
          features: [
            "Full simulator (landed cost / cost-to-serve)",
            "Unlimited invoice verification (consistency alerts)",
            "Operations tracking (docs, tasks, milestones)",
            "1h/week follow-up (video or on-site) — action plan & corrections",
            "Standard support",
          ],
        },
        VIP: {
          name: "VIP",
          price: "€480 / month",
          description: "Full tool + premium watch + 1 day/month export follow-up.",
          features: [
            "Everything in PRO",
            "Premium watch (destination-based) — VIP only",
            "Advanced invoice checks (rules, thresholds)",
            "1 day/month export follow-up (workshop + operational setup)",
            "Priority support",
          ],
        },
      },
    };
  }

  return {
    headline: "Remplacez un recrutement fixe par un outil + du suivi export",
    subhead: "Vérification facture + simulateur complet. La veille est réservée au VIP.",
    description:
      "Plutôt que recruter une ADV export, sécurisez vos opérations avec un outil structurant et un suivi régulier sur les points critiques.",
    cta: "Nous contacter",
    tiers: {
      FREE: {
        name: "FREE",
        price: "0 € (usage unique)",
        description: "Tester une fois : simulateur réduit + vérification facture express.",
        features: [
          "1 simulation réduite (usage unique)",
          "1 vérification facture “express” (cohérence niveau 1)",
          "Pas d’historique / pas de rapport PDF",
          "Pas de veille (réservée VIP)",
        ],
      },
      PRO: {
        name: "PRO",
        price: "250 € / mois",
        description: "Outil + 1h/semaine de suivi (visio ou visite).",
        features: [
          "Simulateur complet (coût rendu / landed cost)",
          "Vérification facture illimitée (alertes de cohérence)",
          "Suivi d’opérations export (docs, tâches, jalons)",
          "1h/semaine de suivi (visio ou visite) — corrections & plan d’actions",
          "Support standard",
        ],
      },
      VIP: {
        name: "VIP",
        price: "480 € / mois",
        description: "Formule complète + veille premium + 1 journée/mois de suivi export.",
        features: [
          "Tout PRO",
          "Veille premium par destination (VIP uniquement)",
          "Contrôles facture avancés (règles, seuils, exceptions)",
          "1 journée/mois de suivi export (atelier + mise en place opérationnelle)",
          "Support prioritaire",
        ],
      },
    },
  };
}

function resolvePricing(meta: PricingMeta | null, defaults: PricingResolved): PricingResolved {
  if (!meta) return defaults;

  const tierKeys: TierSlug[] = ["FREE", "PRO", "VIP"];
  const tiers = {} as Record<TierSlug, PricingTier>;

  for (const k of tierKeys) {
    const tTier = meta.tiers?.[k];
    const dTier = defaults.tiers[k];

    tiers[k] = {
      name: tTier?.name?.trim() ? tTier.name : dTier.name,
      price: tTier?.price?.trim() ? tTier.price : dTier.price,
      description: tTier?.description?.trim() ? tTier.description : dTier.description,
      features: Array.isArray(tTier?.features) && tTier.features.length > 0 ? tTier.features : dTier.features,
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

  const tierKeys: TierSlug[] = ["FREE", "PRO", "VIP"];

  return { isFR, defaults, resolved, tierKeys };
}
