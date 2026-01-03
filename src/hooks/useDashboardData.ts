import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";
import { ExportSettings } from "./useExportSettings";

export type DashboardRow = {
  id: string;
  sale_date: string;
  territory_code: string | null;
  client_id: string | null;
  product_ref: string | null;
  amount_ht: number | null;
  amount_ttc: number | null;
  transport_cost: number | null;
  taxes: number | null;
  margin: number | null;
};

type State = {
  rows: DashboardRow[];
  warning?: string;
  loading: boolean;
  demo?: boolean;
};

export function useDashboardData(filters: {
  from?: string;
  to?: string;
  territories?: string[];
  channel?: string;
  incoterm?: string;
  client?: string;
  product?: string;
  dromOnly?: boolean;
}, settings: ExportSettings) {
  const [state, setState] = useState<State>({ rows: [], loading: true });

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        setState({ rows: [], loading: false, warning: "Supabase non configuré, affichage vide." });
        return;
      }
      try {
        // Sélection minimale (certaines colonnes peuvent ne pas exister côté DB)
        const query = supabase
          .from("sales")
          .select("id,sale_date,territory_code,client_id,product_ref,amount_ht,amount_ttc,transport_cost,taxes,margin", { head: false })
          .order("sale_date", { ascending: false })
          .limit(1500);
        if (filters.from) query.gte("sale_date", filters.from);
        if (filters.to) query.lte("sale_date", filters.to);
        if (filters.territories?.length) query.in("territory_code", filters.territories);
        if (filters.client) query.ilike("client_id", `%${filters.client}%`);
        if (filters.product) query.ilike("product_ref", `%${filters.product}%`);
        const { data, error } = await query;
        if (!active) return;
        if (error || !data) {
          if (isMissingTableError(error as any)) {
            // Mode demo si table manquante
            setState({ rows: demoRows(), loading: false, warning: "Table sales absente (mode dégradé demo).", demo: true });
          } else {
            setState({ rows: [], loading: false, warning: error?.message || "Erreur chargement ventes." });
          }
          return;
        }
        // Normalise pour les colonnes optionnelles (transport_cost/taxes/margin peuvent être absentes)
        const normalized = (data ?? []).map((r: any) => ({
          id: r.id,
          sale_date: r.sale_date,
          territory_code: r.territory_code,
          client_id: r.client_id,
          product_ref: r.product_ref,
          amount_ht: r.amount_ht,
          amount_ttc: r.amount_ttc,
          transport_cost: r.transport_cost ?? 0,
          taxes: r.taxes ?? 0,
          margin: r.margin ?? null,
        })) as DashboardRow[];
        setState({ rows: normalized, loading: false, demo: false });
      } catch (err: any) {
        if (!active) return;
        setState({ rows: demoRows(), loading: false, warning: err?.message || "Erreur chargement ventes (mode demo).", demo: true });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [filters.from, filters.to, JSON.stringify(filters.territories || []), filters.client, filters.product]);

  const aggregates = useMemo(() => {
    const rows = state.rows;
    const totalHt = rows.reduce((s, r) => s + (r.amount_ht || 0), 0);
    const totalTtc = rows.reduce((s, r) => s + (r.amount_ttc || 0), 0);
    const totalTransport = rows.reduce((s, r) => s + (r.transport_cost || 0), 0);
    const totalTaxes = rows.reduce((s, r) => s + (r.taxes || 0), 0);
    const totalMargin = rows.reduce((s, r) => s + (r.margin !== null && r.margin !== undefined ? r.margin : ((r.amount_ht || 0) - (r.transport_cost || 0) - (r.taxes || 0))), 0);
    const orders = rows.length;
    const avgBasket = orders ? totalHt / orders : 0;
    const marginPct = totalHt ? (totalMargin / totalHt) * 100 : 0;

    const byTerritory = new Map<string, { ca: number; margin: number; transport: number; taxes: number; count: number }>();
    rows.forEach((r) => {
      const key = (r.territory_code || "NA").toUpperCase();
      const cur = byTerritory.get(key) || { ca: 0, margin: 0, transport: 0, taxes: 0, count: 0 };
      cur.ca += r.amount_ht || 0;
      cur.margin += r.margin || ((r.amount_ht || 0) - (r.transport_cost || 0) - (r.taxes || 0));
      cur.transport += r.transport_cost || 0;
      cur.taxes += r.taxes || 0;
      cur.count += 1;
      byTerritory.set(key, cur);
    });

    const riskySales = rows.filter((r) => {
      const m = r.margin || ((r.amount_ht || 0) - (r.transport_cost || 0) - (r.taxes || 0));
      const pct = r.amount_ht ? (m / r.amount_ht) * 100 : 0;
      return pct < settings.thresholds.marge_min_pct;
    });

    return { totalHt, totalTtc, totalTransport, totalTaxes, totalMargin, orders, avgBasket, marginPct, byTerritory, riskySales };
  }, [state.rows, settings.thresholds.marge_min_pct]);

  return { state, aggregates };
}

function demoRows(): DashboardRow[] {
  const baseDate = new Date().toISOString().slice(0, 10);
  return [
    { id: "demo1", sale_date: baseDate, territory_code: "FR", client_id: "CLT-FR", product_ref: "PROD-FR-1", amount_ht: 120000, amount_ttc: 144000, transport_cost: 8000, taxes: 6000, margin: 96000 },
    { id: "demo2", sale_date: baseDate, territory_code: "GP", client_id: "CLT-GP", product_ref: "PROD-GP-1", amount_ht: 18000, amount_ttc: 19500, transport_cost: 4200, taxes: 1500, margin: 12300 },
    { id: "demo3", sale_date: baseDate, territory_code: "MQ", client_id: "CLT-MQ", product_ref: "PROD-MQ-1", amount_ht: 15000, amount_ttc: 16500, transport_cost: 3800, taxes: 1400, margin: 9800 },
    { id: "demo4", sale_date: baseDate, territory_code: "RE", client_id: "CLT-RE", product_ref: "PROD-RE-1", amount_ht: 22000, amount_ttc: 24200, transport_cost: 5200, taxes: 1800, margin: 15000 },
    { id: "demo5", sale_date: baseDate, territory_code: "YT", client_id: "CLT-YT", product_ref: "PROD-YT-1", amount_ht: 9000, amount_ttc: 9900, transport_cost: 3000, taxes: 900, margin: 6000 },
  ];
}
