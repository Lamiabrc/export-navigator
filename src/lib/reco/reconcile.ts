import type { ExportCase, MatchStatus, MatchMethod } from '@/types/case';
import type { CostDoc } from '@/types/costs';
import type { ImportedInvoice } from '@/types/sage';
import type { PilotageRules } from '@/lib/pilotage/rules';
import {
  applyRulesToCostDocs,
  applyRulesToInvoice,
  defaultPilotageRules,
  normalizeRules,
} from '@/lib/pilotage/rules';

const sumCostDoc = (doc: CostDoc): number =>
  doc.lines.reduce((sum, line) => sum + (line.amount || 0), 0);

const daysBetween = (d1: string, d2: string): number => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  if (Number.isNaN(date1.valueOf()) || Number.isNaN(date2.valueOf())) return Number.POSITIVE_INFINITY;
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
};

const computeStatus = (score: number): MatchStatus => {
  if (score >= 80) return 'match';
  if (score >= 40) return 'partial';
  return 'none';
};

const buildMissing = (invoice: ImportedInvoice): string[] => {
  const missing: string[] = [];
  if (!invoice.invoiceNumber) missing.push('invoiceNumber');
  if (!invoice.totalHT && invoice.totalHT !== 0) missing.push('totalHT');
  if (!invoice.invoiceDate) missing.push('invoiceDate');
  if (!invoice.totalTVA) missing.push('totalTVA');
  if (!invoice.totalTTC) missing.push('totalTTC');
  return missing;
};

const matchByInvoiceNumber = (invoice: ImportedInvoice, costDocs: CostDoc[]) =>
  costDocs.filter((doc) => doc.invoiceNumber && doc.invoiceNumber === invoice.invoiceNumber);

const matchByShipment = (invoice: ImportedInvoice, costDocs: CostDoc[]) =>
  costDocs.filter(
    (doc) =>
      (invoice.shipmentRef && doc.shipmentRef && doc.shipmentRef === invoice.shipmentRef) ||
      (invoice.awb && doc.awb && doc.awb === invoice.awb) ||
      (invoice.bl && doc.bl && doc.bl === invoice.bl)
  );

const matchByDateAmount = (invoice: ImportedInvoice, costDocs: CostDoc[]) => {
  const total = invoice.totalHT || 0;
  return costDocs.filter((doc) => {
    const docTotal = sumCostDoc(doc);
    const amountGap = Math.abs(docTotal - total);
    const gapPct = total > 0 ? (amountGap / total) * 100 : 100;
    const days = daysBetween(invoice.invoiceDate, doc.docDate);
    return days <= 10 && gapPct <= 30;
  });
};

const computeScore = (method: MatchMethod, invoice: ImportedInvoice, docs: CostDoc[]): number => {
  if (!docs.length) return 0;
  if (method === 'invoiceNumber') return 95;
  if (method === 'shipmentRef') return 75;
  if (method === 'client_date_amount') {
    const invoiceTotal = invoice.totalHT || 0;
    const docTotals = docs.map((d) => sumCostDoc(d));
    const avgDocTotal = docTotals.reduce((s, v) => s + v, 0) / docTotals.length || 0;
    const gap = Math.abs(avgDocTotal - invoiceTotal);
    const gapPct = invoiceTotal > 0 ? (gap / invoiceTotal) * 100 : 100;
    return Math.max(40, 90 - gapPct);
  }
  return 0;
};

export const reconcile = (
  invoices: ImportedInvoice[],
  costDocs: CostDoc[],
  options?: { rules?: PilotageRules }
): ExportCase[] => {
  const rules = normalizeRules(options?.rules ?? defaultPilotageRules);

  const enrichedInvoices = invoices.map((inv) => applyRulesToInvoice(inv, rules));
  const enrichedCostDocs = applyRulesToCostDocs(costDocs, rules);

  return enrichedInvoices.map((invoice, index) => {
    let matched: CostDoc[] = [];
    let method: MatchMethod = 'none';

    const byNumber = matchByInvoiceNumber(invoice, enrichedCostDocs);
    if (byNumber.length) {
      matched = byNumber;
      method = 'invoiceNumber';
    } else {
      const byShipment = matchByShipment(invoice, enrichedCostDocs);
      if (byShipment.length) {
        matched = byShipment;
        method = 'shipmentRef';
      } else {
        const byDateAmount = matchByDateAmount(invoice, enrichedCostDocs);
        if (byDateAmount.length) {
          matched = byDateAmount;
          method = 'client_date_amount';
        }
      }
    }

    const score = computeScore(method, invoice, matched);
    const matchStatus = computeStatus(score);
    const missingFields = buildMissing(invoice);

    return {
      id: invoice.invoiceNumber || `case-${index + 1}`,
      invoice,
      costDocs: matched,
      matchScore: score,
      matchedBy: method,
      missingFields,
      matchStatus,
    };
  });
};
