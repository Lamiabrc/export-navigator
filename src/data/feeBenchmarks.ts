import type { CostType } from '@/types/costs';

export type FeeBenchmarkBasis = 'ht';

export interface FeeBenchmark {
  id: CostType;
  label: string;
  referencePct: {
    min: number;
    target: number;
    max: number;
  };
  basis: FeeBenchmarkBasis;
  description: string;
}

export interface ProfitabilityReference {
  source: string;
  updatedAt: string;
  minMarginRate: number;
  cautionMarginRate: number;
  feeBenchmarks: FeeBenchmark[];
  notes: string[];
}

export const defaultProfitabilityReference: ProfitabilityReference = {
  source: 'Référentiel Export Navigator (benchmarks transit/douane 2024)',
  updatedAt: new Date('2024-12-01').toISOString(),
  minMarginRate: 8,
  cautionMarginRate: 12,
  feeBenchmarks: [
    {
      id: 'transport',
      label: 'Transport principal',
      basis: 'ht',
      referencePct: { min: 3, target: 5.5, max: 9 },
      description: 'Fret route/air/mer facturé au client en DAP/DDP (cible issue des circuits DDP/DAP).',
    },
    {
      id: 'douane',
      label: 'Droits / taxes import',
      basis: 'ht',
      referencePct: { min: 0, target: 6, max: 12 },
      description: 'Droits, TVA import, OM/OMR quand DDP ou avances. Se base sur taux standard DROM / hors UE.',
    },
    {
      id: 'transit',
      label: 'Transit / brokerage',
      basis: 'ht',
      referencePct: { min: 0.5, target: 1.5, max: 3 },
      description: 'Frais transitaires + clearances import/export (hors droits).',
    },
    {
      id: 'frais_dossier',
      label: 'Frais dossier / plateforme',
      basis: 'ht',
      referencePct: { min: 0.2, target: 0.8, max: 1.5 },
      description: 'Frais administratifs, plateformes locales, prépa documentaire.',
    },
    {
      id: 'assurance',
      label: 'Assurance transport',
      basis: 'ht',
      referencePct: { min: 0.1, target: 0.35, max: 0.8 },
      description: 'Assurance marchandise/fret (optionnelle en FCA/EXW, due en CIP/CIF).',
    },
    {
      id: 'autre',
      label: 'Autres frais',
      basis: 'ht',
      referencePct: { min: 0, target: 0.5, max: 2 },
      description: 'Divers non identifiés : stockage, surtaxes fuel, pénalités.',
    },
  ],
  notes: [
    'Les ratios sont calculés en % du montant HT facturé (base = totalHT facture).',
    'Ajustez les bornes via un fichier JSON local pour refléter vos contrats transport/transit.',
    'Le statut bénéficiaire est déclenché si la marge est ≥ 8% (alerte sous 12%).',
  ],
};
