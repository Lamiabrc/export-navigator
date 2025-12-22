import { useState, useCallback, useEffect } from 'react';
import type { Flow } from '@/types';

const FLOWS_KEY = 'orliman_flows';

export function useFlows() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load flows from localStorage on mount
  useEffect(() => {
    const storedFlows = localStorage.getItem(FLOWS_KEY);
    if (storedFlows) {
      try {
        const parsed = JSON.parse(storedFlows);
        setFlows(parsed);
      } catch {
        setFlows([]);
        localStorage.setItem(FLOWS_KEY, JSON.stringify([]));
      }
    } else {
      setFlows([]);
      localStorage.setItem(FLOWS_KEY, JSON.stringify([]));
    }
    setIsLoading(false);
  }, []);

  const saveFlows = useCallback((newFlows: Flow[]) => {
    localStorage.setItem(FLOWS_KEY, JSON.stringify(newFlows));
    setFlows(newFlows);
  }, []);

  const addFlow = useCallback((flow: Omit<Flow, 'id' | 'flow_code' | 'created_at' | 'updated_at'>) => {
    const newFlows = [...flows];
    
    // Generate flow code
    const maxCode = flows.reduce((max, f) => {
      const num = parseInt(f.flow_code.replace('FX-', ''), 10);
      return num > max ? num : max;
    }, 0);
    const flowCode = `FX-${String(maxCode + 1).padStart(4, '0')}`;
    
    const newFlow: Flow = {
      ...flow,
      id: crypto.randomUUID(),
      flow_code: flowCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    newFlows.push(newFlow);
    saveFlows(newFlows);
    return newFlow;
  }, [flows, saveFlows]);

  const updateFlow = useCallback((id: string, updates: Partial<Flow>) => {
    const newFlows = flows.map(f => {
      if (f.id === id) {
        return {
          ...f,
          ...updates,
          updated_at: new Date().toISOString(),
        };
      }
      return f;
    });
    saveFlows(newFlows);
  }, [flows, saveFlows]);

  const deleteFlow = useCallback((id: string) => {
    const newFlows = flows.filter(f => f.id !== id);
    saveFlows(newFlows);
  }, [flows, saveFlows]);

  const getFlow = useCallback((id: string) => {
    return flows.find(f => f.id === id);
  }, [flows]);

  return {
    flows,
    isLoading,
    addFlow,
    updateFlow,
    deleteFlow,
    getFlow,
    refresh: () => {
      const storedFlows = localStorage.getItem(FLOWS_KEY);
      if (storedFlows) {
        setFlows(JSON.parse(storedFlows));
      }
    },
  };
}
