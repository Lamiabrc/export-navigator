import { useState, useCallback, useEffect } from "react";
import type { Flow } from "@/types";
import { mockFlows } from "@/data/mockData";
import { supabase } from "@/lib/supabaseClient";

type FlowRow = {
  id: string;
  flow_code: string;
  data: any;
  created_at: string;
  updated_at: string;
};

function rowToFlow(r: FlowRow): Flow {
  return {
    ...(r.data ?? {}),
    id: r.id,
    flow_code: r.flow_code,
    created_at: r.created_at,
    updated_at: r.updated_at,
  } as Flow;
}

function flowToData(flow: Partial<Flow>) {
  // Tout ce qui n’est pas “colonnes” part dans data
  // (ça permet de garder un modèle DB simple et stable)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, flow_code, created_at, updated_at, ...rest } = flow as any;
  return rest;
}

function generateFlowCodeFrom(code: string | null) {
  if (!code) return "FX-0001";
  const n = parseInt(code.replace("FX-", ""), 10);
  const next = Number.isFinite(n) ? n + 1 : 1;
  return `FX-${String(next).padStart(4, "0")}`;
}

export function useFlows() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const fetchFlows = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("flows")
        .select("id,flow_code,data,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;

      const rows = (data ?? []) as FlowRow[];

      // Seed automatique au premier lancement si table vide
      if (rows.length === 0 && mockFlows?.length) {
        const seedPayload = mockFlows.map((f) => ({
          id: f.id,
          flow_code: f.flow_code,
          data: flowToData(f),
          created_at: f.created_at,
          updated_at: f.updated_at,
        }));

        const seedRes = await supabase.from("flows").upsert(seedPayload, { onConflict: "flow_code" });
        if (seedRes.error) throw seedRes.error;

        // re-fetch après seed
        const again = await supabase
          .from("flows")
          .select("id,flow_code,data,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(2000);

        if (again.error) throw again.error;

        const againRows = (again.data ?? []) as FlowRow[];
        setFlows(againRows.map(rowToFlow));
        return;
      }

      setFlows(rows.map(rowToFlow));
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des flows.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const addFlow = useCallback(
    async (flow: Omit<Flow, "id" | "flow_code" | "created_at" | "updated_at">) => {
      setError("");
      try {
        // Récupère le dernier flow_code pour générer le prochain
        const { data: last, error: lastErr } = await supabase
          .from("flows")
          .select("flow_code")
          .order("flow_code", { ascending: false })
          .limit(1);

        if (lastErr) throw lastErr;

        const lastCode = (last?.[0]?.flow_code as string | undefined) ?? null;
        const flowCode = generateFlowCodeFrom(lastCode);

        const now = new Date().toISOString();
        const id = crypto.randomUUID();

        const newFlow: Flow = {
          ...(flow as any),
          id,
          flow_code: flowCode,
          created_at: now,
          updated_at: now,
        };

        const payload = {
          id,
          flow_code: flowCode,
          data: flowToData(newFlow),
          created_at: now,
          updated_at: now,
        };

        const { error } = await supabase.from("flows").insert(payload);
        if (error) throw error;

        // optimistic update
        setFlows((prev) => [newFlow, ...prev]);
        return newFlow;
      } catch (e: any) {
        setError(e?.message || "Erreur lors de l’ajout du flow.");
        throw e;
      }
    },
    []
  );

  const updateFlow = useCallback(async (id: string, updates: Partial<Flow>) => {
    setError("");
    try {
      const current = flows.find((f) => f.id === id);
      if (!current) return;

      const merged: Flow = {
        ...(current as any),
        ...(updates as any),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("flows")
        .update({
          data: flowToData(merged),
          updated_at: merged.updated_at,
        })
        .eq("id", id);

      if (error) throw error;

      setFlows((prev) => prev.map((f) => (f.id === id ? merged : f)));
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la mise à jour du flow.");
    }
  }, [flows]);

  const deleteFlow = useCallback(async (id: string) => {
    setError("");
    try {
      const { error } = await supabase.from("flows").delete().eq("id", id);
      if (error) throw error;

      setFlows((prev) => prev.filter((f) => f.id !== id));
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la suppression du flow.");
    }
  }, []);

  const getFlow = useCallback(
    (id: string) => {
      return flows.find((f) => f.id === id);
    },
    [flows]
  );

  return {
    flows,
    isLoading,
    error,
    addFlow,
    updateFlow,
    deleteFlow,
    getFlow,
    refresh: fetchFlows,
  };
}
