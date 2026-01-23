import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, DEMO_MODE, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { demoProducts } from "@/lib/demoData";
import { isMissingTableError } from "@/domain/calc/validators";

// Shared helper (Simulator.tsx imports it)
export const safeNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  // support "12,34" => 12.34
  const s = String(value).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

export type ProductRow = {
  id: string;
  code: string | null;
  label: string | null;
  hs_code?: string | null;
  tva: number | null;
  manufacturer: string | null;
  created_at: string | null;
  unit_price_eur?: number | null;
  weight_kg?: number | null;
};

type UseProductsOptions = {
  enabled?: boolean; // default true
  pageSize?: number; // default 500
  orderBy?: keyof ProductRow; // default "label"
};

export function useProducts(options: UseProductsOptions = {}) {
  const enabled = options.enabled ?? true;
  const pageSize = options.pageSize ?? 500;
  const orderBy = options.orderBy ?? "label";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [missingTables, setMissingTables] = useState<boolean>(false);

  const envOk = SUPABASE_ENV_OK;

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    if (!envOk || DEMO_MODE) {
      setMissingTables(false);
      setError("");
      setProducts(demoProducts);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    setMissingTables(false);

    try {
      const all: ProductRow[] = [];
      let from = 0;

      // Pagination: .range(from, to)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const to = from + pageSize - 1;

        const { data, error: sbError } = await supabase
          .from("products")
          .select(
            [
              "id",
              "code",
              "label",
              "hs_code",
              "tva",
              "manufacturer",
              "created_at",
            ].join(",")
          )
          .order(String(orderBy), { ascending: true, nullsFirst: false })
          .range(from, to);

        if (sbError) {
          if (isMissingTableError(sbError)) throw sbError;
          throw sbError;
        }

        const rows = (data ?? []) as ProductRow[];
        all.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      setProducts(all);
    } catch (e: any) {
      if (isMissingTableError(e)) {
        setMissingTables(true);
        setError("");
        setProducts([]);
      } else {
        setError(e?.message || "Erreur lors du chargement des produits.");
        setProducts([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, envOk, pageSize, orderBy]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byCodeArticle = useMemo(() => {
    const map = new Map<string, ProductRow>();
    for (const p of products) {
      const code = (p.code || "").trim();
      if (code) map.set(code, p);
    }
    return map;
  }, [products]);

  const getProductByCode = useCallback(
    (codeArticle: string) => {
      const key = (codeArticle || "").trim();
      return key ? byCodeArticle.get(key) : undefined;
    },
    [byCodeArticle]
  );

  const getProductByCodeArticle = getProductByCode;

  const searchProducts = useCallback(
    (query: string, limit = 20) => {
      const q = (query || "").trim().toLowerCase();
      if (!q) return products.slice(0, limit);

      return products
        .filter((p) => {
          const code = (p.code || "").toLowerCase();
          const label = (p.label || "").toLowerCase();
          const hs = (p.hs_code || "").toLowerCase();
          return code.includes(q) || label.includes(q) || hs.includes(q);
        })
        .slice(0, limit);
    },
    [products]
  );

  const topProductsByZone = useCallback(
    (zone: string, limit = 10) => {
      // No zone volumes yet; return alpha list as a placeholder.
      const list = [...products].sort((a, b) => (a.label || "").localeCompare(b.label || ""));
      return zone ? list.slice(0, limit) : list.slice(0, limit);
    },
    [products]
  );

  const stats = useMemo(() => {
    const total = products.length;
    const withHs = products.filter((p) => Boolean(p.hs_code)).length;
    const withTva = products.filter((p) => safeNumber(p.tva, 0) > 0).length;
    return { total, withHs, withTva };
  }, [products]);

  return {
    products,
    isLoading,
    error,
    refresh,

    // helpers
    getProductByCode,
    searchProducts,
    getProductByCodeArticle,
    topProductsByZone,

    // meta
    envOk,
    stats,
    missingTables,
    demoMode: DEMO_MODE,
  };
}
