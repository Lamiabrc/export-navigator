export type WorkflowSource = "eu" | "mock" | "fallback";

export type ShipmentModel = {
  origin: string;
  destination: string;
  hs6: string;
  incoterm: string;
  value: number;
  currency: string;
  transport: string;
  payment: string;
};

export type WorkflowAmount = {
  label: string;
  value: number;
  currency: string;
  source: WorkflowSource;
};

export type WorkflowDocument = {
  name: string;
  required: boolean;
  source: WorkflowSource;
};

export type WorkflowRisk = {
  level: "low" | "medium" | "high";
  label: string;
  source: WorkflowSource;
};

export type ExportWorkflowResult = {
  shipment: ShipmentModel;
  amounts: {
    customs_value: WorkflowAmount;
    duty_estimate: WorkflowAmount;
    tax_estimate: WorkflowAmount;
    logistics_estimate: WorkflowAmount;
    total_estimate: WorkflowAmount;
  };
  documents: WorkflowDocument[];
  risks: WorkflowRisk[];
  taxes: string[];
  duties: string[];
  notes: string[];
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min = 0) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, value);
}

function normalizeShipment(input: Partial<ShipmentModel>): ShipmentModel {
  return {
    origin: String(input.origin || "FR").trim().toUpperCase(),
    destination: String(input.destination || "WORLD").trim().toUpperCase(),
    hs6: String(input.hs6 || "000000").replace(/[^0-9]/g, "").slice(0, 6) || "000000",
    incoterm: String(input.incoterm || "DAP").trim().toUpperCase(),
    value: clamp(Number(input.value || 0), 0),
    currency: String(input.currency || "EUR").trim().toUpperCase(),
    transport: String(input.transport || "road").trim().toLowerCase(),
    payment: String(input.payment || "tt").trim().toLowerCase(),
  };
}

function estimateDutyRate(shipment: ShipmentModel) {
  if (shipment.destination === "WORLD") return 0.05;
  if (["FR", "DE", "ES", "IT", "BE", "NL"].includes(shipment.destination)) return 0.025;
  return 0.045;
}

function estimateTaxRate(shipment: ShipmentModel) {
  if (["FR", "DE", "ES", "IT", "BE", "NL"].includes(shipment.destination)) return 0.2;
  if (shipment.destination === "US") return 0.08;
  return 0.12;
}

function estimateLogistics(shipment: ShipmentModel) {
  const base = shipment.transport === "air" ? 420 : shipment.transport === "sea" ? 280 : 180;
  return round2(base + shipment.value * 0.02);
}

export function runExportWorkflow(input: Partial<ShipmentModel>): ExportWorkflowResult {
  const shipment = normalizeShipment(input);

  const customsValue = round2(shipment.value);
  const dutyRate = estimateDutyRate(shipment);
  const taxRate = estimateTaxRate(shipment);
  const logistics = estimateLogistics(shipment);

  const duty = round2(customsValue * dutyRate);
  const tax = round2((customsValue + duty) * taxRate);
  const total = round2(customsValue + duty + tax + logistics);

  const source: WorkflowSource = shipment.destination === "WORLD" ? "fallback" : "mock";

  const documents: WorkflowDocument[] = [
    { name: "Facture commerciale", required: true, source },
    { name: "Packing list", required: true, source },
    { name: "Certificat d'origine", required: dutyRate > 0.03, source },
    { name: "Document de transport", required: true, source },
  ];

  const risks: WorkflowRisk[] = [
    {
      level: dutyRate >= 0.05 ? "high" : "medium",
      label: "Verifier classement HS6 et droits applicables avant engagement prix.",
      source,
    },
    {
      level: shipment.incoterm === "DDP" ? "high" : "low",
      label: shipment.incoterm === "DDP"
        ? "DDP engage fiscalite locale et formalites import.": "Incoterm limite l'exposition import.",
      source,
    },
  ];

  return {
    shipment,
    amounts: {
      customs_value: { label: "Valeur douane", value: customsValue, currency: shipment.currency, source },
      duty_estimate: { label: "Droits estimes", value: duty, currency: shipment.currency, source },
      tax_estimate: { label: "Taxes estimees", value: tax, currency: shipment.currency, source },
      logistics_estimate: { label: "Logistique estimee", value: logistics, currency: shipment.currency, source },
      total_estimate: { label: "Cout total estime", value: total, currency: shipment.currency, source },
    },
    documents,
    risks,
    taxes: [`Taxe estimee ${(taxRate * 100).toFixed(1)}%`],
    duties: [`Droit estime ${(dutyRate * 100).toFixed(1)}%`],
    notes: [
      "Estimation indicative a valider avec source officielle avant contractualisation.",
      "La source de chaque montant est exposee pour expliciter le niveau de fiabilite.",
    ],
  };
}
