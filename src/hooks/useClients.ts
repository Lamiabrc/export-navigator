import { useState, useEffect, useCallback } from 'react';
import type { Client } from '@/types';

const CLIENTS_KEY = 'orliman_clients';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(CLIENTS_KEY);
    if (stored) {
      try {
        setClients(JSON.parse(stored));
      } catch {
        setClients([]);
      }
    }
    setIsLoading(false);
  }, []);

  const save = useCallback((list: Client[]) => {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(list));
    setClients(list);
  }, []);

  const addClient = useCallback(
    (client: Omit<Client, 'id'>) => {
      const newClient: Client = { ...client, id: crypto.randomUUID() };
      const next = [...clients, newClient];
      save(next);
      return newClient;
    },
    [clients, save]
  );

  const updateClient = useCallback(
    (id: string, updates: Partial<Client>) => {
      const next = clients.map((c) => (c.id === id ? { ...c, ...updates } : c));
      save(next);
    },
    [clients, save]
  );

  const deleteClient = useCallback(
    (id: string) => {
      const next = clients.filter((c) => c.id !== id);
      save(next);
    },
    [clients, save]
  );

  return { clients, isLoading, addClient, updateClient, deleteClient };
}
