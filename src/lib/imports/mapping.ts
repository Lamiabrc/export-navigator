import type { CostDoc, CostLine, CostType } from '@/types/costs';
import type { SageInvoice } from '@/types/sage';
import type { CsvRow } from './parseCsv';

export interface MappingError {
  row: number;
  reason: string;
}

export interface MappingResult<T> {
  items: T[];
  invalid: MappingError[];
}

export interface SageInvoiceMapping {
  invoiceNumber: string;
  clientName: string;
  invoiceDate: string;
  currency: string;
  totalHT: string;
  totalTVA?: string;
  totalTTC?: string;
  shipmentRef?: string;
  awb?: string;
  bl?: string;
  incoterm?: string;
  destination?: string;
  flowCode?: string;
}

export interface CostDocMapping {
  docNumber: string;
  docDate: string;
  currency: string;
  amount: string;
  costType: string;
  label?: string;
  invoiceNumber?: string;
  flowCode?: string;
  shipmentRef?: string;
  awb?: string;
  bl?: string;
  supplier?: string;
}

const parseNumber = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapSageInvoices = (
  rows: CsvRow[],
  mapping: SageInvoiceMapping
): MappingResult<SageInvoice> => {
  const invalid: MappingError[] = [];
  const items: SageInvoice[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 header +1 index
    const invoiceNumber = row[mapping.invoiceNumber]?.trim();
    const clientName = row[mapping.clientName]?.trim();
    const invoiceDate = row[mapping.invoiceDate]?.trim();
    const currency = row[mapping.currency]?.trim() || 'EUR';
    const totalHT = parseNumber(row[mapping.totalHT]);
    const totalTVA = mapping.totalTVA ? parseNumber(row[mapping.totalTVA]) : null;
    const totalTTC = mapping.totalTTC ? parseNumber(row[mapping.totalTTC]) : null;

    if (!invoiceNumber || !clientName || !invoiceDate || totalHT === null) {
      invalid.push({
        row: rowNumber,
        reason: 'Champs obligatoires manquants (numéro, client, date, total HT)',
      });
      return;
    }

    items.push({
      invoiceNumber,
      clientName,
      invoiceDate,
      currency,
      totalHT,
      totalTVA: totalTVA ?? undefined,
      totalTTC: totalTTC ?? undefined,
      shipmentRef: mapping.shipmentRef ? row[mapping.shipmentRef]?.trim() : undefined,
      awb: mapping.awb ? row[mapping.awb]?.trim() : undefined,
      bl: mapping.bl ? row[mapping.bl]?.trim() : undefined,
      incoterm: mapping.incoterm ? (row[mapping.incoterm]?.trim() as any) : undefined,
      destination: mapping.destination ? (row[mapping.destination]?.trim() as any) : undefined,
      flowCode: mapping.flowCode ? row[mapping.flowCode]?.trim() : undefined,
    });
  });

  return { items, invalid };
};

export const mapCostDocs = (
  rows: CsvRow[],
  mapping: CostDocMapping
): MappingResult<CostDoc> => {
  const invalid: MappingError[] = [];
  const docs: Record<string, CostDoc> = {};

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const docNumber = row[mapping.docNumber]?.trim();
    const docDate = row[mapping.docDate]?.trim();
    const currency = row[mapping.currency]?.trim() || 'EUR';
    const amount = parseNumber(row[mapping.amount]);
    const costType = (row[mapping.costType]?.trim().toLowerCase() as CostType) || 'autre';
    const label = mapping.label ? row[mapping.label]?.trim() : undefined;

    if (!docNumber || !docDate || amount === null) {
      invalid.push({ row: rowNumber, reason: 'Champs obligatoires manquants (doc, date, montant)' });
      return;
    }

    const line: CostLine = {
      lineNumber: (docs[docNumber]?.lines.length || 0) + 1,
      label: label || 'Ligne coût',
      amount,
      currency,
      type: ['transport', 'douane', 'transit', 'frais_dossier', 'assurance', 'autre'].includes(costType)
        ? costType
        : 'autre',
      reference: row[mapping.invoiceNumber || '']?.trim() || undefined,
    };

    if (!docs[docNumber]) {
      docs[docNumber] = {
        docNumber,
        docDate,
        currency,
        supplier: mapping.supplier ? row[mapping.supplier]?.trim() : undefined,
        flowCode: mapping.flowCode ? row[mapping.flowCode]?.trim() : undefined,
        invoiceNumber: mapping.invoiceNumber ? row[mapping.invoiceNumber]?.trim() : undefined,
        shipmentRef: mapping.shipmentRef ? row[mapping.shipmentRef]?.trim() : undefined,
        awb: mapping.awb ? row[mapping.awb]?.trim() : undefined,
        bl: mapping.bl ? row[mapping.bl]?.trim() : undefined,
        lines: [],
        source: 'csv',
      };
    }

    docs[docNumber].lines.push(line);
  });

  return { items: Object.values(docs), invalid };
};
