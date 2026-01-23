import { useEffect, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

export type ExportSettings = {
  vat: Record<string, number>;
  localTaxes: Record<string, number>;
  transport_estimation?: {
    zones: Record<string, { base: number; perKg: number }>;
  };
  thresholds: {
    marge_min_pct: number;
    remise_max_pct: number;
    transport_max_pct_du_ca: number;
  };
  fees: {
    transport_per_order_eur: number;
    dossier_per_order_eur: number;
  };
};

const DEFAULT_SETTINGS: ExportSettings = {
  vat: { FR: 20, UE: 0, HORS_UE: 0 },
  localTaxes: {},
  transport_estimation: {
    zones: {
      UE: { base: 18, perKg: 1.2 },
      HORS_UE: { base: 55, perKg: 4.5 },
    },
  },
  thresholds: {
    marge_min_pct: 12,
    remise_max_pct: 25,
    transport_max_pct_du_ca: 18,
  },
  fees: {
    transport_per_order_eur: 0,
    dossier_per_order_eur: 15,
  },
};

export function useExportSettings() {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        setLoading(false);
        setWarning("Supabase non configuré, fallback local");
        return;
      }
      const { data, error } = await supabase.from("export_settings").select("key,data").eq("key", "reference_rates:1").maybeSingle();
      if (!active) return;
      if (error || !data?.data) {
        setWarning("Settings manquants, fallback local");
        setLoading(false);
        return;
      }
      setSettings((prev) => ({ ...prev, ...(data.data as ExportSettings) }));
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const save = async (payload: ExportSettings) => {
    if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré");
    const { error } = await supabase.from("export_settings").upsert({ key: "reference_rates:1", data: payload });
    if (error) throw error;
    setSettings(payload);
  };

  return { settings, loading, warning, save, DEFAULT_SETTINGS };
}
