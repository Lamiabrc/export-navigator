// src/hooks/useCosts.ts
import * as React from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

export type CostLine = {
  id: string; // text dans ta table
  date: string | null;
  destination: string | null; // text (GP/MQ/...)
  amount: number | null;
  cost_type: string | null;
};

export type CostsFilters = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  destination?: string; // ex: GP
  costType?: string; // ex: TRANSPORT
};

type UseCostsResult = {
  rows: CostLine[];
  isLoading: boolean;
  error: string | null;
  warning: string | null;
  refresh: () => Promise<void>;
};

function asMessage(err: any): string {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;
  if (err?.message) return String(err.message);
  return JSON.stringify(err);
}

async function fetchAllCostLines(filters: CostsFilters): Promise<CostLine[]> {
  const pageSize = 5000;
  let from = 0;
  const all: CostLine[] = [];

  while (true) {
    const to = from + pageSize - 1;

    let q = supabase
      .from("cost_lines")
      .select("id,date,destination,amount,cost_type")
      .order("date", { ascending: false })
      .range(from, to);

    if (filters.from) q = q.gte("date", filters.from);
    if (filters.to) q = q.lte("date", filters.to);
    if (filters.destination) q = q.eq("destination", filters.destination);
    if (filters.costType) q = q.eq("cost_type", filters.costType);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(
      ...data.map((r: any) => ({
        id: String(r.id),
        date: r.date ?? null,
        destination: r.destination ?? null,
        amount: r.amount ?? null,
        cost_type: r.cost_type ?? null,
      }))
    );

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export function useCosts(filters: CostsFilters): UseCostsResult {
  const [rows, setRows] = React.useState<CostLine[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!SUPABASE_ENV_OK) {
      setRows([]);
      setError(null);
      setWarning("Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarning(null);

    try {
      const data = await fetchAllCostLines(filters);
      setRows(data);
    } catch (e: any) {
      setRows([]);
      setError(asMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, isLoading, error, warning, refresh };
}
