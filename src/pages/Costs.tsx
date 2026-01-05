import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Receipt, Truck, Plane } from "lucide-react";
import { useCosts } from "@/hooks/useCosts";
import { supabase } from "@/integrations/supabase/client";
import { useDhlSalesQuotes } from "@/hooks/useDhlSalesQuotes";

type PricingSummary = { territory: string; skuCount: number; avgPlv: number };

const DROM = ["GP", "MQ", "GF", "RE", "YT"];

function formatMoney(n: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
}

function zoneForDestination(dest: string) {
  const up = dest.toUpperCase();
  if (DROM.includes(up)) return "DROM";
  if (up === "FR") return "FR";
  return "UE";
}

export default function Costs() {
  const { rows, isLoading, error, warning, refresh } = useCosts();
  const [destinations, setDestinations] = React.useState<{ id: string; name: string | null }[]>([]);
  const [dhlDestinationId, setDhlDestinationId] = React.useState<string>("all");

  const { data: dhlQuotes, loading: dhlLoading, error: dhlError, refetch: refetchDhl } = useDhlSalesQuotes({
    destinationId: dhlDestinationId === "all" ? undefined : dhlDestinationId,
  });

  // Recherche charges
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((r: any) => {
      const hay = [
        r.cost_type,
        r.market_zone,
        r.destination,
        r.incoterm,
        r.client_id,
        r.product_id,
        r.order_id, // ✅ nouveau
        r.currency,
        r.date,
        String(r.amount ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [rows, q]);

  const total = React.useMemo(
    () => filtered.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0),
    [filtered]
  );

  function exportChargesCsv() {
    const csv = toCsv(
      filtered.map((r: any) => ({
        date: r.date ?? "",
        cost_type: r.cost_type ?? "",
        amount: r.amount ?? 0,
        currency: r.currency ?? "",
        market_zone: r.market_zone ?? "",
        destination: r.destination ?? "",
        incoterm: r.incoterm ?? "",
        order_id: r.order_id ?? "", // ✅ nouveau
        client_id: r.client_id ?? "",
        product_id: r.product_id ?? "",
      }))
    );

    downloadText(csv, `costs_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  React.useEffect(() => {
    supabase
      .from("export_destinations")
      .select("id,name")
      .order("name", { ascending: true })
      .limit(1000)
      .then(({ data, error: destError }) => {
        if (!destError && data) setDestinations(data as any);
      })
      .catch(console.error);
  }, []);

  const dhlTotal = React.useMemo(
    () => dhlQuotes.reduce((s, q) => s + (Number(q.dhl_transport_eur) || 0), 0),
    [dhlQuotes]
  );

  function exportDhlCsv() {
    if (!dhlQuotes.length) return;
    const csv = toCsv(
      dhlQuotes.map((q) => ({
        sale_id: q.sale_id ?? "",
        sale_date: q.sale_date ?? "",
        destination_name: q.destination_name ?? "",
        dhl_zone: q.dhl_zone ?? "",
        quantity: q.quantity ?? "",
        total_actual_weight_kg: q.total_actual_weight_kg ?? "",
        dhl_transport_eur: q.dhl_transport_eur ?? "",
      }))
    );
    downloadText(csv, `dhl_quotes_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // -------------------- FORM: TRANSPORT + DOSSIER (par commande) --------------------
  const [orderId, setOrderId] = React.useState("");
  const [transportAmount, setTransportAmount] = React.useState<number | "">("");
  const [dossierAmount, setDossierAmount] = React.useState<number | "">("");
  const [currency, setCurrency] = React.useState("EUR");
  const [marketZone, setMarketZone] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [incoterm, setIncoterm] = React.useState("");
  const [isSavingOrderCharges, setIsSavingOrderCharges] = React.useState(false);

  async function addOrderCharges() {
    const oid = orderId.trim();
    if (!oid) {
      alert("Merci de renseigner un ID de commande.");
      return;
    }
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("v_export_pricing")
          .select("territory_code,plv_metropole_ttc,plv_om_ttc,sku")
          .limit(5000);
        if (error) throw error;
        const agg = new Map<string, { sum: number; count: number }>();
        (data || []).forEach((r: any) => {
          const terr = r.territory_code || "FR";
          const val = Number(r.plv_om_ttc ?? r.plv_metropole_ttc ?? 0) || 0;
          const cur = agg.get(terr) || { sum: 0, count: 0 };
          cur.sum += val;
          cur.count += 1;
          agg.set(terr, cur);
        });
        const res: PricingSummary[] = Array.from(agg.entries()).map(([territory, v]) => ({
          territory,
          skuCount: v.count,
          avgPlv: v.count ? v.sum / v.count : 0,
        }));
        setPricingDashboard(res);
      } catch (err: any) {
        setPricingWarning(err?.message || "Erreur lecture v_export_pricing");
      }
    };
    void load();
  }, []);

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Coûts export</p>
            <h1 className="text-2xl font-bold">Calcul coût par destination</h1>
            <p className="text-sm text-muted-foreground">Choisis un produit, une destination, et vois le détail des dépenses.</p>
          </div>
        </div>

        {/* ERRORS */}
        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        {/* DHL ESTIMATION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Estimation DHL (Economy Select • Export)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={dhlDestinationId}
                  onChange={(e) => setDhlDestinationId(e.target.value)}
                >
                  <option value="all">Toutes</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name ?? d.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={refetchDhl} disabled={dhlLoading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${dhlLoading ? "animate-spin" : ""}`} />
                  Actualiser DHL
                </Button>
                <Button variant="outline" onClick={exportDhlCsv} disabled={dhlLoading || dhlQuotes.length === 0} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export DHL (CSV)
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Lignes: {dhlQuotes.length}</Badge>
              <Badge variant="secondary">Total estimé: {Math.round(dhlTotal).toLocaleString("fr-FR")} €</Badge>
            </div>

            {dhlError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4 text-sm text-foreground">{dhlError}</CardContent>
              </Card>
            ) : null}

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Vente</th>
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-left font-medium">Destination</th>
                    <th className="py-2 text-left font-medium">Zone DHL</th>
                    <th className="py-2 text-right font-medium">Qté</th>
                    <th className="py-2 text-right font-medium">Poids (kg)</th>
                    <th className="py-2 text-right font-medium">Transport (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {dhlLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : dhlQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Pas de devis DHL : vérifier destination_id, mapping zone, poids produit.
                      </td>
                    </tr>
                  ) : (
                    dhlQuotes.map((q) => (
                      <tr key={q.sale_id} className="border-b last:border-0">
                        <td className="py-2">{q.sale_id ?? "—"}</td>
                        <td className="py-2">{q.sale_date ?? "—"}</td>
                        <td className="py-2">{q.destination_name ?? "—"}</td>
                        <td className="py-2">{q.dhl_zone ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{q.quantity ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{q.total_actual_weight_kg ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{(q.dhl_transport_eur ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 1) PRIX (v_export_pricing) */}
        <Card>
          <CardHeader>
            <CardTitle>Prix catalogue (export par territoire)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Territoire</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={pricingTerritory}
                  onChange={(e) => setPricingTerritory(e.target.value)}
                >
                  {TERRITORIES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={exportPricingCsv} disabled={isExportPricing} className="gap-2">
                  <Download className="h-4 w-4" />
                  {isExportPricing ? "Export..." : "Exporter le catalogue (CSV)"}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Exporte tout le catalogue depuis <code className="text-xs">v_export_pricing</code> (TVA, OM/OMR, TR/LPPR majoré, concurrents).
            </p>
          </CardContent>
        </Card>

        {/* 2) TRANSPORT / DOSSIER (par commande) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Transport & traitement de dossier (par commande)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">ID commande</p>
                <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Ex: CMD-2026-0001" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Devise</p>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" />
              </div>

              <div>
                <div className="font-semibold">Mode dégradé</div>
                <p>{productsError || settingsWarning}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres</CardTitle>
              <CardDescription>Produit catalogue + destination + incoterm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recherche produit (catalogue)</p>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Réf / libellé..." />
                  <div className="border rounded-md max-h-40 overflow-auto mt-2">
                    {productsLoading ? (
                      <p className="text-xs text-muted-foreground p-2">Chargement catalogue...</p>
                    ) : filteredProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Aucun produit.</p>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-muted ${selectedSku === p.id ? "bg-muted" : ""}`}
                          onClick={() => setSelectedSku(p.id)}
                        >
                          <div className="font-semibold">{p.code_article}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.libelle_article}</div>
                          <div className="text-xs text-muted-foreground">Prix: {formatMoney(safeNumber(p.tarif_catalogue_2025) || safeNumber(p.tarif_lppr_eur) || 0)}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Destination</p>
                    <select className="w-full h-10 rounded-md border px-3 text-sm" value={destination} onChange={(e) => setDestination(e.target.value)}>
                      {["FR", ...DROM, "UE"].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <div className="text-[11px] text-muted-foreground mt-1">Zone: {zoneForDestination(destination)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Incoterm</p>
                    <select className="w-full h-10 rounded-md border px-3 text-sm" value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
                      {["EXW", "FCA", "DAP", "DDP"].map((i) => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Quantité</p>
                    <Input type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Résultat détaillé</CardTitle>
              <CardDescription>Coût total expédier vers {destination}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Valeur marchandise" value={formatMoney(estimator.goodsValue)} />
                <Stat label="Poids estimé" value={`${(estimator.weightKg || 0).toFixed(2)} kg`} />
                <Stat label="Transport estimé" value={formatMoney(estimator.transport)} />
                <Stat label="Taxes (TVA + locales)" value={`${formatMoney(estimator.taxes)} (${estimator.vatRate + estimator.localTaxRate}% )`} />
                <Stat label="Frais fixes" value={formatMoney(estimator.fees)} />
                <Stat label="Coût total" value={formatMoney(estimator.totalCost)} accent />
              </div>
              <p className="text-xs text-muted-foreground">Basé sur settings: transport zones, TVA/localTaxes, frais fixes.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard charges (catalogue export)</CardTitle>
            <CardDescription>Depuis v_export_pricing (fallback si Edge Function HS).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pricingWarning ? <p className="text-sm text-amber-600">{pricingWarning}</p> : null}
            <div className="grid gap-3 md:grid-cols-3">
              {pricingDashboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée.</p>
              ) : (
                pricingDashboard.map((row) => (
                  <div key={row.territory} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{row.territory}</span>
                      <Badge variant="outline">{row.skuCount} SKU</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">PLV moyenne: {formatMoney(row.avgPlv)}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "bg-primary/5 border-primary/40" : "bg-muted/30"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
