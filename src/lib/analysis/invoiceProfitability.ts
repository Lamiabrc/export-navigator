import type { ExportCase } from '@/types/case';
import type { ProfitabilityReference } from '@/data/feeBenchmarks';
import { margin, totalCosts, totalRevenueHT, transitCoverage } from '@/lib/kpi/exportKpis';

export type ProfitStatus = 'beneficiaire' | 'deficitaire';
export type FeeStatus = 'sous_reference' | 'ok' | 'au_dessus';

export interface FeeGap {
  id: string;
  label: string;
  amount: number;
  ratio: number;
  status: FeeStatus;
  gapToTarget: number;
  min: number;
  target: number;
  max: number;
  description?: string;
}

export interface ProfitabilityResult {
  status: ProfitStatus;
  marginAmount: number;
  marginRate: number;
  threshold: number;
  caution: number;
  uncoveredTransit: number;
  feeGaps: FeeGap[];
}

export const evaluateInvoiceProfitability = (
  exportCase: ExportCase,
  reference: ProfitabilityReference
): ProfitabilityResult => {
  const revenue = totalRevenueHT(exportCase);
  const costs = totalCosts(exportCase);
  const marginData = margin(exportCase);
  const coverage = transitCoverage(exportCase);

  const feeGaps: FeeGap[] = reference.feeBenchmarks.map((bench) => {
    const amount = costs.byType[bench.id] ?? 0;
    const ratio = revenue > 0 ? (amount / revenue) * 100 : 0;

    let status: FeeStatus = 'ok';
    if (ratio > bench.referencePct.max) {
      status = 'au_dessus';
    } else if (ratio < bench.referencePct.min) {
      status = 'sous_reference';
    }

    return {
      id: bench.id,
      label: bench.label,
      amount,
      ratio,
      status,
      gapToTarget: ratio - bench.referencePct.target,
      min: bench.referencePct.min,
      target: bench.referencePct.target,
      max: bench.referencePct.max,
      description: bench.description,
    };
  });

  return {
    status: marginData.rate >= reference.minMarginRate ? 'beneficiaire' : 'deficitaire',
    marginAmount: marginData.amount,
    marginRate: marginData.rate,
    threshold: reference.minMarginRate,
    caution: reference.cautionMarginRate,
    uncoveredTransit: coverage.uncovered,
    feeGaps,
  };
};
