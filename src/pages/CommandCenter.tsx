import * as React from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Calculator, FileCheck2, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useExportSettings } from "@/hooks/useExportSettings";
import { useDashboardData } from "@/hooks/useDashboardData";
import { KpiBar } from "@/components/dashboard/KpiBar";
import { FiltersBar, DashboardFilters } from "@/components/dashboard/FiltersBar";
import { DromTable } from "@/components/dashboard/DromTable";
import { AlertsPanel, AlertItem } from "@/components/dashboard/AlertsPanel";
import { MarginWaterfall } from "@/components/dashboard/MarginWaterfall";
import { TopFlop } from "@/components/dashboard/TopFlop";
import { RiskySales } from "@/components/dashboard/RiskySales";

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];

const SQL_FIX_ACL7 = `-- Corrige les vues pour éviter l'erreur acl7_norm
-- Exemple : remplacer toute référence à acl7_norm par acl_norm ou valeur par défaut
-- Adapter selon votre schéma :
-- alter view public.v_export_pricing rename column acl7_norm to acl_norm;`;

function formatMoney(n: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(n);
}

export default function CommandCenter() {
  const [activeTab, setActiveTab] = React.useState<"overview" | "drom" | "lab" | "settings">("overview");
  const [filters, setFilters] = React.useState<DashboardFilters>({
    from: "",
    to: "",
    territories: "",
    channel: "",
    incoterm: "",
    client: "",
    product: "",
    dromOnly: true,
  });

  const { settings, loading: settingsLoading, warning: settingsWarning, save, DEFAULT_SETTINGS } = useExportSettings();
  const territories = React.useMemo(() => {
    if (filters.dromOnly) return DROM_CODES;
    if (!filters.territories.trim()) return undefined;
    return filters.territories.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  }, [filters.dromOnly, filters.territories]);

  const { state: salesState, aggregates } = useDashboardData(
    {
      from: filters.from || undefined,
      to: filters.to || undefined,
      territories,
      client: filters.client || undefined,
      product: filters.product || undefined,
    },
    settings,
  );

  const kpis = [
    { label: "CA HT", value: formatMoney(aggregates.totalHt), delta: "", accent: "" },
    { label: "CA TTC", value: formatMoney(aggregates.totalTtc), delta: "", accent: "" },
    { label: "Marge €", value: formatMoney(aggregates.totalMargin), delta: `Marge % ${aggregates.marginPct.toFixed(1)}%`, accent: "text-emerald-600" },
    { label: "# Commandes", value: `${aggregates.orders}`, delta: `Panier moyen ${formatMoney(aggregates.avgBasket)}` },
    { label: "Transport", value: formatMoney(aggregates.totalTransport), delta: "" },
    { label: "Taxes", value: formatMoney(aggregates.totalTaxes), delta: "" },
  ];

  const dromRows = Array.from(aggregates.byTerritory.entries())
    .filter(([code]) => DROM_CODES.includes(code))
    .map(([code, v]) => ({
      territory: code,
      ca: v.ca,
      margin: v.margin,
      transport: v.transport,
      taxes: v.taxes,
      contribution: aggregates.totalHt ? (v.ca / aggregates.totalHt) * 100 : 0,
    }));

  const alerts: AlertItem[] = React.useMemo(() => {
    const list: AlertItem[] = [];
    if (aggregates.marginPct < settings.thresholds.marge_min_pct) {
      list.push({ id: "marge", severity: "danger", title: "Marge globale sous seuil", description: `Marge ${aggregates.marginPct.toFixed(1)}% < ${settings.thresholds.marge_min_pct}%`, action: "Revoir remises/transport" });
    }
    if (aggregates.totalTransport / Math.max(1, aggregates.totalHt) * 100 > settings.thresholds.transport_max_pct_du_ca) {
      list.push({ id: "transport", severity: "warning", title: "Transport élevé", description: "Transport/CA dépasse le seuil", action: "Optimiser poids/incoterm" });
    }
    return list;
  }, [aggregates.marginPct, aggregates.totalTransport, aggregates.totalHt, settings.thresholds]);

  const topClients = React.useMemo(() => {
    const map = new Map<string, { ca: number; margin: number }>();
    salesState.rows.forEach((r) => {
      const key = r.client_id || "n/a";
      const cur = map.get(key) || { ca: 0, margin: 0 };
      cur.ca += r.amount_ht || 0;
      cur.margin += r.margin || 0;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, value: v.margin, pct: v.ca ? (v.margin / v.ca) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [salesState.rows]);

  const flopClients = [...topClients].sort((a, b) => a.pct - b.pct);

  const topProducts = React.useMemo(() => {
    const map = new Map<string, { ca: number; margin: number }>();
    salesState.rows.forEach((r) => {
      const key = r.product_ref || "n/a";
      const cur = map.get(key) || { ca: 0, margin: 0 };
      cur.ca += r.amount_ht || 0;
      cur.margin += r.margin || 0;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, value: v.margin, pct: v.ca ? (v.margin / v.ca) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [salesState.rows]);

  const waterfallSteps = [
    { label: "Prix", value: aggregates.totalHt },
    { label: "Transport", value: -aggregates.totalTransport },
    { label: "Taxes", value: -aggregates.totalTaxes },
    { label: "Marge", value: aggregates.totalMargin },
  ];

  const riskyRows = aggregates.riskySales.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    product_ref: r.product_ref,
    amount_ht: r.amount_ht,
    margin: r.margin || ((r.amount_ht || 0) - (r.transport_cost || 0) - (r.taxes || 0)),
    sale_date: r.sale_date,
  }));

  const [labInput, setLabInput] = React.useState({
    territory: "GP",
    product: "",
    qty: 1,
    price: 100,
    discountPct: 0,
    weightKg: 1,
    incoterm: "DAP",
    channel: "direct",
  });

  const labEstimate = React.useMemo(() => {
    const net = labInput.price * (1 - labInput.discountPct / 100) * labInput.qty;
    const tva = net * ((settings.vat[labInput.territory] ?? 0) / 100);
    const localTax = net * ((settings.localTaxes[labInput.territory] ?? 0) / 100);
    const zoneKey = DROM_CODES.includes(labInput.territory) ? "DROM" : "UE";
    const transportConf = settings.transport_estimation?.zones[zoneKey] || { base: 30, perKg: 2 };
    const transport = transportConf.base + transportConf.perKg * labInput.weightKg;
    const fees = settings.fees.transport_per_order_eur + settings.fees.dossier_per_order_eur;
    const totalCost = transport + fees + localTax + tva;
    const margin = net - totalCost;
    return { net, tva, localTax, transport, fees, totalCost, margin, marginPct: net ? (margin / net) * 100 : 0 };
  }, [labInput, settings]);

  const [settingsDraft, setSettingsDraft] = React.useState(JSON.stringify(settings, null, 2));
  React.useEffect(() => {
    setSettingsDraft(JSON.stringify(settings, null, 2));
  }, [settings]);

  const [saveError, setSaveError] = React.useState<string | null>(null);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Cockpit dirigeant Export</p>
            <h1 className="text-2xl font-bold">Command Center</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/simulator">
                <Calculator className="h-4 w-4 mr-2" />
                Simulateur
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/verifier">
                <FileCheck2 className="h-4 w-4 mr-2" />
                Vérifier facture
              </Link>
            </Button>
          </div>
        </div>

        {settingsWarning || salesState.warning ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-semibold">Mode dégradé</div>
              <p>{settingsWarning || salesState.warning}</p>
            </div>
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drom">DROM Focus</TabsTrigger>
            <TabsTrigger value="lab">Scenario Lab</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <FiltersBar value={filters} onChange={setFilters} onRefresh={() => null} />
            <KpiBar items={kpis} />
            <div className="grid gap-4 md:grid-cols-3">
              <MarginWaterfall steps={waterfallSteps} />
              <AlertsPanel alerts={alerts} />
              <RiskySales rows={riskyRows} />
            </div>
            <TopFlop top={topClients} flop={flopClients} />
            <TopFlop top={topProducts} flop={flopClients} />
          </TabsContent>

          <TabsContent value="drom" className="space-y-4">
            <DromTable rows={dromRows} />
            <TopFlop top={topProducts.filter((p) => DROM_CODES.includes((p.label || "").slice(0, 2)))} flop={flopClients} />
          </TabsContent>

          <TabsContent value="lab" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Scenario Lab</CardTitle>
                <CardDescription>Simuler alignement prix / marge</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Territoire</Label>
                  <Input value={labInput.territory} onChange={(e) => setLabInput((v) => ({ ...v, territory: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label className="text-xs">Produit</Label>
                  <Input value={labInput.product} onChange={(e) => setLabInput((v) => ({ ...v, product: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Prix</Label>
                  <Input type="number" value={labInput.price} onChange={(e) => setLabInput((v) => ({ ...v, price: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Remise %</Label>
                  <Input type="number" value={labInput.discountPct} onChange={(e) => setLabInput((v) => ({ ...v, discountPct: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Quantité</Label>
                  <Input type="number" value={labInput.qty} onChange={(e) => setLabInput((v) => ({ ...v, qty: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Poids (kg)</Label>
                  <Input type="number" value={labInput.weightKg} onChange={(e) => setLabInput((v) => ({ ...v, weightKg: Number(e.target.value) }))} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Résultats</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-3">
                <Stat label="Net" value={formatMoney(labEstimate.net)} />
                <Stat label="TVA" value={formatMoney(labEstimate.tva)} />
                <Stat label="Taxes locales" value={formatMoney(labEstimate.localTax)} />
                <Stat label="Transport" value={formatMoney(labEstimate.transport)} />
                <Stat label="Frais fixes" value={formatMoney(labEstimate.fees)} />
                <Stat label="Marge" value={`${formatMoney(labEstimate.margin)} (${labEstimate.marginPct.toFixed(1)}%)`} accent={labEstimate.margin >= 0 ? "text-emerald-600" : "text-rose-600"} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Settings export</CardTitle>
                <CardDescription>Stockés dans export_settings (clé reference_rates:1)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea value={settingsDraft} onChange={(e) => setSettingsDraft(e.target.value)} className="font-mono min-h-[260px]" />
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      try {
                        const parsed = JSON.parse(settingsDraft);
                        await save(parsed);
                        setSaveError(null);
                      } catch (err: any) {
                        setSaveError(err?.message || "Erreur sauvegarde");
                      }
                    }}
                    disabled={settingsLoading}
                  >
                    Sauvegarder
                  </Button>
                  <Button variant="outline" onClick={() => setSettingsDraft(JSON.stringify(DEFAULT_SETTINGS, null, 2))}>Reset défaut</Button>
                </div>
                {saveError ? <p className="text-sm text-rose-600">{saveError}</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">SQL correctifs</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea className="font-mono text-xs min-h-[120px]" value={SQL_FIX_ACL7} readOnly />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${accent || ""}`}>{value}</div>
    </div>
  );
}
