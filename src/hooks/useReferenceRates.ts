import { useCallback, useEffect, useMemo, useState } from "react";
import {
  vatRates as defaultVatRates,
  octroiMerRates as defaultOmRates,
  transportCosts as defaultTransportCosts,
  serviceCharges as defaultServiceCharges,
  type VatRate,
  type OctroiMerRate,
  type TransportCost,
  type ServiceCharge,
} from "@/data/referenceRates";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { fetchAllWithPagination } from "@/utils/supabasePagination";

type OctroiMerRateWithHs = OctroiMerRate & { hs_code?: string };

interface ReferenceRates {
  vatRates: VatRate[];
  octroiMerRates: OctroiMerRateWithHs[];
  transportCosts: TransportCost[];
  serviceCharges: ServiceCharge[];
}

const SETTINGS_KEY = "reference_rates";
const SETTINGS_KEY_ALT = "reference_rates:1";

function safeArray<T>(v: any, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

function normalizeHsCode(input?: string): string {
  if (!input) return "";
  return String(input).replace(/[^0-9]/g, "").trim();
}

export function useReferenceRates() {
  const [rates, setRates] = useState<ReferenceRates>({
    vatRates: defaultVatRates,
    octroiMerRates: defaultOmRates as OctroiMerRateWithHs[],
    transportCosts: defaultTransportCosts,
    serviceCharges: defaultServiceCharges,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const envOk = SUPABASE_ENV_OK;

  const fetchReferenceRatesFromSettings = useCallback(async (): Promise<ReferenceRates | null> => {
    if (!envOk) return null;

    const tryFetch = async (key: string) => {
      const { data, error } = await supabase.from("export_settings").select("key,data").eq("key", key).maybeSingle();
      if (error || !data) return null;
      const payload = (data?.data || null) as any;
      if (!payload) return null;
      return {
        vatRates: safeArray<VatRate>(payload.vatRates, defaultVatRates),
        octroiMerRates: safeArray<OctroiMerRateWithHs>(payload.octroiMerRates, defaultOmRates as any),
        transportCosts: safeArray<TransportCost>(payload.transportCosts, defaultTransportCosts),
        serviceCharges: safeArray<ServiceCharge>(payload.serviceCharges, defaultServiceCharges),
      };
    };

    const main = await tryFetch(SETTINGS_KEY);
    if (main) return main;
    const alt = await tryFetch(SETTINGS_KEY_ALT);
    if (alt) return alt;

    const { data: anyRow } = await supabase
      .from("export_settings")
      .select("*")
      .in("key", [SETTINGS_KEY, SETTINGS_KEY_ALT])
      .maybeSingle();

    const payload = (anyRow?.data || anyRow?.value || anyRow?.json || null) as any;
    if (!payload) return null;

    return {
      vatRates: safeArray<VatRate>(payload.vatRates, defaultVatRates),
      octroiMerRates: safeArray<OctroiMerRateWithHs>(payload.octroiMerRates, defaultOmRates as any),
      transportCosts: safeArray<TransportCost>(payload.transportCosts, defaultTransportCosts),
      serviceCharges: safeArray<ServiceCharge>(payload.serviceCharges, defaultServiceCharges),
    };
  }, [envOk]);

  const fetchHsCatalogAsOmRates = useCallback(async (): Promise<OctroiMerRateWithHs[]> => {
    if (!envOk) return [];

    const pageSize = 1000;

    const data = await fetchAllWithPagination<any>(
      (from, to) =>
        supabase
          .from("export_hs_catalog")
          .select("*")
          // ordre stable conseillé pour que la pagination soit fiable
          .order("hs_code", { ascending: true })
          .order("destination", { ascending: true })
          .range(from, to),
      pageSize,
    );

    if (!data?.length) return [];

    return data
      .map((row: any) => {
        const destination = row.destination || row.drom || row.zone_destination;
        const hs = normalizeHsCode(row.hs_code || row.code_hs || row.customs_code || row.code_douanier);

        const omRate = Number(row.om_rate ?? row.octroi_mer ?? row.om ?? 0);
        const omrRate = Number(row.omr_rate ?? row.octroi_mer_regional ?? row.omr ?? 0);

        if (!destination || !hs) return null;

        const mapped: OctroiMerRateWithHs = {
          destination,
          category: row.category || row.famille || "Standard",
          om_rate: Number.isFinite(omRate) ? omRate : 0,
          omr_rate: Number.isFinite(omrRate) ? omrRate : 0,
          notes: row.notes || row.commentaire || row.description || "",
          hs_code: hs,
        };

        return mapped;
      })
      .filter(Boolean) as OctroiMerRateWithHs[];
  }, [envOk]);

  const refresh = useCallback(async () => {
    if (!envOk) {
      setRates({
        vatRates: defaultVatRates,
        octroiMerRates: defaultOmRates as OctroiMerRateWithHs[],
        transportCosts: defaultTransportCosts,
        serviceCharges: defaultServiceCharges,
      });
      setError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Utilisation des valeurs par défaut.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const settingsRates = await fetchReferenceRatesFromSettings();
      const hsRates = await fetchHsCatalogAsOmRates();

      const base = settingsRates || {
        vatRates: defaultVatRates,
        octroiMerRates: defaultOmRates as OctroiMerRateWithHs[],
        transportCosts: defaultTransportCosts,
        serviceCharges: defaultServiceCharges,
      };

      const mergedOm = (() => {
        if (!hsRates.length) return base.octroiMerRates;
        const seen = new Set<string>();
        const cleanedBase = (base.octroiMerRates || []).filter((r) => {
          const key = `${r.destination}__${normalizeHsCode((r as any).hs_code)}`;
          if (normalizeHsCode((r as any).hs_code)) {
            if (seen.has(key)) return false;
            seen.add(key);
          }
          return true;
        });

        const cleanedHs = hsRates.filter((r) => {
          const key = `${r.destination}__${normalizeHsCode(r.hs_code)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        return [...cleanedBase, ...cleanedHs];
      })();

      setRates({
        ...base,
        octroiMerRates: mergedOm,
      });
    } catch (e: any) {
      setError(e?.message || String(e));
      setRates({
        vatRates: defaultVatRates,
        octroiMerRates: defaultOmRates as OctroiMerRateWithHs[],
        transportCosts: defaultTransportCosts,
        serviceCharges: defaultServiceCharges,
      });
    } finally {
      setIsLoading(false);
    }
  }, [envOk, fetchReferenceRatesFromSettings, fetchHsCatalogAsOmRates]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveRatesToSupabase = useCallback(
    async (newRates: ReferenceRates) => {
      if (!envOk) {
        setRates(newRates);
        return;
      }

      const payload: ReferenceRates = {
        vatRates: newRates.vatRates,
        octroiMerRates: (newRates.octroiMerRates || []).filter((r) => !normalizeHsCode((r as any).hs_code)),
        transportCosts: newRates.transportCosts,
        serviceCharges: newRates.serviceCharges,
      };

      const { error } = await supabase.from("export_settings").upsert(
        {
          key: SETTINGS_KEY,
          data: payload,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "key" },
      );

      if (error) {
        setRates(newRates);
        setError(error.message);
        return;
      }

      await refresh();
    },
    [envOk, refresh],
  );

  const updateVatRate = useCallback(
    async (index: number, updates: Partial<VatRate>) => {
      const newVatRates = [...rates.vatRates];
      if (!newVatRates[index]) return;
      newVatRates[index] = { ...newVatRates[index], ...updates };
      await saveRatesToSupabase({ ...rates, vatRates: newVatRates });
    },
    [rates, saveRatesToSupabase],
  );

  const updateOmRate = useCallback(
    async (index: number, updates: Partial<OctroiMerRate>) => {
      const newOmRates = [...rates.octroiMerRates];
      if (!newOmRates[index]) return;
      if (normalizeHsCode((newOmRates[index] as any).hs_code)) return;
      newOmRates[index] = { ...newOmRates[index], ...updates } as any;
      await saveRatesToSupabase({ ...rates, octroiMerRates: newOmRates });
    },
    [rates, saveRatesToSupabase],
  );

  const updateTransportCost = useCallback(
    async (index: number, updates: Partial<TransportCost>) => {
      const newTransportCosts = [...rates.transportCosts];
      if (!newTransportCosts[index]) return;
      newTransportCosts[index] = { ...newTransportCosts[index], ...updates };
      await saveRatesToSupabase({ ...rates, transportCosts: newTransportCosts });
    },
    [rates, saveRatesToSupabase],
  );

  const updateServiceCharge = useCallback(
    async (index: number, updates: Partial<ServiceCharge>) => {
      const newServiceCharges = [...rates.serviceCharges];
      if (!newServiceCharges[index]) return;
      newServiceCharges[index] = { ...newServiceCharges[index], ...updates };
      await saveRatesToSupabase({ ...rates, serviceCharges: newServiceCharges });
    },
    [rates, saveRatesToSupabase],
  );

  const resetToDefaults = useCallback(async () => {
    await saveRatesToSupabase({
      vatRates: defaultVatRates,
      octroiMerRates: defaultOmRates as OctroiMerRateWithHs[],
      transportCosts: defaultTransportCosts,
      serviceCharges: defaultServiceCharges,
    });
  }, [saveRatesToSupabase]);

  const stats = useMemo(() => {
    const hsCount = (rates.octroiMerRates || []).filter((r) => normalizeHsCode((r as any).hs_code)).length;
    const catCount = (rates.octroiMerRates || []).length - hsCount;

    return {
      vat: rates.vatRates.length,
      om_total: rates.octroiMerRates.length,
      om_category: Math.max(0, catCount),
      om_hs: Math.max(0, hsCount),
      transport: rates.transportCosts.length,
      services: rates.serviceCharges.length,
    };
  }, [rates]);

  return {
    ...rates,
    isLoading,
    error,
    envOk,
    stats,
    refresh,

    updateVatRate,
    updateOmRate,
    updateTransportCost,
    updateServiceCharge,
    resetToDefaults,
  };
}
