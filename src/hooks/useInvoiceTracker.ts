import { useCallback, useEffect, useState } from 'react';

export type TrackedInvoice = {
  invoiceNumber: string;
  supplier?: string | null;
  date?: string | null;
  totalHT?: number | null;
  totalTTC?: number | null;
  transitFees?: number | null;
  marginAmount?: number | null;
  marginPercent?: number | null;
  filename?: string | null;
  analyzedAt: string;
};

const STORAGE_KEY = 'invoice_tracker_v1';

export function useInvoiceTracker() {
  const [items, setItems] = useState<TrackedInvoice[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setItems(JSON.parse(raw));
      } catch {
        setItems([]);
      }
    }
  }, []);

  const save = useCallback((next: TrackedInvoice[]) => {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const upsert = useCallback(
    (entry: TrackedInvoice) => {
      if (!entry.invoiceNumber) return;
      const next = [...items];
      const idx = next.findIndex((i) => i.invoiceNumber === entry.invoiceNumber);
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...entry };
      } else {
        next.push(entry);
      }
      save(next);
    },
    [items, save],
  );

  return { items, upsert };
}
