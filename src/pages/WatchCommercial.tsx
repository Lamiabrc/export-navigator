// src/pages/WatchCommercial.tsx
import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  hs4: string | null;

  ourPrice: number | null;

  // concurrents (prix territoire)
  competitors: CompetitorPrice[];
  bestCompetitor: CompetitorPrice | null;

  gapPct: number | null; // vs best competitor
  status: "premium" | "aligned" | "underpriced" | "no_data";

  rank: number | null; // position Orliman (1 = moins cher)
  competitorCount: number;

  // taxes & recommandations
  vatRate: number | null;

  omRateBase: number | null;        // (OM + OMR)
  omRateApplied: number | null;     // omRateBase * 1.025
  extraFee: number;

  lpprMetropole: number | null;
  lpprDrom: number | null;

  recommendedTtc: number | null;

  // analyse Thuasne
  thuasneTerritory: number | null;  // prix thuasne sur territoire
  thuasneFR: number | null;         // prix thuasne FR (catalogue)
  thuasneExpectedDrom: number | null; // FR * 1.02 (si DROM)
  thuasneDeltaVsExpectedPct: number | null; // (territory - expected)/expected
};

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"] as const;

const THUASNE_DROM_UPLIFT_PCT = 2;   // +2%
const OM_UPLIFT_PCT = 2.5;          // +2.5% (multiplicatif)
const THUASNE_TOLERANCE_PCT = 0.5;  // tolérance pour dire "ok" (±0.5%)

const BAR_PALETTE = ["#0ea5e9", "#a855f7", "#f97316", "#22c55e", "#e11d48"];

const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n));
};

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pctFmt(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function computeRank(our: number, comps: CompetitorPrice[]) {
  const lower = comps.filter((c) => c.price < our).length;
  return 1 + lower;
}

function hs4From(hsCode?: string | null, hs4?: string | null) {
  const a = (hs4 || "").trim();
  if (a && a.length >= 4) return a.slice(0, 4);
  const b = (hsCode || "").replace(/\D/g, "");
  if (b.length >= 4) return b.slice(0, 4);
  return null;
}

function statusFromGap(gapPct: number | null): PositionRow["status"] {
  if (gapPct === null) return "no_data";
  if (gapPct > 5) return "premium";
  if (gapPct < -5) return "underpriced";
  return "aligned";
}

function isDrom(territory: string) {
  return DROM_CODES.includes((territory || "").toUpperCase() as any);
}

function safePctDelta(actual: number | null, expected: number | null): number | null {
  if (actual === null || expected === null) return null;
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) return null;
  return ((actual - expected) / expected) * 100;
}

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const [rows, setRows] = React.useState<PositionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [territory, setTerritory] = React.useState<string>(variables.territory_code || "FR");
  const [selectedSku, setSelectedSku] = React.useState<string>("");

  const [extraFees, setExtraFees] = React.useState<Record<string, number>>({
    GP: 0, MQ: 0, GF: 0, RE: 0, YT: 0, FR: 0,
  });

  const handleExtraFeeChange = (code: string, value: string) => {
    const n = Number(value);
    setExtraFees((prev) => ({ ...prev, [code]: Number.isFinite(n) ? n : 0 }));
  };

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
        // 1) Prix sur territoire (source principale)
        const pricesRes = await supabase
          .from("product_prices")
          .select(
            `
            product_id,
            territory_code,
            plv_metropole_ttc,
            plv_om_ttc,
            thuasne_price_ttc,
            donjoy_price_ttc,
            gibaud_price_ttc,
            products:products (
              id,
              code_article,
              libelle_article,
              hs_code,
              hs4,
              tarif_lppr_eur
            )
          `
          )
          .eq("territory_code", territory)
          .limit(5000);

        if (!active) return;
        if (pricesRes.error) throw pricesRes.error;
        const priceData = (pricesRes.data || []) as any[];

        // 1b) Prix Thuasne FR (catalogue) pour calcul "attendu DROM = FR * 1.02"
        const thuasneFRRes = await supabase
          .from("product_prices")
          .select("product_id, thuasne_price_ttc")
          .eq("territory_code", "FR")
          .limit(5000);

        if (!active) return;
        if (thuasneFRRes.error) console.warn("Thuasne FR fetch error", thuasneFRRes.error);

        const thuasneFRMap = new Map<string, number>();
        (thuasneFRRes.data || []).forEach((r: any) => {
          const pid = String(r.product_id || "");
          const v = num(r.thuasne_price_ttc);
          if (pid && v !== null) thuasneFRMap.set(pid, v);
        });

        // 2) LPPR + coefficients de majoration
        const coefRes = await supabase
          .from("lpp_majoration_coefficients")
          .select("territory_code, coef");

        if (coefRes.error) console.warn("LPPR coef fetch error", coefRes.error);

        const coefMap = new Map<string, number>();
        (coefRes.data || []).forEach((c: any) => {
          if (c.territory_code && Number.isFinite(Number(c.coef))) {
            coefMap.set(String(c.territory_code).toUpperCase(), Number(c.coef));
          }
        });

        // 3) TVA
        const vatRes = await supabase.from("vat_rates").select("territory_code, rate");
        if (vatRes.error) console.warn("VAT fetch error", vatRes.error);

        const vatMap = new Map<string, number>();
        (vatRes.data || []).forEach((v: any) => {
          if (v.territory_code && Number.isFinite(Number(v.rate))) {
            vatMap.set(String(v.territory_code).toUpperCase(), Number(v.rate));
          }
        });

        // 4) OM/OMR (table om_rates: hs4 + om_rate + omr_rate + year)
        //    On prend la ligne la + récente par hs4.
        const omRes = await supabase
          .from("om_rates")
          .select("territory_code, hs4, om_rate, omr_rate, year")
          .eq("territory_code", territory)
          .order("year", { ascending: false })
          .limit(5000);

        if (omRes.error) console.warn("OM fetch error", omRes.error);

        const omMap = new Map<string, { baseTotal: number; year: number | null }>();
        (omRes.data || []).forEach((o: any) => {
          const hs4 = String(o.hs4 || "").trim();
          if (!hs4) return;
          if (omMap.has(hs4)) return; // on garde la 1ère (year desc)
          const om = num(o.om_rate) ?? 0;
          const omr = num(o.omr_rate) ?? 0;
          const total = om + omr;
          omMap.set(hs4, { baseTotal: total, year: num(o.year) ?? null });
        });

        // 5) Mapping
        const terr = String(territory).toUpperCase();
        const coef = coefMap.get(terr) ?? 1;
        const vatRate = vatMap.get(terr) ?? null;
        const extraFee = extraFees[terr] ?? 0;

        const mapped: PositionRow[] = priceData
          .map((r: any) => {
            const product = r.products || null;
            const productId = String(r.product_id || product?.id || "");
            const sku = String(product?.code_article || r.sku || "").trim();
            if (!sku || !productId) return null;

            const label = (product?.libelle_article ?? null) as string | null;

            const hs4 = hs4From(product?.hs_code ?? null, product?.hs4 ?? null);
            const omBase = hs4 ? (omMap.get(hs4)?.baseTotal ?? null) : null;
            const omApplied = omBase !== null ? omBase * (1 + OM_UPLIFT_PCT / 100) : null;

            // Notre prix
            const ourPrice =
              terr === "FR"
                ? num(r.plv_metropole_ttc)
                : (num(r.plv_om_ttc) ?? num(r.plv_metropole_ttc));

            // Concurrents (prix territoire)
            const thuasneTerritory = num(r.thuasne_price_ttc);
            const donjoy = num(r.donjoy_price_ttc);
            const gibaud = num(r.gibaud_price_ttc);

            const competitorsAll = [
              { name: "Thuasne", price: thuasneTerritory },
              { name: "Donjoy", price: donjoy },
              { name: "Gibaud", price: gibaud },
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

            const status = statusFromGap(gapPct);

            const rank =
              ourPrice !== null && competitors.length > 0 ? computeRank(ourPrice, competitors) : null;

            // LPPR
            const lpprBase = num(product?.tarif_lppr_eur);
            const lpprDrom = lpprBase !== null ? lpprBase * coef : null;

            // Reco TTC (inclut TVA + OM majoré + frais)
            const tax = ourPrice !== null && vatRate !== null ? (ourPrice * vatRate) / 100 : 0;
            const omAmount = ourPrice !== null && omApplied !== null ? (ourPrice * omApplied) / 100 : 0;
            const recommendedTtc = ourPrice !== null ? ourPrice + tax + omAmount + extraFee : null;

            // Analyse Thuasne
            const thuasneFR = thuasneFRMap.get(productId) ?? null;
            const expectedThuasneDrom =
              isDrom(terr) && thuasneFR !== null ? thuasneFR * (1 + THUASNE_DROM_UPLIFT_PCT / 100) : null;

            const deltaThuasne = safePctDelta(thuasneTerritory, expectedThuasneDrom);

            const out: PositionRow = {
              productId,
              sku,
              label,
              territory: terr,
              hs4,

              ourPrice,

              competitors,
              bestCompetitor,

              gapPct,
              status,

              rank,
              competitorCount: competitors.length,

              vatRate,

              omRateBase: omBase,
              omRateApplied: omApplied,
              extraFee,

              lpprMetropole: lpprBase,
              lpprDrom,

              recommendedTtc,

              thuasneTerritory,
              thuasneFR,
              thuasneExpectedDrom: expectedThuasneDrom,
              thuasneDeltaVsExpectedPct: deltaThuasne,
            };

            return out;
          })
          .filter(Boolean) as PositionRow[];

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
  }, [territory, extraFees]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.sku + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rows, search]);

  const selected = React.useMemo(() => {
    if (!selectedSku) return null;
    return rows.find((r) => r.sku === selectedSku) || null;
  }, [rows, selectedSku]);

  // --- Veille : “Thuasne DROM = FR +2%” -> contrôle de conformité
  const thuasneInsight = React.useMemo(() => {
    if (!isDrom(territory)) {
      return {
        applicable: false,
        coverage: 0,
        ok: 0,
        outliers: 0,
        okPct: null as number | null,
      };
    }
    const withExpected = rows.filter((r) => r.thuasneExpectedDrom !== null && r.thuasneTerritory !== null);
    const coverage = withExpected.length;
    const ok = withExpected.filter((r) => {
      const d = r.thuasneDeltaVsExpectedPct;
      return d !== null && Math.abs(d) <= THUASNE_TOLERANCE_PCT;
    }).length;
    const outliers = coverage - ok;
    const okPct = coverage ? (ok / coverage) * 100 : null;
    return { applicable: true, coverage, ok, outliers, okPct };
  }, [rows, territory]);

  // --- Synthèse “actionnable”
  const actions = React.useMemo(() => {
    const premium = filtered
      .filter((r) => r.gapPct !== null && r.gapPct > 5)
      .sort((a, b) => (b.gapPct as number) - (a.gapPct as number))
      .slice(0, 8);

    const underpriced = filtered
      .filter((r) => r.gapPct !== null && r.gapPct < -5)
      .sort((a, b) => (a.gapPct as number) - (b.gapPct as number))
      .slice(0, 8);

    const thuasneOutliers = filtered
      .filter((r) => r.thuasneDeltaVsExpectedPct !== null)
      .sort((a, b) => Math.abs(b.thuasneDeltaVsExpectedPct as number) - Math.abs(a.thuasneDeltaVsExpectedPct as number))
      .slice(0, 8);

    const missingCompetitor = filtered
      .filter((r) => r.competitorCount === 0)
      .slice(0, 8);

    return { premium, underpriced, thuasneOutliers, missingCompetitor };
  }, [filtered]);

  const summary = React.useMemo(() => {
    const base = filtered;
    const total = base.length;

    const premium = base.filter((r) => r.status === "premium").length;
    const aligned = base.filter((r) => r.status === "aligned").length;
    const underpriced = base.filter((r) => r.status === "underpriced").length;
    const noData = base.filter((r) => r.status === "no_data").length;

    const withGap = base.filter((r) => Number.isFinite(r.gapPct)).map((r) => r.gapPct as number);
    const avgGap = withGap.length ? withGap.reduce((a, b) => a + b, 0) / withGap.length : null;

    const ranks = base.filter((r) => r.rank !== null).map((r) => r.rank as number);
    const rankCounts = [1, 2, 3, 4].map((rk) => ({
      rank: `#${rk}`,
      count: ranks.filter((x) => x === rk).length,
    }));

    const compCoverage = base.filter((r) => r.competitorCount > 0).length;

    return { total, premium, aligned, underpriced, noData, avgGap, rankCounts, compCoverage };
  }, [filtered]);

  const priceBarsForSelected = React.useMemo(() => {
    if (!selected) return [];
    const bars: { name: string; price: number }[] = [];
    if (selected.ourPrice !== null) bars.push({ name: "Orliman", price: selected.ourPrice });
    selected.competitors.forEach((c) => bars.push({ name: c.name, price: c.price }));
    return bars;
  }, [selected]);

  return (
    <MainLayout contentClassName="md:p-6 bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">Veille concurrentielle</p>
            <h1 className="text-3xl font-bold text-slate-900">Concurrence & stratégie prix</h1>
            <p className="text-sm text-slate-600">
              Source : <span className="font-mono">product_prices</span> (estimations) + taxes (TVA / OM-OMR).
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
                <SelectItem value="SPM">Saint-Pierre-et-Miquelon (SPM)</SelectItem>
                <SelectItem value="BL">Saint-Barthélemy (BL)</SelectItem>
                <SelectItem value="MF">Saint-Martin (MF)</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtre (SKU ou libellé)"
              className="w-[260px]"
            />

            <Select value={selectedSku} onValueChange={setSelectedSku}>
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Choisir un produit (SKU)" />
              </SelectTrigger>
              <SelectContent>
                {filtered.slice(0, 800).map((r) => (
                  <SelectItem key={r.sku} value={r.sku}>
                    {r.sku} — {(r.label || "Produit").slice(0, 52)}
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

        {/* Hypothèses / constats de veille */}
        <Card className="border-transparent shadow bg-gradient-to-r from-slate-50 via-white to-sky-50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-800">Constats de veille intégrés</CardTitle>
            <CardDescription>
              Ces règles sont affichées et utilisées pour calculer des repères “attendus”.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Thuasne (DROM)</div>
              <div className="mt-1 text-sm text-slate-800">
                Prix DROM ≈ <span className="font-semibold">catalogue FR + {THUASNE_DROM_UPLIFT_PCT}%</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Si territoire DROM, on calcule : Thuasne attendu = Thuasne(FR) × 1.{String(THUASNE_DROM_UPLIFT_PCT).padStart(2, "0")}
              </div>
              {thuasneInsight.applicable ? (
                <div className="mt-2 text-xs">
                  <Badge variant="outline">
                    Conformité observée : {thuasneInsight.okPct === null ? "n/a" : `${thuasneInsight.okPct.toFixed(0)}%`}
                  </Badge>
                  <div className="mt-1 text-slate-500">
                    Coverage: {thuasneInsight.coverage} SKU · Outliers: {thuasneInsight.outliers}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">Non applicable hors DROM.</div>
              )}
            </div>

            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Octroi de mer</div>
              <div className="mt-1 text-sm text-slate-800">
                <span className="font-semibold">OM/OMR majoré de {OM_UPLIFT_PCT}%</span> sur l’OM théorique
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Calcul appliqué : OM appliqué = (OM + OMR) × 1.{String(OM_UPLIFT_PCT).replace(".", "")}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                (On garde aussi l’OM “base” pour comparer.)
              </div>
            </div>

            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Objectif page</div>
              <div className="mt-1 text-sm text-slate-800">
                Prioriser les décisions : <span className="font-semibold">quoi corriger / quoi investiguer</span>.
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Les “Actions prioritaires” ci-dessous servent de short-list.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Frais supplémentaires */}
        <Card className="border-transparent shadow bg-gradient-to-r from-orange-50 via-white to-amber-50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-amber-700">Frais supplémentaires par territoire (€/commande)</CardTitle>
            <CardDescription>Utilisés dans la “Reco TTC (taxes/OM majoré/frais)”.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(["FR", ...DROM_CODES] as const).map((code) => (
              <div key={code} className="space-y-1">
                <div className="text-xs text-muted-foreground font-medium">{code}</div>
                <Input
                  type="number"
                  value={extraFees[code] ?? 0}
                  onChange={(e) => handleExtraFeeChange(code, e.target.value)}
                  className="h-9"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions prioritaires */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">À baisser (sur-pricing)</CardTitle>
              <CardDescription>Top écarts Orliman &gt; best concurrent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : actions.premium.length ? (
                actions.premium.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className="w-full text-left rounded-lg border p-2 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs text-slate-500">{r.sku}</div>
                        <div className="text-sm font-medium line-clamp-1">{r.label || "Produit"}</div>
                      </div>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        {pctFmt(r.gapPct)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Orliman {money(r.ourPrice)} · Best {money(r.bestCompetitor?.price)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500">Rien de critique (seuil ±5%).</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">À monter (marge)</CardTitle>
              <CardDescription>Top “sous-pricé”</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : actions.underpriced.length ? (
                actions.underpriced.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className="w-full text-left rounded-lg border p-2 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs text-slate-500">{r.sku}</div>
                        <div className="text-sm font-medium line-clamp-1">{r.label || "Produit"}</div>
                      </div>
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                        {pctFmt(r.gapPct)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Orliman {money(r.ourPrice)} · Best {money(r.bestCompetitor?.price)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500">Pas d’opportunité évidente (seuil ±5%).</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Thuasne : anomalies</CardTitle>
              <CardDescription>Δ vs attendu (FR +2%)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : actions.thuasneOutliers.length ? (
                actions.thuasneOutliers.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className="w-full text-left rounded-lg border p-2 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs text-slate-500">{r.sku}</div>
                        <div className="text-sm font-medium line-clamp-1">{r.label || "Produit"}</div>
                      </div>
                      <Badge variant="outline">
                        Δ {pctFmt(r.thuasneDeltaVsExpectedPct)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Thuasne {money(r.thuasneTerritory)} · Attendu {money(r.thuasneExpectedDrom)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500">Aucune donnée Thuasne exploitable.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Manque données</CardTitle>
              <CardDescription>0 concurrent renseigné</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : actions.missingCompetitor.length ? (
                actions.missingCompetitor.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className="w-full text-left rounded-lg border p-2 hover:bg-slate-50"
                  >
                    <div className="font-mono text-xs text-slate-500">{r.sku}</div>
                    <div className="text-sm font-medium line-clamp-1">{r.label || "Produit"}</div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500">OK : au moins 1 concurrent pour la plupart.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Produit sélectionné + chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="border-slate-200 shadow lg:col-span-2">
            <CardHeader>
              <CardTitle>Produit sélectionné</CardTitle>
              <CardDescription>Diagnostic rapide : prix, taxes/OM majoré, et repère Thuasne.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedSku ? (
                <div className="text-sm text-muted-foreground">
                  Sélectionne un SKU pour voir la position Orliman (rang, écarts, OM majoré, repère Thuasne).
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
                          selected.status === "premium"
                            ? "text-amber-600 border-amber-300"
                            : selected.status === "underpriced"
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
                        <CardTitle className="text-sm">Prix & charges</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Orliman (TTC)</div>
                          <div className="font-semibold">{money(selected.ourPrice)}</div>
                        </div>

                        <div className="text-xs text-slate-600">
                          TVA: {selected.vatRate ?? "n/a"}% · OM base: {selected.omRateBase ?? "n/a"}% · OM appliqué:{" "}
                          {selected.omRateApplied === null ? "n/a" : selected.omRateApplied.toFixed(3)}% · Frais:{" "}
                          {selected.extraFee ?? 0}€
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="font-medium">Reco TTC</div>
                          <div className="font-semibold">{money(selected.recommendedTtc)}</div>
                        </div>

                        <div className="h-px bg-slate-100 my-2" />

                        <div className="text-sm font-medium">Thuasne (repère)</div>
                        <div className="text-xs text-slate-600">
                          Thuasne territoire: <span className="font-medium">{money(selected.thuasneTerritory)}</span>{" "}
                          {selected.thuasneExpectedDrom !== null ? (
                            <>
                              · Attendu (FR +{THUASNE_DROM_UPLIFT_PCT}%):{" "}
                              <span className="font-medium">{money(selected.thuasneExpectedDrom)}</span> · Δ{" "}
                              <span className="font-medium">{pctFmt(selected.thuasneDeltaVsExpectedPct)}</span>
                            </>
                          ) : (
                            <>
                              · Thuasne FR: <span className="font-medium">{money(selected.thuasneFR)}</span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Comparatif visuel</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[240px]">
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

          <Card className="border-slate-200 shadow">
            <CardHeader>
              <CardTitle>Distribution rang Orliman</CardTitle>
              <CardDescription>Sur produits avec ≥1 concurrent.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.rankCounts} layout="vertical" margin={{ top: 12, right: 24, left: 24, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="rank" width={32} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                      {summary.rankCounts.map((_, idx) => (
                        <Cell key={idx} fill={BAR_PALETTE[idx % BAR_PALETTE.length]} />
                      ))}
                    </Bar>
                    <LabelList dataKey="count" position="right" offset={8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="pt-2 text-xs text-muted-foreground">
                Couverture concurrents : {summary.compCoverage}/{summary.total}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste */}
        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle>Positionnement (liste)</CardTitle>
            <CardDescription>Inclut Thuasne attendu (FR+2% si DROM) + OM majoré.</CardDescription>
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

                    <TableHead className="text-right">Orliman TTC</TableHead>
                    <TableHead className="text-right">Reco TTC</TableHead>

                    <TableHead className="text-right">LPPR FR</TableHead>
                    <TableHead className="text-right">LPPR DROM</TableHead>

                    <TableHead className="text-right">Thuasne</TableHead>
                    <TableHead className="text-right">Thuasne attendu</TableHead>
                    <TableHead className="text-right">Δ Thuasne</TableHead>

                    <TableHead>Best concurrent</TableHead>
                    <TableHead className="text-right">Gap %</TableHead>
                    <TableHead className="text-right">Rang</TableHead>
                    <TableHead className="text-right"># conc.</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.slice(0, 400).map((row) => (
                    <TableRow
                      key={row.sku}
                      className={cn(selectedSku === row.sku ? "bg-slate-50" : "")}
                      onClick={() => setSelectedSku(row.sku)}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                      <TableCell className="font-medium">{row.label || "—"}</TableCell>

                      <TableCell className="text-right">{money(row.ourPrice)}</TableCell>

                      <TableCell className="text-right">
                        {row.recommendedTtc !== null ? money(row.recommendedTtc) : "—"}
                        <div className="text-[10px] text-muted-foreground">
                          TVA: {row.vatRate ?? "n/a"}% · OM base: {row.omRateBase ?? "n/a"}% · OM appliqué:{" "}
                          {row.omRateApplied === null ? "n/a" : row.omRateApplied.toFixed(3)}% · Fees: {row.extraFee ?? 0}€
                        </div>
                      </TableCell>

                      <TableCell className="text-right">{row.lpprMetropole !== null ? money(row.lpprMetropole) : "—"}</TableCell>
                      <TableCell className="text-right">{row.lpprDrom !== null ? money(row.lpprDrom) : "—"}</TableCell>

                      <TableCell className="text-right">{money(row.thuasneTerritory)}</TableCell>
                      <TableCell className="text-right">{row.thuasneExpectedDrom !== null ? money(row.thuasneExpectedDrom) : "—"}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          row.thuasneDeltaVsExpectedPct !== null && Math.abs(row.thuasneDeltaVsExpectedPct) <= THUASNE_TOLERANCE_PCT
                            ? "text-emerald-700"
                            : row.thuasneDeltaVsExpectedPct !== null
                            ? "text-amber-700"
                            : "text-slate-700"
                        )}
                      >
                        {row.thuasneDeltaVsExpectedPct !== null ? pctFmt(row.thuasneDeltaVsExpectedPct) : "—"}
                      </TableCell>

                      <TableCell>
                        {row.bestCompetitor ? (
                          <div>
                            {money(row.bestCompetitor.price)}{" "}
                            <span className="text-xs text-muted-foreground">({row.bestCompetitor.name})</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell
                        className={cn(
                          "text-right",
                          row.gapPct !== null && row.gapPct > 5
                            ? "text-amber-600"
                            : row.gapPct !== null && row.gapPct < -5
                            ? "text-emerald-700"
                            : "text-slate-700"
                        )}
                      >
                        {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "—"}
                      </TableCell>

                      <TableCell className="text-right">{row.rank ?? "—"}</TableCell>
                      <TableCell className="text-right">{row.competitorCount}</TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            row.status === "premium"
                              ? "text-amber-600 border-amber-300"
                              : row.status === "underpriced"
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
                      <TableCell colSpan={14} className="text-center text-sm text-muted-foreground">
                        Aucun produit trouvé.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}

            <div className="pt-2 text-xs text-muted-foreground">
              Astuce : clique une ligne pour sélectionner le produit et voir le diagnostic en haut.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
