import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

type CompetitorPrice = { name: string; price: number };

type PositionRow = {
  productId: string;
  sku: string;
  label: string | null;
  territory: string;

  ourPrice: number | null;
  competitors: CompetitorPrice[];
  bestCompetitor: CompetitorPrice | null;

  gapPct: number | null; // vs best competitor
  status: "too_expensive" | "aligned" | "too_low" | "missing_data";

  rank: number | null; // 1 = moins cher
  competitorCount: number;
};

const BAR_PALETTE = ["#0ea5e9", "#a855f7", "#f97316", "#22c55e", "#e11d48"];

function toNum(v: any): number | null {
  // IMPORTANT: éviter Number(null) => 0 (sinon tu affiches des 0€ fantômes)
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const money = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

function computeRank(our: number, comps: CompetitorPrice[]) {
  const lower = comps.filter((c) => c.price < our).length;
  return 1 + lower;
}

function median(values: number[]) {
  if (!values.length) return null;
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 0) return (arr[mid - 1] + arr[mid]) / 2;
  return arr[mid];
}

function bucketLabel(gap: number) {
  if (gap <= -10) return "<= -10%";
  if (gap < -5) return "-10 à -5%";
  if (gap <= 5) return "-5 à +5%";
  if (gap < 10) return "+5 à +10%";
  return ">= +10%";
}

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const [rows, setRows] = React.useState<PositionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [territory, setTerritory] = React.useState(variables.territory_code || "FR");
  const [selectedSku, setSelectedSku] = React.useState<string>("");

  // Seuils “action”
  const [premiumThreshold, setPremiumThreshold] = React.useState<number>(10); // +10%
  const [underpricedThreshold, setUnderpricedThreshold] = React.useState<number>(10); // -10%

  React.useEffect(() => {
    if (variables.territory_code) setTerritory(variables.territory_code);
  }, [variables.territory_code]);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        setError("Supabase non configuré (SUPABASE_ENV_OK=false).");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 1) Base = product_prices (territoire)
        const { data: prices, error: pErr } = await supabase
          .from("product_prices")
          .select("product_id, territory_code, plv_metropole_ttc, plv_om_ttc, thuasne_price_ttc, donjoy_price_ttc, gibaud_price_ttc")
          .eq("territory_code", territory)
          .limit(5000);

        if (!active) return;
        if (pErr) throw pErr;

        const priceRows = (prices || []) as any[];
        const productIds = Array.from(new Set(priceRows.map((r) => r.product_id).filter(Boolean)));

        // 2) produits (SKU + libellé)
        const { data: products, error: prodErr } = await supabase
          .from("products")
          .select("id, code_article, libelle_article")
          .in("id", productIds)
          .limit(5000);

        if (!active) return;
        if (prodErr) throw prodErr;

        const prodMap = new Map<string, { sku: string; label: string | null }>();
        (products || []).forEach((p: any) => {
          if (p?.id) prodMap.set(p.id, { sku: p.code_article || p.id, label: p.libelle_article || null });
        });

        // 3) Mapping “actionnable”
        const mapped: PositionRow[] = priceRows
          .map((r) => {
            const p = prodMap.get(r.product_id);
            const sku = p?.sku || r.product_id;
            const label = p?.label || null;

            const terr = (r.territory_code || territory || "FR").toUpperCase();

            const ourPrice =
              terr === "FR"
                ? toNum(r.plv_metropole_ttc)
                : (toNum(r.plv_om_ttc) ?? toNum(r.plv_metropole_ttc));

            const competitorsAll = [
              { name: "Thuasne", price: toNum(r.thuasne_price_ttc) },
              { name: "Donjoy", price: toNum(r.donjoy_price_ttc) },
              { name: "Gibaud", price: toNum(r.gibaud_price_ttc) },
            ];

            const competitors = competitorsAll
              .filter((c) => c.price !== null)
              .map((c) => ({ name: c.name, price: c.price as number }));

            const bestCompetitor =
              competitors.length > 0
                ? competitors.reduce((m, c) => (c.price < m.price ? c : m), competitors[0])
                : null;

            const gapPct =
              ourPrice !== null && bestCompetitor
                ? ((ourPrice - bestCompetitor.price) / bestCompetitor.price) * 100
                : null;

            let status: PositionRow["status"] = "missing_data";
            if (gapPct !== null) {
              if (gapPct >= premiumThreshold) status = "too_expensive";
              else if (gapPct <= -underpricedThreshold) status = "too_low";
              else status = "aligned";
            }

            const rank =
              ourPrice !== null && competitors.length > 0 ? computeRank(ourPrice, competitors) : null;

            return {
              productId: r.product_id,
              sku,
              label,
              territory: terr,
              ourPrice,
              competitors,
              bestCompetitor,
              gapPct,
              status,
              rank,
              competitorCount: competitors.length,
            };
          })
          .sort((a, b) => (a.sku || "").localeCompare(b.sku || ""));

        setRows(mapped);
        if (selectedSku && !mapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
      } catch (err: any) {
        console.error("Chargement concurrence échoué", err);
        if (!active) return;
        setError(err?.message || "Erreur chargement concurrence (product_prices)");
        setRows([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory, premiumThreshold, underpricedThreshold]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.sku + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rows, search]);

  const selected = React.useMemo(() => {
    if (!selectedSku) return null;
    return rows.find((r) => r.sku === selectedSku) || null;
  }, [rows, selectedSku]);

  const kpis = React.useMemo(() => {
    const base = filtered;
    const total = base.length;

    const missingOurPrice = base.filter((r) => r.ourPrice === null || (r.ourPrice ?? 0) <= 0).length;
    const withCompetitor = base.filter((r) => r.competitorCount > 0).length;

    const tooExpensive = base.filter((r) => r.status === "too_expensive").length;
    const tooLow = base.filter((r) => r.status === "too_low").length;
    const aligned = base.filter((r) => r.status === "aligned").length;
    const missingData = base.filter((r) => r.status === "missing_data").length;

    const gaps = base.filter((r) => r.gapPct !== null).map((r) => r.gapPct as number);
    const medGap = median(gaps);

    return {
      total,
      missingOurPrice,
      withCompetitor,
      tooExpensive,
      tooLow,
      aligned,
      missingData,
      medGap,
    };
  }, [filtered]);

  const gapBuckets = React.useMemo(() => {
    const base = filtered;
    const buckets = new Map<string, number>();
    const ensure = (k: string) => buckets.set(k, buckets.get(k) ?? 0);

    ["<= -10%", "-10 à -5%", "-5 à +5%", "+5 à +10%", ">= +10%", "n/a"].forEach(ensure);

    base.forEach((r) => {
      if (r.gapPct === null) buckets.set("n/a", (buckets.get("n/a") ?? 0) + 1);
      else buckets.set(bucketLabel(r.gapPct), (buckets.get(bucketLabel(r.gapPct)) ?? 0) + 1);
    });

    return Array.from(buckets.entries()).map(([label, count]) => ({ label, count }));
  }, [filtered]);

  const topActions = React.useMemo(() => {
    const base = filtered.filter((r) => r.gapPct !== null);
    const premium = [...base].sort((a, b) => (b.gapPct as number) - (a.gapPct as number)).slice(0, 10);
    const under = [...base].sort((a, b) => (a.gapPct as number) - (b.gapPct as number)).slice(0, 10);
    return { premium, under };
  }, [filtered]);

  const priceBarsForSelected = React.useMemo(() => {
    if (!selected) return [];
    const bars: { name: string; price: number }[] = [];
    if (selected.ourPrice !== null) bars.push({ name: "Orliman", price: selected.ourPrice });
    selected.competitors.forEach((c) => bars.push({ name: c.name, price: c.price }));
    return bars;
  }, [selected]);

  const pct = (part: number, total: number) => {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  };

  return (
    <MainLayout contentClassName="md:p-6 bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">Concurrence & décision prix</p>
            <h1 className="text-3xl font-bold text-slate-900">Concurrence (actionnable)</h1>
            <p className="text-sm text-slate-600">
              Source: <span className="font-mono">product_prices</span> + <span className="font-mono">products</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Select value={territory} onValueChange={setTerritory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Territoire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FR">Métropole (FR)</SelectItem>
                <SelectItem value="GP">Guadeloupe (GP)</SelectItem>
                <SelectItem value="MQ">Martinique (MQ)</SelectItem>
                <SelectItem value="GF">Guyane (GF)</SelectItem>
                <SelectItem value="RE">Réunion (RE)</SelectItem>
                <SelectItem value="YT">Mayotte (YT)</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtre (SKU ou libellé)"
              className="w-[260px]"
            />

            <Select value={selectedSku} onValueChange={setSelectedSku}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Choisir un produit (SKU)" />
              </SelectTrigger>
              <SelectContent>
                {filtered.slice(0, 800).map((r) => (
                  <SelectItem key={r.sku} value={r.sku}>
                    {r.sku} — {(r.label || "Produit").slice(0, 42)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="text-sm text-red-600">{error}</div>
            </CardContent>
          </Card>
        ) : null}

        {/* SEUILS */}
        <Card className="border-transparent shadow bg-gradient-to-r from-slate-50 via-white to-sky-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Seuils d’action</CardTitle>
            <CardDescription>Tu pilotes ce que l’écran considère “trop cher” / “trop bas”.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Trop cher si gap ≥</div>
              <Input
                type="number"
                value={premiumThreshold}
                onChange={(e) => setPremiumThreshold(Number(e.target.value) || 10)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Trop bas si gap ≤ -</div>
              <Input
                type="number"
                value={underpricedThreshold}
                onChange={(e) => setUnderpricedThreshold(Number(e.target.value) || 10)}
                className="h-9"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={() => { setPremiumThreshold(10); setUnderpricedThreshold(10); }}>
                Reset 10/10
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI ACTIONNABLES */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Card className="border-transparent shadow bg-gradient-to-br from-sky-50 via-white to-sky-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700">Produits (filtrés)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpis.total}</div>
              <div className="text-xs text-muted-foreground">Territoire: {territory}</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-indigo-50 via-white to-indigo-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-indigo-700">Couverture concurrents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-700">{pct(kpis.withCompetitor, kpis.total)}</div>
              <div className="text-xs text-muted-foreground">{kpis.withCompetitor} / {kpis.total}</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-amber-50 via-white to-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-700">Trop cher</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-700">{kpis.tooExpensive}</div>
              <div className="text-xs text-muted-foreground">gap ≥ {premiumThreshold}%</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-emerald-50 via-white to-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-emerald-700">Trop bas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-700">{kpis.tooLow}</div>
              <div className="text-xs text-muted-foreground">gap ≤ -{underpricedThreshold}%</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-rose-50 via-white to-rose-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-rose-700">Gap médian</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-rose-700">
                {kpis.medGap === null ? "—" : `${kpis.medGap.toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">sur produits avec données</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* DÉTAIL PRODUIT */}
          <Card className="border-slate-200 shadow lg:col-span-2">
            <CardHeader>
              <CardTitle>Produit sélectionné</CardTitle>
              <CardDescription>Comparatif Orliman vs meilleurs concurrents (prix TTC).</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedSku ? (
                <div className="text-sm text-muted-foreground">
                  Sélectionne un SKU pour afficher un comparatif décisionnel.
                </div>
              ) : !selected ? (
                <div className="text-sm text-muted-foreground">SKU introuvable dans ce territoire.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{selected.sku}</div>
                      <div className="text-lg font-semibold">{selected.label || "Produit"}</div>
                      <div className="text-sm text-muted-foreground">Territoire: {selected.territory}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          selected.status === "too_expensive"
                            ? "text-amber-600 border-amber-300"
                            : selected.status === "too_low"
                            ? "text-emerald-600 border-emerald-300"
                            : selected.status === "aligned"
                            ? "text-blue-600 border-blue-300"
                            : "text-slate-500 border-slate-300"
                        )}
                      >
                        {selected.status}
                      </Badge>

                      <Badge variant="outline" className="text-slate-700 border-slate-300">
                        Rang Orliman: {selected.rank ?? "—"}
                      </Badge>

                      <Badge variant="outline" className="text-slate-700 border-slate-300">
                        Gap vs best: {selected.gapPct === null ? "—" : `${selected.gapPct.toFixed(1)}%`}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card className="border-slate-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Prix (liste)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Orliman</div>
                          <div className="font-semibold">{money(selected.ourPrice)}</div>
                        </div>

                        {selected.competitors.length ? (
                          selected.competitors
                            .slice()
                            .sort((a, b) => a.price - b.price)
                            .map((c) => (
                              <div key={c.name} className="flex items-center justify-between">
                                <div className="text-sm text-slate-700">{c.name}</div>
                                <div className="text-sm font-medium">{money(c.price)}</div>
                              </div>
                            ))
                        ) : (
                          <div className="text-sm text-muted-foreground">Aucun prix concurrent disponible.</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Comparatif visuel</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[220px]">
                        {priceBarsForSelected.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priceBarsForSelected} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="price" fill={BAR_PALETTE[0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-sm text-muted-foreground">Pas assez de données pour afficher un graphe.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RÉPARTITION DES GAPS (plus utile que rang distribution) */}
          <Card className="border-slate-200 shadow">
            <CardHeader>
              <CardTitle>Répartition des écarts</CardTitle>
              <CardDescription>Combien de SKU tombent dans chaque zone.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gapBuckets} layout="vertical" margin={{ top: 12, right: 24, left: 24, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={90} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                      {gapBuckets.map((_, idx) => (
                        <Cell key={idx} fill={BAR_PALETTE[idx % BAR_PALETTE.length]} />
                      ))}
                    </Bar>
                    <LabelList dataKey="count" position="right" offset={8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="pt-2 text-xs text-muted-foreground">
                “n/a” = prix Orliman ou concurrents manquants.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TOP ACTIONS */}
        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle>Top actions</CardTitle>
            <CardDescription>Les 10 SKU qui bougent le plus la situation (à traiter en priorité).</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold text-amber-700 mb-2">Top 10 trop chers</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                    <TableHead className="text-right">Orliman</TableHead>
                    <TableHead>Best</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topActions.premium.map((r) => (
                    <TableRow key={r.sku} className="cursor-pointer" onClick={() => setSelectedSku(r.sku)}>
                      <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                      <TableCell className="text-right text-amber-700">{r.gapPct === null ? "—" : `${r.gapPct.toFixed(1)}%`}</TableCell>
                      <TableCell className="text-right">{money(r.ourPrice)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!topActions.premium.length ? (
                    <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground text-center">Aucun</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div>
              <div className="text-sm font-semibold text-emerald-700 mb-2">Top 10 trop bas</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                    <TableHead className="text-right">Orliman</TableHead>
                    <TableHead>Best</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topActions.under.map((r) => (
                    <TableRow key={r.sku} className="cursor-pointer" onClick={() => setSelectedSku(r.sku)}>
                      <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                      <TableCell className="text-right text-emerald-700">{r.gapPct === null ? "—" : `${r.gapPct.toFixed(1)}%`}</TableCell>
                      <TableCell className="text-right">{money(r.ourPrice)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!topActions.under.length ? (
                    <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground text-center">Aucun</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* LISTE */}
        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle>Liste (clique pour sélectionner)</CardTitle>
            <CardDescription>Vue complète filtrable.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Orliman</TableHead>
                    <TableHead>Best concurrent</TableHead>
                    <TableHead className="text-right">Gap %</TableHead>
                    <TableHead className="text-right">Rang</TableHead>
                    <TableHead className="text-right"># conc.</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((row) => (
                    <TableRow
                      key={row.sku}
                      className={cn(selectedSku === row.sku ? "bg-slate-50" : "")}
                      onClick={() => setSelectedSku(row.sku)}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                      <TableCell className="font-medium">{row.label || "—"}</TableCell>
                      <TableCell className="text-right">{money(row.ourPrice)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.bestCompetitor ? `${money(row.bestCompetitor.price)} (${row.bestCompetitor.name})` : "—"}
                      </TableCell>
                      <TableCell className={cn("text-right", row.gapPct !== null && row.gapPct >= premiumThreshold ? "text-amber-600" : row.gapPct !== null && row.gapPct <= -underpricedThreshold ? "text-emerald-700" : "text-slate-700")}>
                        {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{row.rank ?? "—"}</TableCell>
                      <TableCell className="text-right">{row.competitorCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            row.status === "too_expensive"
                              ? "text-amber-600 border-amber-300"
                              : row.status === "too_low"
                              ? "text-emerald-600 border-emerald-300"
                              : row.status === "aligned"
                              ? "text-blue-600 border-blue-300"
                              : "text-slate-500 border-slate-300"
                          )}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                        Aucun produit trouvé.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}

            <div className="pt-2 text-xs text-muted-foreground">
              Astuce : la colonne “Top actions” sert à décider vite; la liste sert à vérifier / naviguer.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
