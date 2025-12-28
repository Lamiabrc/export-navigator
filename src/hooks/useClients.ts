import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

type ExportZone = "UE" | "DROM" | "Hors UE" | "France" | string;
type SalesChannel = "direct" | "indirect" | "depositaire" | "grossiste" | string | null;

export type ClientRow = {
  id: string;
  libelle_client: string;
  email?: string | null;
  telephone: string | null;
  adresse: string | null;
  cp: string | null;
  ville: string | null;
  pays: string | null;
  tva_number?: string | null;
  notes?: string | null;
  code_ets?: string | null;
  export_zone: ExportZone | null;
  drom_code: string | null;
  canal: string | null;
  sales_channel: SalesChannel;
  depositaire_id: string | null;
  groupement_id: string | null;
  groupement: string | null;
  groupement_remise: number | null;
  default_destination?: string | null;
};

type ClientType = "direct" | "indirect" | "depositaire" | "grossiste" | "inconnu";

const normalizeString = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function useClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const envOk = SUPABASE_ENV_OK;

  const fetchClients = useCallback(async () => {
    if (!envOk) {
      setError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setClients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fullSelect =
      "id,libelle_client,email,telephone,adresse,cp,ville,pays,tva_number,notes,code_ets,export_zone,drom_code,canal,sales_channel,depositaire_id,groupement_id,groupement,groupement_remise,default_destination";
    const minimalSelect = "id,libelle_client,pays,export_zone,drom_code,default_destination,tva_number,email";

    try {
      let query = supabase.from("clients").select(fullSelect).order("libelle_client", { ascending: true }).limit(3000);
      const { data, error: sbError, status } = await query;

      if (sbError && status === 400) {
        // fallback minimal si colonne manquante
        const { data: dataMin, error: errMin } = await supabase
          .from("clients")
          .select(minimalSelect)
          .order("libelle_client", { ascending: true })
          .limit(3000);
        if (errMin) throw errMin;
        setClients((dataMin ?? []) as ClientRow[]);
        return;
      }

      if (sbError) throw sbError;
      setClients((data ?? []) as ClientRow[]);
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des clients.");
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, [envOk]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const filterByZone = useCallback(
    (zone: ExportZone | null) => clients.filter((c) => (zone ? c.export_zone === zone : true)),
    [clients],
  );

  const filterByDrom = useCallback(
    (dromCode: string | null) => clients.filter((c) => (dromCode ? c.drom_code === dromCode : true)),
    [clients],
  );

  const computeClientType = useCallback((c: ClientRow): ClientType => {
    const channel = normalizeString(c.sales_channel || c.canal).toLowerCase();
    if (channel === "depositaire") return "depositaire";
    if (channel === "indirect") return "indirect";
    if (channel === "grossiste") return "grossiste";
    if (channel === "direct") return "direct";
    if (c.depositaire_id) return "indirect";
    return "inconnu";
  }, []);

  const stats = useMemo(() => {
    const total = clients.length;
    const byZone = clients.reduce<Record<string, number>>((acc, c) => {
      const z = c.export_zone || "NC";
      acc[z] = (acc[z] || 0) + 1;
      return acc;
    }, {});
    const types = clients.reduce<Record<ClientType, number>>((acc, c) => {
      const t = computeClientType(c);
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<ClientType, number>);

    return { total, byZone, types };
  }, [clients, computeClientType]);

  return {
    clients,
    isLoading,
    error,
    envOk,
    fetchClients,
    filterByZone,
    filterByDrom,
    computeClientType,
    stats,
  };
}
