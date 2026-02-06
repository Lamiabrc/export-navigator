// src/lib/exportSimulator.ts
export type Incoterm = "EXW" | "FCA" | "FOB" | "CFR" | "CIF" | "DAP" | "DDP";
export type Currency = "EUR" | "USD" | "GBP" | "CHF" | "CNY";

export type CostLineKey =
  | "goods"
  | "preCarriage"
  | "mainCarriage"
  | "insurance"
  | "exportClearance"
  | "importClearance"
  | "handling"
  | "otherFees"
  | "duty"
  | "vat";

export type CostLine = {
  key: CostLineKey;
  label: string;
  amountEur: number;
};

export type SimulationInput = {
  quantity: number;

  // Valeur marchandise
  productUnitPrice: number;
  productCurrency: Currency;
  fxToEur: number; // 1 unité de la devise produit = fxToEur EUR

  incoterm: Incoterm;

  // Coûts logistiques/administratifs (en EUR)
  preCarriageEur?: number; // acheminement interne jusqu’au point de départ export
  mainCarriageEur?: number; // transport principal international
  insuranceMode?: "rate" | "fixed";
  insuranceRatePct?: number; // % appliqué sur (marchandise + transport principal)
  insuranceFixedEur?: number;

  exportClearanceEur?: number; // formalités export
  importClearanceEur?: number; // dédouanement import
  handlingEur?: number; // manutention/terminal/THC
  otherFeesEur?: number; // bancaire, inspection, packaging, etc.

  // Taxes (import)
  dutyRatePct?: number; // droits de douane %
  vatRatePct?: number; // TVA import %
  preferOrigin?: boolean; // si origine préférentielle => droits peuvent être réduits (simplifié)
  dutyRatePreferentialPct?: number; // si preferOrigin = true

  // Vente (optionnel, pour marge)
  sellingUnitPriceEur?: number;
};

export type SimulationResult = {
  incoterm: Incoterm;
  quantity: number;

  goodsValueEur: number;
  customsValueEur: number; // base droits (simplifiée type CIF-frontière)
  dutyEur: number;
  vatBaseEur: number;
  vatEur: number;

  totalLandedCostEur: number;
  unitLandedCostEur: number;

  revenueEur?: number;
  marginEur?: number;
  marginPct?: number;

  lines: CostLine[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

const labelMap: Record<CostLineKey, string> = {
  goods: "Marchandise",
  preCarriage: "Pré-acheminement",
  mainCarriage: "Transport principal",
  insurance: "Assurance",
  exportClearance: "Formalités export",
  importClearance: "Dédouanement import",
  handling: "Manutention / terminal",
  otherFees: "Autres frais",
  duty: "Droits de douane",
  vat: "TVA import",
};

/**
 * Hypothèses volontairement simples mais utiles :
 * - Valeur en douane ~ Marchandise + Transport principal + Assurance (+ éventuellement pré-acheminement)
 * - Base TVA import ~ Valeur en douane + Droits + (dédouanement + manutention + autres frais)
 * - Les coûts sont fournis en EUR, sauf marchandise (convertie)
 *
 * Tu pourras raffiner selon pays/Incoterm, mais cette base donne déjà un calcul exploitable.
 */
export function computeLandedCost(input: SimulationInput): SimulationResult {
  const qty = Math.max(1, Math.floor(input.quantity || 1));

  const fx = input.productCurrency === "EUR" ? 1 : clamp0(input.fxToEur || 0);
  const goodsValueEur = round2(clamp0(input.productUnitPrice) * qty * fx);

  const preCarriage = round2(clamp0(input.preCarriageEur || 0));
  const mainCarriage = round2(clamp0(input.mainCarriageEur || 0));
  const exportClearance = round2(clamp0(input.exportClearanceEur || 0));
  const importClearance = round2(clamp0(input.importClearanceEur || 0));
  const handling = round2(clamp0(input.handlingEur || 0));
  const otherFees = round2(clamp0(input.otherFeesEur || 0));

  const insurance =
    input.insuranceMode === "fixed"
      ? round2(clamp0(input.insuranceFixedEur || 0))
      : round2(clamp0(((goodsValueEur + mainCarriage) * clamp0(input.insuranceRatePct || 0)) / 100));

  // Valeur en douane (simplifiée) : selon incoterm, certains coûts peuvent déjà être inclus.
  // Ici on garde une formule robuste et lisible :
  // - EXW/FCA/FOB : on ajoute pré-acheminement + transport principal + assurance
  // - CFR : on ajoute transport principal (assurance à part)
  // - CIF : on ajoute transport principal + assurance
  // - DAP/DDP : idem CIF pour la base douane (les frais "après frontière" ne devraient pas gonfler la base)
  let customsValueEur = goodsValueEur;

  if (input.incoterm === "EXW" || input.incoterm === "FCA" || input.incoterm === "FOB") {
    customsValueEur = goodsValueEur + preCarriage + mainCarriage + insurance;
  } else if (input.incoterm === "CFR") {
    customsValueEur = goodsValueEur + mainCarriage + insurance; // on garde assurance séparée mais incluse en douane
  } else if (input.incoterm === "CIF" || input.incoterm === "DAP" || input.incoterm === "DDP") {
    customsValueEur = goodsValueEur + mainCarriage + insurance;
  }

  customsValueEur = round2(clamp0(customsValueEur));

  const dutyRate =
    input.preferOrigin && (input.dutyRatePreferentialPct ?? null) !== null
      ? clamp0(input.dutyRatePreferentialPct || 0)
      : clamp0(input.dutyRatePct || 0);

  const dutyEur = round2((customsValueEur * dutyRate) / 100);

  const vatRate = clamp0(input.vatRatePct || 0);
  const vatBaseEur = round2(customsValueEur + dutyEur + importClearance + handling + otherFees);
  const vatEur = round2((vatBaseEur * vatRate) / 100);

  const lines: CostLine[] = [
    { key: "goods", label: labelMap.goods, amountEur: goodsValueEur },
    { key: "preCarriage", label: labelMap.preCarriage, amountEur: preCarriage },
    { key: "mainCarriage", label: labelMap.mainCarriage, amountEur: mainCarriage },
    { key: "insurance", label: labelMap.insurance, amountEur: insurance },
    { key: "exportClearance", label: labelMap.exportClearance, amountEur: exportClearance },
    { key: "importClearance", label: labelMap.importClearance, amountEur: importClearance },
    { key: "handling", label: labelMap.handling, amountEur: handling },
    { key: "otherFees", label: labelMap.otherFees, amountEur: otherFees },
    { key: "duty", label: labelMap.duty, amountEur: dutyEur },
    { key: "vat", label: labelMap.vat, amountEur: vatEur },
  ].filter((l) => l.amountEur > 0.001);

  const totalLandedCostEur = round2(lines.reduce((s, l) => s + l.amountEur, 0));
  const unitLandedCostEur = round2(totalLandedCostEur / qty);

  const sellingUnitPriceEur = clamp0(input.sellingUnitPriceEur || 0);
  const revenueEur = sellingUnitPriceEur > 0 ? round2(sellingUnitPriceEur * qty) : undefined;
  const marginEur = revenueEur !== undefined ? round2(revenueEur - totalLandedCostEur) : undefined;
  const marginPct =
    revenueEur !== undefined && revenueEur > 0 ? round2((marginEur! / revenueEur) * 100) : undefined;

  return {
    incoterm: input.incoterm,
    quantity: qty,
    goodsValueEur,
    customsValueEur,
    dutyEur,
    vatBaseEur,
    vatEur,
    totalLandedCostEur,
    unitLandedCostEur,
    revenueEur,
    marginEur,
    marginPct,
    lines,
  };
}
