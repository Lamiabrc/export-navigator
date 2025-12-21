import { useCallback, useEffect, useState } from 'react';
import type { Flow } from '@/types';

export type ChecklistStatusLocal = 'ok' | 'a_faire' | 'bloque' | 'na';

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatusLocal;
  notes?: string;
}

type ChecklistMap = Record<string, ChecklistItem[]>;

const CHECKLIST_KEY = 'orliman_flow_checklists';

const baseItems = (flow: Flow): ChecklistItem[] => {
  const common: ChecklistItem[] = [
    { id: 'facture_client', label: 'Facture client', status: 'a_faire' },
    { id: 'facture_transport', label: 'Facture transport', status: 'a_faire' },
    { id: 'preuve_transport', label: 'Preuve transport (BL/AWB/CMR)', status: 'a_faire' },
    { id: 'preuve_livraison', label: 'Preuve de livraison', status: 'a_faire' },
  ];

  const items = [...common];

  if (flow.zone !== 'UE') {
    items.push({ id: 'ex1', label: 'EX1 / Déclaration export', status: 'a_faire' });
  }
  if (flow.zone === 'DROM') {
    items.push({ id: 'dau_om', label: 'DAU + OM/OMR DROM', status: 'a_faire' });
  }
  if (flow.destination === 'Suisse') {
    items.push({ id: 'eur1', label: 'EUR.1 / Déclaration origine', status: 'a_faire' });
    items.push({ id: 'e_dec', label: 'e-dec import Suisse', status: 'a_faire' });
  }
  if (flow.zone === 'UE') {
    items.push({ id: 'declaration_ue', label: 'Autoliquidation / DEB si seuil', status: 'a_faire' });
  }

  return items;
};

export function useFlowChecklists() {
  const [map, setMap] = useState<ChecklistMap>({});

  useEffect(() => {
    const stored = localStorage.getItem(CHECKLIST_KEY);
    if (stored) {
      try {
        setMap(JSON.parse(stored));
      } catch {
        setMap({});
      }
    }
  }, []);

  const save = useCallback((next: ChecklistMap) => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
    setMap(next);
  }, []);

  const getChecklist = useCallback(
    (flow: Flow): ChecklistItem[] => {
      const existing = map[flow.id];
      if (existing) return existing;
      const generated = baseItems(flow);
      const next = { ...map, [flow.id]: generated };
      save(next);
      return generated;
    },
    [map, save]
  );

  const updateItem = useCallback(
    (flowId: string, itemId: string, updates: Partial<ChecklistItem>) => {
      const items = map[flowId];
      if (!items) return;
      const nextItems = items.map((it) => (it.id === itemId ? { ...it, ...updates } : it));
      const next = { ...map, [flowId]: nextItems };
      save(next);
    },
    [map, save]
  );

  return { getChecklist, updateItem };
}
