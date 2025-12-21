import type { Flow } from '@/types';
import type { ChecklistItem, ChecklistStatusLocal } from '@/hooks/useFlowChecklists';

export type HealthBucket = 'OK' | 'A_SURVEILLER' | 'RISQUE';

export interface FlowHealth {
  score: number; // 0..100
  bucket: HealthBucket;
  blockers: string[];
  missing: string[];
  isOverdue: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const labelForChecklistStatus = (status: ChecklistStatusLocal) => {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'a_faire':
      return 'À faire';
    case 'bloque':
      return 'Bloqué';
    case 'na':
      return 'N/A';
    default:
      return status;
  }
};

const severityPenalty = (status: ChecklistStatusLocal) => {
  if (status === 'a_faire') return 5;
  if (status === 'bloque') return 15;
  return 0;
};

export function computeFlowHealth(flow: Flow, checklist: ChecklistItem[], now = new Date()): FlowHealth {
  const blockers: string[] = [];
  const missing: string[] = [];

  // Retard livraison (si non terminé)
  const delivery = flow.delivery_date ? new Date(flow.delivery_date) : null;
  const isOverdue = Boolean(
    delivery &&
      now.getTime() > delivery.getTime() &&
      (flow.status_transport !== 'termine' || flow.status_invoicing !== 'termine')
  );

  let score = 100;

  // Risque déclaré
  if (flow.risk_level === 'a_surveiller') score -= 15;
  if (flow.risk_level === 'risque') score -= 30;

  // Statuts bloqués
  const blockedStages: Array<{ key: keyof Flow; label: string }> = [
    { key: 'status_order', label: 'Commande' },
    { key: 'status_incoterm_validated', label: 'Incoterm' },
    { key: 'status_export', label: 'Export' },
    { key: 'status_transport', label: 'Transport' },
    { key: 'status_customs', label: 'Douanes' },
    { key: 'status_invoicing', label: 'Facturation' },
  ];
  blockedStages.forEach(({ key, label }) => {
    if (flow[key] === 'bloque') {
      score -= 15;
      blockers.push(`${label} bloqué`);
    }
  });

  // Checklist dynamique (docs / conformité)
  checklist.forEach((it) => {
    const p = severityPenalty(it.status);
    score -= p;
    if (it.status === 'bloque') blockers.push(`${it.label} (${labelForChecklistStatus(it.status)})`);
    if (it.status === 'a_faire') missing.push(it.label);
  });

  // Retard
  if (isOverdue) {
    score -= 20;
    blockers.push('Retard livraison / clôture');
  }

  score = clamp(score, 0, 100);

  const bucket: HealthBucket = score >= 80 ? 'OK' : score >= 55 ? 'A_SURVEILLER' : 'RISQUE';

  return { score, bucket, blockers: Array.from(new Set(blockers)), missing: Array.from(new Set(missing)), isOverdue };
}
