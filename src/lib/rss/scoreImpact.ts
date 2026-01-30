import type { RssImpact } from "./types";

const HIGH_KEYWORDS: Array<{ key: string; tags: string[]; reason: string }> = [
  { key: "sanction", tags: ["sanctions"], reason: "Mention de sanctions" },
  { key: "embargo", tags: ["sanctions"], reason: "Mention d'embargo" },
  { key: "anti-dumping", tags: ["trade-defense"], reason: "Mesure anti-dumping" },
  { key: "antidumping", tags: ["trade-defense"], reason: "Mesure anti-dumping" },
  { key: "export control", tags: ["export-control"], reason: "Controle des exportations" },
  { key: "controle des exportations", tags: ["export-control"], reason: "Controle des exportations" },
  { key: "dual-use", tags: ["export-control"], reason: "Biens a double usage" },
  { key: "double usage", tags: ["export-control"], reason: "Biens a double usage" },
];

const MED_KEYWORDS: Array<{ key: string; tags: string[]; reason: string }> = [
  { key: "tariff", tags: ["tariffs"], reason: "Mention de tarifs" },
  { key: "tarif", tags: ["tariffs"], reason: "Mention de tarifs" },
  { key: "droit de douane", tags: ["customs"], reason: "Droits de douane" },
  { key: "douane", tags: ["customs"], reason: "Douane" },
  { key: "customs", tags: ["customs"], reason: "Douane" },
  { key: "vat", tags: ["vat"], reason: "TVA/VAT" },
  { key: "tva", tags: ["vat"], reason: "TVA/VAT" },
  { key: "incoterm", tags: ["incoterms"], reason: "Incoterms" },
  { key: "strike", tags: ["logistics"], reason: "Greve ou perturbation" },
  { key: "greve", tags: ["logistics"], reason: "Greve ou perturbation" },
  { key: "port congestion", tags: ["logistics"], reason: "Congestion portuaire" },
  { key: "congestion", tags: ["logistics"], reason: "Congestion logistique" },
  { key: "inspection", tags: ["compliance"], reason: "Controle ou inspection" },
  { key: "procedures", tags: ["compliance"], reason: "Procedure douaniere" },
  { key: "procedure", tags: ["compliance"], reason: "Procedure douaniere" },
];

function normalize(text: string) {
  return text.toLowerCase();
}

export function scoreImpact(text: string): RssImpact {
  const normalized = normalize(text);
  const reasons: string[] = [];
  const tags: string[] = [];

  const add = (reason: string, tagList: string[]) => {
    if (!reasons.includes(reason)) reasons.push(reason);
    tagList.forEach((t) => {
      if (!tags.includes(t)) tags.push(t);
    });
  };

  let impact: RssImpact["impact"] = "LOW";

  for (const rule of HIGH_KEYWORDS) {
    if (normalized.includes(rule.key)) {
      impact = "HIGH";
      add(rule.reason, rule.tags);
    }
  }

  for (const rule of MED_KEYWORDS) {
    if (normalized.includes(rule.key)) {
      if (impact !== "HIGH") impact = "MED";
      add(rule.reason, rule.tags);
    }
  }

  if (reasons.length === 0) {
    reasons.push("Information generale (pas d'impact direct detecte)");
  }

  if (tags.length === 0) {
    tags.push("general");
  }

  return { impact, reasons, tags };
}
