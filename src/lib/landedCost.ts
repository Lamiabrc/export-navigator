export type Incoterm =
  | "EXW"
  | "FCA"
  | "FOB"
  | "CFR"
  | "CIF"
  | "CPT"
  | "CIP"
  | "DAP"
  | "DPU"
  | "DDP";

export type TransportMode = "road" | "air" | "sea" | "rail";

export type LandedCostInput = {
  goodsValue: number;
  currency: string;
  quantity?: number;
  destination: string;
  incoterm: Incoterm;
  mode: TransportMode;
  preCarriage: number;
  mainFreight: number;
  insuranceType: "percent" | "amount";
  insuranceValue: number;
  packaging: number;
  brokerage: number;
  misc: number;
  dutyRate?: number;
  vatRate?: number;
  marginTarget?: number;
};

export type LandedCostBreakdown = {
  goodsValue: number;
  preCarriage: number;
  mainFreight: number;
  insurance: number;
  packaging: number;
  brokerage: number;
  misc: number;
  duties: number;
  vat: number;
};

export type LandedCostResult = {
  total: number;
  breakdown: LandedCostBreakdown;
  unitCost?: number;
  margin?: {
    targetPercent: number;
    targetAmount: number;
    targetPrice: number;
  };
  warnings: string[];
};

const INCOTERM_WARNINGS: Record<Incoterm, string[]> = {
  EXW: ["EXW: buyer handles export and main transport; confirm responsibilities."],
  FCA: ["FCA: buyer handles main transport; confirm handover point."],
  FOB: ["FOB: seller loads on board; buyer handles main transport."],
  CFR: ["CFR: seller pays main freight; insurance not included."],
  CIF: ["CIF: seller pays freight and insurance; verify coverage level."],
  CPT: ["CPT: seller pays main transport; risk transfers early."],
  CIP: ["CIP: seller pays transport and insurance; verify coverage level."],
  DAP: ["DAP: seller delivers to place; buyer handles import duties and VAT."],
  DPU: ["DPU: seller delivers unloaded; buyer handles import duties and VAT."],
  DDP: ["DDP: seller handles import duties and VAT; ensure local capacity."],
};

function clampNumber(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function computeInsurance(input: LandedCostInput) {
  const base = clampNumber(input.goodsValue);
  const value = clampNumber(input.insuranceValue);
  if (input.insuranceType === "percent") {
    return (base * value) / 100;
  }
  return value;
}

function computeMargin(total: number, marginTarget?: number) {
  const target = clampNumber(marginTarget ?? 0);
  if (!target || target >= 100) return undefined;
  const targetPrice = total / (1 - target / 100);
  const targetAmount = targetPrice - total;
  return {
    targetPercent: target,
    targetAmount,
    targetPrice,
  };
}

export function computeLandedCost(input: LandedCostInput): LandedCostResult {
  const goodsValue = clampNumber(input.goodsValue);
  const preCarriage = clampNumber(input.preCarriage);
  const mainFreight = clampNumber(input.mainFreight);
  const insurance = computeInsurance(input);
  const packaging = clampNumber(input.packaging);
  const brokerage = clampNumber(input.brokerage);
  const misc = clampNumber(input.misc);

  const baseDuty = goodsValue + preCarriage + mainFreight + insurance + packaging + brokerage + misc;
  const dutyRate = clampNumber(input.dutyRate ?? 0);
  const duties = dutyRate ? (baseDuty * dutyRate) / 100 : 0;

  const transportBase = preCarriage + mainFreight + insurance;
  const vatBase = goodsValue + duties + transportBase;
  const vatRate = clampNumber(input.vatRate ?? 0);
  const vat = vatRate ? (vatBase * vatRate) / 100 : 0;

  const breakdown: LandedCostBreakdown = {
    goodsValue,
    preCarriage,
    mainFreight,
    insurance,
    packaging,
    brokerage,
    misc,
    duties,
    vat,
  };

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : undefined;
  const unitCost = quantity ? total / quantity : undefined;

  const warnings = [...(INCOTERM_WARNINGS[input.incoterm] || [])];
  if (input.incoterm === "DDP") {
    if (!input.dutyRate) warnings.push("DDP selected but duty rate is empty.");
    if (!input.vatRate) warnings.push("DDP selected but VAT rate is empty.");
  }
  if (input.incoterm !== "DDP" && (input.dutyRate || input.vatRate)) {
    warnings.push("Check who pays import duties and VAT for this incoterm.");
  }
  if (!input.dutyRate) warnings.push("Duty rate is manual and not provided.");
  if (!input.vatRate) warnings.push("VAT rate is manual and not provided.");

  return {
    total,
    breakdown,
    unitCost,
    margin: computeMargin(total, input.marginTarget),
    warnings,
  };
}
