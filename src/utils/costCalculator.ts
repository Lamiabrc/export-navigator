import type { Destination, Incoterm, TransportMode, Zone } from '@/types';
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
} from '@/data/referenceRates';

export type ProductType = 'lppr' | 'standard';

// Custom rates interface for overriding defaults
export interface CustomRates {
  vatRates?: VatRate[];
  octroiMerRates?: OctroiMerRate[];
  transportCosts?: TransportCost[];
  serviceCharges?: ServiceCharge[];
}

export interface CostCalculationParams {
  goodsValue: number;           // Valeur marchandise HT (coût d'achat)
  destination: Destination;
  incoterm: Incoterm;
  productType: ProductType;     // LPPR remboursé ou standard
  transportMode: TransportMode;
  weight?: number;              // Poids en kg (optionnel)
  customsCode?: string;         // Code nomenclature douanière
  margin?: number;              // Marge souhaitée en %
  customRates?: CustomRates;    // Taux personnalisés (optionnel)
}

export interface CostLine {
  label: string;
  amount: number;
  payer: 'Fournisseur' | 'Client';
  tvaApplicable: boolean;       // TVA sur la prestation
  tvaAmount: number;            // Montant TVA récupérable
  isRecoverable: boolean;       // TVA récupérable (neutre trésorerie)
  category: 'prestation' | 'taxe' | 'tva_import';
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
  totalFournisseur: number;
  totalClient: number;
  prixDeRevient: number;
  prixVenteHT: number;
  margeAppliquee: number;
}

export function calculateCosts(params: CostCalculationParams): CostBreakdown {
  const { goodsValue, destination, incoterm, productType, transportMode, weight = 100, margin = 25, customRates } = params;

  const vatRates = customRates?.vatRates || defaultVatRates;
  const omRates = customRates?.octroiMerRates || defaultOmRates;
  const transportCostsData = customRates?.transportCosts || defaultTransportCosts;
  const serviceChargesData = customRates?.serviceCharges || defaultServiceCharges;

  const zone = getZoneFromDestination(destination);

  // VAT rate
  const vatRate = vatRates.find((v) => v.destination === destination);

  // OM/OMR rate
  const omRatesForDest = omRates.filter((r) => r.destination === destination);
  const omRate = productType === 'lppr'
    ? omRatesForDest.find((r) => r.category === 'Orthopedie') || omRatesForDest.find((r) => r.category === 'Standard')
    : omRatesForDest.find((r) => r.category === 'Standard');

  // Transport cost estimate
  const transportCost = transportCostsData.find((t) => t.destination === destination && t.transport_mode === transportMode);

  const incotermRule = incotermPayerRules.find((r) => r.incoterm === incoterm);

  const lines: CostLine[] = [];

  // ============= 1. TRANSPORT PRINCIPAL =============
  const transportAmount = transportCost
    ? Math.max(weight * transportCost.cost_per_kg, transportCost.min_cost)
    : estimateTransportCost(zone, transportMode, weight);

  const transportPayer = incotermRule?.transport_principal || 'Fournisseur';
  const transportTvaRate = 20; // TVA française sur le fret
  const transportTva = transportAmount * (transportTvaRate / 100);

  lines.push({
    label: `Fret ${transportMode}`,
    amount: transportAmount,
    payer: transportPayer,
    tvaApplicable: true,
    tvaAmount: transportTva,
    isRecoverable: true,
    category: 'prestation',
    notes: `TVA ${transportTvaRate}% récupérable`,
  });

  // ============= 2. SURCHARGE CARBURANT =============
  const fuelSurcharge = environmentalTaxes.find(
    (t) => t.transport_mode === transportMode && t.type.includes('carburant')
  );
  if (fuelSurcharge && fuelSurcharge.rate_percentage) {
    const surchargeAmount = transportAmount * (fuelSurcharge.rate_percentage / 100);
    const surchargeTva = surchargeAmount * 0.20;

    lines.push({
      label: 'Surcharge carburant',
      amount: surchargeAmount,
      payer: transportPayer,
      tvaApplicable: true,
      tvaAmount: surchargeTva,
      isRecoverable: true,
      category: 'prestation',
      notes: fuelSurcharge.notes,
    });
  }

  // ============= 3. DEDOUANEMENT EXPORT =============
  if (zone !== 'UE') {
    const dedouanementExport = serviceChargesData.find(
      (s) => s.type === 'dedouanement_export' && s.zone === zone
    );
    if (dedouanementExport && dedouanementExport.fixed_cost > 0) {
      const dedouanementExportPayer = incotermRule?.dedouanement_export || 'Fournisseur';
      const dedouanementTva = dedouanementExport.fixed_cost * (dedouanementExport.tva_on_service / 100);

      lines.push({
        label: 'Dédouanement export',
        amount: dedouanementExport.fixed_cost,
        payer: dedouanementExportPayer,
        tvaApplicable: true,
        tvaAmount: dedouanementTva,
        isRecoverable: true,
        category: 'prestation',
        notes: `TVA ${dedouanementExport.tva_on_service}% récupérable`,
      });
    }
  }

  // ============= 4. DEDOUANEMENT IMPORT =============
  if (zone !== 'UE') {
    const dedouanementImport = serviceChargesData.find(
      (s) => s.type === 'dedouanement_import' && s.zone === zone
    );
    if (dedouanementImport && dedouanementImport.fixed_cost > 0) {
      const dedouanementImportPayer = incotermRule?.dedouanement_import || 'Client';
      const dedouanementTva = dedouanementImport.fixed_cost * (dedouanementImport.tva_on_service / 100);

      lines.push({
        label: 'Dédouanement import',
        amount: dedouanementImport.fixed_cost,
        payer: dedouanementImportPayer,
        tvaApplicable: true,
        tvaAmount: dedouanementTva,
        isRecoverable: false,
        category: 'prestation',
        notes: 'TVA destination (non récupérable en France)',
      });
    }
  }

  // ============= 5. MANUTENTION =============
  const manutention = serviceChargesData.find((s) => s.type === 'manutention' && s.zone === zone);
  if (manutention && manutention.fixed_cost > 0) {
    const manutentionTva = manutention.fixed_cost * (manutention.tva_on_service / 100);

    lines.push({
      label: 'Manutention',
      amount: manutention.fixed_cost,
      payer: transportPayer,
      tvaApplicable: manutention.tva_on_service > 0,
      tvaAmount: manutentionTva,
      isRecoverable: zone === 'UE' || manutention.tva_on_service === 20,
      category: 'prestation',
      notes: zone === 'UE' ? 'TVA récupérable' : 'Selon origine facture',
    });
  }

  // ============= 6. ASSURANCE =============
  const assurance = serviceChargesData.find((s) => s.type === 'assurance' && s.zone === zone);
  let assuranceAmount = 0;
  if (assurance && assurance.percentage) {
    assuranceAmount = goodsValue * (assurance.percentage / 100);
    const assurancePayer = incotermRule?.assurance || 'Fournisseur';

    lines.push({
      label: 'Assurance transport',
      amount: assuranceAmount,
      payer: assurancePayer,
      tvaApplicable: false,
      tvaAmount: 0,
      isRecoverable: false,
      category: 'prestation',
      notes: 'Exonéré de TVA',
    });
  }

  // ============= 7. DROITS DE DOUANE (Hors UE) =============
  if (zone === 'Hors UE') {
    const droitsRate = productType === 'lppr' ? 0 : 3; // par défaut, 0 pour 9021, 3% générique
    const droitsAmount = goodsValue * (droitsRate / 100);

    if (droitsAmount > 0) {
      lines.push({
        label: 'Droits de douane',
        amount: droitsAmount,
        payer: incotermRule?.droits_douane || 'Client',
        tvaApplicable: false,
        tvaAmount: 0,
        isRecoverable: false,
        category: 'taxe',
        notes: `${droitsRate}% - NON RECUPERABLE`,
      });
    }
  }

  // ============= 8. OCTROI DE MER (DROM uniquement) =============
  if (zone === 'DROM' && omRate) {
    const omAmount = goodsValue * (omRate.om_rate / 100);
    const omrAmount = goodsValue * (omRate.omr_rate / 100);

    if (omAmount > 0) {
      lines.push({
        label: 'Octroi de Mer',
        amount: omAmount,
        payer: incotermRule?.octroi_mer || 'Client',
        tvaApplicable: false,
        tvaAmount: 0,
        isRecoverable: false,
        category: 'taxe',
        notes: `${omRate.om_rate}% - NON RECUPERABLE (${omRate.notes})`,
      });
    }

    if (omrAmount > 0) {
      lines.push({
        label: 'Octroi de Mer Régional',
        amount: omrAmount,
        payer: incotermRule?.octroi_mer || 'Client',
        tvaApplicable: false,
        tvaAmount: 0,
        isRecoverable: false,
        category: 'taxe',
        notes: `${omRate.omr_rate}% - NON RECUPERABLE`,
      });
    }
  }

  // ============= 9. TVA IMPORT =============
  if (zone !== 'UE' && vatRate) {
    const rate = productType === 'lppr' ? vatRate.rate_lppr : vatRate.rate_standard;
    if (rate > 0) {
      const taxesAmount = lines.filter((l) => l.category === 'taxe').reduce((s, l) => s + l.amount, 0);
      const prestationsFournisseur = lines
        .filter((l) => l.category === 'prestation' && l.payer === 'Fournisseur')
        .reduce((s, l) => s + l.amount, 0);
      const baseTva = goodsValue + taxesAmount + prestationsFournisseur;
      const tvaImportAmount = baseTva * (rate / 100);
      const isAuto = vatRate.autoliquidation && zone !== 'Hors UE'; // DROM autoliquidation possible (selon schéma)
      const recoverable = isAuto && (incotermRule?.tva_import || 'Client') === 'Fournisseur';

      lines.push({
        label: `TVA Import ${destination}`,
        amount: tvaImportAmount,
        payer: incotermRule?.tva_import || 'Client',
        tvaApplicable: false,
        tvaAmount: recoverable ? tvaImportAmount : 0,
        isRecoverable: recoverable,
        category: 'tva_import',
        notes: recoverable
          ? `${rate}% - récupérable (autoliquidation)`
          : `${rate}% - à la charge du payeur (non récupérable fournisseur)`,
      });
    }
  }

  // ============= 10. TAXE CARBONE (si applicable) =============
  const carbonTax = environmentalTaxes.find(
    (t) => t.transport_mode === transportMode && t.type === 'taxe_carbone_ets'
  );
  if (carbonTax && carbonTax.rate_percentage) {
    const carbonAmount = transportAmount * (carbonTax.rate_percentage / 100);

    lines.push({
      label: 'Taxe carbone (ETS)',
      amount: carbonAmount,
      payer: transportPayer,
      tvaApplicable: false,
      tvaAmount: 0,
      isRecoverable: false,
      category: 'taxe',
      notes: 'NON RECUPERABLE',
    });
  }

  // ============= CALCUL DES TOTAUX =============
  const prestations = lines.filter((l) => l.category === 'prestation');
  const taxes = lines.filter((l) => l.category === 'taxe');
  const tvaImport = lines.filter((l) => l.category === 'tva_import');

  const totalPrestationsHT = prestations.reduce((s, l) => s + l.amount, 0);
  const totalTvaRecuperablePrestations = prestations
    .filter((l) => l.isRecoverable)
    .reduce((s, l) => s + l.tvaAmount, 0);
  const totalTaxesNonRecuperables = taxes.reduce((s, l) => s + l.amount, 0);
  const totalTvaImport = tvaImport.reduce((s, l) => s + l.amount, 0);

  const totalFournisseur = lines
    .filter((l) => l.payer === 'Fournisseur')
    .reduce((s, l) => s + l.amount, 0);
  const totalClient = lines
    .filter((l) => l.payer === 'Client')
    .reduce((s, l) => s + l.amount, 0);

  const chargesFournisseurNonRecuperables = lines
    .filter((l) => l.payer === 'Fournisseur' && !l.isRecoverable)
    .reduce((s, l) => s + l.amount, 0);
  const chargesFournisseurRecuperables = lines
    .filter((l) => l.payer === 'Fournisseur' && l.isRecoverable)
    .reduce((s, l) => s + l.amount - l.tvaAmount, 0);

  const prixDeRevient = goodsValue + chargesFournisseurNonRecuperables + chargesFournisseurRecuperables;

  const margeAppliquee = margin || 25;
  const prixVenteHT = prixDeRevient * (1 + margeAppliquee / 100);

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
    prixDeRevient,
    prixVenteHT,
    margeAppliquee,
  };
}

function estimateTransportCost(zone: Zone, mode: TransportMode, weight: number): number {
  const costPerKg: Record<Zone, Record<TransportMode, number>> = {
    UE: { Routier: 0.15, Maritime: 0.2, Aerien: 2.5, Express: 5, Ferroviaire: 0.12 },
    'Hors UE': { Routier: 0.25, Maritime: 0.3, Aerien: 4, Express: 8, Ferroviaire: 0.2 },
    DROM: { Routier: 0.5, Maritime: 0.5, Aerien: 4, Express: 7, Ferroviaire: 0.5 },
  };

  const minCost: Record<Zone, number> = {
    UE: 200,
    'Hors UE': 400,
    DROM: 800,
  };

  return Math.max(weight * (costPerKg[zone]?.[mode] || 0.3), minCost[zone] || 300);
}

// Export du type ProductType
export type { ProductType as CostProductType };
