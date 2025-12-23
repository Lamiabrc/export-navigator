import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { ImportedInvoice } from '@/types/sage';
import { IMPORTED_INVOICES_KEY, LEGACY_SAGE_INVOICES_KEY } from '@/lib/constants/storage';

/**
 * Stockage unifié des factures importées (anciennement "Sage").
 * - lit/écrit sur la clé générique IMPORTED_INVOICES_KEY
 * - migre automatiquement l'ancienne clé si présente
 */
export function useImportedInvoices() {
  const storage = useLocalStorage<ImportedInvoice[]>(IMPORTED_INVOICES_KEY, []);

  useEffect(() => {
    try {
      const legacy = localStorage.getItem(LEGACY_SAGE_INVOICES_KEY);
      const hasLegacy = Boolean(legacy);
      const hasNew = Boolean(localStorage.getItem(IMPORTED_INVOICES_KEY));
      if (hasLegacy && !hasNew && legacy) {
        const parsed = JSON.parse(legacy) as ImportedInvoice[];
        storage.setValue(parsed);
      }
    } catch {
      // ignore migration errors
    }
  }, [storage.setValue]);

  return storage;
}
