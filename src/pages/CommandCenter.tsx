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
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { SvgMapWorld } from "@/components/dashboard/SvgMapWorld";

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];

type CompetitorRow = {
  sku: string;
  label: string | null;
  territory: string;
  ourPrice: number | null;
  bestPrice: number | null;
  bestName: string | null;
  gapPct: number | null;
};

const SQL_FIX_ACL7 = `-- Corrige les vues pour éviter l'erreur acl7_norm
-- Exemple : remplacer toute référence à acl7_norm par acl_norm ou valeur par défaut
-- Adapter selon votre schéma :
-- alter view public.v_export_pricing rename column acl7_norm to acl_norm;`;

function formatMoney(n: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(n);
}

export default function CommandCenter() {
  const [activeTab, setActiveTab] = React.useState<"overview" | "drom" | "lab" | "concurrents" | "settings">("overview");
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
  const debugEnabled = React.useMemo(() => typeof window !== "undefined" && window.location.search.includes("debug=1"), []);
  const todayIso = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultFrom = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const effectiveFrom = filters.from || defaultFrom;
  const effectiveTo = filters.to || todayIso;
  const territories = React.useMemo(() => {
    if (filters.dromOnly) return DROM_CODES;
    if (!filters.territories.trim()) return undefined;
    return filters.territories.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  }, [filters.dromOnly, filters.territories]);

  const { state: salesState, aggregates } = useDashboardData(
    {
      from: effectiveFrom,
      to: effectiveTo,
      territories,
      client: filters.client || undefined,
      product: filters.product || undefined,
    },
    settings,
  );
  const [competitionRows, setCompetitionRows] = React.useState<CompetitorRow[]>([]);
  const [competitionError, setCompetitionError] = React.useState<string | null>(null);
  const [competitionLoading, setCompetitionLoading] = React.useState(false);
  const selectedTerritory = React.useMemo(() => {
    const t = (filters.territories || "").split(",").map((v) => v.trim()).filter(Boolean);
    return t.length ? t[0] : null;
  }, [filters.territories]);

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

  const mapData = React.useMemo(() => {
    const res: Record<string, { ca_ht: number; ca_ttc: number; vat: number; lines: number }> = {};
    aggregates.byTerritory.forEach((v, code) => {
      if (code === "FR" || code === "HUB") return;
      res[code] = { ca_ht: v.ca, ca_ttc: v.ca + v.taxes, vat: v.taxes, lines: v.count };
    });
    return res;
  }, [aggregates.byTerritory]);

  const handleSelectTerritory = React.useCallback(
    (code: string | null) => {
      if (!code) {
        setFilters((prev) => ({ ...prev, territories: "", dromOnly: prev.dromOnly }));
        return;
      }
      setFilters((prev) => ({ ...prev, territories: code, dromOnly: false }));
    },
    [setFilters],
  );

  React.useEffect(() => {
    let active = true;
    const loadCompetition = async () => {
      if (!SUPABASE_ENV_OK) {
        setCompetitionError("Supabase non configuré (SUPABASE_ENV_OK=false)");
        return;
      }
      setCompetitionLoading(true);
      setCompetitionError(null);
      try {
        const { data, error } = await supabase
          .from("v_export_pricing")
          .select("sku,label,territory_code,plv_metropole_ttc,plv_om_ttc,thuasne_price_ttc,donjoy_price_ttc,gibaud_price_ttc")
          .in("territory_code", DROM_CODES)
          .limit(4000);
        if (!active) return;
        if (error) throw error;

        const mapped: CompetitorRow[] = (data || []).map((r: any) => {
          const our = Number(r.plv_om_ttc ?? r.plv_metropole_ttc ?? null);
          const competitors = [
            { name: "Thuasne", price: Number(r.thuasne_price_ttc ?? NaN) },
            { name: "Donjoy", price: Number(r.donjoy_price_ttc ?? NaN) },
            { name: "Gibaud", price: Number(r.gibaud_price_ttc ?? NaN) },
          ].filter((c) => Number.isFinite(c.price)) as { name: string; price: number }[];
          const best =
            competitors.length > 0
              ? competitors.reduce((m, c) => (c.price < m.price ? c : m), competitors[0])
              : null;
          const gapPct = our && best ? ((our - best.price) / best.price) * 100 : null;
          return {
            sku: r.sku,
            label: r.label,
            territory: r.territory_code,
            ourPrice: our || null,
            bestPrice: best?.price ?? null,
            bestName: best?.name ?? null,
            gapPct,
          };
        });
        setCompetitionRows(mapped);
      } catch (err: any) {
        if (!active) return;
        setCompetitionError(err?.message || "Erreur chargement v_export_pricing");
        setCompetitionRows([]);
      } finally {
        if (active) setCompetitionLoading(false);
      }
    };
    void loadCompetition();
    return () => {
      active = false;
    };
  }, []);

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

  const competitorsByTerritory = React.useMemo(() => {
    const map = new Map<string, { count: number; avgGap: number | null; premium: number; under: number }>();
    DROM_CODES.forEach((code) => map.set(code, { count: 0, avgGap: null, premium: 0, under: 0 }));
    competitionRows.forEach((row) => {
      const entry = map.get(row.territory) || { count: 0, avgGap: null, premium: 0, under: 0 };
      entry.count += 1;
      if (row.gapPct !== null && Number.isFinite(row.gapPct)) {
        entry.avgGap = entry.avgGap === null ? row.gapPct : entry.avgGap + row.gapPct;
        if (row.gapPct > 5) entry.premium += 1;
        if (row.gapPct < -5) entry.under += 1;
      }
      map.set(row.territory, entry);
    });
    return Array.from(map.entries()).map(([territory, v]) => ({
      territory,
      count: v.count,
      avgGap: v.avgGap !== null && v.count > 0 ? v.avgGap / v.count : null,
      premium: v.premium,
      under: v.under,
    }));
  }, [competitionRows]);

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
              {salesState.demo ? <p className="text-xs text-muted-foreground">Données demo affichées faute de table sales.</p> : null}
            </div>
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drom">DROM Focus</TabsTrigger>
            <TabsTrigger value="lab">Scenario Lab</TabsTrigger>
            <TabsTrigger value="concurrents">Concurrents</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <FiltersBar value={filters} onChange={setFilters} onRefresh={() => null} />
            <SvgMapWorld
              dataByTerritory={mapData}
              selectedTerritory={selectedTerritory}
              onSelectTerritory={handleSelectTerritory}
              dateRangeLabel={`${effectiveFrom} → ${effectiveTo}`}
            />
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

          <TabsContent value="concurrents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Positionnement prix (DROM)</CardTitle>
                <CardDescription>Données via v_export_pricing. Mode dégradé si vue absente.</CardDescription>
              </CardHeader>
              <CardContent>
                {competitionLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                ) : competitionError ? (
                  <p className="text-sm text-rose-600">{competitionError}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {competitorsByTerritory.map((c) => (
                      <div key={c.territory} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{c.territory}</div>
                          <Badge variant="outline">{c.count} SKU</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Gap moyen: {c.avgGap === null ? "n/a" : `${c.avgGap.toFixed(1)}%`}
                        </div>
                        <div className="text-xs text-muted-foreground">Premium: {c.premium} / Sous-prix: {c.under}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top écarts (DROM)</CardTitle>
              </CardHeader>
              <CardContent>
                {competitionRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
                ) : (
                  <div className="space-y-2">
                    {competitionRows
                      .filter((r) => r.gapPct !== null)
                      .sort((a, b) => (b.gapPct || 0) - (a.gapPct || 0))
                      .slice(0, 12)
                      .map((r) => (
                        <div key={`${r.sku}-${r.territory}`} className="rounded border px-3 py-2 flex items-center justify-between">
                          <div>
                            <div className="font-mono text-xs text-muted-foreground">{r.sku}</div>
                            <div className="text-sm font-semibold">{r.label || "Produit"}</div>
                            <div className="text-xs text-muted-foreground">Territoire: {r.territory}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{r.gapPct !== null ? `${r.gapPct.toFixed(1)}%` : "n/a"}</div>
                            <div className="text-xs text-muted-foreground">Best: {r.bestName || "n/a"} {r.bestPrice ? formatMoney(r.bestPrice) : ""}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
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
      {debugEnabled ? (
        <div className="fixed bottom-4 left-4 z-50 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-lg space-y-1">
          <div className="font-semibold">DEBUG sales</div>
          <div>rows: {salesState.rows.length}</div>
          <div>from: {effectiveFrom} / to: {effectiveTo}</div>
          <div>first: {salesState.rows[0]?.sale_date || "n/a"}</div>
          <div>last: {salesState.rows[salesState.rows.length - 1]?.sale_date || "n/a"}</div>
          {salesState.warning ? <div className="text-amber-300">warn: {salesState.warning}</div> : null}
        </div>
      ) : null}
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
