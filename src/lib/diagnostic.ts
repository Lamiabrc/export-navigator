export type DiagnosticInputs = {
  destination_country: string;
  product_label: string;
  hs_code?: string | null;
  origin_country?: string | null;
  incoterm?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  currency?: string | null;
};

export type DiagnosticFlag = {
  level: "info" | "warning" | "risk";
  title: string;
  detail: string;
};

export type DiagnosticEstimate = {
  revenue: number;
  costs: number;
  margin: number;
  marginPct: number;
  currency: string;
  assumptions: string[];
};

export type DiagnosticOutput = {
  checklist: string[];
  flags: DiagnosticFlag[];
  recommendations: string[];
  estimate?: DiagnosticEstimate;
};

const INCOTERM_RISK_WEIGHT: Record<string, number> = {
  EXW: 0.12,
  FCA: 0.13,
  FAS: 0.14,
  FOB: 0.15,
  CFR: 0.16,
  CIF: 0.17,
  CPT: 0.16,
  CIP: 0.17,
  DAP: 0.2,
  DPU: 0.2,
  DDP: 0.24,
};

function normalizeText(v?: string | null) {
  return String(v || "").trim();
}

function normalizeCode(v?: string | null) {
  return normalizeText(v).toUpperCase();
}

export function buildDiagnostic(inputs: DiagnosticInputs): DiagnosticOutput {
  const hs = normalizeText(inputs.hs_code).replace(/[^0-9]/g, "");
  const incoterm = normalizeCode(inputs.incoterm);
  const origin = normalizeCode(inputs.origin_country);
  const destination = normalizeCode(inputs.destination_country);

  const checklistBase = [
    "Facture commerciale (mentions obligatoires + devise)",
    "Packing list (poids, volumes, colisage)",
    "Document de transport (BL/AWB/CMR selon mode)",
    "Déclaration export + identifiants opérateur",
    "Instruction transport & assurance si applicable",
    "Vérification sanctions & restrictions pays",
  ];

  if (origin) {
    checklistBase.push("Justificatif d’origine (preuve préférentielle si accord)");
  } else {
    checklistBase.push("Origine à confirmer (impact droits & préférences)");
  }

  if (incoterm) {
    checklistBase.push(`Incoterm ${incoterm} précisé au contrat`);
  } else {
    checklistBase.push("Incoterm à clarifier dans l’offre/contrat");
  }

  const flags: DiagnosticFlag[] = [];
  if (!destination) {
    flags.push({
      level: "risk",
      title: "Destination manquante",
      detail: "Les obligations, documents et contrôles varient fortement selon le pays.",
    });
  }

  if (!hs) {
    flags.push({
      level: "risk",
      title: "Code HS manquant",
      detail: "Sans HS, droits, contrôles et restrictions restent génériques.",
    });
  }

  if (!origin) {
    flags.push({
      level: "warning",
      title: "Origine non définie",
      detail: "L’origine détermine préférences tarifaires et exigences documentaires.",
    });
  }

  if (!incoterm) {
    flags.push({
      level: "warning",
      title: "Incoterm non précisé",
      detail: "Les responsabilités (transport, assurance, douane) restent floues.",
    });
  }

  if (!inputs.quantity || !inputs.unit_price) {
    flags.push({
      level: "info",
      title: "Estimation marge incomplète",
      detail: "Ajoute quantité + prix unitaire pour estimer rapidement la marge.",
    });
  }

  const recommendations = [
    "Valider le HS avec un classement fiable.",
    "Confirmer l’Incoterm dans la proposition commerciale.",
    "Sécuriser l’origine pour bénéficier d’éventuelles préférences.",
    "Vérifier les restrictions pays avant expédition.",
  ];

  let estimate: DiagnosticEstimate | undefined;
  if (inputs.quantity && inputs.unit_price) {
    const revenue = Math.max(0, inputs.quantity) * Math.max(0, inputs.unit_price);
    const baseRate = INCOTERM_RISK_WEIGHT[incoterm] ?? 0.16;
    const hsPenalty = hs ? 0 : 0.02;
    const originPenalty = origin ? 0 : 0.01;
    const costRate = Math.min(baseRate + hsPenalty + originPenalty, 0.35);

    const costs = revenue * costRate;
    const margin = revenue - costs;
    const marginPct = revenue ? (margin / revenue) * 100 : 0;

    const assumptions = [
      `Hypothèse coûts logistiques + douane ~ ${(costRate * 100).toFixed(0)}%`,
      "Inclut transport, assurance, formalités, aléas pays",
      "À affiner avec contrat & prestataires",
    ];

    estimate = {
      revenue,
      costs,
      margin,
      marginPct,
      currency: inputs.currency || "EUR",
      assumptions,
    };
  }

  return {
    checklist: checklistBase,
    flags,
    recommendations,
    estimate,
  };
}
