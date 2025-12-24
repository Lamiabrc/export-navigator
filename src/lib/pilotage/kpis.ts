import { margin, transitCoverage } from '@/lib/kpi/exportKpis';
import type { ExportCase } from '@/types/case';

export interface PilotageKpis {
  totalCases: number;
  marginTotal: number;
  marginAveragePct: number;
  coverageAveragePct: number;
  uncoveredTotal: number;
  belowThreshold: number;
  notBilled: number;
  amountMismatch: number;
}

const amountMismatch = (c: ExportCase, tolerance = 1) => {
  if (
    c.invoice.totalHT === undefined ||
    c.invoice.totalTVA === undefined ||
    c.invoice.totalTTC === undefined
  ) {
    return false;
  }
  const expected = (c.invoice.totalHT || 0) + (c.invoice.totalTVA || 0);
  return Math.abs(expected - (c.invoice.totalTTC || 0)) > tolerance;
};

export const computePilotageKpis = (
  cases: ExportCase[],
  coverageThreshold: number,
  opts?: { amountTolerance?: number }
): PilotageKpis => {
  if (!cases.length) {
    return {
      totalCases: 0,
      marginTotal: 0,
      marginAveragePct: 0,
      coverageAveragePct: 0,
      uncoveredTotal: 0,
      belowThreshold: 0,
      notBilled: 0,
      amountMismatch: 0,
    };
  }

  const tolerance = opts?.amountTolerance ?? 1;

  let totalCoverage = 0;
  let uncoveredTotal = 0;
  let marginSum = 0;
  let marginPctSum = 0;
  let belowThreshold = 0;
  let notBilled = 0;
  let amountMismatchCount = 0;

  cases.forEach((c) => {
    const m = margin(c);
    marginSum += m.amount;
    marginPctSum += m.rate;

    const cov = transitCoverage(c);
    totalCoverage += cov.coverage;
    uncoveredTotal += cov.uncovered;
    if (cov.transitCosts > 0 && cov.coverage < coverageThreshold) belowThreshold += 1;
    if (cov.transitCosts > 0 && cov.transitBilled === 0) notBilled += 1;

    if (amountMismatch(c, tolerance)) amountMismatchCount += 1;
  });

  return {
    totalCases: cases.length,
    marginTotal: marginSum,
    marginAveragePct: marginPctSum / cases.length,
    coverageAveragePct: (totalCoverage / cases.length) * 100,
    uncoveredTotal,
    belowThreshold,
    notBilled,
    amountMismatch: amountMismatchCount,
  };
};
