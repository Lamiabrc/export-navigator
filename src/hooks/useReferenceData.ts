import { useCallback, useEffect, useState } from 'react';
import incotermsJson from '@/data/reference/incoterms.json';
import destinationsJson from '@/data/reference/destinations.json';
import type { Destination, Incoterm, Zone } from '@/types';
import { REFERENCE_OVERRIDES_KEY } from '@/lib/constants/storage';

export interface IncotermReference {
  code: Incoterm | string;
  description: string;
  payerTransport: 'Fournisseur' | 'Client' | string;
  notes?: string;
}

export interface DestinationReference {
  destination: Destination | string;
  zone: Zone | string;
  tvaRegime: string;
  taxesPossibles: string[];
  flags: string[];
}

export interface ReferenceData {
  incoterms: IncotermReference[];
  destinations: DestinationReference[];
  updatedAt?: string;
}

const defaultReference: ReferenceData = {
  incoterms: incotermsJson as IncotermReference[],
  destinations: destinationsJson as DestinationReference[],
  updatedAt: new Date().toISOString(),
};

export const useReferenceData = () => {
  const [referenceData, setReferenceData] = useState<ReferenceData>(defaultReference);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REFERENCE_OVERRIDES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ReferenceData;
        setReferenceData(parsed);
      } else {
        setReferenceData(defaultReference);
      }
    } catch {
      setReferenceData(defaultReference);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveReferenceData = useCallback((data: ReferenceData) => {
    const withDate = { ...data, updatedAt: new Date().toISOString() };
    setReferenceData(withDate);
    localStorage.setItem(REFERENCE_OVERRIDES_KEY, JSON.stringify(withDate));
  }, []);

  const resetReferenceData = useCallback(() => {
    setReferenceData({ ...defaultReference, updatedAt: new Date().toISOString() });
    localStorage.removeItem(REFERENCE_OVERRIDES_KEY);
  }, []);

  return { referenceData, saveReferenceData, resetReferenceData, isLoaded };
};
