import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { AlertTriangle, Search, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";

type CompetitorKey = "thuasne" | "donjoy" | "gibaud";

type CompetitorPrice = { name: string; key: CompetitorKey; price: number };

type PositionRow = {
  productId: string;
  sku: string;
  label: string | null;
  territory: string;

  ourPrice: number | null;

  // competitor observed (for selected territory)
  thuasne: number | null;
  donjoy: number | null;
  gibaud: number | null;

  // thuasne baseline FR
  thuasneFR: number | null;

  // computed
  bestCompetitor: CompetitorPrice | null;
  competitors: CompetitorPrice[];
  gapPct: number | null; // Orliman vs best competitor
  status: "premium" | "aligned" | "underpriced" | "no_data";
  rank: number | null;
  competitorCount: number;

  hs4: string | null;
  vatRate: number | null;
  omTotalRate: number | null; // OM + OMR (approx)

  // Thuasne hypothesis checks
  thuasneExpected: number | null; // FR * (1 + markup)
  thuasneDeltaPct: number | null; // observed vs expected
  thuasneOmSurchargeEur: number | null; // estimation: (price * om%) * surcharge%
};

type ProductRow = {
  id: string;
  code_article?: string | null;
  libelle_article?: string | null;
  hs_code?: string | null;
  hs4?: string | null;
  tarif_lppr_eur?: number | null;
};

type ProductPriceRow = {
  product_id: string;
  territory_code: string;
  plv_metropole_ttc: number | null;
  plv_om_ttc: number | null;
  thuasne_price_ttc: number | null;
  donjoy_price_ttc: number | null;
  gibaud_price_ttc: number | null;
};

type VatRow = { territory_code: string; rate: number };
type OmRow = { territory_code: string; hs4: string; om_rate: number | null; omr_rate: number | null };

const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n));
};

const pct = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(1)}%`;
};

function computeRank(our: number, comps: CompetitorPrice[]) {
  const lower = comps.filter((c) => c.price < our).length;
  return 1 + lower;
}

function statusFromGap(gapPct: number | null) {
  if (gapPct === null) return "no_data" as const;
  if (gapPct > 5) return "premium" as const;
  if (gapPct < -5) return "underpriced" as const;
  return "aligned" as const;
}

// Style helpers (neon control tower)
const neonShell =
  "bg-slate-950 text-slate-50 min-h-[calc(100vh-0px)]";
const neonCard =
  "bg-slate-950/70 border border-cyan-500/20 shadow-[0_0_22px_rgba(34,211,238,0.10)] backdrop-blur";
const neonCardHot =
  "bg-slate-950/70 border border-fuchsia-500/20 shadow-[0_0_26px_rgba(217,70,239,0.16)] backdrop-blur";
const neonHeaderLine =
  "h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent";

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];
  const territoryOptions = [
    { value: "FR", label: "Métropole (FR)" },
    { value: "GP", label: "Guadeloupe (GP)" },
    { value: "MQ", label: "Martinique (MQ)" },
    { value: "GF", label: "Guyane (GF)" },
    { value: "RE", label: "Réunion (RE)" },
    { value: "YT", label: "Mayotte (YT)" },
    { value: "SPM", label: "Saint-Pierre-et-Miquelon (SPM)" },
    { value: "BL", label: "Saint-Barthélemy (BL)" },
    { value: "MF", label: "Saint-Martin (MF)" },
  ];

  const [territory, setTerritory] = React.useState<string>(variables.territory_code || "FR");
  const [search, setSearch] = React.useState("");

  // Hypothèses (réglables)
  const [thuasneDromMarkupPct, setThuasneDromMarkupPct] = React.useState<number>(2.0);
  const [thuasneOmSurchargePct, setThuasneOmSurchargePct] = React.useState<number>(2.5);

  // frais supplémentaires par DROM (€/commande)
  const [extraFees, setExtraFees] = React.useState<Record<string, number>>({
    GP: 0,
    MQ: 0,
    GF: 0,
    RE: 0,
    YT: 0,
  });

  const handleExtraFeeChange = (code: string, value: string) => {
    const n = Number(value);
    setExtraFees((prev) => ({ ...prev, [code]: Number.isFinite(n) ? n : 0 }));
  };

  const [rows, setRows] = React.useState<PositionRow[]>([]);
  const [selectedSku, setSelectedSku] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // “Lens” (filtre stratégique cliquable)
  const [lens, setLens] = React.useState<"all" | "to_lower" | "to_raise" | "thuasne_anomalies" | "missing">("all");

  React.useEffect(() => {
    if (variables.territory_code) setTerritory(variables.territory_code);
  }, [variables.territory_code]);

  // Data loading (product_prices + products + taxes)
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
        const territoriesToLoad = Array.from(new Set(["FR", territory, ...DROM_CODES]));

        // 1) Prix estimés (table product_prices)
        const pricesRes = await supabase
          .from("product_prices")
          .select("product_id, territory_code, plv_metropole_ttc, plv_om_ttc, thuasne_price_ttc, donjoy_price_ttc, gibaud_price_ttc")
          .in("territory_code", territoriesToLoad)
          .limit(5000);

        if (!active) return;
        if (pricesRes.error) throw pricesRes.error;

        const priceRows = (pricesRes.data || []) as unknown as ProductPriceRow[];
        const productIds = Array.from(new Set(priceRows.map((p) => p.product_id).filter(Boolean)));

        // 2) Produits (SKU, label, hs4)
        const prodRes = await supabase
          .from("products")
          .select("id, code_article, libelle_article, hs_code, hs4, tarif_lppr_eur")
          .in("id", productIds)
          .limit(5000);

        if (!active) return;
        if (prodRes.error) throw prodRes.error;

        const products = (prodRes.data || []) as unknown as ProductRow[];
        const prodMap = new Map<string, ProductRow>();
        products.forEach((p) => prodMap.set(p.id, p));

        // 3) Taxes : TVA + OM/OMR
        const [vatRes, omRes] = await Promise.all([
          supabase.from("vat_rates").select("territory_code, rate").limit(5000),
          supabase.from("om_rates").select("territory_code, hs4, om_rate, omr_rate").limit(5000),
        ]);

        const vatData = (vatRes.data || []) as unknown as VatRow[];
        const omData = (omRes.data || []) as unknown as OmRow[];

        const vatMap = new Map<string, number>();
        vatData.forEach((v) => {
          if (v.territory_code && Number.isFinite(Number(v.rate))) vatMap.set(String(v.territory_code).toUpperCase(), Number(v.rate));
        });

        const omMap = new Map<string, number>();
        omData.forEach((o) => {
          const terr = String(o.territory_code || "").toUpperCase();
          const hs4 = String(o.hs4 || "").trim();
          if (!terr || !hs4) return;
          const total = (Number(o.om_rate || 0) || 0) + (Number(o.omr_rate || 0) || 0);
          omMap.set(`${terr}:${hs4}`, total);
        });

        // maps for FR competitor baseline
        const thuasneFRByProduct = new Map<string, number>();
        priceRows
          .filter((r) => String(r.territory_code).toUpperCase() === "FR" && Number.isFinite(Number(r.thuasne_price_ttc)))
          .forEach((r) => thuasneFRByProduct.set(r.product_id, Number(r.thuasne_price_ttc)));

        // territory rows
        const terrRows = priceRows.filter((r) => String(r.territory_code).toUpperCase() === String(territory).toUpperCase());

        const mapped: PositionRow[] = terrRows
          .map((r) => {
            const p = prodMap.get(r.product_id);

            const sku = (p?.code_article || r.product_id).toString();
            const label = (p?.libelle_article ?? null) as string | null;

            const terr = String(r.territory_code || territory || "FR").toUpperCase();
            const isFR = terr === "FR";

            const ourPrice =
              isFR ? (r.plv_metropole_ttc ?? null) : (r.plv_om_ttc ?? r.plv_metropole_ttc ?? null);

            const thuasne = r.thuasne_price_ttc ?? null;
            const donjoy = r.donjoy_price_ttc ?? null;
            const gibaud = r.gibaud_price_ttc ?? null;

            const competitorsAll: Array<{ name: string; key: CompetitorKey; price: number | null }> = [
              { name: "Thuasne", key: "thuasne", price: thuasne },
              { name: "Enovis (Donjoy)", key: "donjoy", price: donjoy },
              { name: "Gibaud", key: "gibaud", price: gibaud },
            ];

            const competitors: CompetitorPrice[] = competitorsAll
              .filter((c) => c.price !== null && Number.isFinite(Number(c.price)))
              .map((c) => ({ name: c.name, key: c.key, price: Number(c.price) }));

            const bestCompetitor =
              competitors.length > 0
                ? competitors.reduce((m, c) => (c.price < m.price ? c : m), competitors[0])
                : null;

            const gapPct =
              ourPrice !== null && bestCompetitor
                ? ((ourPrice - bestCompetitor.price) / bestCompetitor.price) * 100
                : null;

            const status = statusFromGap(gapPct);

            const rank = ourPrice !== null && competitors.length > 0 ? computeRank(ourPrice, competitors) : null;

            // hs4
            const hs4 =
              (p?.hs4 && String(p.hs4).trim()) ||
              (p?.hs_code ? String(p.hs_code).replace(/\s+/g, "").slice(0, 4) : null);

            const vatRate = vatMap.get(terr) ?? null;
            const omTotalRate = hs4 ? (omMap.get(`${terr}:${hs4}`) ?? null) : null;

            // Thuasne expected vs observed
            const thuasneFR = thuasneFRByProduct.get(r.product_id) ?? null;
            const thuasneExpected =
              !isFR && thuasneFR !== null
                ? thuasneFR * (1 + thuasneDromMarkupPct / 100)
                : null;

            const thuasneDeltaPct =
              !isFR && thuasne !== null && thuasneExpected !== null && thuasneExpected > 0
                ? ((thuasne - thuasneExpected) / thuasneExpected) * 100
                : null;

            // Thuasne OM surcharge estimate (ONLY Thuasne)
            // estimation simple: (thuasne_price * OM_total%) * surcharge%
            const thuasneOmSurchargeEur =
              !isFR && thuasne !== null && omTotalRate !== null
                ? (thuasne * (omTotalRate / 100)) * (thuasneOmSurchargePct / 100)
                : null;

            return {
              productId: r.product_id,
              sku,
              label,
              territory: terr,

              ourPrice,

              thuasne,
              donjoy,
              gibaud,

              thuasneFR,

              competitors,
              bestCompetitor,
              gapPct,
              status,
              rank,
              competitorCount: competitors.length,

              hs4,
              vatRate,
              omTotalRate,

              thuasneExpected,
              thuasneDeltaPct,
              thuasneOmSurchargeEur,
            };
          })
          .filter((x) => x.sku);

        if (!active) return;

        setRows(mapped);

        if (selectedSku && !mapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
      } catch (err: any) {
        console.error("Chargement concurrence échoué", err);
        if (!active) return;
        setError(err?.message || "Erreur chargement (product_prices)");
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
  }, [territory, thuasneDromMarkupPct, thuasneOmSurchargePct]);

  // Action lists (controltower)
  const actionPanels = React.useMemo(() => {
    const base = rows;

    const toLower = base
      .filter((r) => r.status === "premium" && r.gapPct !== null)
      .sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0))
      .slice(0, 12);

    const toRaise = base
      .filter((r) => r.status === "underpriced" && r.gapPct !== null)
      .sort((a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0))
      .slice(0, 12);

    const thuasneAnomalies = base
      .filter((r) => r.thuasneDeltaPct !== null && Math.abs(r.thuasneDeltaPct) >= 0.8)
      .sort((a, b) => Math.abs(b.thuasneDeltaPct ?? 0) - Math.abs(a.thuasneDeltaPct ?? 0))
      .slice(0, 12);

    const missing = base
      .filter((r) => r.competitorCount === 0)
      .slice(0, 12);

    return { toLower, toRaise, thuasneAnomalies, missing };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    let base = rows;

    if (lens === "to_lower") base = rows.filter((r) => r.status === "premium");
    if (lens === "to_raise") base = rows.filter((r) => r.status === "underpriced");
    if (lens === "thuasne_anomalies") base = rows.filter((r) => r.thuasneDeltaPct !== null && Math.abs(r.thuasneDeltaPct) >= 0.8);
    if (lens === "missing") base = rows.filter((r) => r.competitorCount === 0);

    if (!q) return base;
    return base.filter((r) => (r.sku + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rows, search, lens]);

  const summary = React.useMemo(() => {
    const total = rows.length;
    const premium = rows.filter((r) => r.status === "premium").length;
    const aligned = rows.filter((r) => r.status === "aligned").length;
    const underpriced = rows.filter((r) => r.status === "underpriced").length;
    const noData = rows.filter((r) => r.status === "no_data").length;

    const withThuasneFR = rows.filter((r) => r.thuasneFR !== null).length;
    const withThuasneObserved = rows.filter((r) => r.thuasne !== null).length;
    const thuasneHypCoverage = withThuasneFR ? Math.round((rows.filter((r) => r.thuasneExpected !== null).length / rows.length) * 100) : 0;

    const anomalies = rows.filter((r) => r.thuasneDeltaPct !== null && Math.abs(r.thuasneDeltaPct) >= 0.8).length;

    const withAnyCompetitor = rows.filter((r) => r.competitorCount > 0).length;
    const coverage = total ? Math.round((withAnyCompetitor / total) * 100) : 0;

    return {
      total,
      premium,
      aligned,
      underpriced,
      noData,
      coverage,
      thuasneHypCoverage,
      anomalies,
      withThuasneFR,
      withThuasneObserved,
    };
  }, [rows]);

  const selected = React.useMemo(() => {
    if (!selectedSku) return null;
    return rows.find((r) => r.sku === selectedSku) || null;
  }, [rows, selectedSku]);

  const lensButton = (key: typeof lens, label: string) => (
    <Button
      type="button"
      variant={lens === key ? "default" : "secondary"}
      className={cn(
        "h-9",
        lens === key
          ? "bg-cyan-500/15 text-cyan-100 border border-cyan-400/40 shadow-[0_0_16px_rgba(34,211,238,0.22)]"
          : "bg-slate-900/60 text-slate-200 border border-slate-700/60 hover:bg-slate-900"
      )}
      onClick={() => setLens(key)}
    >
      {label}
    </Button>
  );

  return (
    <MainLayout contentClassName={cn(neonShell, "p-4 md:p-6")}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.35em] text-cyan-300/90">
                Veille concurrentielle
              </span>
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.65)]" />
              <span className="text-[11px] uppercase tracking-[0.35em] text-fuchsia-300/70">
                ControlTower
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-50">
              Concurrence & stratégie prix
            </h1>
            <p className="text-sm text-slate-300/80 max-w-3xl">
              Objectif : rendre la veille <span className="text-cyan-200">actionnable</span> (quoi baisser/monter, où investiguer, où les données manquent).
              Sources : <span className="font-mono text-slate-200">product_prices</span> + taxes (TVA, OM/OMR).
            </p>
            <div className={neonHeaderLine} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={territory} onValueChange={setTerritory}>
              <SelectTrigger className="w-[220px] bg-slate-950/60 border-slate-700/60 text-slate-100">
                <SelectValue placeholder="Territoire" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                {territoryOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtre (SKU ou libellé)"
                className="pl-9 w-[260px] bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <Select value={selectedSku} onValueChange={setSelectedSku}>
              <SelectTrigger className="w-[320px] bg-slate-950/60 border-slate-700/60 text-slate-100">
                <SelectValue placeholder="Sélection produit (SKU)" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                {filtered.slice(0, 900).map((r) => (
                  <SelectItem key={r.sku} value={r.sku}>
                    {r.sku} — {(r.label || "Produit").slice(0, 52)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <Card className={cn(neonCardHot, "border-red-500/30")}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-2 text-sm text-red-200">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <div className="font-semibold">Erreur chargement</div>
                  <div className="text-red-200/80">{error}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Hypothèses (claires + hiérarchie demandée) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Hypothèses concurrentielles (appliquées)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Ce sont des règles de lecture / contrôle, pas des vérités “fixes”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Thuasne DROM +2% (main) */}
              <div className="rounded-xl border border-cyan-400/20 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-100">Thuasne : DROM = catalogue FR +</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={thuasneDromMarkupPct}
                      onChange={(e) => setThuasneDromMarkupPct(Number(e.target.value))}
                      className="h-8 w-20 bg-slate-950/60 border-slate-700/60 text-slate-100"
                    />
                    <span className="text-sm text-slate-300">%</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Contrôle : compare Thuasne observé ({territory}) vs Thuasne attendu (FR × (1+%)).
                </div>

                {/* Thuasne OM +2.5% (ONLY Thuasne, under main info) */}
                <div className="mt-3 pt-3 border-t border-slate-800/60">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-100">
                      Thuasne : OM refacturé +
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={thuasneOmSurchargePct}
                        onChange={(e) => setThuasneOmSurchargePct(Number(e.target.value))}
                        className="h-8 w-20 bg-slate-950/60 border-slate-700/60 text-slate-100"
                      />
                      <span className="text-sm text-slate-300">%</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    ⚠️ Concerne <span className="text-slate-200">uniquement Thuasne</span> (sur la part OM/OMR estimée). Affiché comme estimation.
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-950/35 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-200">Enovis (Donjoy)</div>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    Information non disponible
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  À compléter : règle DROM vs FR (si existante) + politique taxes.
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-950/35 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-200">Gibaud</div>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    Information non disponible
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  À compléter : règle DROM vs FR (si existante) + politique taxes.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI tiles (moins “dashboard”, plus lecture stratégique) */}
          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-fuchsia-300" />
                Lecture rapide (territoire : {territory})
              </CardTitle>
              <CardDescription className="text-slate-400">
                Couverture & signaux (pas des KPI décoratifs).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-cyan-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">Produits chargés</div>
                <div className="text-2xl font-bold text-slate-50">{summary.total}</div>
                <div className="text-xs text-slate-400">Depuis product_prices</div>
              </div>
              <div className="rounded-xl border border-fuchsia-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">Couverture concurrents</div>
                <div className="text-2xl font-bold text-slate-50">{summary.coverage}%</div>
                <div className="text-xs text-slate-400">Orliman + ≥1 concurrent</div>
              </div>
              <div className="rounded-xl border border-amber-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">À baisser (premium)</div>
                <div className="text-2xl font-bold text-amber-200">{summary.premium}</div>
                <div className="text-xs text-slate-400">&gt; +5% vs best</div>
              </div>
              <div className="rounded-xl border border-emerald-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">À monter (sous-pricé)</div>
                <div className="text-2xl font-bold text-emerald-200">{summary.underpriced}</div>
                <div className="text-xs text-slate-400">&lt; -5% vs best</div>
              </div>

              <div className="col-span-2 rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Contrôle Thuasne (FR → {territory})</div>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    anomalies ≥ 0.8% : {summary.anomalies}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Couverture Thuasne FR : {summary.withThuasneFR} / {summary.total} ·
                  Thuasne observé ({territory}) : {summary.withThuasneObserved} / {summary.total}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions / Lens */}
          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filtres d’action (1 clic)</CardTitle>
              <CardDescription className="text-slate-400">
                Pour rendre la page “parlante” : on filtre par intention.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {lensButton("all", "Tout")}
              {lensButton("to_lower", "À baisser")}
              {lensButton("to_raise", "À monter")}
              {lensButton("thuasne_anomalies", "Anomalies Thuasne")}
              {lensButton("missing", "Données manquantes")}
            </CardContent>
          </Card>
        </div>

        {/* Extra fees */}
        <Card className={cn(neonCard, "border-amber-400/15")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-200">Frais supplémentaires par DROM (€/commande)</CardTitle>
            <CardDescription className="text-slate-400">
              Ajuste tes “frais terrain” pour simuler une recommandation TTC (indicative).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {DROM_CODES.map((code) => (
              <div key={code} className="space-y-1">
                <div className="text-xs text-slate-300 font-medium">{code}</div>
                <Input
                  type="number"
                  value={extraFees[code] ?? 0}
                  onChange={(e) => handleExtraFeeChange(code, e.target.value)}
                  className="h-9 bg-slate-950/60 border-slate-700/60 text-slate-100"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ControlTower panels (interactifs) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <Card className={cn(neonCard, "lg:col-span-2")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-300" />
                À baisser (Orliman premium)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Priorité : plus gros gap vs best concurrent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-[220px] w-full bg-slate-800/40" />
              ) : actionPanels.toLower.length ? (
                actionPanels.toLower.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className={cn(
                      "w-full text-left rounded-xl border px-3 py-2 transition",
                      "bg-slate-950/40 border-amber-400/15 hover:border-amber-300/35",
                      selectedSku === r.sku && "border-amber-300/50 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono text-slate-300">{r.sku}</div>
                        <div className="text-sm text-slate-100">{(r.label || "Produit").slice(0, 68)}</div>
                      </div>
                      <Badge variant="outline" className="border-amber-300/30 text-amber-200">
                        {pct(r.gapPct)}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Orliman {money(r.ourPrice)} · Best {r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-slate-400">Aucune alerte “à baisser” sur ce territoire.</div>
              )}
            </CardContent>
          </Card>

          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                À monter (sous-pricé)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Opportunités : Orliman très en dessous du marché.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-[220px] w-full bg-slate-800/40" />
              ) : actionPanels.toRaise.length ? (
                actionPanels.toRaise.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className={cn(
                      "w-full text-left rounded-xl border px-3 py-2 transition",
                      "bg-slate-950/40 border-emerald-400/15 hover:border-emerald-300/35",
                      selectedSku === r.sku && "border-emerald-300/50 shadow-[0_0_18px_rgba(16,185,129,0.18)]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono text-slate-300">{r.sku}</div>
                        <div className="text-sm text-slate-100">{(r.label || "Produit").slice(0, 48)}</div>
                      </div>
                      <Badge variant="outline" className="border-emerald-300/30 text-emerald-200">
                        {pct(r.gapPct)}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Orliman {money(r.ourPrice)} · Best {r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-slate-400">Aucune opportunité “à monter” détectée.</div>
              )}
            </CardContent>
          </Card>

          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-fuchsia-300" />
                Anomalies Thuasne
              </CardTitle>
              <CardDescription className="text-slate-400">
                Contrôle : Thuasne observé vs Thuasne attendu (FR + {thuasneDromMarkupPct}%).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-[220px] w-full bg-slate-800/40" />
              ) : actionPanels.thuasneAnomalies.length ? (
                actionPanels.thuasneAnomalies.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className={cn(
                      "w-full text-left rounded-xl border px-3 py-2 transition",
                      "bg-slate-950/40 border-fuchsia-400/15 hover:border-fuchsia-300/35",
                      selectedSku === r.sku && "border-fuchsia-300/50 shadow-[0_0_18px_rgba(217,70,239,0.18)]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono text-slate-300">{r.sku}</div>
                        <div className="text-sm text-slate-100">{(r.label || "Produit").slice(0, 48)}</div>
                      </div>
                      <Badge variant="outline" className="border-fuchsia-300/30 text-fuchsia-200">
                        Δ {pct(r.thuasneDeltaPct)}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Attendu {money(r.thuasneExpected)} · Observé {money(r.thuasne)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-slate-400">Aucune anomalie Thuasne détectée.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Produit sélectionné (clarifié) */}
        <Card className={neonCard}>
          <CardHeader>
            <CardTitle className="text-base">Produit sélectionné</CardTitle>
            <CardDescription className="text-slate-400">
              Focus décision : position Orliman, best concurrent, contrôle Thuasne (attendu vs observé), estimation OM Thuasne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[160px] w-full bg-slate-800/40" />
            ) : !selected ? (
              <div className="text-sm text-slate-400">Sélectionne un SKU pour afficher le diagnostic.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4 lg:col-span-1">
                  <div className="text-xs font-mono text-slate-400">{selected.sku}</div>
                  <div className="text-lg font-semibold text-slate-100">{selected.label || "Produit"}</div>
                  <div className="text-sm text-slate-400 mt-1">Territoire : {selected.territory}</div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        selected.status === "premium"
                          ? "text-amber-200 border-amber-300/40"
                          : selected.status === "underpriced"
                          ? "text-emerald-200 border-emerald-300/40"
                          : selected.status === "aligned"
                          ? "text-cyan-200 border-cyan-300/40"
                          : "text-slate-300 border-slate-600"
                      )}
                    >
                      {selected.status}
                    </Badge>
                    <Badge variant="outline" className="text-slate-200 border-slate-600">
                      Rang Orliman : {selected.rank ?? "—"}
                    </Badge>
                    <Badge variant="outline" className="text-slate-200 border-slate-600">
                      Gap vs best : {pct(selected.gapPct)}
                    </Badge>
                  </div>

                  <div className="mt-3 text-xs text-slate-400 space-y-1">
                    <div>HS4 : {selected.hs4 || "—"}</div>
                    <div>TVA : {selected.vatRate !== null ? `${selected.vatRate}%` : "—"}</div>
                    <div>OM+OMR : {selected.omTotalRate !== null ? `${selected.omTotalRate}%` : "—"}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-400/15 bg-slate-950/35 p-4 lg:col-span-1">
                  <div className="text-sm font-semibold text-slate-100">Prix (observés)</div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-200">Orliman</div>
                      <div className="font-semibold text-slate-50">{money(selected.ourPrice)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-200">Thuasne</div>
                      <div className="font-medium text-slate-50">{money(selected.thuasne)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-200">Enovis (Donjoy)</div>
                      <div className="font-medium text-slate-50">{money(selected.donjoy)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-200">Gibaud</div>
                      <div className="font-medium text-slate-50">{money(selected.gibaud)}</div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/60 text-xs text-slate-400">
                      Best concurrent :{" "}
                      <span className="text-slate-200">
                        {selected.bestCompetitor ? `${money(selected.bestCompetitor.price)} (${selected.bestCompetitor.name})` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-fuchsia-400/15 bg-slate-950/35 p-4 lg:col-span-1">
                  <div className="text-sm font-semibold text-slate-100">Contrôle Thuasne (règles)</div>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-300">Thuasne FR</div>
                      <div className="text-slate-50 font-medium">{money(selected.thuasneFR)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-300">Thuasne attendu ({territory})</div>
                      <div className="text-slate-50 font-semibold">{money(selected.thuasneExpected)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-300">Thuasne observé ({territory})</div>
                      <div className="text-slate-50 font-semibold">{money(selected.thuasne)}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <div className="text-slate-300">Δ observé vs attendu</div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-slate-600",
                          selected.thuasneDeltaPct !== null && Math.abs(selected.thuasneDeltaPct) >= 0.8
                            ? "text-fuchsia-200 border-fuchsia-300/40 shadow-[0_0_16px_rgba(217,70,239,0.18)]"
                            : "text-slate-200"
                        )}
                      >
                        {selected.thuasneDeltaPct === null ? "—" : `Δ ${pct(selected.thuasneDeltaPct)}`}
                      </Badge>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-800/60">
                      <div className="text-xs text-slate-400">
                        OM Thuasne (+{thuasneOmSurchargePct}% sur la part OM/OMR estimée) —{" "}
                        <span className="text-slate-200">estimation</span>
                      </div>
                      <div className="mt-1 text-lg font-bold text-amber-200">
                        {money(selected.thuasneOmSurchargeEur)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Estimation simple : (Thuasne TTC × (OM+OMR%)) × {thuasneOmSurchargePct}%.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table (liste) */}
        <Card className={neonCard}>
          <CardHeader>
            <CardTitle className="text-lg">Positionnement (liste)</CardTitle>
            <CardDescription className="text-slate-400">
              Astuce : clique une ligne pour sélectionner le produit. (Filtre = {lens})
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(7)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-slate-800/40" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-300">SKU</TableHead>
                    <TableHead className="text-slate-300">Produit</TableHead>
                    <TableHead className="text-right text-slate-300">Orliman TTC</TableHead>
                    <TableHead className="text-right text-slate-300">Thuasne</TableHead>
                    <TableHead className="text-right text-slate-300">Thuasne attendu</TableHead>
                    <TableHead className="text-right text-slate-300">Δ Thuasne</TableHead>
                    <TableHead className="text-right text-slate-300">Donjoy</TableHead>
                    <TableHead className="text-right text-slate-300">Gibaud</TableHead>
                    <TableHead className="text-right text-slate-300">Best concurrent</TableHead>
                    <TableHead className="text-right text-slate-300">Gap %</TableHead>
                    <TableHead className="text-right text-slate-300">Rang</TableHead>
                    <TableHead className="text-slate-300">Statut</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.slice(0, 600).map((r) => (
                    <TableRow
                      key={r.sku}
                      className={cn(
                        "border-slate-900/60 hover:bg-slate-900/40 cursor-pointer",
                        selectedSku === r.sku && "bg-slate-900/50"
                      )}
                      onClick={() => setSelectedSku(r.sku)}
                    >
                      <TableCell className="font-mono text-xs text-slate-200">{r.sku}</TableCell>
                      <TableCell className="text-slate-100">{r.label || "—"}</TableCell>

                      <TableCell className="text-right text-slate-100">{money(r.ourPrice)}</TableCell>

                      <TableCell className="text-right text-slate-100">{money(r.thuasne)}</TableCell>
                      <TableCell className="text-right text-slate-100">{money(r.thuasneExpected)}</TableCell>
                      <TableCell className="text-right">
                        {r.thuasneDeltaPct === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-medium",
                              Math.abs(r.thuasneDeltaPct) >= 0.8 ? "text-fuchsia-200" : "text-slate-200"
                            )}
                          >
                            {pct(r.thuasneDeltaPct)}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-slate-100">{money(r.donjoy)}</TableCell>
                      <TableCell className="text-right text-slate-100">{money(r.gibaud)}</TableCell>

                      <TableCell className="text-right text-slate-100">
                        {r.bestCompetitor ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-semibold">{money(r.bestCompetitor.price)}</span>
                            <span className="text-[11px] text-slate-400">{r.bestCompetitor.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>

                      <TableCell
                        className={cn(
                          "text-right",
                          r.gapPct !== null && r.gapPct > 5
                            ? "text-amber-200"
                            : r.gapPct !== null && r.gapPct < -5
                            ? "text-emerald-200"
                            : "text-slate-200"
                        )}
                      >
                        {r.gapPct !== null ? `${r.gapPct.toFixed(1)}%` : "—"}
                      </TableCell>

                      <TableCell className="text-right text-slate-100">{r.rank ?? "—"}</TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            r.status === "premium"
                              ? "text-amber-200 border-amber-300/40"
                              : r.status === "underpriced"
                              ? "text-emerald-200 border-emerald-300/40"
                              : r.status === "aligned"
                              ? "text-cyan-200 border-cyan-300/40"
                              : "text-slate-300 border-slate-600"
                          )}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 ? (
                    <TableRow className="border-slate-900/60">
                      <TableCell colSpan={12} className="text-center text-sm text-slate-400">
                        Aucun produit trouvé.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}

            <div className="pt-3 text-xs text-slate-500">
              Note : le contrôle “Thuasne attendu” suppose une base FR disponible pour le même produit.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
