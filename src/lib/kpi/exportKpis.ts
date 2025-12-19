import type { ExportCase } from '@/types/case';
import type { CostType } from '@/types/costs';

export interface CostBreakdown {
  total: number;
  byType: Record<CostType, number>;
}

export interface TransitCoverageResult {
  transitCosts: number;
  transitBilled: number;
  coverage: number;
  uncovered: number;
}

export interface CaseAggregates {
  coverageAverage: number;
  uncoveredTotal: number;
  topLosses: ExportCase[];
  byDestination: Record<string, { margin: number; count: number }>;
  byClient: Record<string, { margin: number; count: number }>;
  byIncoterm: Record<string, { margin: number; count: number }>;
  byForwarder: Record<string, { margin: number; count: number }>;
}

export const totalRevenueHT = (exportCase: ExportCase): number => {
  return exportCase.invoice.totalHT || 0;
};

export const totalCosts = (exportCase: ExportCase): CostBreakdown => {
  const byType: Record<CostType, number> = {
    transport: 0,
    douane: 0,
    transit: 0,
    frais_dossier: 0,
    assurance: 0,
    autre: 0,
  };

  exportCase.costDocs.forEach((doc) => {
    doc.lines.forEach((line) => {
      byType[line.type] = (byType[line.type] || 0) + (line.amount || 0);
    });
  });

  const total = Object.values(byType).reduce((s, v) => s + v, 0);
  return { total, byType };
};

export const transitBilled = (exportCase: ExportCase): number => {
  if (!exportCase.invoice.lines) return 0;
  return exportCase.invoice.lines
    .filter((line) => line.costType?.toLowerCase() === 'transit')
    .reduce((sum, line) => sum + (line.totalHT || 0), 0);
};

export const transitCoverage = (exportCase: ExportCase): TransitCoverageResult => {
  const costs = totalCosts(exportCase);
  const transitCosts =
    (costs.byType.transit || 0) + (costs.byType.douane || 0) + (costs.byType.frais_dossier || 0);
  const billed = transitBilled(exportCase);
  const coverage = transitCosts > 0 ? billed / transitCosts : 1;
  const uncovered = Math.max(0, transitCosts - billed);

  return { transitCosts, transitBilled: billed, coverage, uncovered };
};

export const margin = (exportCase: ExportCase) => {
  const revenue = totalRevenueHT(exportCase);
  const costs = totalCosts(exportCase);
  const amount = revenue - costs.total;
  const rate = revenue > 0 ? (amount / revenue) * 100 : 0;
  return { amount, rate };
};

export const aggregateCases = (cases: ExportCase[]): CaseAggregates => {
  if (!cases.length) {
    return {
      coverageAverage: 0,
      uncoveredTotal: 0,
      topLosses: [],
      byDestination: {},
      byClient: {},
      byIncoterm: {},
      byForwarder: {},
    };
  }

  let coverageSum = 0;
  let uncoveredTotal = 0;

  const byDestination: CaseAggregates['byDestination'] = {};
  const byClient: CaseAggregates['byClient'] = {};
  const byIncoterm: CaseAggregates['byIncoterm'] = {};
  const byForwarder: CaseAggregates['byForwarder'] = {};

  cases.forEach((c) => {
    const coverageData = transitCoverage(c);
    coverageSum += coverageData.coverage;
    uncoveredTotal += coverageData.uncovered;

    const m = margin(c);
    const destination = c.invoice.destination || 'Inconnu';
    const client = c.invoice.clientName || 'Inconnu';
    const incoterm = c.invoice.incoterm || 'NC';
    const forwarder = c.costDocs[0]?.supplier || 'Inconnu';

    const addToBucket = (bucket: Record<string, { margin: number; count: number }>, key: string) => {
      if (!bucket[key]) bucket[key] = { margin: 0, count: 0 };
      bucket[key].margin += m.amount;
      bucket[key].count += 1;
    };

    addToBucket(byDestination, destination);
    addToBucket(byClient, client);
    addToBucket(byIncoterm, incoterm);
    addToBucket(byForwarder, forwarder);
  });

  const topLosses = [...cases]
    .sort((a, b) => margin(a).amount - margin(b).amount)
    .slice(0, 20);

  return {
    coverageAverage: coverageSum / cases.length,
    uncoveredTotal,
    topLosses,
    byDestination,
    byClient,
    byIncoterm,
    byForwarder,
  };
};
