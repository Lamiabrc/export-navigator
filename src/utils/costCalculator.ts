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

export type ProductType = "regulated" | "standard";

/**
 * ✅ Sens de flux (positionnement France ↔ Monde)
 * - export_fr : France -> Monde (droits/TVA import côté destination)
 * - import_fr : Monde -> France (droits/TVA import côté France)
 */
export type TradeDirection = "export_fr" | "import_fr";

// Custom rates interface for overriding defaults
export interface CustomRates {
  vatRates?: VatRate[];

  /**
   * ✅ Référentiel "droits & taxes à l'import" (générique)
   * - On garde le type OctroiMerRate pour compat (historique), mais on ne l'affiche plus comme "Octroi de mer"
   * - On supporte hs_code si présent (depuis Supabase)
   *
   * Champs attendus (compat / DB possible) :
   * { destination, hs_code, om_rate, omr_rate, notes, category? }
   *
   * Interprétation :
   * - om_rate  => taux droits/taxe de base
   * - omr_rate => taux taxe additionnelle (si applicable)
   */
  octroiMerRates?: OctroiMerRate[] | Array<OctroiMerRate & { hs_code?: string }>;

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

  /**
   * ✅ destination = pays "cible" du flux (ISO recommandé: FR, US, CN...)
   * - export_fr : pays de destination client
   * - import_fr : destination peut rester FR, mais on garde la signature existante
   */
  destination: Destination;

  /**
   * ✅ origine (optionnel) :
   * - utile pour import_fr (Monde -> France) afin d'évaluer la zone depuis l'origine
   */
  origin?: Destination;

  /**
   * ✅ sens du flux (par défaut export_fr pour compat)
   */
  direction?: TradeDirection;

  incoterm: Incoterm;
  productType: ProductType;
  transportMode: TransportMode;
  weight?: number;

  /**
   * ✅ HS code / code douanier (ex: "90211010")
   * - utilisé pour droits/taxes à l'import (quand disponibles)
   */
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

  /**
   * ✅ "Vrai coût" payeur (intègre la TVA non récupérable + exclut TVA import récupérable)
   * => c'est celui à utiliser pour prix de revient
   */
  totalFournisseurNetCost: number;

  prixDeRevient: number;
  prixVenteHT: number;
  margeAppliquee: number;

  remiseGroupementPct?: number;
  prixVenteHTApresRemise?: number;
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeHsCode(input?: string): string {
  if (!input) return "";
  return String(input).replace(/[^0-9]/g, "").trim();
}

/**
 * ✅ Trouve le "duty rate" via référentiel (hs_code > prefix 6/4 > fallback category)
 * Note: on utilise octroiMerRates pour compat, mais le sens est générique (droits/taxes import).
 */
function findDutyRate(params: {
  dutyCountry: Destination;
  productType: ProductType;
  customsCode?: string;
  dutyRates: Array<OctroiMerRate & { hs_code?: string }>;
}): (OctroiMerRate & { hs_code?: string }) | undefined {
  const { dutyCountry, productType, customsCode, dutyRates } = params;

  const ratesForCountry = dutyRates.filter((r) => (r as any).destination === dutyCountry);

  // 1) ✅ priorité HS code (si présent)
  const hs = normalizeHsCode(customsCode);
  if (hs) {
    const exact = ratesForCountry.find((r) => normalizeHsCode((r as any).hs_code) === hs);
    if (exact) return exact;

    const prefix6 = hs.slice(0, 6);
    const prefix4 = hs.slice(0, 4);

    const match6 = ratesForCountry.find((r) => normalizeHsCode((r as any).hs_code) === prefix6);
    if (match6) return match6;

    const match4 = ratesForCountry.find((r) => normalizeHsCode((r as any).hs_code) === prefix4);
    if (match4) return match4;
  }

  // 2) fallback catégorie (compat historique)
  const byCategory =
    productType === "regulated"
      ? ratesForCountry.find((r) => (r as any).category === "Reglemente") ||
        ratesForCountry.find((r) => (r as any).category === "Standard")
      : ratesForCountry.find((r) => (r as any).category === "Standard");

  return byCategory as any;
}

function isLineTvaNonRecoverableCost(line: CostLine): boolean {
  return Boolean(line.tvaApplicable) && safeNumber(line.tvaAmount) > 0 && !line.isRecoverable;
}

function isRecoverableTvaImport(line: CostLine): boolean {
  return line.category === "tva_import" && line.isRecoverable;
}

/**
 * ✅ coût net payeur (utilisé pour prix de revient)
 * - amount toujours compté
 * - + TVA sur prestation si NON récupérable
 * - tva_import: si récupérable => exclue du coût (sinon incluse)
 */
function netCostForPayer(lines: CostLine[], payer: "Fournisseur" | "Client"): number {
  return lines
    .filter((l) => l.payer === payer)
    .reduce((sum, l) => {
      let s = sum + safeNumber(l.amount);
      if (isLineTvaNonRecoverableCost(l)) s += safeNumber(l.tvaAmount);

      // TVA import récupérable => pas un coût
      if (isRecoverableTvaImport(l)) {
        s -= safeNumber(l.amount);
      }

      return s;
    }, 0);
}

export function calculateCosts(params: CostCalculationParams): CostBreakdown {
  const {
    goodsValue: rawGoodsValue,
    destination: rawDestination,
    origin: rawOrigin,
    direction: rawDirection,
    incoterm,
    productType,
    transportMode,
    weight: rawWeight = 100,
    margin: rawMargin = 25,
    customRates,
    client,
    customsCode,
  } = params;

  const goodsValue = Math.max(0, safeNumber(rawGoodsValue));
  const weight = Math.max(0, safeNumber(rawWeight));
  const margin = Math.max(0, safeNumber(rawMargin));

  const direction: TradeDirection = rawDirection ?? "export_fr";
  const destination: Destination = rawDestination;
  const origin: Destination = rawOrigin ?? "FR";

  /**
   * ✅ Pays où s'appliquent droits & TVA import
   * - export_fr => côté destination
   * - import_fr => côté France (destination=FR normalement)
   */
  const importCountry: Destination = direction === "import_fr" ? "FR" : destination;

  /**
   * ✅ Zone calculée selon le pays "importCountry" (là où se fait l'import)
   * - si importCountry dans l'UE => UE, sinon Hors UE
   */
  const zone = getZoneFromDestination(importCountry);

  const vatRates = (customRates?.vatRates || defaultVatRates) as VatRate[];
  const dutyRates = (customRates?.octroiMerRates || defaultOmRates) as Array<OctroiMerRate & { hs_code?: string }>;
  const transportCostsData = (customRates?.transportCosts || defaultTransportCosts) as TransportCost[];
  const serviceChargesData = (customRates?.serviceCharges || defaultServiceCharges) as ServiceCharge[];

  const vatRate = vatRates.find((v) => v.destination === importCountry);

  const incotermRule = incotermPayerRules.find((r) => r.incoterm === incoterm);

  const lines: CostLine[] = [];

  // 1) TRANSPORT PRINCIPAL
  const transportCost = transportCostsData.find(
    (t) => t.destination === destination && t.transport_mode === transportMode,
  );

  const transportAmount = transportCost
    ? Math.max(weight * transportCost.cost_per_kg, transportCost.min_cost)
    : estimateTransportCost(zone, transportMode, weight);

  const transportPayer = (incotermRule as any)?.transport_principal || "Fournisseur";

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
    (t) => t.transport_mode === transportMode && String(t.type || "").includes("carburant"),
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

  // 3) DEDOUANEMENT EXPORT (si export_fr et Hors UE côté destination)
  if (direction === "export_fr" && zone !== "UE") {
    const dedouanementExport = serviceChargesData.find(
      (s) => s.type === "dedouanement_export" && s.zone === zone,
    );
    if (dedouanementExport?.fixed_cost) {
      const payer = (incotermRule as any)?.dedouanement_export || "Fournisseur";
      const tva = dedouanementExport.fixed_cost * (dedouanementExport.tva_on_service / 100);

      lines.push({
        label: "Dédouanement export",
        amount: dedouanementExport.fixed_cost,
        payer,
        tvaApplicable: true,
        tvaAmount: tva,
        isRecoverable: dedouanementExport.tva_on_service === 20,
        category: "prestation",
        notes:
          dedouanementExport.tva_on_service === 20
            ? `TVA ${dedouanementExport.tva_on_service}% récupérable (FR)`
            : `TVA ${dedouanementExport.tva_on_service}% (attention récupérabilité)`,
      });
    }
  }

  // 4) DEDOUANEMENT IMPORT (si Hors UE côté importCountry)
  if (zone !== "UE") {
    const dedouanementImport = serviceChargesData.find(
      (s) => s.type === "dedouanement_import" && s.zone === zone,
    );
    if (dedouanementImport?.fixed_cost) {
      const payer = (incotermRule as any)?.dedouanement_import || "Client";
      const tva = dedouanementImport.fixed_cost * (dedouanementImport.tva_on_service / 100);

      lines.push({
        label: `Dédouanement import (${importCountry})`,
        amount: dedouanementImport.fixed_cost,
        payer,
        tvaApplicable: dedouanementImport.tva_on_service > 0,
        tvaAmount: tva,
        isRecoverable: false,
        category: "prestation",
        notes: "TVA locale/non récupérable par défaut => coût réel (à affiner selon statut)",
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
      isRecoverable: manutention.tva_on_service === 20,
      category: "prestation",
      notes:
        manutention.tva_on_service === 20
          ? "TVA 20% récupérable (FR)"
          : "TVA locale / non récupérable => coût réel",
    });
  }

  // 6) ASSURANCE
  const assurance = serviceChargesData.find((s) => s.type === "assurance" && s.zone === zone);
  if (assurance?.percentage) {
    const amount = goodsValue * (assurance.percentage / 100);
    const payer = (incotermRule as any)?.assurance || "Fournisseur";

    lines.push({
      label: "Assurance transport",
      amount,
      payer,
      tvaApplicable: false,
      tvaAmount: 0,
      isRecoverable: false,
      category: "prestation",
      notes: "Exonéré de TVA (générique)",
    });
  }

  // 7) DROITS & TAXES A L'IMPORT (Hors UE) — Générique + HS si dispo, sinon fallback
  if (zone === "Hors UE") {
    const found = findDutyRate({
      dutyCountry: importCountry,
      productType,
      customsCode,
      dutyRates,
    });

    const payer =
      (incotermRule as any)?.droits_douane ||
      (incotermRule as any)?.octroi_mer || // compat ancienne règle
      "Client";

    if (found) {
      const baseRate = safeNumber((found as any).om_rate);
      const addRate = safeNumber((found as any).omr_rate);

      const baseAmount = goodsValue * (baseRate / 100);
      const addAmount = goodsValue * (addRate / 100);

      const hsInfo = normalizeHsCode((found as any).hs_code)
        ? `HS ${normalizeHsCode((found as any).hs_code)}`
        : "catégorie";

      if (baseAmount > 0) {
        lines.push({
          label: `Droits à l'import (${importCountry})`,
          amount: baseAmount,
          payer,
          tvaApplicable: false,
          tvaAmount: 0,
          isRecoverable: false,
          category: "taxe",
          notes: `${baseRate}% - non récupérable (${hsInfo}) ${(found as any).notes || ""}`.trim(),
        });
      }

      if (addAmount > 0) {
        lines.push({
          label: `Taxe additionnelle (${importCountry})`,
          amount: addAmount,
          payer,
          tvaApplicable: false,
          tvaAmount: 0,
          isRecoverable: false,
          category: "taxe",
          notes: `${addRate}% - non récupérable (${hsInfo})`.trim(),
        });
      }
    } else {
      // fallback (placeholder)
      const fallbackRate = productType === "regulated" ? 0 : 3;
      const amount = goodsValue * (fallbackRate / 100);

      if (amount > 0) {
        lines.push({
          label: `Droits à l'import (${importCountry})`,
          amount,
          payer,
          tvaApplicable: false,
          tvaAmount: 0,
          isRecoverable: false,
          category: "taxe",
          notes: `${fallbackRate}% - placeholder (à remplacer par tarif HS réel)`,
        });
      }
    }
  }

  // 8) TVA IMPORT (Hors UE) — modèle simplifié, cohérent France ↔ Monde
  if (zone !== "UE" && vatRate) {
    const rate = productType === "regulated" ? vatRate.rate_regulated : vatRate.rate_standard;

    if (rate > 0) {
      const taxesAmount = lines.filter((l) => l.category === "taxe").reduce((s, l) => s + l.amount, 0);

      const prestationsFournisseur = lines
        .filter((l) => l.category === "prestation" && l.payer === "Fournisseur")
        .reduce((s, l) => s + l.amount, 0);

      const baseTva = goodsValue + taxesAmount + prestationsFournisseur;
      const tvaImportAmount = baseTva * (rate / 100);

      /**
       * ✅ Bugfix: avant, c'était toujours false.
       * Ici: autoliquidation = param dans vatRate, sans condition de zone absurde.
       */
      const isAuto = Boolean((vatRate as any).autoliquidation);
      const payer = (incotermRule as any)?.tva_import || "Client";
      const recoverable = isAuto && payer === "Fournisseur";

      lines.push({
        label: `TVA import (${importCountry})`,
        amount: tvaImportAmount,
        payer,
        tvaApplicable: false,
        tvaAmount: 0,
        isRecoverable: recoverable,
        category: "tva_import",
        notes: recoverable
          ? `${rate}% - récupérable (autoliquidation)`
          : `${rate}% - à la charge du payeur (coût)`,
      });
    }
  }

  // 9) TAXE CARBONE (ETS) — placeholder (peut devenir paramétrable)
  const carbonTax = environmentalTaxes.find(
    (t) => t.transport_mode === transportMode && t.type === "taxe_carbone_ets",
  );
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
      notes: "NON RECUPERABLE (placeholder)",
    });
  }

  // ============= TOTAUX =============
  const prestations = lines.filter((l) => l.category === "prestation");
  const taxes = lines.filter((l) => l.category === "taxe");
  const tvaImport = lines.filter((l) => l.category === "tva_import");

  const totalPrestationsHT = prestations.reduce((s, l) => s + l.amount, 0);

  // TVA récupérable uniquement sur prestations avec isRecoverable=true
  const totalTvaRecuperablePrestations = prestations
    .filter((l) => l.isRecoverable)
    .reduce((s, l) => s + safeNumber(l.tvaAmount), 0);

  const totalTaxesNonRecuperables = taxes.reduce((s, l) => s + l.amount, 0);
  const totalTvaImport = tvaImport.reduce((s, l) => s + l.amount, 0);

  const totalFournisseur = lines
    .filter((l) => l.payer === "Fournisseur")
    .reduce((s, l) => s + safeNumber(l.amount), 0);

  const totalClient = lines
    .filter((l) => l.payer === "Client")
    .reduce((s, l) => s + safeNumber(l.amount), 0);

  // ✅ Cash-out TTC (ajoute TVA prestation quand applicable)
  const totalFournisseurCashOut = lines
    .filter((l) => l.payer === "Fournisseur")
    .reduce((s, l) => s + safeNumber(l.amount) + (l.tvaApplicable ? safeNumber(l.tvaAmount) : 0), 0);

  const totalClientCashOut = lines
    .filter((l) => l.payer === "Client")
    .reduce((s, l) => s + safeNumber(l.amount) + (l.tvaApplicable ? safeNumber(l.tvaAmount) : 0), 0);

  // ✅ VRAI coût fournisseur
  const totalFournisseurNetCost = netCostForPayer(lines, "Fournisseur");

  // ✅ prix de revient = marchandise + vrai coût fournisseur
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
  };

  const minCost: Record<Zone, number> = {
    UE: 200,
    "Hors UE": 400,
  };

  return Math.max(weight * (costPerKg[zone]?.[mode] || 0.3), minCost[zone] || 300);
}

// Export du type ProductType
export type { ProductType as CostProductType };
