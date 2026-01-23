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

  // Hors UE (exemples)
  { destination: "Suisse", zone: "Hors UE", rate_standard: 8.1, rate_regulated: 2.5, autoliquidation: false, notes: "TVA import a payer" },
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

export const octroiMerRates: OctroiMerRate[] = [];

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

  // Dedouanement import
  { type: "dedouanement_import", zone: "UE", fixed_cost: 0, tva_on_service: 0, notes: "Pas de dedouanement UE" },
  { type: "dedouanement_import", zone: "Hors UE", fixed_cost: 250, tva_on_service: 8.1, notes: "Transitaire destination" },

  // Manutention
  { type: "manutention", zone: "UE", fixed_cost: 50, tva_on_service: 20, notes: "Chargement/dechargement" },
  { type: "manutention", zone: "Hors UE", fixed_cost: 80, tva_on_service: 0, notes: "Variable" },

  // Assurance
  { type: "assurance", zone: "UE", fixed_cost: 0, percentage: 0.25, tva_on_service: 0, notes: "% valeur marchandise" },
  { type: "assurance", zone: "Hors UE", fixed_cost: 0, percentage: 0.35, tva_on_service: 0, notes: "% valeur marchandise" },
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
  const ueDestinations: Destination[] = ["Belgique", "Espagne", "Luxembourg"];

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
