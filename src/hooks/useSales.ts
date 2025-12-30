import { useCallback, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { fetchAllWithPagination } from "@/utils/supabasePagination";
import { SalesLine } from "@/domain/calc";
import { isMissingTableError } from "@/domain/calc";

export function useSales(options: { pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 1000;

  const [rows, setRows] = useState<SalesLine[]>([]);
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
      const data = await fetchAllWithPagination<SalesLine>(
        (from, to) =>
          supabase
            .from("sales_lines")
            .select("id,date,client_id,product_id,qty,net_sales_ht,currency,market_zone,incoterm,destination")
            .order("date", { ascending: false })
            .range(from, to),
        pageSize,
      );
      setRows(data ?? []);
    } catch (e: any) {
      if (isMissingTableError(e)) {
        setWarning("Table sales_lines manquante. Ajoute la migration SQL fournie pour activer la page.");
        setRows([]);
      } else {
        setError(e?.message || "Erreur chargement ventes");
        setRows([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  const totalNet = useMemo(() => rows.reduce((sum, r) => sum + (r.net_sales_ht ?? 0), 0), [rows]);

  return { rows, isLoading, error, warning, refresh, totalNet };
}
