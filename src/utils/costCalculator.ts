import type { Destination, Incoterm, TransportMode, Zone } from "@/types";
import {
  getZoneFromDestination,
  vatRates as defaultVatRates,
  octroiMerRates as defaultOmRates,
  transportCosts as defaultTransportCosts,
  serviceCharges as defaultServiceCharges,
  environmentalTaxes,
  incotermPayerRules,
  type VatRate,
  type OctroiMerRate,
  type TransportCost,
  type ServiceCharge,
} from "@/data/referenceRates";

export type ProductType = "lppr" | "standard";

// Custom rates interface for overriding defaults
export interface CustomRates {
  vatRates?: VatRate[];
  octroiMerRates?: OctroiMerRate[];
  transportCosts?: TransportCost[];
  serviceCharges?: ServiceCharge[];
}

/**
 * Contexte client (optionnel) — on branche plus tard sur table clients / groupements.
 */
export type SalesCanal = "direct" | "indirect" | "depositaire";

export interface ClientContext {
  client_id?: string;
  canal?: SalesCanal;
  depositaire_id?: string;
  groupement_id?: string;
  groupement_discount_pct?: number; // ex: 5 => -5%
}

export interface CostCalculationParams {
  goodsValue: number; // Valeur marchandise HT
  destination: Destination;
  incoterm: Incoterm;
  productType: ProductType;
  transportMode: TransportMode;
  weight?: number;
  customsCode?: string;
  margin?: number;
  customRates?: CustomRates;

  client?: ClientContext;
}

export interface CostLine {
  label: string;
  amount: number; // HT / taxe / TVA import
  payer: "Fournisseur" | "Client";
  tvaApplicable: boolean;
  tvaAmount: number; // TVA sur prestation (si applicable)
  isRecoverable: boolean; // TVA récupérable (neutre)
  category: "prestation" | "taxe" | "tva_import";
  notes: string;
}

export interface CostBreakdown {
  params: CostCalculationParams;
  zone: Zone;
  lines: CostLine[];

  totalPrestationsHT: number;
  totalTvaRecuperablePrestations: number;
  totalTaxesNonRecuperables: number;
  totalTvaImport: number;

  totalFournisseur: number; // somme amounts payés fournisseur (HT/taxes/TVA import)
  totalClient: number; // somme amounts payés client (HT/taxes/TVA import)

  /** ✅ Totaux cash-out TTC (incluent TVA sur prestations quand applicable) */
  totalFournisseurCashOut: number;
  totalClientCashOut: number;

  totalFournisseurNetCost: number; // ✅ coût fournisseur hors TVA import récupérable
  prixDeRevient: number;
  prixVenteHT: number;
  margeAppliquee: number;

  remiseGroupementPct?: number;
  prixVenteHTApresRemise?: number;
}

export function calculateCosts(params: CostCalculationParams): CostBreakdown {
  const {
    goodsValue,
    destination,
    incoterm,
    productType,
    transportMode,
    weight = 100,
    margin = 25,
    customRates,
    client,
  } = params;

  const vatRates = customRates?.vatRates || defaultVatRates;
  const omRates = customRates?.octroiMerRates || defaultOmRates;
  const transportCostsData = customRates?.transportCosts || defaultTransportCosts;
  const serviceChargesData = customRates?.serviceCharges || defaultServiceCharges;

  const zone = getZoneFromDestination(destination);

  const vatRate = vatRates.find((v) => v.destination === destination);

  const omRatesForDest = omRates.filter((r) => r.destination === destination);
  const omRate =
    productType === "lppr"
      ? omRatesForDest.find((r) => r.category === "Orthopedie") || omRatesForDest.find((r) => r.category === "Standard")
      : omRatesForDest.find((r) => r.category === "Standard");

  const transportCost = transportCostsData.find(
    (t) => t.destination === destination && t.transport_mode === transportMode
  );

  const incotermRule = incotermPayerRules.find((r) => r.incoterm === incoterm);

  const lines: CostLine[] = [];

  // 1) TRANSPORT PRINCIPAL
  const transportAmount = transportCost
    ? Math.max(weight * transportCost.cost_per_kg, transportCost.min_cost)
    : estimateTransportCost(zone, transportMode, weight);

  const transportPayer = incotermRule?.transport_principal || "Fournisseur";
  const transportTvaRate = 20;
  const transportTva = transportAmount * (transportTvaRate / 100);

  lines.push({
    label: `Fret ${transportMode}`,
    amount: transportAmount,
    payer: transportPayer,
    tvaApplicable: true,
    tvaAmount: transportTva,
    isRecoverable: true,
    category: "prestation",
    notes: `TVA ${transportTvaRate}% récupérable`,
  });

  // 2) SURCHARGE CARBURANT
  const fuelSurcharge = environmentalTaxes.find(
    (t) => t.transport_mode === transportMode && t.type.includes("carburant")
  );
  if (fuelSurcharge?.rate_percentage) {
    const surchargeAmount = transportAmount * (fuelSurcharge.rate_percentage / 100);
    const surchargeTva = surchargeAmount * 0.2;

    lines.push({
      label: "Surcharge carburant",
      amount: surchargeAmount,
      payer: transportPayer,
      tvaApplicable: true,
      tvaAmount: surchargeTva,
      isRecoverable: true,
      category: "prestation",
      notes: fuelSurcharge.notes,
    });
  }

  // 3) DEDOUANEMENT EXPORT
  if (zone !== "UE") {
    const dedouanementExport = serviceChargesData.find((s) => s.type === "dedouanement_export" && s.zone === zone);
    if (dedouanementExport?.fixed_cost) {
      const payer = incotermRule?.dedouanement_export || "Fournisseur";
      const tva = dedouanementExport.fixed_cost * (dedouanementExport.tva_on_service / 100);

      lines.push({
        label: "Dédouanement export",
        amount: dedouanementExport.fixed_cost,
        payer,
        tvaApplicable: true,
        tvaAmount: tva,
        isRecoverable: true,
        category: "prestation",
        notes: `TVA ${dedouanementExport.tva_on_service}% récupérable`,
      });
    }
  }

  // 4) DEDOUANEMENT IMPORT
  if (zone !== "UE") {
    const dedouanementImport = serviceChargesData.find((s) => s.type === "dedouanement_import" && s.zone === zone);
    if (dedouanementImport?.fixed_cost) {
      const payer = incotermRule?.dedouanement_import || "Client";
      const tva = dedouanementImport.fixed_cost * (dedouanementImport.tva_on_service / 100);

      lines.push({
        label: "Dédouanement import",
        amount: dedouanementImport.fixed_cost,
        payer,
        tvaApplicable: true,
        tvaAmount: tva,
        isRecoverable: false,
        category: "prestation",
        notes: "TVA destination (non récupérable en France)",
      });
    }
  }

  // 5) MANUTENTION
  const manutention = serviceChargesData.find((s) => s.type === "manutention" && s.zone === zone);
  if (manutention?.fixed_cost) {
    const tva = manutention.fixed_cost * (manutention.tva_on_service / 100);

    lines.push({
      label: "Manutention",
      amount: manutention.fixed_cost,
      payer: transportPayer,
      tvaApplicable: manutention.tva_on_service > 0,
      tvaAmount: tva,
      // ✅ fix minimal : récupérable uniquement si TVA FR 20% (sinon trop risqué)
      isRecoverable: manutention.tva_on_service === 20,
      category: "prestation",
      notes: manutention.tva_on_service === 20 ? "TVA 20% récupérable (FR)" : "TVA destination / non récupérable fournisseur",
    });
  }

  // 6) ASSURANCE
  const assurance = serviceChargesData.find((s) => s.type === "assurance" && s.zone === zone);
  if (assurance?.percentage) {
    const amount = goodsValue * (assurance.percentage / 100);
    const payer = incotermRule?.assurance || "Fournisseur";

    lines.push({
      label: "Assurance transport",
      amount,
      payer,
      tvaApplicable: false,
      tvaAmount: 0,
      isRecoverable: false,
      category: "prestation",
      notes: "Exonéré de TVA",
    });
  }

  // 7) DROITS DE DOUANE (Hors UE)
  if (zone === "Hors UE") {
    const droitsRate = productType === "lppr" ? 0 : 3;
    const amount = goodsValue * (droitsRate / 100);

    if (amount > 0) {
      lines.push({
        label: "Droits de douane",
        amount,
        payer: incotermRule?.droits_douane || "Client",
        tvaApplicable: false,
        tvaAmount: 0,
        isRecoverable: false,
        category: "taxe",
        notes: `${droitsRate}% - NON RECUPERABLE`,
      });
    }
  }

  // 8) OCTROI DE MER (DROM)
  if (zone === "DROM" && omRate) {
    const omAmount = goodsValue * (omRate.om_rate / 100);
    const omrAmount = goodsValue * (omRate.omr_rate / 100);

    if (omAmount > 0) {
      lines.push({
        label: "Octroi de Mer",
        amount: omAmount,
        payer: incotermRule?.octroi_mer || "Client",
        tvaApplicable: false,
        tvaAmount: 0,
        isRecoverable: false,
        category: "taxe",
        notes: `${omRate.om_rate}% - NON RECUPERABLE (${omRate.notes})`,
      });
    }

    if (omrAmount > 0) {
      lines.push({
        label: "Octroi de Mer Régional",
        amount: omrAmount,
        payer: incotermRule?.octroi_mer || "Client",
        tvaApplicable: false,
        tvaAmount: 0,
        isRecoverable: false,
        category: "taxe",
        notes: `${omRate.omr_rate}% - NON RECUPERABLE`,
      });
    }
  }

  // 9) TVA IMPORT
  if (zone !== "UE" && vatRate) {
    const rate = productType === "lppr" ? vatRate.rate_lppr : vatRate.rate_standard;

    if (rate > 0) {
      const taxesAmount = lines.filter((l) => l.category === "taxe").reduce((s, l) => s + l.amount, 0);

      const prestationsFournisseur = lines
        .filter((l) => l.category === "prestation" && l.payer === "Fournisseur")
        .reduce((s, l) => s + l.amount, 0);

      const baseTva = goodsValue + taxesAmount + prestationsFournisseur;
      const tvaImportAmount = baseTva * (rate / 100);

      const isAuto = Boolean(vatRate.autoliquidation) && zone !== "Hors UE";
      const payer = incotermRule?.tva_import || "Client";
      const recoverable = isAuto && payer === "Fournisseur";

      lines.push({
        label: `TVA Import ${destination}`,
        amount: tvaImportAmount,
        payer,
        tvaApplicable: false,
        tvaAmount: recoverable ? tvaImportAmount : 0,
        isRecoverable: recoverable,
        category: "tva_import",
        notes: recoverable
          ? `${rate}% - récupérable (autoliquidation)`
          : `${rate}% - à la charge du payeur (non récupérable fournisseur)`,
      });
    }
  }

  // 10) TAXE CARBONE
  const carbonTax = environmentalTaxes.find((t) => t.transport_mode === transportMode && t.type === "taxe_carbone_ets");
  if (carbonTax?.rate_percentage) {
    const amount = transportAmount * (carbonTax.rate_percentage / 100);

    lines.push({
      label: "Taxe carbone (ETS)",
      amount,
      payer: transportPayer,
      tvaApplicable: false,
      tvaAmount: 0,
      isRecoverable: false,
      category: "taxe",
      notes: "NON RECUPERABLE",
    });
  }

  // ============= TOTAUX =============
  const prestations = lines.filter((l) => l.category === "prestation");
  const taxes = lines.filter((l) => l.category === "taxe");
  const tvaImport = lines.filter((l) => l.category === "tva_import");

  const totalPrestationsHT = prestations.reduce((s, l) => s + l.amount, 0);
  const totalTvaRecuperablePrestations = prestations.filter((l) => l.isRecoverable).reduce((s, l) => s + l.tvaAmount, 0);

  const totalTaxesNonRecuperables = taxes.reduce((s, l) => s + l.amount, 0);
  const totalTvaImport = tvaImport.reduce((s, l) => s + l.amount, 0);

  const totalFournisseur = lines.filter((l) => l.payer === "Fournisseur").reduce((s, l) => s + l.amount, 0);
  const totalClient = lines.filter((l) => l.payer === "Client").reduce((s, l) => s + l.amount, 0);

  // ✅ Cash-out TTC (ajoute TVA prestation quand applicable)
  const totalFournisseurCashOut = lines
    .filter((l) => l.payer === "Fournisseur")
    .reduce((s, l) => s + l.amount + (l.tvaApplicable ? l.tvaAmount : 0), 0);

  const totalClientCashOut = lines
    .filter((l) => l.payer === "Client")
    .reduce((s, l) => s + l.amount + (l.tvaApplicable ? l.tvaAmount : 0), 0);

  // ✅ VRAI coût fournisseur (ne pas compter la TVA import récupérable)
  const totalFournisseurNetCost = lines
    .filter((l) => l.payer === "Fournisseur")
    .filter((l) => !(l.category === "tva_import" && l.isRecoverable))
    .reduce((s, l) => s + l.amount, 0);

  const prixDeRevient = goodsValue + totalFournisseurNetCost;

  const margeAppliquee = margin || 25;
  const prixVenteHT = prixDeRevient * (1 + margeAppliquee / 100);

  const remiseGroupementPct = client?.groupement_discount_pct;
  const prixVenteHTApresRemise =
    typeof remiseGroupementPct === "number" && remiseGroupementPct > 0
      ? prixVenteHT * (1 - remiseGroupementPct / 100)
      : undefined;

  return {
    params,
    zone,
    lines,
    totalPrestationsHT,
    totalTvaRecuperablePrestations,
    totalTaxesNonRecuperables,
    totalTvaImport,
    totalFournisseur,
    totalClient,
    totalFournisseurCashOut,
    totalClientCashOut,
    totalFournisseurNetCost,
    prixDeRevient,
    prixVenteHT,
    margeAppliquee,
    remiseGroupementPct,
    prixVenteHTApresRemise,
  };
}

function estimateTransportCost(zone: Zone, mode: TransportMode, weight: number): number {
  const costPerKg: Record<Zone, Record<TransportMode, number>> = {
    UE: { Routier: 0.15, Maritime: 0.2, Aerien: 2.5, Express: 5, Ferroviaire: 0.12 },
    "Hors UE": { Routier: 0.25, Maritime: 0.3, Aerien: 4, Express: 8, Ferroviaire: 0.2 },
    DROM: { Routier: 0.5, Maritime: 0.5, Aerien: 4, Express: 7, Ferroviaire: 0.5 },
  };

  const minCost: Record<Zone, number> = {
    UE: 200,
    "Hors UE": 400,
    DROM: 800,
  };

  return Math.max(weight * (costPerKg[zone]?.[mode] || 0.3), minCost[zone] || 300);
}

// Export du type ProductType
export type { ProductType as CostProductType };
