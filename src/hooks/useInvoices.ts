import { useState, useCallback, useEffect } from 'react';
import type { Invoice, InvoiceType } from '@/types';

const INVOICES_KEY = 'orliman_invoices';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(INVOICES_KEY);
    if (stored) {
      try {
        setInvoices(JSON.parse(stored));
      } catch {
        setInvoices([]);
      }
    } else {
      setInvoices([]);
    }
    setIsLoading(false);
  }, []);

  const save = useCallback((list: Invoice[]) => {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(list));
    setInvoices(list);
  }, []);

  const addInvoice = useCallback(
    (invoice: Omit<Invoice, 'id'>) => {
      const newInvoice: Invoice = { ...invoice, id: crypto.randomUUID() };
      const next = [...invoices, newInvoice];
      save(next);
      return newInvoice;
    },
    [invoices, save]
  );

  const updateInvoice = useCallback(
    (id: string, updates: Partial<Invoice>) => {
      const next = invoices.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv));
      save(next);
    },
    [invoices, save]
  );

  const deleteInvoice = useCallback(
    (id: string) => {
      const next = invoices.filter((inv) => inv.id !== id);
      save(next);
    },
    [invoices, save]
  );

  const filterByFlow = useCallback(
    (flowId: string) => invoices.filter((inv) => inv.flow_id === flowId),
    [invoices]
  );

  const filterByType = useCallback(
    (type: InvoiceType) => invoices.filter((inv) => inv.type === type),
    [invoices]
  );

  return { invoices, isLoading, addInvoice, updateInvoice, deleteInvoice, filterByFlow, filterByType };
}
