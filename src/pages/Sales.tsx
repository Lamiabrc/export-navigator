import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Download, TrendingUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSales } from "@/hooks/useSales";

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = String(v ?? "");
    const needsQuotes = s.includes(";") || s.includes("\n") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))];
  return lines.join("\n");
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function money(n: any) {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

type Territory = { code: string; label: string | null };
type Client = { id: string; name: string | null };
type Product = { id: string; libelle_article: string | null };
type Destination = { id: string; name: string | null };

export default function Sales() {
  const { rows, isLoading, error, warning, refresh, createSale, deleteSale } = useSales();

  const [q, setQ] = React.useState("");

  // lookups pour la saisie
  const [territories, setTerritories] = React.useState<Territory[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [destinations, setDestinations] = React.useState<Destination[]>([]);

  // form
  const [saleDate, setSaleDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [territoryCode, setTerritoryCode] = React.useState<string>("FR");
  const [clientId, setClientId] = React.useState<string>("none");
  const [productId, setProductId] = React.useState<string>("none");
  const [destinationId, setDestinationId] = React.useState<string>("none");
  const [qty, setQty] = React.useState<string>("1");
  const [unitPrice, setUnitPrice] = React.useState<string>("0");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const [tRes, cRes, pRes, dRes] = await Promise.all([
        supabase.from("territories").select("code,label").order("label", { ascending: true }),
        supabase.from("clients").select("id,name").order("name", { ascending: true }).limit(500),
        supabase.from("products").select("id,libelle_article").order("libelle_article", { ascending: true }).limit(500),
        supabase.from("export_destinations").select("id,name").order("name", { ascending: true }).limit(1000),
      ]);
      if (tRes.data) setTerritories(tRes.data as any);
      if (cRes.data) setClients(cRes.data as any);
      if (pRes.data) setProducts(pRes.data as any);
      if (dRes.data) setDestinations(dRes.data as any);
    })().catch(console.error);
  }, []);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const hay = [
        r.sale_date,
        r.territory_code,
        r.territory_label,
        r.client_name,
        r.product_name,
        r.vat_category,
        r.destination_name,
        String(r.amount_ht ?? ""),
        String(r.amount_ttc ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q]);

  const totalHt = React.useMemo(() => filtered.reduce((s, r) => s + (r.amount_ht ?? 0), 0), [filtered]);
  const totalVat = React.useMemo(() => filtered.reduce((s, r) => s + (r.vat_amount ?? 0), 0), [filtered]);
  const totalTtc = React.useMemo(() => filtered.reduce((s, r) => s + (r.amount_ttc ?? 0), 0), [filtered]);

  function exportCsv() {
    const csv = toCsv(
      filtered.map((r) => ({
        sale_date: r.sale_date,
        territory: r.territory_code ?? "",
        territory_label: r.territory_label ?? "",
        client: r.client_name ?? "",
        product: r.product_name ?? "",
        qty: r.quantity ?? 0,
        unit_price_ht: r.unit_price_ht ?? 0,
        amount_ht: r.amount_ht ?? 0,
        vat_category: r.vat_category ?? "",
        vat_rate: r.vat_rate ?? 0,
        vat_amount: r.vat_amount ?? 0,
        amount_ttc: r.amount_ttc ?? 0,
        destination_name: r.destination_name ?? "",
      })),
    );
    downloadText(csv, `sales_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function submit() {
    if (productId === "none") {
      toast.error("Choisis un produit");
      return;
    }
    const qNum = Number(qty);
    const pNum = Number(unitPrice);
    if (!Number.isFinite(qNum) || qNum <= 0) return toast.error("Quantité invalide");
    if (!Number.isFinite(pNum) || pNum < 0) return toast.error("Prix invalide");

    setSaving(true);
    try {
      await createSale({
        sale_date: saleDate,
        territory_code: territoryCode,
        client_id: clientId === "none" ? null : clientId,
        product_id: productId,
        destination_id: destinationId === "none" ? null : destinationId,
        quantity: qNum,
        unit_price_ht: pNum,
      });
      toast.success("Vente ajoutée");
      setQty("1");
      setUnitPrice("0");
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur ajout vente");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette vente ?")) return;
    try {
      await deleteSale(id);
      toast.success("Vente supprimée");
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur suppression");
    }
  }

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Données</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Ventes
            </h1>
            <p className="text-sm text-muted-foreground">
              Source: <code className="text-xs">public.sales</code> (HT/TVA/TTC calculés)
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={isLoading || filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("certaines") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        {/* Saisie */}
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
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name ?? c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Produit</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choisir un produit…</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.libelle_article ?? p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                TVA auto via <code>vat_rates</code> + <code>products.tva_percent</code>. Si TVA inconnue : EXO.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Destination (optionnel)</Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name ?? d.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Requis pour estimer le transport DHL.</p>
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
              <Button onClick={submit} disabled={saving || productId === "none"}>
                <Plus className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recherche + totals */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche (territoire, client, produit, catégorie TVA…)" />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Lignes: {filtered.length}</Badge>
            <Badge variant="secondary">HT: {money(totalHt)}</Badge>
            <Badge variant="secondary">TVA: {money(totalVat)}</Badge>
            <Badge variant="secondary">TTC: {money(totalTtc)}</Badge>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Dernières ventes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-left font-medium">Date</th>
                  <th className="py-2 text-left font-medium">Territoire</th>
                  <th className="py-2 text-left font-medium">Destination</th>
                  <th className="py-2 text-left font-medium">Client</th>
                  <th className="py-2 text-left font-medium">Produit</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">PU HT</th>
                  <th className="py-2 text-right font-medium">HT</th>
                  <th className="py-2 text-right font-medium">TVA</th>
                  <th className="py-2 text-right font-medium">TTC</th>
                  <th className="py-2 text-left font-medium">Cat.</th>
                  <th className="py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="py-3 text-muted-foreground" colSpan={12}>Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="py-3 text-muted-foreground" colSpan={12}>Aucune donnée.</td></tr>
                ) : (
                  filtered.slice(0, 200).map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">{r.sale_date ?? "—"}</td>
                      <td className="py-2">{r.territory_label ?? r.territory_code ?? "—"}</td>
                      <td className="py-2">{r.destination_name ?? "—"}</td>
                      <td className="py-2">{r.client_name ?? "—"}</td>
                      <td className="py-2">{r.product_name ?? "—"}</td>
                      <td className="py-2 text-right">{Number(r.quantity ?? 0).toLocaleString("fr-FR")}</td>
                      <td className="py-2 text-right">{money(r.unit_price_ht)}</td>
                      <td className="py-2 text-right">{money(r.amount_ht)}</td>
                      <td className="py-2 text-right">{money(r.vat_amount)}</td>
                      <td className="py-2 text-right">{money(r.amount_ttc)}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{r.vat_category ?? "—"}</Badge>
                      </td>
                      <td className="py-2">
                        <Button size="sm" variant="outline" onClick={() => void remove(r.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Suppr.
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
