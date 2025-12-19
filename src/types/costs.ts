export type CostType = 'transport' | 'douane' | 'transit' | 'frais_dossier' | 'assurance' | 'autre';

export interface CostLine {
  lineNumber: number;
  label: string;
  amount: number;
  currency: string;
  type: CostType;
  reference?: string;
}

export interface CostDoc {
  docNumber: string;
  docDate: string;
  currency: string;
  supplier?: string;
  flowCode?: string;
  invoiceNumber?: string;
  shipmentRef?: string;
  awb?: string;
  bl?: string;
  lines: CostLine[];
  source?: 'csv' | 'manual';
}
