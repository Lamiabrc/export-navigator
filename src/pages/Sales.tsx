import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

type Territory = { code: string; label: string | null };
type Client = { id: string; name: string | null };
type Product = { id: string; libelle_article: string | null };

type SaleRow = {
  id: string;
  sale_date: string;
  territory_code: string | null;
  client_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price_ht: number;
  amount_ht: number;
  vat_category: string | null;
  vat_rate: number;
  vat_amount: number;
  amount_ttc: number;
  created_at: string;
};

function money(n: any) {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

export default function Sales() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);

  // Form state
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [territoryCode, setTerritoryCode] = useState<string>("FR");
  const [clientId, setClientId] = useState<string>("none");
  const [productId, setProductId] = useState<string>("none");
  const [qty, setQty] = useState<string>("1");
  const [unitPrice, setUnitPrice] = useState<string>("0");

  const canSubmit = useMemo(() => {
    const q = Number(qty);
    const p = Number(unitPrice);
    return territoryCode && productId !== "none" && Number.isFinite(q) && q > 0 && Number.isFinite(p) && p >= 0;
  }, [territoryCode, productId, qty, unitPrice]);

  const fetchLookups = async () => {
    try {
      const [{ data: tData, error: tErr }, { data: cData, error: cErr }, { data: pData, error: pErr }] =
        await Promise.all([
          supabase.from("territories").select("code,label").order("label", { ascending: true }),
          supabase.from("clients").select("id,name").order("name", { ascending: true }).limit(500),
          supabase.from("products").select("id,libelle_article").order("libelle_article", { ascending: true }).limit(500),
        ]);

      if (tErr) throw tErr;
      if (cErr) throw cErr;
      if (pErr) throw pErr;

      setTerritories((tData ?? []) as Territory[]);
      setClients((cData ?? []) as Client[]);
      setProducts((pData ?? []) as Product[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur chargement référentiels");
    }
  };

  const fetchSales = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id,sale_date,territory_code,client_id,product_id,quantity,unit_price_ht,amount_ht,vat_category,vat_rate,vat_amount,amount_ttc,created_at"
        )
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setSales((data ?? []) as SaleRow[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur chargement ventes");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchLookups();
    void fetchSales();
  }, []);

  const submit = async () => {
    if (!canSubmit) {
      toast.error("Complète au minimum territoire + produit + quantité + prix");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        sale_date: saleDate,
        territory_code: territoryCode,
        product_id: productId === "none" ? null : productId,
        client_id: clientId === "none" ? null : clientId,
        quantity: Number(qty),
        unit_price_ht: Number(unitPrice),
      };

      const { error } = await supabase.from("sales").insert(payload);
      if (error) throw error;

      toast.success("Vente ajoutée");
      setQty("1");
      setUnitPrice("0");
      await fetchSales();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur ajout vente");
    } finally {
      setLoading(false);
    }
  };

  const removeSale = async (id: string) => {
    if (!confirm("Supprimer cette vente ?")) return;
    try {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
      toast.success("Vente supprimée");
      await fetchSales();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur suppression");
    }
  };

  const territoryLabelByCode = useMemo(() => {
    const m = new Map<string, string>();
    territories.forEach((t) => m.set(t.code, t.label ?? t.code));
    return m;
  }, [territories]);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name ?? c.id));
    return m;
  }, [clients]);

  const productNameById = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.id, p.libelle_article ?? p.id));
    return m;
  }, [products]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Ventes</p>
            <h1 className="text-2xl font-bold">Saisie & suivi (HT / TVA / TTC)</h1>
          </div>

          <Button variant="outline" onClick={() => fetchSales()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Ajouter une vente
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-6">
            <div className="space-y-2 md:col-span-2">
              <Label>Date</Label>
              <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Territoire</Label>
              <Select value={territoryCode} onValueChange={setTerritoryCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {territories.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label ?? t.code} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Client (optionnel)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Produit</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choisir un produit…</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.libelle_article ?? p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                La TVA est calculée automatiquement via <code>vat_rates</code> + <code>products.tva_percent</code>.
                Si TVA inconnue : EXO.
              </p>
            </div>

            <div className="space-y-2 md:col-span-1">
              <Label>Quantité</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
            </div>

            <div className="space-y-2 md:col-span-1">
              <Label>Prix unitaire HT</Label>
              <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
            </div>

            <div className="md:col-span-6 flex justify-end">
              <Button onClick={submit} disabled={loading || !canSubmit}>
                <Plus className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Dernières ventes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Territoire</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">HT</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead className="text-right">TTC</TableHead>
                  <TableHead>Cat.</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.sale_date}</TableCell>
                    <TableCell>
                      {s.territory_code ? (territoryLabelByCode.get(s.territory_code) ?? s.territory_code) : "—"}
                    </TableCell>
                    <TableCell>{s.client_id ? (clientNameById.get(s.client_id) ?? "—") : "—"}</TableCell>
                    <TableCell>
                      {s.product_id ? (productNameById.get(s.product_id) ?? s.product_id) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{money(s.amount_ht)}</TableCell>
                    <TableCell className="text-right">{money(s.vat_amount)}</TableCell>
                    <TableCell className="text-right">{money(s.amount_ttc)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.vat_category ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => void removeSale(s.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Suppr.
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      Aucune vente. Ajoute ta première ligne.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
