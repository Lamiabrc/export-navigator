import type { Alert } from '@/types/alerts';
import type { ExportCase } from '@/types/case';
import type { ReferenceData } from '@/hooks/useReferenceData';
import { transitCoverage, totalCosts, totalRevenueHT } from '@/lib/kpi/exportKpis';

export interface RiskResult {
  alerts: Alert[];
  riskScore: number;
}

const buildAlertId = (code: string, idx: number) => `${code}-${idx}`;

export const evaluateCase = (
  exportCase: ExportCase,
  referenceData: ReferenceData,
  options?: { coverageThreshold?: number; amountTolerance?: number }
): RiskResult => {
  const alerts: Alert[] = [];
  const coverageThreshold = options?.coverageThreshold ?? 0.6;
  const amountTolerance = options?.amountTolerance ?? 1;

  const coverage = transitCoverage(exportCase);
  const costs = totalCosts(exportCase);
  const revenue = totalRevenueHT(exportCase);

  // Couverture transit insuffisante
  if (coverage.transitCosts > 0 && coverage.coverage < coverageThreshold) {
    alerts.push({
      id: buildAlertId('TRANSIT_COVERAGE', alerts.length),
      code: 'TRANSIT_COVERAGE',
      severity: coverage.coverage < 0.3 ? 'blocker' : 'warning',
      message: `Couverture transit ${Math.round(coverage.coverage * 100)}% (< ${Math.round(
        coverageThreshold * 100
      )}% demandé)`,
      suggestion: 'Refacturer le transit / frais dossier au client ou ajuster le pricing.',
    });
  }

  // Coûts transit présents mais rien facturé
  if (coverage.transitCosts > 0 && coverage.transitBilled === 0) {
    alerts.push({
      id: buildAlertId('TRANSIT_NOT_BILLED', alerts.length),
      code: 'TRANSIT_NOT_BILLED',
      severity: 'blocker',
      message: 'Coûts transit/douane présents mais aucun transit facturé',
      suggestion: 'Ajouter une ligne transit/frais dossier sur la facture.',
    });
  }

  // DDP sans coûts douane
  if (exportCase.invoice.incoterm === 'DDP' && (costs.byType.douane || 0) === 0) {
    alerts.push({
      id: buildAlertId('DDP_NO_CUSTOMS', alerts.length),
      code: 'DDP_NO_CUSTOMS',
      severity: 'warning',
      message: 'Incoterm DDP mais aucun coût douanier identifié',
      suggestion: 'Vérifier droits/TVA import ou OM/OMR selon destination.',
    });
  }

  // Incohérence HT/TVA/TTC
  if (
    exportCase.invoice.totalHT !== undefined &&
    exportCase.invoice.totalTVA !== undefined &&
    exportCase.invoice.totalTTC !== undefined
  ) {
    const expectedTTC = (exportCase.invoice.totalHT || 0) + (exportCase.invoice.totalTVA || 0);
    const gap = Math.abs(expectedTTC - (exportCase.invoice.totalTTC || 0));
    if (gap > amountTolerance) {
      alerts.push({
        id: buildAlertId('AMOUNT_MISMATCH', alerts.length),
        code: 'AMOUNT_MISMATCH',
        severity: 'warning',
        message: `Écart HT+TVA vs TTC : ${gap.toFixed(2)} (devrait être 0)`,
        suggestion: 'Vérifier taux TVA et montants HT/TVA saisis.',
      });
    }
  }

  // Référence destination / référentiel (placeholder d’usage pour crédibilité)
  if (referenceData && exportCase.invoice.destination) {
    const dest = referenceData.destinations.find((d) => d.destination === exportCase.invoice.destination);
    if (!dest) {
      alerts.push({
        id: buildAlertId('DEST_NOT_IN_REF', alerts.length),
        code: 'DEST_NOT_IN_REF',
        severity: 'info',
        message: `Destination ${exportCase.invoice.destination} absente du référentiel`,
        suggestion: 'Ajouter/valider la destination dans le référentiel.',
      });
    }
  }

  // Calcul score simple
  const blockerCount = alerts.filter((a) => a.severity === 'blocker').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const baseScore = 100;
  const riskScore = Math.max(0, baseScore - blockerCount * 40 - warningCount * 15);

  return { alerts, riskScore };
};
