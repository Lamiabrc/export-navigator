import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProducts, safeNumber, type ProductRow } from "@/hooks/useProducts";
import { useExportSettings } from "@/hooks/useExportSettings";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

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
  const { products, isLoading: productsLoading, error: productsError } = useProducts({ pageSize: 2000 });
  const { settings, warning: settingsWarning } = useExportSettings();

  const [search, setSearch] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState<string>("");
  const [qty, setQty] = React.useState<number>(1);
  const [destination, setDestination] = React.useState<string>("GP");
  const [incoterm, setIncoterm] = React.useState<string>("DAP");

  const product = React.useMemo(() => products.find((p) => p.id === selectedSku || p.code_article === selectedSku), [products, selectedSku]);

  const estimator = React.useMemo(() => {
    const unitPrice = product ? safeNumber(product.tarif_catalogue_2025) || safeNumber(product.tarif_lppr_eur) : 0;
    const weightKg = product ? safeNumber(product.unite_vente_poids_brut_g) / 1000 : 0;
    const goodsValue = Math.max(0, unitPrice * Math.max(1, qty));

    const zone = zoneForDestination(destination);
    const vatRate = settings.vat[destination] ?? settings.vat[zone] ?? 0;
    const localTaxRate = settings.localTaxes[destination] ?? settings.localTaxes[zone] ?? 0;
    const transportConf = settings.transport_estimation?.zones?.[zone] || { base: 30, perKg: 2 };
    const transport = transportConf.base + transportConf.perKg * (weightKg || 1) * Math.max(1, qty);
    const fees = settings.fees.transport_per_order_eur + settings.fees.dossier_per_order_eur;

    const taxes = goodsValue * (vatRate / 100) + goodsValue * (localTaxRate / 100);
    const totalCost = goodsValue + transport + taxes + fees;

    return {
      goodsValue,
      vatRate,
      localTaxRate,
      transport,
      fees,
      taxes,
      totalCost,
      weightKg: weightKg * Math.max(1, qty),
    };
  }, [product, qty, destination, settings]);

  const filteredProducts = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 200);
    return products.filter((p) => {
      const hay = [p.code_article, p.libelle_article, (p as any).classement_produit_libelle].join(" ").toLowerCase();
      return hay.includes(q);
    }).slice(0, 200);
  }, [products, search]);

  const [pricingDashboard, setPricingDashboard] = React.useState<PricingSummary[]>([]);
  const [pricingWarning, setPricingWarning] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!SUPABASE_ENV_OK) {
      setPricingWarning("Supabase non configuré, dashboard charges en mode dégradé.");
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

        {(productsError || settingsWarning) && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-4 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
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
