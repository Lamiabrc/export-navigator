import { useCallback, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { fetchAllWithPagination } from "@/utils/supabasePagination";
import { CostLine, isMissingTableError } from "@/domain/calc";

export function useCosts(options: { pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 1000;

  const [rows, setRows] = useState<CostLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setWarning("");

    if (!SUPABASE_ENV_OK) {
      setWarning("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setRows([]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchAllWithPagination<CostLine>(
        (from, to) =>
          supabase
            .from("cost_lines")
            .select("id,date,cost_type,amount,currency,market_zone,incoterm,client_id,product_id,destination")
            .order("date", { ascending: false })
            .range(from, to),
        pageSize,
      );
      setRows(data ?? []);
    } catch (e: any) {
      if (isMissingTableError(e)) {
        setWarning("Table cost_lines manquante. Ajoute la migration SQL fournie pour activer la page.");
        setRows([]);
      } else {
        setError(e?.message || "Erreur chargement charges");
        setRows([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  const totalAmount = useMemo(() => rows.reduce((sum, r) => sum + (r.amount ?? 0), 0), [rows]);

  return { rows, isLoading, error, warning, refresh, totalAmount };
}
