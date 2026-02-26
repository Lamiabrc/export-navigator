import type { ShipmentModel, WorkflowAmount, WorkflowDocument, WorkflowRisk, WorkflowSource } from "./exportWorkflow";

export type ImportWorkflowResult = {
  shipment: ShipmentModel;
  invoice_checks: Array<{
    label: string;
    ok: boolean;
    source: WorkflowSource;
  }>;
  amounts: {
    duty_estimate: WorkflowAmount;
    tax_estimate: WorkflowAmount;
    total_import_estimate: WorkflowAmount;
  };
  documents: WorkflowDocument[];
  risks: WorkflowRisk[];
  recommendations: string[];
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeShipment(input: Partial<ShipmentModel>): ShipmentModel {
  return {
    origin: String(input.origin || "WORLD").trim().toUpperCase(),
    destination: String(input.destination || "FR").trim().toUpperCase(),
    hs6: String(input.hs6 || "000000").replace(/[^0-9]/g, "").slice(0, 6) || "000000",
    incoterm: String(input.incoterm || "DAP").trim().toUpperCase(),
    value: Math.max(0, Number(input.value || 0)),
    currency: String(input.currency || "EUR").trim().toUpperCase(),
    transport: String(input.transport || "road").trim().toLowerCase(),
    payment: String(input.payment || "tt").trim().toLowerCase(),
  };
}

export function runImportWorkflow(input: Partial<ShipmentModel>): ImportWorkflowResult {
  const shipment = normalizeShipment(input);
  const source: WorkflowSource = shipment.destination === "FR" ? "eu" : "mock";

  const dutyRate = shipment.destination === "FR" ? 0.03 : 0.05;
  const taxRate = shipment.destination === "FR" ? 0.2 : 0.12;

  const duty = round2(shipment.value * dutyRate);
  const tax = round2((shipment.value + duty) * taxRate);
  const total = round2(shipment.value + duty + tax);

  const invoiceChecks = [
    {
      label: "Devise facture coherente",
      ok: shipment.currency.length === 3,
      source,
    },
    {
      label: "Incoterm renseigne",
      ok: shipment.incoterm.length >= 3,
      source,
    },
    {
      label: "Code HS6 fourni",
      ok: shipment.hs6.length === 6,
      source,
    },
  ];

  return {
    shipment,
    invoice_checks: invoiceChecks,
    amounts: {
      duty_estimate: { label: "Droits import estimes", value: duty, currency: shipment.currency, source },
      tax_estimate: { label: "Taxes import estimees", value: tax, currency: shipment.currency, source },
      total_import_estimate: { label: "Cout import estime", value: total, currency: shipment.currency, source },
    },
    documents: [
      { name: "Facture commerciale", required: true, source },
      { name: "Packing list", required: true, source },
      { name: "Connaissement / AWB", required: true, source },
      { name: "Certificat d'origine", required: true, source },
    ],
    risks: [
      {
        level: invoiceChecks.every((check) => check.ok) ? "low" : "medium",
        label: "Verifier les champs manquants avant declaration en douane.",
        source,
      },
      {
        level: shipment.incoterm === "DDP" ? "high" : "low",
        label: shipment.incoterm === "DDP"
          ? "DDP peut masquer des couts import deja integres par le vendeur."
          : "Le cout import reste a verifier cote acheteur.",
        source,
      },
    ],
    recommendations: [
      "Valider les montants avec le declarant en douane.",
      "Conserver les preuves documentaires (facture, transport, origine).",
      "Tracer la source des estimations pour audit interne.",
    ],
  };
}
