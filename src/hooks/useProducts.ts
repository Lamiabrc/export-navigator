import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

/** Helper partagé (Simulator.tsx l’importe) */
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

  nouveaute: boolean | null;
  code_article: string | null;
  libelle_article: string | null;
  code_acl13_ou_ean13: string | null;
  code_acl7: string | null;
  code_iud_id: string | null;

  tarif_catalogue_2025: number | null;

  code_lppr_generique: string | null;
  tarif_lppr_eur: number | null;
  code_lppr_individuel: string | null;

  tva_percent: number | null;

  caracteristiques: string | null;
  indications: string | null;

  unite_vente_longueur_mm: number | null;
  unite_vente_largeur_mm: number | null;
  unite_vente_hauteur_mm: number | null;
  unite_vente_poids_brut_g: number | null;

  marquage_ce: boolean | null;
  type_du_dispositif: string | null;
  classe_du_dispositif: string | null;
  type_de_vigilance: string | null;
  nom_du_fabricant: string | null;
  conditionnement_conforme_dss_lpp: boolean | null;

  created_at: string | null;
  updated_at: string | null;

  classement_groupe: string | null;
  classement_produit_code: string | null;
  classement_produit_num: string | null;
  classement_produit_libelle: string | null;
  classement_sous_famille_code: string | null;
  classement_detail: string | null;
  classement_taille: string | null;
  classement_variante: string | null;
  classement_ancien_code: string | null;
};

type UseProductsOptions = {
  enabled?: boolean; // default true
  pageSize?: number; // default 500
  orderBy?: keyof ProductRow; // default "libelle_article"
};

export function useProducts(options: UseProductsOptions = {}) {
  const enabled = options.enabled ?? true;
  const pageSize = options.pageSize ?? 500;
  const orderBy = options.orderBy ?? "libelle_article";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const envOk = SUPABASE_ENV_OK;

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    if (!envOk) {
      setError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const all: ProductRow[] = [];
      let from = 0;

      // Pagination : .range(from, to)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const to = from + pageSize - 1;

        const { data, error: sbError } = await supabase
          .from("products")
          .select("*")
          .order(String(orderBy), { ascending: true, nullsFirst: false })
          .range(from, to);

        if (sbError) throw sbError;

        const rows = (data ?? []) as ProductRow[];
        all.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      setProducts(all);
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des produits.");
      setProducts([]);
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
      const code = (p.code_article || "").trim();
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

  const searchProducts = useCallback(
    (query: string, limit = 20) => {
      const q = (query || "").trim().toLowerCase();
      if (!q) return products.slice(0, limit);

      return products
        .filter((p) => {
          const code = (p.code_article || "").toLowerCase();
          const label = (p.libelle_article || "").toLowerCase();
          const ean = (p.code_acl13_ou_ean13 || "").toLowerCase();
          return code.includes(q) || label.includes(q) || ean.includes(q);
        })
        .slice(0, limit);
    },
    [products]
  );

  const stats = useMemo(() => {
    const total = products.length;
    const nouveautes = products.filter((p) => Boolean(p.nouveaute)).length;
    const lppr = products.filter((p) => safeNumber(p.tarif_lppr_eur, 0) > 0 || Boolean(p.code_lppr_individuel || p.code_lppr_generique)).length;
    const withTva = products.filter((p) => safeNumber(p.tva_percent, 0) > 0).length;

    return { total, nouveautes, lppr, withTva };
  }, [products]);

  return {
    products,
    isLoading,
    error,
    refresh,

    // helpers
    getProductByCode,
    searchProducts,

    // meta
    envOk,
    stats,
  };
}
