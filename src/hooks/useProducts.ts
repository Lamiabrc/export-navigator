import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/lib/supabaseClient";

export type ProductRow = {
  id: string;
  nouveaute: boolean | null;
  code_article: string | null;
  libelle_article: string | null;
  code_acl13_ou_ean13: string | null;
  code_acl7: string | null;
  code_iud_id: string | null;
  tarif_catalogue_2025: number | string | null;
  code_lppr_generique: string | null;
  tarif_lppr_eur: number | string | null;
  code_lppr_individuel: string | null;
  tva_percent: number | string | null;
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
  classement_groupe: string | null;
  classement_produit_code: string | null;
  classement_produit_num: string | null;
  classement_produit_libelle: string | null;
  classement_sous_famille_code: string | null;
  classement_detail: string | null;
  classement_taille: string | null;
  classement_variante: string | null;
  classement_ancien_code: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Options = { limit?: number; search?: string };

const CACHE_KEY = "export_products_cache_v1";

export const safeNumber = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function useProducts(opts: Options = {}) {
  const limit = opts.limit ?? 2000;
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    if (!SUPABASE_ENV_OK) {
      const cached = localStorage.getItem(CACHE_KEY);
      setProducts(cached ? JSON.parse(cached) : []);
      setLoading(false);
      return;
    }

    try {
      let q = supabase.from("products").select("*").limit(limit);

      const s = (opts.search ?? "").trim();
      if (s) {
        const safe = s.replaceAll(",", " ").replaceAll("'", " ");
        q = q.or(
          [
            `libelle_article.ilike.%${safe}%`,
            `code_article.ilike.%${safe}%`,
            `code_lppr_individuel.ilike.%${safe}%`,
            `code_lppr_generique.ilike.%${safe}%`,
            `code_acl13_ou_ean13.ilike.%${safe}%`,
            `nom_du_fabricant.ilike.%${safe}%`,
            `classement_groupe.ilike.%${safe}%`,
            `classement_produit_libelle.ilike.%${safe}%`,
          ].join(",")
        );
      } else {
        q = q.order("libelle_article", { ascending: true });
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as ProductRow[];
      setProducts(rows);
      localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
    } catch (e: any) {
      setError(e?.message ?? "Erreur chargement products");
    } finally {
      setLoading(false);
    }
  }, [limit, opts.search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const byCodeArticle = useMemo(() => {
    const m = new Map<string, ProductRow>();
    for (const p of products) {
      const code = String(p.code_article ?? "").trim();
      if (code) m.set(code, p);
    }
    return m;
  }, [products]);

  return { products, byCodeArticle, loading, error, refresh: fetchProducts };
}
