import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export type DhlSalesQuote = {
  sale_id: string;
  sale_date: string | null;
  destination_id: string | null;
  destination_name: string | null;
  client_id: string | null;
  product_id: string | null;
  quantity: number | null;
  total_actual_weight_kg: number | null;
  dhl_zone: string | null;
  dhl_transport_eur: number | null;
};

type Params = {
  from?: string;
  to?: string;
  destinationId?: string;
  clientId?: string;
  productId?: string;
  limit?: number;
};

const RLS_MESSAGE = "Accès refusé (RLS). Autoriser SELECT sur v_sales_dhl_quote / tables sources.";
const MISSING_VIEW_MESSAGE = "Vue v_sales_dhl_quote manquante côté Supabase.";

function normalizeError(error: any) {
  if (!error) return null;

  const code = error.code || error.hint;
  const message = (error.message || "").toLowerCase();

  if (error.status === 401 || error.status === 403 || code === "42501" || /permission denied/.test(message)) {
    return RLS_MESSAGE;
  }

  if (code === "42P01" || /relation .* does not exist/.test(message)) {
    return MISSING_VIEW_MESSAGE;
  }

  return error.message || "Erreur chargement v_sales_dhl_quote";
}

export function useDhlSalesQuotes(params: Params = {}) {
  const [data, setData] = React.useState<DhlSalesQuote[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { from, to, destinationId, clientId, productId, limit = 5000 } = params;

  const fetchQuotes = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from("v_sales_dhl_quote").select("*").order("sale_date", { ascending: false }).limit(limit);

      if (from) query = query.gte("sale_date", from);
      if (to) query = query.lte("sale_date", to);
      if (destinationId) query = query.eq("destination_id", destinationId);
      if (clientId) query = query.eq("client_id", clientId);
      if (productId) query = query.eq("product_id", productId);

      const { data: rows, error: qError } = await query;

      if (qError) throw qError;
      setData((rows || []) as DhlSalesQuote[]);
    } catch (e: any) {
      console.error(e);
      setError(normalizeError(e));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, destinationId, clientId, productId, limit]);

  React.useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);

  const refetch = React.useCallback(() => fetchQuotes(), [fetchQuotes]);

  return { data, loading, error, refetch };
}
