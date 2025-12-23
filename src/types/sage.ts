import type { Destination, Incoterm } from './index';

export interface ImportedInvoiceLine {
  lineNumber: number;
  description: string;
  account?: string;
  quantity?: number;
  unitPrice?: number;
  totalHT: number;
  totalTVA?: number;
  totalTTC?: number;
  costType?: string;
}

export interface ImportedInvoice {
  invoiceNumber: string;
  clientName: string;
  clientCode?: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  totalHT: number;
  totalTVA?: number;
  totalTTC?: number;
  shipmentRef?: string;
  awb?: string;
  bl?: string;
  incoterm?: Incoterm;
  destination?: Destination;
  flowCode?: string;
  lines?: ImportedInvoiceLine[];
}

// Legacy aliases to avoid breaking older imports while removing "Sage" wording elsewhere
export type SageInvoice = ImportedInvoice;
export type SageInvoiceLine = ImportedInvoiceLine;
