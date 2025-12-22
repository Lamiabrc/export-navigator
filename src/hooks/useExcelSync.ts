import { useEffect, useMemo, useRef, useState } from 'react';
import { mapExcelRowToFlow, mergeFlowsByCode, loadStoredFlows, persistFlows } from '@/lib/imports/excelSync';
import type { ExcelErrorPayload, ExcelUpdatePayload } from '@/types/electron';

const EXCEL_PATH_KEY = 'excel_source_path';

type SyncStatus = 'idle' | 'watching' | 'error';

export function useExcelSync() {
  const [filePath, setFilePath] = useState<string>(() => localStorage.getItem(EXCEL_PATH_KEY) || '');
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lastRowsCount, setLastRowsCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const isElectron = useMemo(() => typeof window !== 'undefined' && !!window.electronAPI?.isElectron, []);
  const watchersBoundRef = useRef(false);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    if (watchersBoundRef.current) return;

    const handleUpdate = (payload: ExcelUpdatePayload) => {
      const flows = payload.rows.map(mapExcelRowToFlow).filter((f): f is NonNullable<ReturnType<typeof mapExcelRowToFlow>> => Boolean(f));
      const existing = loadStoredFlows();
      const { merged, added, updated } = mergeFlowsByCode(existing, flows);
      persistFlows(merged);
      setLastUpdate(payload.updatedAt);
      setLastRowsCount(payload.rows.length);
      setStatus('watching');
      setError(null);
      if (added + updated > 0 && window.electronAPI?.platform !== 'darwin') {
        console.info(`[Excel Sync] Flux ajoutés/mis à jour : ${added} / ${updated}`);
      }
    };

    const handleError = (payload: ExcelErrorPayload) => {
      setError(payload.message);
      setStatus('error');
    };

    window.electronAPI.onExcelUpdate(handleUpdate);
    window.electronAPI.onExcelError(handleError);
    watchersBoundRef.current = true;
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    if (!filePath) return;

    localStorage.setItem(EXCEL_PATH_KEY, filePath);

    window.electronAPI
      .watchExcelFile(filePath)
      .then((res) => {
        if (res?.error) {
          setError(res.error);
          setStatus('error');
        } else {
          setStatus('watching');
          setError(null);
        }
      })
      .catch((err) => {
        setError(err?.message ?? 'Erreur lors du watch Excel');
        setStatus('error');
      });

    return () => {
      window.electronAPI?.stopExcelWatch();
      setStatus('idle');
    };
  }, [filePath, isElectron]);

  const syncNow = async () => {
    if (!isElectron || !window.electronAPI || !filePath) return;
    const res = await window.electronAPI.readExcelOnce();
    if (res?.error) {
      setError(res.error);
      setStatus('error');
    }
  };

  const updatePath = (path: string) => {
    setFilePath(path);
    if (path) {
      localStorage.setItem(EXCEL_PATH_KEY, path);
    } else {
      localStorage.removeItem(EXCEL_PATH_KEY);
      window.electronAPI?.stopExcelWatch();
      setStatus('idle');
    }
  };

  return {
    filePath,
    status,
    error,
    lastUpdate,
    lastRowsCount,
    isElectron,
    setFilePath: updatePath,
    syncNow,
  };
}
