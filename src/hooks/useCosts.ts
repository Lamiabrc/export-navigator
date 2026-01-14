// src/hooks/useCosts.ts
import * as React from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

export type CostLine = {
  id: string;

  date: string | null;
  cost_type: string | null;
  amount: number | null;

  currency: string | null;
  market_zone: string | null;
  destination: string | null;
  incoterm: string | null;

  client_id: string | null;
  product_id: string | null;

  order_id: string | null;
};

export type CostsFilters = {
  from?: string;
  to?: string;
  territory?: string;
  clientId?: string;
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
  try {
    return JSON.stringify(err);
  } catch {
    return "Erreur inconnue";
  }
}

async function fetchCostLines(filters: CostsFilters): Promise<CostLine[]> {
  const pageSize = 5000;
  let from = 0;
  const all: CostLine[] = [];

  while (true) {
    const to = from + pageSize - 1;

    let q = supabase
      .from("cost_lines")
      .select(
        "id,date,cost_type,amount,currency,market_zone,destination,incoterm,client_id,product_id,order_id"
      )
      .order("date", { ascending: false })
      .range(from, to);

    if (filters.from) q = q.gte("date", filters.from);
    if (filters.to) q = q.lte("date", filters.to);
    if (filters.territory) q = q.eq("destination", filters.territory);
    if (filters.clientId) q = q.eq("client_id", filters.clientId);

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) break;

    all.push(
      ...data.map((r: any) => ({
        id: String(r.id),
        date: r.date ?? null,
        cost_type: r.cost_type ?? null,
        amount: r.amount ?? null,
        currency: r.currency ?? null,
        market_zone: r.market_zone ?? null,
        destination: r.destination ?? null,
        incoterm: r.incoterm ?? null,
        client_id: r.client_id ?? null,
        product_id: r.product_id ?? null,
        order_id: r.order_id ?? null,
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
      const data = await fetchCostLines(filters);
      setRows(data);
    } catch (e: any) {
      const msg = asMessage(e);

      const hintMissing =
        msg.toLowerCase().includes("does not exist") ||
        msg.toLowerCase().includes("relation") ||
        msg.toLowerCase().includes("not found");

      if (hintMissing) {
        setWarning("Table cost_lines manquante ou non accessible (droits/RLS).");
        setError(null);
      } else {
        setError(msg);
      }

      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { rows, isLoading, error, warning, refresh };
}
