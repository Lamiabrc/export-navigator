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

type OctroiMerRateWithHs = OctroiMerRate & { hs_code?: string };

interface ReferenceRates {
  vatRates: VatRate[];
  // on accepte des entrées enrichies (hs_code) sans casser le type de base
  octroiMerRates: OctroiMerRateWithHs[];
  transportCosts: TransportCost[];
  serviceCharges: ServiceCharge[];
}

const SETTINGS_KEY = "reference_rates";

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

  /**
   * Lis la config depuis export_settings:
   * - row: { key: 'reference_rates', data: { vatRates, octroiMerRates, transportCosts, serviceCharges } }
   */
  const fetchReferenceRatesFromSettings = useCallback(async (): Promise<ReferenceRates | null> => {
    if (!envOk) return null;

    // On essaie "key/data" d'abord (le plus standard)
    const { data, error } = await supabase
      .from("export_settings")
      .select("key,data")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      // fallback: si colonnes différentes, on tente un select('*')
      const { data: anyRow, error: err2 } = await supabase
        .from("export_settings")
        .select("*")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (err2) {
        // Si la table existe mais clé absente, ce n’est pas une erreur
        return null;
      }

      const payload = (anyRow?.data || anyRow?.value || anyRow?.json || null) as any;
      if (!payload) return null;

      return {
        vatRates: safeArray<VatRate>(payload.vatRates, defaultVatRates),
        octroiMerRates: safeArray<OctroiMerRateWithHs>(payload.octroiMerRates, defaultOmRates as any),
        transportCosts: safeArray<TransportCost>(payload.transportCosts, defaultTransportCosts),
        serviceCharges: safeArray<ServiceCharge>(payload.serviceCharges, defaultServiceCharges),
      };
    }

    const payload = (data?.data || null) as any;
    if (!payload) return null;

    return {
      vatRates: safeArray<VatRate>(payload.vatRates, defaultVatRates),
      octroiMerRates: safeArray<OctroiMerRateWithHs>(payload.octroiMerRates, defaultOmRates as any),
      transportCosts: safeArray<TransportCost>(payload.transportCosts, defaultTransportCosts),
      serviceCharges: safeArray<ServiceCharge>(payload.serviceCharges, defaultServiceCharges),
    };
  }, [envOk]);

  /**
   * Charge le catalogue HS (si présent) et le transforme en entrées OM/OMR “hs_code”
   * attendu par costCalculator.
   *
   * ⚠️ On ne casse pas ton existant: on MERGE ces entrées avec tes rates catégorie par défaut.
   */
  const fetchHsCatalogAsOmRates = useCallback(async (): Promise<OctroiMerRateWithHs[]> => {
    if (!envOk) return [];

    // Table que tu as déjà: export_hs_catalog
    const { data, error } = await supabase
      .from("export_hs_catalog")
      .select("*")
      .limit(5000);

    if (error || !data?.length) return [];

    // On mappe de façon tolérante (noms de colonnes possibles)
    // Destination attendue: "Martinique", "Guadeloupe", etc.
    return data
      .map((row: any) => {
        const destination = row.destination || row.drom || row.zone_destination;
        const hs = normalizeHsCode(row.hs_code || row.code_hs || row.customs_code || row.code_douanier);

        const omRate = Number(row.om_rate ?? row.octroi_mer ?? row.om ?? 0);
        const omrRate = Number(row.omr_rate ?? row.octroi_mer_regional ?? row.omr ?? 0);

        if (!destination || !hs) return null;

        // On réutilise le type OctroiMerRate "category-based" en ajoutant hs_code
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
    setIsLoading(true);
    setError(null);

    try {
      // 1) Base rates depuis export_settings (si présent)
      const settingsRates = await fetchReferenceRatesFromSettings();

      // 2) HS catalog => OM by HS (si présent)
      const hsRates = await fetchHsCatalogAsOmRates();

      // 3) Merge intelligent: on conserve les rates catégorie + on ajoute hsRates
      const base = settingsRates || {
        vatRates: defaultVatRates,
        octroiMerRates: defaultOmRates as OctroiMerRateWithHs[],
        transportCosts: defaultTransportCosts,
        serviceCharges: defaultServiceCharges,
      };

      const mergedOm = (() => {
        if (!hsRates.length) return base.octroiMerRates;

        // évite doublons exact destination + hs_code
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
      // fallback total
      setRates({
        vatRates: defaultVatRates,
        octroiMerRates: defaultOmRates as OctroiMerRateWithHs[],
        transportCosts: defaultTransportCosts,
        serviceCharges: defaultServiceCharges,
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchReferenceRatesFromSettings, fetchHsCatalogAsOmRates]);

  useEffect(() => {
    // Au montage: charge depuis Supabase (si possible)
    refresh();
  }, [refresh]);

  /**
   * Persistance des rates dans export_settings (jsonb)
   * - On stocke uniquement la base (vatRates/omRates/transport/service)
   * - Les hsRates viennent de export_hs_catalog => pas besoin de les stocker ici.
   */
  const saveRatesToSupabase = useCallback(
    async (newRates: ReferenceRates) => {
      if (!envOk) {
        setRates(newRates);
        return;
      }

      // On retire du payload les OM "hs_code" si on veut que ça vienne du catalog
      // (sinon tu vas avoir des doublons + une dérive)
      const payload: ReferenceRates = {
        vatRates: newRates.vatRates,
        octroiMerRates: (newRates.octroiMerRates || []).filter((r) => !normalizeHsCode((r as any).hs_code)),
        transportCosts: newRates.transportCosts,
        serviceCharges: newRates.serviceCharges,
      };

      // upsert "clé unique"
      const { error } = await supabase.from("export_settings").upsert(
        {
          key: SETTINGS_KEY,
          data: payload,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "key" },
      );

      if (error) {
        // fallback: on garde en mémoire même si la DB refuse
        setRates(newRates);
        setError(error.message);
        return;
      }

      // reload pour remixer avec HS catalog
      await refresh();
    },
    [envOk, refresh],
  );

  // ========= Update helpers (API identique à ton hook actuel) =========

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

      // ⚠️ On bloque la modif des entrées HS (elles doivent venir du catalog HS)
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

  // Petit résumé utile pour dashboard/debug
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
