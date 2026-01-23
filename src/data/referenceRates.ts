import type { Destination, Zone, TransportMode, Incoterm } from "@/types";

// ============= TVA RATES =============
export interface VatRate {
  destination: Destination;
  zone: Zone;
  rate_standard: number;
  rate_regulated: number;
  autoliquidation: boolean;
  notes: string;
}

export const vatRates: VatRate[] = [
  // UE - autoliquidation
  { destination: "Belgique", zone: "UE", rate_standard: 21, rate_regulated: 6, autoliquidation: true, notes: "Autoliquidation TVA intracom" },
  { destination: "Espagne", zone: "UE", rate_standard: 21, rate_regulated: 10, autoliquidation: true, notes: "Autoliquidation TVA intracom" },
  { destination: "Luxembourg", zone: "UE", rate_standard: 17, rate_regulated: 8, autoliquidation: true, notes: "Autoliquidation TVA intracom" },

  // Suisse
  { destination: "Suisse", zone: "Hors UE", rate_standard: 8.1, rate_regulated: 2.5, autoliquidation: false, notes: "TVA import suisse a payer" },

  // DROM
  { destination: "Guadeloupe", zone: "DROM", rate_standard: 8.5, rate_regulated: 2.1, autoliquidation: false, notes: "TVA DOM reduite" },
  { destination: "Martinique", zone: "DROM", rate_standard: 8.5, rate_regulated: 2.1, autoliquidation: false, notes: "TVA DOM reduite" },
  { destination: "Reunion", zone: "DROM", rate_standard: 8.5, rate_regulated: 2.1, autoliquidation: false, notes: "TVA DOM reduite" },
  { destination: "Guyane", zone: "DROM", rate_standard: 0, rate_regulated: 0, autoliquidation: false, notes: "Exonere de TVA" },
  { destination: "Mayotte", zone: "DROM", rate_standard: 0, rate_regulated: 0, autoliquidation: false, notes: "Exonere de TVA" },
];

// ============= OCTROI DE MER =============
export interface OctroiMerRate {
  destination: Destination;
  category: string;
  code_nomenclature: string;
  om_rate: number;
  omr_rate: number;
  exoneration_possible: boolean;
  notes: string;
}

export const octroiMerRates: OctroiMerRate[] = [
  // Reglemente (code 9021) exonere OM/OMR
  { destination: "Guadeloupe", category: "Reglemente", code_nomenclature: "9021*", om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: "Exonere OM/OMR" },
  { destination: "Martinique", category: "Reglemente", code_nomenclature: "9021*", om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: "Exonere OM/OMR" },
  { destination: "Reunion", category: "Reglemente", code_nomenclature: "9021*", om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: "Exonere OM/OMR" },
  { destination: "Guyane", category: "Reglemente", code_nomenclature: "9021*", om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: "Exonere OM/OMR" },
  { destination: "Mayotte", category: "Reglemente", code_nomenclature: "9021*", om_rate: 0, omr_rate: 0, exoneration_possible: true, notes: "Exonere OM/OMR" },

  // Standard (estimations)
  { destination: "Guadeloupe", category: "Standard", code_nomenclature: "*", om_rate: 9.5, omr_rate: 2.5, exoneration_possible: false, notes: "Taux moyen" },
  { destination: "Martinique", category: "Standard", code_nomenclature: "*", om_rate: 9.5, omr_rate: 2.5, exoneration_possible: false, notes: "Taux moyen" },
  { destination: "Reunion", category: "Standard", code_nomenclature: "*", om_rate: 10, omr_rate: 2.5, exoneration_possible: false, notes: "Taux moyen" },
  { destination: "Guyane", category: "Standard", code_nomenclature: "*", om_rate: 15, omr_rate: 0, exoneration_possible: false, notes: "Taux plus eleves" },
  { destination: "Mayotte", category: "Standard", code_nomenclature: "*", om_rate: 12, omr_rate: 0, exoneration_possible: false, notes: "Taux moyen" },
];

// ============= TRANSPORT COSTS (ESTIMATED) =============
export interface TransportCost {
  destination: Destination;
  transport_mode: TransportMode;
  cost_per_kg: number;
  min_cost: number;
  transit_days_min: number;
  transit_days_max: number;
  notes: string;
}

export const transportCosts: TransportCost[] = [
  // UE - Routier
  { destination: "Belgique", transport_mode: "Routier", cost_per_kg: 0.15, min_cost: 200, transit_days_min: 1, transit_days_max: 2, notes: "Livraison rapide" },
  { destination: "Espagne", transport_mode: "Routier", cost_per_kg: 0.18, min_cost: 350, transit_days_min: 2, transit_days_max: 4, notes: "Selon region" },
  { destination: "Luxembourg", transport_mode: "Routier", cost_per_kg: 0.12, min_cost: 150, transit_days_min: 1, transit_days_max: 2, notes: "Proche" },
  { destination: "Suisse", transport_mode: "Routier", cost_per_kg: 0.25, min_cost: 400, transit_days_min: 1, transit_days_max: 3, notes: "Passage douane" },

  // DROM - Maritime
  { destination: "Guadeloupe", transport_mode: "Maritime", cost_per_kg: 0.45, min_cost: 800, transit_days_min: 15, transit_days_max: 22, notes: "Fret maritime" },
  { destination: "Martinique", transport_mode: "Maritime", cost_per_kg: 0.45, min_cost: 800, transit_days_min: 15, transit_days_max: 22, notes: "Fret maritime" },
  { destination: "Guyane", transport_mode: "Maritime", cost_per_kg: 0.55, min_cost: 1000, transit_days_min: 18, transit_days_max: 28, notes: "Transit plus long" },
  { destination: "Reunion", transport_mode: "Maritime", cost_per_kg: 0.5, min_cost: 1200, transit_days_min: 20, transit_days_max: 30, notes: "Ocean Indien" },
  { destination: "Mayotte", transport_mode: "Maritime", cost_per_kg: 0.6, min_cost: 1500, transit_days_min: 22, transit_days_max: 35, notes: "Infrastructure limitee" },

  // DROM - Aerien
  { destination: "Guadeloupe", transport_mode: "Aerien", cost_per_kg: 3.5, min_cost: 250, transit_days_min: 2, transit_days_max: 5, notes: "Express aerien" },
  { destination: "Martinique", transport_mode: "Aerien", cost_per_kg: 3.5, min_cost: 250, transit_days_min: 2, transit_days_max: 5, notes: "Express aerien" },
  { destination: "Guyane", transport_mode: "Aerien", cost_per_kg: 4, min_cost: 300, transit_days_min: 3, transit_days_max: 6, notes: "Express aerien" },
  { destination: "Reunion", transport_mode: "Aerien", cost_per_kg: 4.5, min_cost: 350, transit_days_min: 3, transit_days_max: 6, notes: "Express aerien" },
  { destination: "Mayotte", transport_mode: "Aerien", cost_per_kg: 5, min_cost: 400, transit_days_min: 4, transit_days_max: 7, notes: "Connexions limitees" },
];

// ============= SERVICE CHARGES =============
export interface ServiceCharge {
  type: string;
  zone: Zone;
  fixed_cost: number;
  percentage?: number;
  tva_on_service: number;
  notes: string;
}

export const serviceCharges: ServiceCharge[] = [
  // Dedouanement export (France)
  { type: "dedouanement_export", zone: "UE", fixed_cost: 0, tva_on_service: 0, notes: "Pas de dedouanement UE" },
  { type: "dedouanement_export", zone: "Hors UE", fixed_cost: 180, tva_on_service: 20, notes: "Forfait transitaire France" },
  { type: "dedouanement_export", zone: "DROM", fixed_cost: 150, tva_on_service: 20, notes: "Forfait transitaire France" },

  // Dedouanement import
  { type: "dedouanement_import", zone: "UE", fixed_cost: 0, tva_on_service: 0, notes: "Pas de dedouanement UE" },
  { type: "dedouanement_import", zone: "Hors UE", fixed_cost: 250, tva_on_service: 8.1, notes: "Transitaire destination" },
  { type: "dedouanement_import", zone: "DROM", fixed_cost: 200, tva_on_service: 8.5, notes: "Transitaire destination" },

  // Manutention
  { type: "manutention", zone: "UE", fixed_cost: 50, tva_on_service: 20, notes: "Chargement/dechargement" },
  { type: "manutention", zone: "Hors UE", fixed_cost: 80, tva_on_service: 0, notes: "Variable" },
  { type: "manutention", zone: "DROM", fixed_cost: 100, tva_on_service: 8.5, notes: "Manutention portuaire" },

  // Assurance
  { type: "assurance", zone: "UE", fixed_cost: 0, percentage: 0.25, tva_on_service: 0, notes: "% valeur marchandise" },
  { type: "assurance", zone: "Hors UE", fixed_cost: 0, percentage: 0.35, tva_on_service: 0, notes: "% valeur marchandise" },
  { type: "assurance", zone: "DROM", fixed_cost: 0, percentage: 0.4, tva_on_service: 0, notes: "% valeur maritime" },
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
  { type: "taxe_carbone_ets", transport_mode: "Maritime", rate_percentage: 0.5, notes: "ETS maritime (estim.)" },
  { type: "taxe_carbone_ets", transport_mode: "Aerien", rate_percentage: 1.2, notes: "ETS aerien (estim.)" },
  { type: "surcharge_carburant_baf", transport_mode: "Maritime", rate_percentage: 12, notes: "BAF variable" },
  { type: "surcharge_carburant_fsc", transport_mode: "Aerien", rate_percentage: 18, notes: "FSC variable" },
  { type: "surcharge_carburant", transport_mode: "Routier", rate_percentage: 8, notes: "Surcharge gazole" },
];

// ============= INCOTERM RULES (who pays what) =============
export interface IncotermPayerRule {
  incoterm: Incoterm;
  transport_principal: "Fournisseur" | "Client";
  dedouanement_export: "Fournisseur" | "Client";
  dedouanement_import: "Fournisseur" | "Client";
  droits_douane: "Fournisseur" | "Client";
  tva_import: "Fournisseur" | "Client";
  octroi_mer: "Fournisseur" | "Client";
  assurance: "Fournisseur" | "Client";
}

export const incotermPayerRules: IncotermPayerRule[] = [
  {
    incoterm: "EXW",
    transport_principal: "Client",
    dedouanement_export: "Client",
    dedouanement_import: "Client",
    droits_douane: "Client",
    tva_import: "Client",
    octroi_mer: "Client",
    assurance: "Client",
  },
  {
    incoterm: "FCA",
    transport_principal: "Client",
    dedouanement_export: "Fournisseur",
    dedouanement_import: "Client",
    droits_douane: "Client",
    tva_import: "Client",
    octroi_mer: "Client",
    assurance: "Client",
  },
  {
    incoterm: "DAP",
    transport_principal: "Fournisseur",
    dedouanement_export: "Fournisseur",
    dedouanement_import: "Client",
    droits_douane: "Client",
    tva_import: "Client",
    octroi_mer: "Client",
    assurance: "Fournisseur",
  },
  {
    incoterm: "DDP",
    transport_principal: "Fournisseur",
    dedouanement_export: "Fournisseur",
    dedouanement_import: "Fournisseur",
    droits_douane: "Fournisseur",
    tva_import: "Fournisseur",
    octroi_mer: "Fournisseur",
    assurance: "Fournisseur",
  },
];

// ============= HELPER FUNCTIONS =============
export function getZoneFromDestination(destination: Destination): Zone {
  const dromDestinations: Destination[] = ["Guadeloupe", "Martinique", "Guyane", "Reunion", "Mayotte"];
  const ueDestinations: Destination[] = ["Belgique", "Espagne", "Luxembourg"];

  if (dromDestinations.includes(destination)) return "DROM";
  if (ueDestinations.includes(destination)) return "UE";
  return "Hors UE";
}

export function getVatRateForDestination(destination: Destination): VatRate | undefined {
  return vatRates.find((v) => v.destination === destination);
}

export function getOctroiMerRateForDestination(destination: Destination, isRegulated: boolean): OctroiMerRate | undefined {
  const rates = octroiMerRates.filter((r) => r.destination === destination);
  if (isRegulated) {
    return rates.find((r) => r.category === "Reglemente") || rates.find((r) => r.category === "Standard");
  }
  return rates.find((r) => r.category === "Standard");
}

export function getTransportCostEstimate(destination: Destination, mode: TransportMode): TransportCost | undefined {
  return transportCosts.find((t) => t.destination === destination && t.transport_mode === mode);
}

export function getIncotermRule(incoterm: Incoterm): IncotermPayerRule | undefined {
  return incotermPayerRules.find((r) => r.incoterm === incoterm);
}
