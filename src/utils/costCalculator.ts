import type { Destination, Incoterm, TransportMode, Zone } from '@/types';
import {
  getZoneFromDestination,
  getVatRateForDestination,
  getOctroiMerRateForDestination,
  getTransportCostEstimate,
  getIncotermRule,
  serviceCharges,
  environmentalTaxes,
} from '@/data/referenceRates';

export type ProductType = 'lppr' | 'standard';

export interface CostCalculationParams {
  goodsValue: number;           // Valeur marchandise HT (coût d'achat)
  destination: Destination;
  incoterm: Incoterm;
  productType: ProductType;     // LPPR remboursé ou standard
  transportMode: TransportMode;
  weight?: number;              // Poids en kg (optionnel)
  customsCode?: string;         // Code nomenclature douanière
  margin?: number;              // Marge souhaitée en %
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
  // Paramètres d'entrée
  params: CostCalculationParams;
  zone: Zone;
  
  // Détail des coûts
  lines: CostLine[];
  
  // Totaux
  totalPrestationsHT: number;         // Total des prestations HT
  totalTvaRecuperablePrestations: number;  // TVA récupérable sur prestations
  totalTaxesNonRecuperables: number;  // Droits, OM, OMR, taxe carbone
  totalTvaImport: number;             // TVA import (récupérable si autoliquidée)
  
  // Répartition par payeur
  totalFournisseur: number;           // Total à la charge du fournisseur
  totalClient: number;                // Total à la charge du client
  
  // Prix de revient (pour le fournisseur)
  prixDeRevient: number;              // Coût achat + charges fournisseur - TVA récupérable
  
  // Prix de vente conseillé
  prixVenteHT: number;                // Avec marge appliquée
  margeAppliquee: number;
}

export function calculateCosts(params: CostCalculationParams): CostBreakdown {
  const { goodsValue, destination, incoterm, productType, transportMode, weight = 100, margin = 25 } = params;
  
  const zone = getZoneFromDestination(destination);
  const vatRate = getVatRateForDestination(destination, productType === 'lppr');
  const omRate = getOctroiMerRateForDestination(destination, productType === 'lppr');
  const transportCost = getTransportCostEstimate(destination, transportMode);
  const incotermRule = getIncotermRule(incoterm);
  
  const lines: CostLine[] = [];
  
  // ============= 1. TRANSPORT PRINCIPAL =============
  let transportAmount = transportCost 
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
    isRecoverable: true, // TVA sur facture transporteur récupérable
    category: 'prestation',
    notes: `TVA ${transportTvaRate}% récupérable`
  });
  
  // ============= 2. SURCHARGE CARBURANT =============
  const fuelSurcharge = environmentalTaxes.find(t => 
    t.transport_mode === transportMode && t.type.includes('carburant')
  );
  if (fuelSurcharge && fuelSurcharge.rate_percentage) {
    const surchargeAmount = transportAmount * (fuelSurcharge.rate_percentage / 100);
    const surchargeTva = surchargeAmount * 0.20; // TVA 20% si facturée
    
    lines.push({
      label: 'Surcharge carburant',
      amount: surchargeAmount,
      payer: transportPayer,
      tvaApplicable: true,
      tvaAmount: surchargeTva,
      isRecoverable: true,
      category: 'prestation',
      notes: fuelSurcharge.notes
    });
  }
  
  // ============= 3. DÉDOUANEMENT EXPORT =============
  if (zone !== 'UE') {
    const dedouanementExport = serviceCharges.find(s => 
      s.type === 'dedouanement_export' && s.zone === zone
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
        notes: `TVA ${dedouanementExport.tva_on_service}% récupérable`
      });
    }
  }
  
  // ============= 4. DÉDOUANEMENT IMPORT =============
  if (zone !== 'UE') {
    const dedouanementImport = serviceCharges.find(s => 
      s.type === 'dedouanement_import' && s.zone === zone
    );
    if (dedouanementImport && dedouanementImport.fixed_cost > 0) {
      const dedouanementImportPayer = incotermRule?.dedouanement_import || 'Client';
      // TVA sur service transitaire destination - pas récupérable en France
      const dedouanementTva = dedouanementImport.fixed_cost * (dedouanementImport.tva_on_service / 100);
      
      lines.push({
        label: 'Dédouanement import',
        amount: dedouanementImport.fixed_cost,
        payer: dedouanementImportPayer,
        tvaApplicable: true,
        tvaAmount: dedouanementTva,
        isRecoverable: false, // TVA étrangère pas récupérable en France
        category: 'prestation',
        notes: 'TVA destination (non récupérable en France)'
      });
    }
  }
  
  // ============= 5. MANUTENTION =============
  const manutention = serviceCharges.find(s => 
    s.type === 'manutention' && s.zone === zone
  );
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
      notes: zone === 'UE' ? 'TVA récupérable' : 'Selon origine facture'
    });
  }
  
  // ============= 6. ASSURANCE =============
  const assurance = serviceCharges.find(s => 
    s.type === 'assurance' && s.zone === zone
  );
  if (assurance && assurance.percentage) {
    const assuranceAmount = goodsValue * (assurance.percentage / 100);
    const assurancePayer = incotermRule?.assurance || 'Fournisseur';
    
    lines.push({
      label: 'Assurance transport',
      amount: assuranceAmount,
      payer: assurancePayer,
      tvaApplicable: false, // Assurance exonérée TVA
      tvaAmount: 0,
      isRecoverable: false,
      category: 'prestation',
      notes: 'Exonéré de TVA'
    });
  }
  
  // ============= 7. DROITS DE DOUANE (Hors UE) =============
  if (zone === 'Hors UE') {
    // Estimation droits de douane (variable selon produit)
    const droitsRate = productType === 'lppr' ? 0 : 3; // Dispositifs médicaux souvent 0%
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
        notes: `${droitsRate}% - NON RÉCUPÉRABLE`
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
        notes: `${omRate.om_rate}% - NON RÉCUPÉRABLE (${omRate.notes})`
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
        notes: `${omRate.omr_rate}% - NON RÉCUPÉRABLE`
      });
    }
  }
  
  // ============= 9. TVA IMPORT =============
  if (zone !== 'UE' && vatRate) {
    const rate = productType === 'lppr' ? vatRate.rate_lppr : vatRate.rate_standard;
    if (rate > 0) {
      // Base TVA = valeur + frais + droits + OM
      const baseTva = goodsValue + 
        lines.filter(l => l.category === 'taxe').reduce((s, l) => s + l.amount, 0);
      const tvaImportAmount = baseTva * (rate / 100);
      
      lines.push({
        label: `TVA Import ${destination}`,
        amount: tvaImportAmount,
        payer: incotermRule?.tva_import || 'Client',
        tvaApplicable: false,
        tvaAmount: vatRate.autoliquidation ? tvaImportAmount : 0,
        isRecoverable: vatRate.autoliquidation, // Récupérable si autoliquidation
        category: 'tva_import',
        notes: vatRate.autoliquidation 
          ? `${rate}% - RÉCUPÉRABLE (autoliquidation)`
          : `${rate}% - Récupérable par le client dans le pays`
      });
    }
  }
  
  // ============= 10. TAXE CARBONE (si applicable) =============
  const carbonTax = environmentalTaxes.find(t => 
    t.transport_mode === transportMode && t.type === 'taxe_carbone_ets'
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
      notes: 'NON RÉCUPÉRABLE'
    });
  }
  
  // ============= CALCUL DES TOTAUX =============
  const prestations = lines.filter(l => l.category === 'prestation');
  const taxes = lines.filter(l => l.category === 'taxe');
  const tvaImport = lines.filter(l => l.category === 'tva_import');
  
  const totalPrestationsHT = prestations.reduce((s, l) => s + l.amount, 0);
  const totalTvaRecuperablePrestations = prestations
    .filter(l => l.isRecoverable)
    .reduce((s, l) => s + l.tvaAmount, 0);
  const totalTaxesNonRecuperables = taxes.reduce((s, l) => s + l.amount, 0);
  const totalTvaImport = tvaImport.reduce((s, l) => s + l.amount, 0);
  const totalTvaImportRecuperable = tvaImport
    .filter(l => l.isRecoverable)
    .reduce((s, l) => s + l.amount, 0);
  
  // Répartition par payeur
  const totalFournisseur = lines
    .filter(l => l.payer === 'Fournisseur')
    .reduce((s, l) => s + l.amount, 0);
  const totalClient = lines
    .filter(l => l.payer === 'Client')
    .reduce((s, l) => s + l.amount, 0);
  
  // Prix de revient = Coût achat + Charges fournisseur - TVA récupérable
  // (la TVA récupérable est neutre, donc on ne l'inclut pas)
  const chargesFournisseurNonRecuperables = lines
    .filter(l => l.payer === 'Fournisseur' && !l.isRecoverable)
    .reduce((s, l) => s + l.amount, 0);
  const chargesFournisseurRecuperables = lines
    .filter(l => l.payer === 'Fournisseur' && l.isRecoverable)
    .reduce((s, l) => s + l.amount - l.tvaAmount, 0); // HT car TVA récupérée
  
  const prixDeRevient = goodsValue + chargesFournisseurNonRecuperables + chargesFournisseurRecuperables;
  
  // Prix de vente conseillé
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
  // Estimation basique si pas de données spécifiques
  const costPerKg: Record<Zone, Record<TransportMode, number>> = {
    'UE': { 'Routier': 0.15, 'Maritime': 0.20, 'Aerien': 2.50, 'Express': 5.00, 'Ferroviaire': 0.12 },
    'Hors UE': { 'Routier': 0.25, 'Maritime': 0.30, 'Aerien': 4.00, 'Express': 8.00, 'Ferroviaire': 0.20 },
    'DROM': { 'Routier': 0.50, 'Maritime': 0.50, 'Aerien': 4.00, 'Express': 7.00, 'Ferroviaire': 0.50 },
  };
  
  const minCost: Record<Zone, number> = {
    'UE': 200,
    'Hors UE': 400,
    'DROM': 800,
  };
  
  return Math.max(weight * (costPerKg[zone]?.[mode] || 0.30), minCost[zone] || 300);
}

// Export du type ProductType
export type { ProductType as CostProductType };
