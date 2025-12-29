import { useState, useCallback, useEffect } from "react";
import type { Flow } from "@/types";
import { mockFlows } from "@/data/mockData";
import { supabase, SUPABASE_ENV_OK } from "@/lib/supabaseClient";
import { fetchAllWithPagination } from "@/utils/supabasePagination";

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
  const { id, flow_code, created_at, updated_at, ...rest } = flow as any;
  return rest;
}

function validateFlowData(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
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
  const envOk = SUPABASE_ENV_OK;

  const fetchFlows = useCallback(async () => {
    if (!envOk) {
      setError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setFlows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    const pageSize = 1000;

    const fetchAllFlowsRows = async (): Promise<FlowRow[]> => {
      return await fetchAllWithPagination<FlowRow>(
        (from, to) =>
          supabase
            .from("flows")
            .select("id,flow_code,data,created_at,updated_at")
            // ordre stable pour paginer correctement
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        pageSize,
      );
    };

    try {
      const rows = await fetchAllFlowsRows();

      // Seed automatique au premier lancement si table vide (dev)
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

        const againRows = await fetchAllFlowsRows();
        setFlows(
          againRows.map(
            (row) =>
              ({
                ...rowToFlow(row),
                data: validateFlowData((row as any).data),
              }) as any,
          ),
        );
        return;
      }

      setFlows(
        rows.map(
          (row) =>
            ({
              ...rowToFlow(row),
              data: validateFlowData((row as any).data),
            }) as any,
        ),
      );
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des flows.");
      setFlows([]);
    } finally {
      setIsLoading(false);
    }
  }, [envOk]);

  useEffect(() => {
    void fetchFlows();
  }, [fetchFlows]);

  const addFlow = useCallback(
    async (flow: Omit<Flow, "id" | "flow_code" | "created_at" | "updated_at">) => {
      setError("");
      try {
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

        setFlows((prev) => [newFlow, ...prev]);
        return newFlow;
      } catch (e: any) {
        setError(e?.message || "Erreur lors de l'ajout du flow.");
        throw e;
      }
    },
    [],
  );

  const updateFlow = useCallback(
    async (id: string, updates: Partial<Flow>) => {
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
    },
    [flows],
  );

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
    [flows],
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
    envOk,
  };
}
