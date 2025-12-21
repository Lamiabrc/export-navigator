export type CircuitId =
  | 'fca_client_place'
  | 'ddp_direct'
  | 'platform_drom'
  | 'ue_intra'
  | 'suisse'
  | 'hors_ue';

export type ZoneCode = 'UE' | 'DROM' | 'HORS_UE' | 'MULTI';

export type IncotermCode =
  | 'EXW'
  | 'FCA'
  | 'CPT'
  | 'CIP'
  | 'DAP'
  | 'DPU'
  | 'DDP'
  | 'FAS'
  | 'FOB'
  | 'CFR'
  | 'CIF';

export type Payer = 'SELLER' | 'BUYER' | 'VARIABLE';

export type CostType =
  | 'PREP'
  | 'EXPORT_CUSTOMS'
  | 'MAIN_TRANSPORT'
  | 'TRANSIT'
  | 'IMPORT_CUSTOMS'
  | 'DUTIES'
  | 'TAXES'
  | 'INSURANCE'
  | 'HANDLING'
  | 'PLATFORM_FEE'
  | 'ADMIN'
  | 'OTHER';

export type TransitaireType = 'DHL' | 'LVoverseas' | 'Geodis' | 'TDIS' | 'Autre' | 'Client';

export interface Transitaire {
  id: TransitaireType;
  name: string;
  speciality: string;
  zones: string[];
  documentsReceived: string[];
  contact?: string;
}

export interface CostItem {
  id: string;
  label: string;
  payer: Payer;
  costType: CostType;
  payerDependsOn?: 'incoterm';
  description: string;
  typicalPct?: { min: number; max: number; basis: 'value' | 'freight' };
  displayNote?: string;
}

export interface CircuitStep {
  id: string;
  label: string;
  actor: string;
  description: string;
}

export interface DocumentDistribution {
  document: string;
  recipients: TransitaireType[];
  notes?: string;
}

export interface BillingRules {
  transitFeeKeywords: string[];
  transitFeeSkuCodes?: string[];
  expectedCoveredCostTypes: CostType[];
}

export interface VatRule {
  context: string;
  importerOfRecord: string;
  payerImportVat: string;
  payerDuties: string;
  taxRecovery: string;
  autoliquidation?: string;
  traceability?: string;
  checks?: string[];
  warnings?: string[];
}

export interface ExportCircuit {
  id: CircuitId;
  name: string;
  shortName: string;
  description: string;
  zone: ZoneCode;
  incoterms: IncotermCode[];
  defaultIncoterm?: IncotermCode;
  transitaires: TransitaireType[];
  documentDistribution: DocumentDistribution[];
  declarationsRequired: string[];
  documentsRequired: string[];
  costItems: CostItem[];
  steps: CircuitStep[];
  risks: string[];
  bestPractices: string[];
  billing: BillingRules;
  vatRules?: VatRule;
  matching?: {
    expectedRefs: ('INVOICE_NUMBER' | 'SHIPMENT_REF' | 'AWB' | 'BL' | 'ORDER_NUMBER')[];
  };
}

export const zoneLabel = (zone: ZoneCode): string => {
  switch (zone) {
    case 'UE':
      return 'UE';
    case 'DROM':
      return 'DROM';
    case 'HORS_UE':
      return 'Hors UE';
    case 'MULTI':
      return 'Multiple zones';
    default:
      return zone;
  }
};
