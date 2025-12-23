import type { Alert } from './alerts';
import type { CostDoc } from './costs';
import type { ImportedInvoice } from './sage';

export type MatchStatus = 'match' | 'partial' | 'none';
export type MatchMethod = 'invoiceNumber' | 'shipmentRef' | 'client_date_amount' | 'none';

export interface ExportCase {
  id: string;
  invoice: ImportedInvoice;
  costDocs: CostDoc[];
  matchScore: number;
  matchedBy: MatchMethod;
  missingFields: string[];
  matchStatus: MatchStatus;
  alerts?: Alert[];
  riskScore?: number;
}
