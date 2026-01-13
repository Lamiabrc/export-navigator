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

  // charges "par commande"
  order_id: string | null;
};

export type UseCostsParams = {
  from?: string;
  to?: string;
  territory?: string; // ex: FR / GP / ... / UE
  clientId?: string;
};

type UseCostsResult = {
  rows: CostLine[];
  isLoading: boolean;
  error: string | null;
  warning: string | null;
  source: "cost_lines" | "costs" | null;
  refresh: () => Promise<void>;
};

function asMessage(err: any): string {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;
  if (err?.message) return String(err.message);
  return JSON.stringify(err);
}

function looksLikeMissingTable(errMsg: string) {
  const msg = (errMsg || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("not found") ||
    msg.includes("42p01") // relation does not exist
  );
}

async function fetchAll(
  table: "cost_lines" | "costs",
  params: UseCostsParams
): Promise<CostLine[]> {
  const pageSize = 5000;
  let from = 0;
  const all: CostLine[] = [];

  while (true) {
    const to = from + pageSize - 1;

    let q = supabase
      .from(table)
      .select(
        "id,date,cost_type,amount,currency,market_zone,destination,incoterm,client_id,product_id,order_id"
      )
      .order("date", { ascending: false })
      .range(from, to);

    // filtres période
    if (params.from) q = q.gte("date", params.from);
    if (params.to) q = q.lte("date", params.to);

    // filtre territoire
    if (params.territory) {
      const terr = params.territory.toUpperCase();
      if (terr === "UE") {
        q = q.eq("market_zone", "UE");
      } else {
        q = q.eq("destination", terr);
      }
    }

    // filtre client
    if (params.clientId) {
      q = q.eq("client_id", params.clientId);
    }

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

export function useCosts(params: UseCostsParams = {}): UseCostsResult {
  const [rows, setRows] = React.useState<CostLine[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<UseCostsResult["source"]>(null);

  const paramsRef = React.useRef<UseCostsParams>(params);
  paramsRef.current = params;

  const refresh = React.useCallback(async () => {
    if (!SUPABASE_ENV_OK) {
      setRows([]);
      setError(null);
      setWarning("Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setSource(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarning(null);

    try {
      // 1) on tente cost_lines (table “canon”)
      const data = await fetchAll("cost_lines", paramsRef.current);
      setRows(data);
      setSource("cost_lines");
    } catch (e1: any) {
      const msg1 = asMessage(e1);

      // si cost_lines absente => fallback costs
      if (looksLikeMissingTable(msg1)) {
        try {
          const data2 = await fetchAll("costs", paramsRef.current);
          setRows(data2);
          setSource("costs");
          setWarning("Lecture via table costs (fallback) : cost_lines manquante ou non accessible (droits/RLS).");
          setError(null);
        } catch (e2: any) {
          setRows([]);
          setSource(null);
          setError(asMessage(e2));
        }
      } else {
        setRows([]);
        setSource(null);
        setError(msg1);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // auto-refresh quand les filtres changent
  React.useEffect(() => {
    void refresh();
  }, [refresh, params.from, params.to, params.territory, params.clientId]);

  return { rows, isLoading, error, warning, source, refresh };
}
