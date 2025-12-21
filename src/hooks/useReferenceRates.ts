import { useState, useCallback, useEffect } from 'react';
import { 
  vatRates as defaultVatRates, 
  octroiMerRates as defaultOmRates,
  transportCosts as defaultTransportCosts,
  serviceCharges as defaultServiceCharges,
  type VatRate,
  type OctroiMerRate,
  type TransportCost,
  type ServiceCharge,
} from '@/data/referenceRates';

const RATES_KEY = 'orliman_reference_rates';

interface ReferenceRates {
  vatRates: VatRate[];
  octroiMerRates: OctroiMerRate[];
  transportCosts: TransportCost[];
  serviceCharges: ServiceCharge[];
}

export function useReferenceRates() {
  const [rates, setRates] = useState<ReferenceRates>({
    vatRates: defaultVatRates,
    octroiMerRates: defaultOmRates,
    transportCosts: defaultTransportCosts,
    serviceCharges: defaultServiceCharges,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load rates from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(RATES_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRates({
          vatRates: parsed.vatRates || defaultVatRates,
          octroiMerRates: parsed.octroiMerRates || defaultOmRates,
          transportCosts: parsed.transportCosts || defaultTransportCosts,
          serviceCharges: parsed.serviceCharges || defaultServiceCharges,
        });
      } catch {
        // Keep defaults
      }
    }
    setIsLoading(false);
  }, []);

  const saveRates = useCallback((newRates: ReferenceRates) => {
    localStorage.setItem(RATES_KEY, JSON.stringify(newRates));
    setRates(newRates);
  }, []);

  const updateVatRate = useCallback((index: number, updates: Partial<VatRate>) => {
    const newVatRates = [...rates.vatRates];
    newVatRates[index] = { ...newVatRates[index], ...updates };
    saveRates({ ...rates, vatRates: newVatRates });
  }, [rates, saveRates]);

  const updateOmRate = useCallback((index: number, updates: Partial<OctroiMerRate>) => {
    const newOmRates = [...rates.octroiMerRates];
    newOmRates[index] = { ...newOmRates[index], ...updates };
    saveRates({ ...rates, octroiMerRates: newOmRates });
  }, [rates, saveRates]);

  const updateTransportCost = useCallback((index: number, updates: Partial<TransportCost>) => {
    const newTransportCosts = [...rates.transportCosts];
    newTransportCosts[index] = { ...newTransportCosts[index], ...updates };
    saveRates({ ...rates, transportCosts: newTransportCosts });
  }, [rates, saveRates]);

  const updateServiceCharge = useCallback((index: number, updates: Partial<ServiceCharge>) => {
    const newServiceCharges = [...rates.serviceCharges];
    newServiceCharges[index] = { ...newServiceCharges[index], ...updates };
    saveRates({ ...rates, serviceCharges: newServiceCharges });
  }, [rates, saveRates]);

  const resetToDefaults = useCallback(() => {
    const defaults = {
      vatRates: defaultVatRates,
      octroiMerRates: defaultOmRates,
      transportCosts: defaultTransportCosts,
      serviceCharges: defaultServiceCharges,
    };
    saveRates(defaults);
  }, [saveRates]);

  return {
    ...rates,
    isLoading,
    updateVatRate,
    updateOmRate,
    updateTransportCost,
    updateServiceCharge,
    resetToDefaults,
  };
}
