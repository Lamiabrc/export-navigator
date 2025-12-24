import { useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  defaultPilotageRules,
  normalizeRules,
  type PilotageRules,
} from '@/lib/pilotage/rules';

const PILOTAGE_RULES_KEY = 'pilotage_rules_v1';

export const usePilotageRules = () => {
  const { value, setValue, removeValue, requestImport } = useLocalStorage<PilotageRules>(
    PILOTAGE_RULES_KEY,
    defaultPilotageRules,
    { version: 1 }
  );

  const normalized = useMemo(() => normalizeRules(value), [value]);

  const resetRules = () => setValue(defaultPilotageRules);

  const importRules = (raw: string) => {
    const parsed = JSON.parse(raw) as PilotageRules;
    setValue(normalizeRules(parsed));
  };

  const exportRules = () => JSON.stringify(normalized, null, 2);

  return {
    rules: normalized,
    setRules: (next: PilotageRules) => setValue(normalizeRules(next)),
    resetRules,
    removeRules: removeValue,
    importRules,
    exportRules,
    requestImport,
  };
};
