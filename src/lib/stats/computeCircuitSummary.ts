import type { ExportCircuit } from '@/types/circuits';
import type { ImportedInvoice } from '@/types/sage';
import type { CostDoc } from '@/types/costs';
import type { ReferenceData } from '@/hooks/useReferenceData';
import type { PilotageRules } from '@/lib/pilotage/rules';
import { reconcile } from '@/lib/reco/reconcile';
import { transitCoverage } from '@/lib/kpi/exportKpis';
import { evaluateCase } from '@/lib/rules/riskEngine';

export interface CircuitSummary {
  casesCount: number | '—';
  avgTransitCoverage: string | number;
  riskWarnsCount: number | '—';
  riskBlockersCount: number | '—';
}

/**
 * Calcule un résumé par circuit à partir des données importées.
 * Retourne des placeholders "—" si aucune donnée.
 */
export const computeCircuitSummary = (
  circuits: ExportCircuit[],
  invoices: ImportedInvoice[],
  costDocs: CostDoc[],
  referenceData?: ReferenceData,
  pilotageRules?: PilotageRules
): Record<string, CircuitSummary> => {
  const summaries: Record<string, CircuitSummary> = {};

  circuits.forEach((circuit) => {
    const relatedInvoices = invoices.filter((inv) => inv.flowCode === circuit.id);
    const relatedCostDocs = costDocs.filter((doc) => doc.flowCode === circuit.id);

    if (!relatedInvoices.length) {
      summaries[circuit.id] = {
        casesCount: '—',
        avgTransitCoverage: '—',
        riskWarnsCount: '—',
        riskBlockersCount: '—',
      };
      return;
    }

    const cases = reconcile(relatedInvoices, relatedCostDocs, { rules: pilotageRules });
    const evaluated = referenceData
      ? cases.map((c) =>
          evaluateCase(c, referenceData, { coverageThreshold: pilotageRules?.coverageThreshold })
        )
      : cases.map(() => ({ alerts: [], riskScore: 100 }));

    const coverageValues = cases.map((c) => transitCoverage(c).coverage);
    const avgCoverage =
      coverageValues.length > 0
        ? Math.round((coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length) * 100)
        : null;

    const allAlerts = evaluated.flatMap((r) => r.alerts || []);
    const warns = allAlerts.filter((a) => a.severity === 'warning').length;
    const blockers = allAlerts.filter((a) => a.severity === 'blocker').length;

    summaries[circuit.id] = {
      casesCount: cases.length,
      avgTransitCoverage: avgCoverage !== null ? `${avgCoverage}%` : '—',
      riskWarnsCount: warns,
      riskBlockersCount: blockers,
    };
  });

  return summaries;
};
