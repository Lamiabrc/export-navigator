export type CircuitType = 
  | 'fca_client_place'
  | 'ddp_direct'
  | 'platform_drom'
  | 'ue_intra'
  | 'suisse'
  | 'hors_ue';

export type TransitaireType = 'DHL' | 'LVoverseas' | 'Geodis' | 'TDIS' | 'Autre' | 'Client';

export interface Transitaire {
  id: TransitaireType;
  name: string;
  speciality: string;
  zones: string[];
  documentsReceived: string[];
  contact?: string;
}

export interface ExportCircuit {
  id: CircuitType;
  name: string;
  shortName: string;
  description: string;
  zone: 'UE' | 'Hors UE' | 'DROM' | 'Multiple';
  incoterm: string;
  declarationsRequired: string[];
  documentsRequired: string[];
  costItems: CostItem[];
  steps: CircuitStep[];
  risks: string[];
  bestPractices: string[];
  transitaires: TransitaireType[];
  documentDistribution: DocumentDistribution[];
}

export interface DocumentDistribution {
  document: string;
  recipients: TransitaireType[];
  notes?: string;
}

export interface CostItem {
  id: string;
  label: string;
  payer: 'Fournisseur' | 'Client' | 'Variable';
  description: string;
  typical_percentage?: string;
}

export interface CircuitStep {
  id: string;
  label: string;
  actor: string;
  description: string;
}
