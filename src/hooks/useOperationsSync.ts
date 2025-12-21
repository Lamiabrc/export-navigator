import { useState, useCallback } from 'react';
import type { OperationEntry } from '@/types/operations';

type SyncState = {
  isLoading: boolean;
  error: string | null;
  data: OperationEntry[] | null;
  sourceCount: number;
};

export function useOperationsSync() {
  const [state, setState] = useState<SyncState>({
    isLoading: false,
    error: null,
    data: null,
    sourceCount: 0,
  });

  const sync = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const r = await fetch('/api/sync-operations');
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }
      const json = await r.json();
      setState({
        isLoading: false,
        error: null,
        data: json.data ?? null,
        sourceCount: json.sourceRows ?? 0,
      });
      return json.data as OperationEntry[];
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
      return null;
    }
  }, []);

  return { ...state, sync };
}
