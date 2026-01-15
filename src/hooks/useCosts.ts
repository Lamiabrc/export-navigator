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
  destination: string | null; // UUID (souvent) -> export_destinations.id
  incoterm: string | null;

  client_id: string | null;
  product_id: string | null;
  order_id: string | null;
};

export type CostsFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  destinationId?: string; // ✅ UUID
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

async function fetchCostLines(params: CostsFilters): Promise<CostLine[]> {
  const pageSize = 5000;
  let offset = 0;
  const all: CostLine[] = [];

  while (true) {
    let q = supabase
      .from("cost_lines")
      .select("id,date,cost_type,amount,currency,market_zone,destination,incoterm,client_id,product_id,order_id")
      .order("date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (params.from) q = q.gte("date", params.from);
    if (params.to) q = q.lte("date", params.to);
    if (params.clientId) q = q.eq("client_id", params.clientId);

    // ✅ IMPORTANT: destination filtrée uniquement en UUID (sinon 400)
    if (params.destinationId) q = q.eq("destination", params.destinationId);

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
    offset += pageSize;
  }

  return all;
}

export function useCosts(filters: CostsFilters): UseCostsResult {
  const { from, to, clientId, destinationId } = filters || {};

  const [rows, setRows] = React.useState<CostLine[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const inFlightRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (!SUPABASE_ENV_OK) {
      setRows([]);
      setError(null);
      setWarning("Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      inFlightRef.current = false;
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarning(null);

    try {
      const data = await fetchCostLines({ from, to, clientId, destinationId });
      setRows(data);
    } catch (e: any) {
      const msg = asMessage(e);
      const hintMissing =
        msg.toLowerCase().includes("does not exist") ||
        msg.toLowerCase().includes("relation") ||
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("schema cache");

      if (hintMissing) {
        setWarning("cost_lines manquante / non exposée / non accessible (RLS/schema cache).");
        setError(null);
      } else {
        setError(msg);
      }
      setRows([]);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [from, to, clientId, destinationId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, isLoading, error, warning, refresh };
}
