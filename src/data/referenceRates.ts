import type { Destination, Zone, TransportMode, Incoterm } from '@/types';

// ============= TVA RATES =============
export interface VatRate {
  destination: Destination;
  zone: Zone;
  rate_standard: number;      // Taux standard
  rate_lppr: number;          // Taux produits LPPR (2.1% en DROM)
  autoliquidation: boolean;   // Autoliquidation possible
  notes: string;
}

export const vatRates: VatRate[] = [
  // UE - TVA intracommunautaire (autoliquidation)
  { destination: 'Belgique', zone: 'UE', rate_standard: 21, rate_lppr: 6, autoliquidation: true, notes: 'Autoliquidation avec n° TVA intracommunautaire' },
  { destination: 'Espagne', zone: 'UE', rate_standard: 21, rate_lppr: 10, autoliquidation: true, notes: 'Autoliquidation avec n° TVA intracommunautaire' },
  { destination: 'Luxembourg', zone: 'UE', rate_standard: 17, rate_lppr: 8, autoliquidation: true, notes: 'Autoliquidation avec n° TVA intracommunautaire' },
  
  // Hors UE - Suisse
  { destination: 'Suisse', zone: 'Hors UE', rate_standard: 7.7, rate_lppr: 2.5, autoliquidation: false, notes: 'TVA import suisse à payer' },
  
  // DROM - Taux réduits
  { destination: 'Guadeloupe', zone: 'DROM', rate_standard: 8.5, rate_lppr: 2.1, autoliquidation: false, notes: 'TVA DOM réduite' },
  { destination: 'Martinique', zone: 'DROM', rate_standard: 8.5, rate_lppr: 2.1, autoliquidation: false, notes: 'TVA DOM réduite' },
  { destination: 'Réunion', zone: 'DROM', rate_standard: 8.5, rate_lppr: 2.1, autoliquidation: false, notes: 'TVA DOM réduite' },
  { destination: 'Guyane', zone: 'DROM', rate_standard: 0, rate_lppr: 0, autoliquidation: false, notes: 'Exonéré de TVA' },
  { destination: 'Mayotte', zone: 'DROM', rate_standard: 0, rate_lppr: 0, autoliquidation: false, notes: 'Exonéré de TVA' },
];

// ============= OCTROI DE MER =============
export interface OctroiMerRate {
  destination: Destination;
  category: string;           // Catégorie produit
  code_nomenclature: string;  // Code douanier
  om_rate: number;            // Taux Octroi de Mer (%)
  omr_rate: number;           // Taux OM Régional (%)
  exoneration_possible: boolean;
  notes: string;
}

export const octroiMerRates: OctroiMerRate[] = [
  // Produits orthopédiques (code 9021) - souvent exonérés ou taux réduits
  { destination: 'Guadeloupe', category: 'Orthopédie', code_nomenclature: '9021*', om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: 'Dispositifs médicaux exonérés' },
  { destination: 'Martinique', category: 'Orthopédie', code_nomenclature: '9021*', om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: 'Dispositifs médicaux exonérés' },
  { destination: 'Réunion', category: 'Orthopédie', code_nomenclature: '9021*', om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: 'Dispositifs médicaux exonérés' },
  { destination: 'Guyane', category: 'Orthopédie', code_nomenclature: '9021*', om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: 'Dispositifs médicaux exonérés' },
  { destination: 'Mayotte', category: 'Orthopédie', code_nomenclature: '9021*', om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: 'Dispositifs médicaux exonérés' },
  
  // Produits standards (taux moyens pour estimation)
  { destination: 'Guadeloupe', category: 'Standard', code_nomenclature: '*', om_rate: 9.5, omr_rate: 2.5, exoneration_possible: false, notes: 'Taux moyen pour estimation' },
  { destination: 'Martinique', category: 'Standard', code_nomenclature: '*', om_rate: 9.5, omr_rate: 2.5, exoneration_possible: false, notes: 'Taux moyen pour estimation' },
  { destination: 'Réunion', category: 'Standard', code_nomenclature: '*', om_rate: 10, omr_rate: 2.5, exoneration_possible: false, notes: 'Taux moyen pour estimation' },
  { destination: 'Guyane', category: 'Standard', code_nomenclature: '*', om_rate: 15, omr_rate: 0, exoneration_possible: false, notes: 'Taux souvent plus élevés' },
  { destination: 'Mayotte', category: 'Standard', code_nomenclature: '*', om_rate: 12, omr_rate: 0, exoneration_possible: false, notes: 'Taux moyen pour estimation' },
];

// ============= TRANSPORT COSTS (ESTIMATED) =============
export interface TransportCost {
  destination: Destination;
  transport_mode: TransportMode;
  cost_per_kg: number;        // €/kg (pour estimation)
  min_cost: number;           // Minimum par envoi
  transit_days_min: number;
  transit_days_max: number;
  notes: string;
}

export const transportCosts: TransportCost[] = [
  // UE - Routier
  { destination: 'Belgique', transport_mode: 'Routier', cost_per_kg: 0.15, min_cost: 200, transit_days_min: 1, transit_days_max: 2, notes: 'Livraison rapide' },
  { destination: 'Espagne', transport_mode: 'Routier', cost_per_kg: 0.18, min_cost: 350, transit_days_min: 2, transit_days_max: 4, notes: 'Dépend de la région' },
  { destination: 'Luxembourg', transport_mode: 'Routier', cost_per_kg: 0.12, min_cost: 150, transit_days_min: 1, transit_days_max: 2, notes: 'Très proche' },
  { destination: 'Suisse', transport_mode: 'Routier', cost_per_kg: 0.25, min_cost: 400, transit_days_min: 1, transit_days_max: 3, notes: 'Passage douane' },
  
  // DROM - Maritime
  { destination: 'Guadeloupe', transport_mode: 'Maritime', cost_per_kg: 0.45, min_cost: 800, transit_days_min: 15, transit_days_max: 22, notes: 'Fret maritime standard' },
  { destination: 'Martinique', transport_mode: 'Maritime', cost_per_kg: 0.45, min_cost: 800, transit_days_min: 15, transit_days_max: 22, notes: 'Fret maritime standard' },
  { destination: 'Guyane', transport_mode: 'Maritime', cost_per_kg: 0.55, min_cost: 1000, transit_days_min: 18, transit_days_max: 28, notes: 'Transit plus long' },
  { destination: 'Réunion', transport_mode: 'Maritime', cost_per_kg: 0.50, min_cost: 1200, transit_days_min: 20, transit_days_max: 30, notes: 'Fret maritime Océan Indien' },
  { destination: 'Mayotte', transport_mode: 'Maritime', cost_per_kg: 0.60, min_cost: 1500, transit_days_min: 22, transit_days_max: 35, notes: 'Infrastructure limitée' },
  
  // DROM - Aérien
  { destination: 'Guadeloupe', transport_mode: 'Aerien', cost_per_kg: 3.50, min_cost: 250, transit_days_min: 2, transit_days_max: 5, notes: 'Express aérien' },
  { destination: 'Martinique', transport_mode: 'Aerien', cost_per_kg: 3.50, min_cost: 250, transit_days_min: 2, transit_days_max: 5, notes: 'Express aérien' },
  { destination: 'Guyane', transport_mode: 'Aerien', cost_per_kg: 4.00, min_cost: 300, transit_days_min: 3, transit_days_max: 6, notes: 'Express aérien' },
  { destination: 'Réunion', transport_mode: 'Aerien', cost_per_kg: 4.50, min_cost: 350, transit_days_min: 3, transit_days_max: 6, notes: 'Express aérien' },
  { destination: 'Mayotte', transport_mode: 'Aerien', cost_per_kg: 5.00, min_cost: 400, transit_days_min: 4, transit_days_max: 7, notes: 'Connexions limitées' },
];

// ============= SERVICE CHARGES =============
export interface ServiceCharge {
  type: string;
  zone: Zone;
  fixed_cost: number;         // Coût fixe
  percentage?: number;        // % de la valeur (si applicable)
  tva_on_service: number;     // TVA applicable sur la prestation
  notes: string;
}

export const serviceCharges: ServiceCharge[] = [
  // Dédouanement export (France)
  { type: 'dedouanement_export', zone: 'UE', fixed_cost: 0, tva_on_service: 0, notes: 'Pas de dédouanement UE' },
  { type: 'dedouanement_export', zone: 'Hors UE', fixed_cost: 180, tva_on_service: 20, notes: 'Forfait transitaire France' },
  { type: 'dedouanement_export', zone: 'DROM', fixed_cost: 150, tva_on_service: 20, notes: 'Forfait transitaire France' },
  
  // Dédouanement import
  { type: 'dedouanement_import', zone: 'UE', fixed_cost: 0, tva_on_service: 0, notes: 'Pas de dédouanement UE' },
  { type: 'dedouanement_import', zone: 'Hors UE', fixed_cost: 250, tva_on_service: 7.7, notes: 'Transitaire destination' },
  { type: 'dedouanement_import', zone: 'DROM', fixed_cost: 200, tva_on_service: 8.5, notes: 'Transitaire destination' },
  
  // Manutention
  { type: 'manutention', zone: 'UE', fixed_cost: 50, tva_on_service: 20, notes: 'Chargement/déchargement' },
  { type: 'manutention', zone: 'Hors UE', fixed_cost: 80, tva_on_service: 0, notes: 'Variable selon destination' },
  { type: 'manutention', zone: 'DROM', fixed_cost: 100, tva_on_service: 8.5, notes: 'Manutention portuaire' },
  
  // Assurance
  { type: 'assurance', zone: 'UE', fixed_cost: 0, percentage: 0.25, tva_on_service: 0, notes: '% de la valeur marchandise' },
  { type: 'assurance', zone: 'Hors UE', fixed_cost: 0, percentage: 0.35, tva_on_service: 0, notes: '% de la valeur marchandise' },
  { type: 'assurance', zone: 'DROM', fixed_cost: 0, percentage: 0.40, tva_on_service: 0, notes: '% de la valeur maritime' },
];

// ============= ENVIRONMENTAL TAXES =============
export interface EnvironmentalTax {
  type: string;
  transport_mode: TransportMode;
  rate_per_kg?: number;
  rate_percentage?: number;
  notes: string;
}

export const environmentalTaxes: EnvironmentalTax[] = [
  { type: 'taxe_carbone_ets', transport_mode: 'Maritime', rate_percentage: 0.5, notes: 'ETS maritime (estimé)' },
  { type: 'taxe_carbone_ets', transport_mode: 'Aerien', rate_percentage: 1.2, notes: 'ETS aérien (estimé)' },
  { type: 'surcharge_carburant_baf', transport_mode: 'Maritime', rate_percentage: 12, notes: 'BAF variable selon cours pétrole' },
  { type: 'surcharge_carburant_fsc', transport_mode: 'Aerien', rate_percentage: 18, notes: 'FSC variable selon cours kérosène' },
  { type: 'surcharge_carburant', transport_mode: 'Routier', rate_percentage: 8, notes: 'Surcharge gazole' },
];

// ============= INCOTERM RULES (who pays what) =============
export interface IncotermPayerRule {
  incoterm: Incoterm;
  transport_principal: 'Fournisseur' | 'Client';
  dedouanement_export: 'Fournisseur' | 'Client';
  dedouanement_import: 'Fournisseur' | 'Client';
  droits_douane: 'Fournisseur' | 'Client';
  tva_import: 'Fournisseur' | 'Client';
  octroi_mer: 'Fournisseur' | 'Client';
  assurance: 'Fournisseur' | 'Client';
}

export const incotermPayerRules: IncotermPayerRule[] = [
  {
    incoterm: 'EXW',
    transport_principal: 'Client',
    dedouanement_export: 'Client',
    dedouanement_import: 'Client',
    droits_douane: 'Client',
    tva_import: 'Client',
    octroi_mer: 'Client',
    assurance: 'Client',
  },
  {
    incoterm: 'FCA',
    transport_principal: 'Client',
    dedouanement_export: 'Fournisseur',
    dedouanement_import: 'Client',
    droits_douane: 'Client',
    tva_import: 'Client',
    octroi_mer: 'Client',
    assurance: 'Client',
  },
  {
    incoterm: 'DAP',
    transport_principal: 'Fournisseur',
    dedouanement_export: 'Fournisseur',
    dedouanement_import: 'Client',
    droits_douane: 'Client',
    tva_import: 'Client',
    octroi_mer: 'Client',
    assurance: 'Fournisseur',
  },
  {
    incoterm: 'DDP',
    transport_principal: 'Fournisseur',
    dedouanement_export: 'Fournisseur',
    dedouanement_import: 'Fournisseur',
    droits_douane: 'Fournisseur',
    tva_import: 'Fournisseur',
    octroi_mer: 'Fournisseur',
    assurance: 'Fournisseur',
  },
];

// ============= HELPER FUNCTIONS =============
export function getZoneFromDestination(destination: Destination): Zone {
  const dromDestinations: Destination[] = ['Guadeloupe', 'Martinique', 'Guyane', 'Réunion', 'Mayotte'];
  const ueDestinations: Destination[] = ['Belgique', 'Espagne', 'Luxembourg'];
  
  if (dromDestinations.includes(destination)) return 'DROM';
  if (ueDestinations.includes(destination)) return 'UE';
  return 'Hors UE';
}

export function getVatRateForDestination(destination: Destination, isLppr: boolean): VatRate | undefined {
  return vatRates.find(v => v.destination === destination);
}

export function getOctroiMerRateForDestination(destination: Destination, isOrthopedic: boolean): OctroiMerRate | undefined {
  const rates = octroiMerRates.filter(r => r.destination === destination);
  if (isOrthopedic) {
    return rates.find(r => r.category === 'Orthopédie') || rates.find(r => r.category === 'Standard');
  }
  return rates.find(r => r.category === 'Standard');
}

export function getTransportCostEstimate(destination: Destination, mode: TransportMode): TransportCost | undefined {
  return transportCosts.find(t => t.destination === destination && t.transport_mode === mode);
}

export function getIncotermRule(incoterm: Incoterm): IncotermPayerRule | undefined {
  return incotermPayerRules.find(r => r.incoterm === incoterm);
}
