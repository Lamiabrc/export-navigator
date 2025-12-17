export type CircuitType = 
  | 'fca_client_place'
  | 'ddp_direct'
  | 'platform_drom'
  | 'ue_intra'
  | 'suisse'
  | 'hors_ue';

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
