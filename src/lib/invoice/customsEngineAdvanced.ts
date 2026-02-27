import { OFFICIAL_LINKS } from "@/lib/constants";

import type { CheckerItem, InvoiceData, TransactionContext } from "./types";

function normalizeHs6(value: string) {
  return String(value || "").replace(/[^0-9]/g, "").slice(0, 6);
}

function detectHs6(value: string) {
  const match = String(value || "").match(/\b\d{6}\b/);
  return match ? match[0] : "";
}

type AdvancedInput = {
  productQuery: string;
  context: TransactionContext;
  invoice: InvoiceData;
};

export function evaluateCustomsAdvanced(input: AdvancedInput): CheckerItem[] {
  const query = String(input.productQuery || "").trim();
  const hs6FromInput = detectHs6(query);
  const hs6 = normalizeHs6(input.invoice.lines[0]?.hs6 || hs6FromInput);
  const origin = String(input.invoice.lines[0]?.originCountry || "").trim().toUpperCase();

  const checks: CheckerItem[] = [
    {
      id: "customs_adv_product_description",
      label: "Produit precise",
      status: query.length >= 8 ? "OK" : "WARN",
      explanation: query.length >= 8
        ? "Description produit suffisante pour affiner les controles."
        : "Description produit trop courte pour un affinage fiable.",
      what_to_fix: "Ajouter une description commerciale et technique du produit.",
      example: "Batteries lithium-ion 48V pour stockage solaire.",
      source_link: OFFICIAL_LINKS.douane_fr,
      fieldPath: "invoice.lines.0.description",
    },
    {
      id: "customs_adv_hs6",
      label: "HS6 pour affinage",
      status: hs6.length === 6 ? "OK" : "WARN",
      explanation: hs6.length === 6
        ? `HS6 ${hs6} disponible pour filtrer droits/restrictions.`
        : "HS6 absent: affinage restrictions limite.",
      what_to_fix: "Ajouter un HS6 (6 chiffres) pour verifier droits/restrictions.",
      example: "850760",
      source_link: OFFICIAL_LINKS.taric,
      fieldPath: "invoice.lines.0.hs6",
    },
    {
      id: "customs_adv_origin",
      label: "Origine pour preferences",
      status: origin.length === 2 ? "OK" : "WARN",
      explanation: origin.length === 2
        ? `Origine ${origin} prise en compte pour l'analyse.`
        : "Origine manquante: impossible d'evaluer les regimes preferentiels.",
      what_to_fix: "Ajouter le pays d'origine du produit.",
      example: "FR",
      source_link: OFFICIAL_LINKS.access2markets,
      fieldPath: "invoice.lines.0.originCountry",
    },
  ];

  if (hs6.length === 6) {
    const highWatchHs = ["3002", "3004", "3822", "8507", "8541", "9018", "9301", "9302", "9303", "9304"];
    const hsPrefix4 = hs6.slice(0, 4);
    const requiresWatch = highWatchHs.includes(hsPrefix4);

    checks.push({
      id: "customs_adv_restrictions",
      label: "Restrictions potentielles",
      status: requiresWatch ? "WARN" : "OK",
      explanation: requiresWatch
        ? "Produit potentiellement sensible: verifier restrictions et exigences documentaires."
        : "Aucune alerte de restriction evidente au niveau HS4.",
      what_to_fix: "Verifier sanctions, licences et regles techniques du pays destination.",
      example: "Controle via Access2Markets + autorites nationales.",
      source_link: OFFICIAL_LINKS.access2markets,
      fieldPath: "invoice.lines.0.hs6",
    });
  } else {
    checks.push({
      id: "customs_adv_restrictions",
      label: "Restrictions potentielles",
      status: "WARN",
      explanation: "Sans HS6, les restrictions produit ne peuvent pas etre evaluees finement.",
      what_to_fix: "Saisir HS6 pour lancer le controle de restrictions.",
      example: "HS6 requis pour controler droits et mesures non tarifaires.",
      source_link: OFFICIAL_LINKS.access2markets,
      fieldPath: "invoice.lines.0.hs6",
    });
  }

  return checks;
}

