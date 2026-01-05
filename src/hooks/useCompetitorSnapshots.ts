import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

export type CompetitorSnapshot = {
  id: string;
  snapshot_date: string | null;
  competitor_id: string | null;
  territory_code: string | null;
  product_ref: string | null;
  product_name?: string | null;
  list_price?: number | null;
  net_price_est?: number | null;
  currency?: string | null;
  incoterm?: string | null;
  promo_flag?: boolean | null;
  promo_details?: string | null;
  availability?: string | null;
  source?: string | null;
  confidence?: number | null;
  created_at?: string | null;
};

export type SnapshotFilters = {
  from?: string;
  to?: string;
  territories?: string[];
  competitors?: string[];
  productQuery?: string;
};

type State<T> = { data: T; loading: boolean; error: string | null; warning?: string };

export function useCompetitorSnapshots(filters: SnapshotFilters = {}) {
  const [state, setState] = useState<State<CompetitorSnapshot[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        if (active) setState({ data: [], loading: false, error: null, warning: "Supabase non configuré" });
        return;
      }
      try {
        const query = supabase
          .from("competitor_snapshots")
          .select("*")
          .order("snapshot_date", { ascending: false })
          .limit(800);

        if (filters.from) query.gte("snapshot_date", filters.from);
        if (filters.to) query.lte("snapshot_date", filters.to);
        if (filters.territories?.length) query.in("territory_code", filters.territories);
        if (filters.competitors?.length) query.in("competitor_id", filters.competitors);
        if (filters.productQuery) query.ilike("product_ref", `%${filters.productQuery}%`);

        const { data, error } = await query;
        if (!active) return;
        if (error) {
          if (isMissingTableError(error)) {
            setState({ data: [], loading: false, error: null, warning: "Table competitor_snapshots absente" });
          } else {
            setState({ data: [], loading: false, error: error.message });
          }
          return;
        }

        setState({ data: (data ?? []) as CompetitorSnapshot[], loading: false, error: null });
      } catch (err: any) {
        if (!active) return;
        setState({ data: [], loading: false, error: err?.message || "Erreur chargement snapshots" });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [filters.from, filters.to, filters.productQuery, JSON.stringify(filters.territories || []), JSON.stringify(filters.competitors || [])]);

  const bulkInsert = async (rows: Partial<CompetitorSnapshot>[]) => {
    if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré");
    if (!rows.length) return;
    const normalized = rows.map((r) => ({
      ...r,
      snapshot_date: r.snapshot_date || new Date().toISOString().slice(0, 10),
    }));
    const { error } = await supabase.from("competitor_snapshots").insert(normalized);
    if (error) throw error;
  };

  const byTerritory = useMemo(() => {
    const map = new Map<string, CompetitorSnapshot[]>();
    state.data.forEach((s) => {
      const key = s.territory_code || "NA";
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    });
    return map;
  }, [state.data]);

  return { state, bulkInsert, byTerritory };
}
