import { useCallback, useEffect, useState } from 'react';
import { defaultProfitabilityReference, type ProfitabilityReference } from '@/data/feeBenchmarks';
import { FEE_BENCHMARKS_KEY } from '@/lib/constants/storage';

export const useFeeBenchmarks = () => {
  const [benchmarks, setBenchmarks] = useState<ProfitabilityReference>(defaultProfitabilityReference);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEE_BENCHMARKS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProfitabilityReference;
        setBenchmarks(parsed);
      } else {
        setBenchmarks(defaultProfitabilityReference);
      }
    } catch {
      setBenchmarks(defaultProfitabilityReference);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveBenchmarks = useCallback((data: ProfitabilityReference) => {
    const withTimestamp = {
      ...data,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
    setBenchmarks(withTimestamp);
    localStorage.setItem(FEE_BENCHMARKS_KEY, JSON.stringify(withTimestamp));
  }, []);

  const resetBenchmarks = useCallback(() => {
    const reset = { ...defaultProfitabilityReference, updatedAt: new Date().toISOString() };
    setBenchmarks(reset);
    localStorage.removeItem(FEE_BENCHMARKS_KEY);
  }, []);

  return { benchmarks, saveBenchmarks, resetBenchmarks, isLoaded };
};
