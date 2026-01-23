import { cn } from '@/lib/utils';
import type { FlowStatus, ChecklistStatus, RiskLevel, Zone } from '@/types';

interface StatusBadgeProps {
  status: FlowStatus | ChecklistStatus | RiskLevel | Zone | string;
  type?: 'flow' | 'checklist' | 'risk' | 'zone';
  className?: string;
}

const flowStatusConfig: Record<FlowStatus, { label: string; className: string }> = {
  non_demarre: { label: 'Non démarré', className: 'badge-neutral' },
  en_cours: { label: 'En cours', className: 'badge-warning' },
  termine: { label: 'Terminé', className: 'badge-ok' },
  bloque: { label: 'Bloqué', className: 'badge-risk' },
};

const checklistStatusConfig: Record<ChecklistStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'badge-ok' },
  a_faire: { label: 'À faire', className: 'badge-warning' },
  na: { label: 'N/A', className: 'badge-neutral' },
  bloque: { label: 'Bloqué', className: 'badge-risk' },
};

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'badge-ok' },
  a_surveiller: { label: 'À surveiller', className: 'badge-warning' },
  risque: { label: 'Risque', className: 'badge-risk' },
};

const zoneConfig: Record<Zone, { label: string; className: string }> = {
  UE: { label: 'UE', className: 'badge-ue' },
  'Hors UE': { label: 'Hors UE', className: 'badge-hors-ue' },
};

export function StatusBadge({ status, type = 'flow', className }: StatusBadgeProps) {
  let config: { label: string; className: string } | undefined;

  switch (type) {
    case 'flow':
      config = flowStatusConfig[status as FlowStatus];
      break;
    case 'checklist':
      config = checklistStatusConfig[status as ChecklistStatus];
      break;
    case 'risk':
      config = riskConfig[status as RiskLevel];
      break;
    case 'zone':
      config = zoneConfig[status as Zone];
      break;
  }

  if (!config) {
    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium badge-neutral', className)}>
        {status}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
