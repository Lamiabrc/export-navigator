import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export type SaleRowUI = {
  id: string;
  sale_date: string;
  territory_code: string | null;
  territory_label: string | null;
  client_id: string | null;
  client_name: string | null;
  product_id: string | null;
  product_name: string | null;
  destination_id: string | null;
  destination_name: string | null;

  quantity: number;
  unit_price_ht: number;

  amount_ht: number;
  vat_category: string | null;
  vat_rate: number;
  vat_amount: number;
  amount_ttc: number;

  created_at: string;
};

type Territory = { code: string; label: string | null };
type Client = { id: string; name: string | null };
type Product = { id: string; label: string | null };
type Destination = { id: string; name: string | null };
const ENABLE_TERRITORIES = import.meta.env.VITE_ENABLE_TERRITORIES === "true";

function isMissingTableError(err: unknown) {
  const message = String((err as any)?.message || "");
  const code = (err as any)?.code;
  return code === "42P01" || /not found|does not exist/i.test(message);
}

export function useSales() {
  const [rows, setRows] = React.useState<SaleRowUI[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setWarning(null);

    try {
      const [tRes, cRes, pRes, dRes, sRes] = await Promise.all([
        ENABLE_TERRITORIES ? supabase.from("territories").select("code,label") : Promise.resolve({ data: [], error: null }),
        supabase.from("clients").select("id,name").limit(1000),
        supabase.from("products").select("id,label").limit(1000),
        supabase.from("export_destinations").select("id,name").order("name", { ascending: true }).limit(1000),
        supabase
          .from("sales")
          .select(
            "id,sale_date,territory_code,client_id,product_id,destination_id,quantity,unit_price_ht,amount_ht,vat_category,vat_rate,vat_amount,amount_ttc,created_at"
          )
          .order("sale_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (tRes.error && !isMissingTableError(tRes.error)) throw tRes.error;
      if (cRes.error) throw cRes.error;
      if (pRes.error) throw pRes.error;
      if (dRes.error) throw dRes.error;
      if (sRes.error) throw sRes.error;

      const territories = (tRes.data ?? []) as Territory[];
      const clients = (cRes.data ?? []) as Client[];
      const products = (pRes.data ?? []) as Product[];
      const destinations = (dRes.data ?? []) as Destination[];

      const territoryByCode = new Map(territories.map((t) => [t.code, t.label ?? t.code]));
      const clientById = new Map(clients.map((c) => [c.id, c.name ?? c.id]));
      const productById = new Map(products.map((p) => [p.id, p.label ?? p.id]));
      const destinationById = new Map(destinations.map((d) => [d.id, d.name ?? d.id]));

      const mapped: SaleRowUI[] = (sRes.data ?? []).map((s: any) => ({
        id: s.id,
        sale_date: s.sale_date,
        territory_code: s.territory_code ?? null,
        territory_label: s.territory_code ? (territoryByCode.get(s.territory_code) ?? s.territory_code) : null,
        client_id: s.client_id ?? null,
        client_name: s.client_id ? (clientById.get(s.client_id) ?? s.client_id) : null,
        product_id: s.product_id ?? null,
        product_name: s.product_id ? (productById.get(s.product_id) ?? s.product_id) : null,
        destination_id: s.destination_id ?? null,
        destination_name: s.destination_id ? (destinationById.get(s.destination_id) ?? s.destination_id) : null,

        quantity: Number(s.quantity ?? 0),
        unit_price_ht: Number(s.unit_price_ht ?? 0),

        amount_ht: Number(s.amount_ht ?? 0),
        vat_category: s.vat_category ?? null,
        vat_rate: Number(s.vat_rate ?? 0),
        vat_amount: Number(s.vat_amount ?? 0),
        amount_ttc: Number(s.amount_ttc ?? 0),

        created_at: s.created_at,
      }));

      const missingProduct = mapped.some((r) => !r.product_id);
      if (missingProduct) setWarning("Certaines lignes n’ont pas de produit : TVA peut être EXO par défaut.");

      setRows(mapped);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Erreur chargement ventes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  const createSale = React.useCallback(async (payload: {
    sale_date: string;
    territory_code: string;
    client_id?: string | null;
    product_id: string;
    destination_id?: string | null;
    quantity: number;
    unit_price_ht: number;
  }) => {
    const { error } = await supabase.from("sales").insert({
      sale_date: payload.sale_date,
      territory_code: payload.territory_code,
      client_id: payload.client_id ?? null,
      product_id: payload.product_id,
      destination_id: payload.destination_id ?? null,
      quantity: payload.quantity,
      unit_price_ht: payload.unit_price_ht,
    });
    if (error) throw error;
  }, []);

  const deleteSale = React.useCallback(async (id: string) => {
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) throw error;
  }, []);

  return { rows, isLoading, error, warning, refresh, createSale, deleteSale };
}
