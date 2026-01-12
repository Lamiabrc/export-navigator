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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/**
 * ✅ Table des prix produits estimés
 */
const PRICE_EST_TABLE = "product_prices";

type CompetitorPrice = { name: string; price: number };

type BaseRow = {
  sku: string;
  label: string | null;
  territory: string;

  // base Orliman (TTC) provenant de la vue
  plvMetropoleTtc: number | null;
  plvOmTtc: number | null;

  // HS
  hsCode: string | null;
  hs4: string | null;

  // prix concurrents
  competitors: CompetitorPrice[];
  bestCompetitor: CompetitorPrice | null;

  // prix Orliman utilisé (TTC)
  ourPriceTtc: number | null;
  ourPriceSource: "estimate" | "plv" | "none";

  // base HT pour reco TTC
  baseHtForReco: number | null;
  baseHtSource: "estimate_ht" | "derived_from_ttc" | "none";

  // métriques concurrence
  gapPct: number | null;
  status: "premium" | "aligned" | "underpriced" | "no_data";
  rank: number | null;
  competitorCount: number;

  // taxes / OM / OMR (en %)
  vatRate: number | null;
  omRate: number | null;
  omrRate: number | null;
  omYear: number | null;

  // LPPR
  lpprMetropole: number | null;
  lpprDrom: number | null;
};

type PositionRow = BaseRow & {
  extraFee: number;
  recommendedTtc: number | null;
};

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];
const BAR_PALETTE = ["#0ea5e9", "#a855f7", "#f97316", "#22c55e", "#e11d48"];

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n));
};

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function hs4FromHs(hs: string | null | undefined) {
  if (!hs) return null;
  const digits = String(hs).replace(/[^\d]/g, "");
  if (digits.length < 4) return null;
  return digits.slice(0, 4);
}

function computeRank(our: number, comps: CompetitorPrice[]) {
  const lower = comps.filter((c) => c.price < our).length;
  return 1 + lower;
}

function computeStatusAndGap(ourPriceTtc: number | null, best: CompetitorPrice | null) {
  const gapPct =
    ourPriceTtc !== null && best
      ? ((ourPriceTtc - best.price) / best.price) * 100
      : null;

  let status: BaseRow["status"] = "no_data";
  if (gapPct !== null) {
    if (gapPct > 5) status = "premium";
    else if (gapPct < -5) status = "underpriced";
    else status = "aligned";
  }
  return { gapPct, status };
}

function chunkArray<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// --- robust pickers pour product_prices (colonnes peuvent varier)
function pickSku(row: any): string | null {
  return (
    (typeof row?.sku === "string" && row.sku) ||
    (typeof row?.code_article === "string" && row.code_article) ||
    (typeof row?.product_sku === "string" && row.product_sku) ||
    null
  );
}
function pickTerritory(row: any): string | null {
  const t =
    (typeof row?.territory_code === "string" && row.territory_code) ||
    (typeof row?.territory === "string" && row.territory) ||
    (typeof row?.destination === "string" && row.destination) ||
    null;
  return t ? String(t).toUpperCase() : null;
}
function pickHt(row: any): number | null {
  return (
    toNum(row?.price_ht) ??
    toNum(row?.ht) ??
    toNum(row?.estimated_ht) ??
    toNum(row?.plv_ht) ??
    null
  );
}
function pickTtc(row: any): number | null {
  return (
    toNum(row?.price_ttc) ??
    toNum(row?.ttc) ??
    toNum(row?.estimated_ttc) ??
    toNum(row?.plv_ttc) ??
    null
  );
}

async function fetchProductPricesBySkuList(params: {
  territory: string;
  skus: string[];
}) {
  const { territory, skus } = params;
  const skuChunks = chunkArray(skus, 500);
  const out: any[] = [];

  // 1) Essais “propres” (filtrés par territoire) : territory_code / territory
  const attempts = [
    { terrCol: "territory_code", skuCol: "sku" },
    { terrCol: "territory_code", skuCol: "code_article" },
    { terrCol: "territory", skuCol: "sku" },
    { terrCol: "territory", skuCol: "code_article" },
  ] as const;

  for (const a of attempts) {
    try {
      out.length = 0;
      for (const ch of skuChunks) {
        const qb: any = supabase
          .from(PRICE_EST_TABLE)
          .select("*")
          .eq(a.terrCol, territory);
        const res = await qb.in(a.skuCol, ch);

        if (res.error) throw res.error;
        (res.data || []).forEach((x: any) => out.push(x));
      }
      // si on a trouvé des lignes, on stop
      if (out.length) return out;
      // sinon on continue (peut être table vide pour ce territoire)
      // mais au moins la requête a fonctionné
      return out;
    } catch {
      // on tente la prochaine variante
    }
  }

  // 2) Fallback : sans filtre territoire (au cas où colonne absente), on limite large
  try {
    const res = await supabase.from(PRICE_EST_TABLE).select("*").limit(5000);
    if (!res.error) return res.data || [];
  } catch {
    // ignore
  }

  return [];
}

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const [baseRows, setBaseRows] = React.useState<BaseRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [territory, setTerritory] = React.useState(variables.territory_code || "FR");
  const [selectedSku, setSelectedSku] = React.useState<string>("");

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

  React.useEffect(() => {
    if (variables.territory_code) setTerritory(variables.territory_code);
  }, [variables.territory_code]);

  // ✅ LOAD DB : dépend seulement de territory
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
        // 1) Vue pricing principale
        const { data: viewData, error: viewError } = await supabase
          .from("v_export_pricing")
          .select("*")
          .eq("territory_code", territory)
          .limit(3000);

        if (!active) return;
        if (viewError) throw viewError;

        const rows0 = (viewData || []).filter((r: any) => r?.sku);
        const skus = Array.from(new Set(rows0.map((r: any) => String(r.sku)).filter(Boolean)));
        const skuChunks = chunkArray(skus, 500);

        // 2) LPPR + coeff
        const productsData: any[] = [];
        for (const ch of skuChunks) {
          const res = await supabase
            .from("products")
            .select("code_article, tarif_lppr_eur")
            .in("code_article", ch);

          if (res.error) console.warn("LPPR fetch error", res.error);
          (res.data || []).forEach((x: any) => productsData.push(x));
        }

        const coefRes = await supabase
          .from("lpp_majoration_coefficients")
          .select("territory_code, coef");

        if (coefRes.error) console.warn("LPPR coef fetch error", coefRes.error);

        const lpprMap = new Map<string, number>();
        (productsData || []).forEach((p: any) => {
          if (p.code_article && Number.isFinite(Number(p.tarif_lppr_eur))) {
            lpprMap.set(String(p.code_article), Number(p.tarif_lppr_eur));
          }
        });

        const coefMap = new Map<string, number>();
        (coefRes.data || []).forEach((c: any) => {
          if (c.territory_code && Number.isFinite(Number(c.coef))) {
            coefMap.set(String(c.territory_code).toUpperCase(), Number(c.coef));
          }
        });

        // 3) TVA + OM/OMR (✅ colonnes attendues: hs4, om_rate, omr_rate)
        const [vatRes, omRes] = await Promise.all([
          supabase.from("vat_rates").select("territory_code, rate"),
          supabase.from("om_rates").select("territory_code, hs4, om_rate, omr_rate, year"),
        ]);

        if (vatRes.error) console.warn("VAT fetch error", vatRes.error);
        if (omRes.error) console.warn("OM fetch error", omRes.error);

        const vatMap = new Map<string, number>();
        (vatRes.data || []).forEach((v: any) => {
          const code = String(v.territory_code || "").toUpperCase();
          const rate = toNum(v.rate);
          if (code && rate !== null) vatMap.set(code, rate);
        });

        // garder la ligne la plus récente par (territory, hs4)
        const omMap = new Map<string, { om: number | null; omr: number | null; year: number | null }>();
        (omRes.data || []).forEach((o: any) => {
          const code = String(o.territory_code || "").toUpperCase();
          const hs4 = String(o.hs4 || "");
          const key = `${code}:${hs4}`;
          const year = toNum(o.year) ?? null;

          const cur = omMap.get(key);
          const curYear = cur?.year ?? -1;
          const nextYear = year ?? -1;

          if (!cur || nextYear >= curYear) {
            omMap.set(key, { om: toNum(o.om_rate), omr: toNum(o.omr_rate), year });
          }
        });

        // 4) Prix estimés (product_prices)
        const priceEstRows = await fetchProductPricesBySkuList({ territory, skus });
        const priceEstMap = new Map<string, { ht: number | null; ttc: number | null }>();

        for (const r of priceEstRows) {
          const sku = pickSku(r);
          const terr = pickTerritory(r) || territory.toUpperCase();
          if (!sku) continue;
          priceEstMap.set(`${terr}:${sku}`, { ht: pickHt(r), ttc: pickTtc(r) });
        }

        // 5) Mapping final
        const mapped: BaseRow[] = rows0.map((r: any) => {
          const sku = String(r.sku);
          const label = (r.label ?? null) as string | null;
          const terr = String(r.territory_code || territory).toUpperCase();

          const plvMetropoleTtc = toNum(r.plv_metropole_ttc);
          const plvOmTtc = toNum(r.plv_om_ttc);

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

          const hsCode = (r.hs_code ? String(r.hs_code) : null) as string | null;
          const hs4 = hs4FromHs(hsCode);

          const plvFallbackTtc =
            terr === "FR"
              ? plvMetropoleTtc
              : (plvOmTtc ?? plvMetropoleTtc);

          const est = priceEstMap.get(`${terr}:${sku}`) || null;

          const ourPriceTtc = (est?.ttc ?? plvFallbackTtc) ?? null;
          const ourPriceSource: BaseRow["ourPriceSource"] =
            est?.ttc !== null && est?.ttc !== undefined
              ? "estimate"
              : plvFallbackTtc !== null
              ? "plv"
              : "none";

          const vatRate = vatMap.get(terr) ?? null;

          let baseHtForReco: number | null = est?.ht ?? null;
          let baseHtSource: BaseRow["baseHtSource"] = baseHtForReco !== null ? "estimate_ht" : "none";

          if (baseHtForReco === null && ourPriceTtc !== null && vatRate !== null) {
            baseHtForReco = ourPriceTtc / (1 + vatRate / 100);
            baseHtSource = "derived_from_ttc";
          }

          const { gapPct, status } = computeStatusAndGap(ourPriceTtc, bestCompetitor);
          const rank =
            ourPriceTtc !== null && competitors.length > 0 ? computeRank(ourPriceTtc, competitors) : null;

          const lpprBase = lpprMap.get(sku) ?? null;
          const coef = coefMap.get(terr) ?? 1;
          const lpprDrom = lpprBase !== null ? lpprBase * coef : null;

          let omRate: number | null = null;
          let omrRate: number | null = null;
          let omYear: number | null = null;

          if (hs4) {
            const omRow = omMap.get(`${terr}:${hs4}`);
            omRate = omRow?.om ?? null;
            omrRate = omRow?.omr ?? null;
            omYear = omRow?.year ?? null;
          }

          return {
            sku,
            label,
            territory: terr,

            plvMetropoleTtc,
            plvOmTtc,

            hsCode,
            hs4,

            competitors,
            bestCompetitor,

            ourPriceTtc,
            ourPriceSource,

            baseHtForReco,
            baseHtSource,

            gapPct,
            status,
            rank,
            competitorCount: competitors.length,

            vatRate,
            omRate,
            omrRate,
            omYear,

            lpprMetropole: lpprBase,
            lpprDrom,
          };
        });

        if (!active) return;

        setBaseRows(mapped);
        if (selectedSku && !mapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
      } catch (err: any) {
        console.error("Chargement concurrence échoué", err);
        if (!active) return;
        setError(err?.message || "Erreur chargement concurrence (v_export_pricing)");
        setBaseRows([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory]);

  // ✅ Reco TTC recalculée localement (sans reload DB)
  const rows: PositionRow[] = React.useMemo(() => {
    return baseRows.map((r) => {
      const extraFee = extraFees[r.territory] ?? 0;
      const vat = r.vatRate ?? 0;
      const om = r.omRate ?? 0;
      const omr = r.omrRate ?? 0;

      const baseHt = r.baseHtForReco;
      const recommendedTtc =
        baseHt !== null
          ? baseHt * (1 + (vat + om + omr) / 100) + extraFee
          : null;

      return { ...r, extraFee, recommendedTtc };
    });
  }, [baseRows, extraFees]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.sku + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rows, search]);

  const selected = React.useMemo(() => {
    if (!selectedSku) return null;
    return rows.find((r) => r.sku === selectedSku) || null;
  }, [rows, selectedSku]);

  const summary = React.useMemo(() => {
    const base = filtered;
    const total = base.length;

    const premium = base.filter((r) => r.status === "premium").length;
    const aligned = base.filter((r) => r.status === "aligned").length;
    const underpriced = base.filter((r) => r.status === "underpriced").length;
    const noData = base.filter((r) => r.status === "no_data").length;

    const withGap = base.filter((r) => Number.isFinite(r.gapPct as number)).map((r) => r.gapPct as number);
    const avgGap = withGap.length ? withGap.reduce((a, b) => a + b, 0) / withGap.length : null;

    const ranks = base.filter((r) => r.rank !== null).map((r) => r.rank as number);
    const rankCounts = [1, 2, 3, 4].map((rk) => ({
      rank: `#${rk}`,
      count: ranks.filter((x) => x === rk).length,
    }));

    return { total, premium, aligned, underpriced, noData, avgGap, rankCounts };
  }, [filtered]);

  const dromSummary = React.useMemo(() => {
    return DROM_CODES.map((code) => {
      const terrRows = rows.filter((r) => (r.territory || "").toUpperCase() === code);
      const count = terrRows.length;
      const finiteGaps = terrRows.filter((r) => Number.isFinite(r.gapPct as number)).map((r) => r.gapPct as number);
      const avgGap = finiteGaps.length ? finiteGaps.reduce((s, g) => s + g, 0) / finiteGaps.length : null;
      const best = terrRows
        .filter((r) => Number.isFinite(r.gapPct as number))
        .sort((a, b) => (a.gapPct as number) - (b.gapPct as number))[0];
      return {
        territory: code,
        count,
        avgGap: Number.isFinite(avgGap) ? avgGap : null,
        bestLabel: best?.label || best?.sku || null,
        bestGap: best?.gapPct ?? null,
      };
    });
  }, [rows]);

  const priceBarsForSelected = React.useMemo(() => {
    if (!selected) return [];
    const bars: { name: string; price: number }[] = [];
    if (selected.ourPriceTtc !== null) bars.push({ name: "Orliman", price: selected.ourPriceTtc });
    selected.competitors.forEach((c) => bars.push({ name: c.name, price: c.price }));
    return bars;
  }, [selected]);

  return (
    <MainLayout contentClassName="md:p-6 bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">Concurrence & positionnement</p>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard concurrence</h1>
            <p className="text-sm text-slate-600">
              Source: <span className="font-mono">v_export_pricing</span> +{" "}
              <span className="font-mono">{PRICE_EST_TABLE}</span> (prix estimés si dispo).
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
              placeholder="Filtre (SKU ou label)"
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

        <Card className="border-transparent shadow bg-gradient-to-r from-orange-50 via-white to-amber-50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-amber-700">
              Frais supplémentaires par DROM (€/commande)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {DROM_CODES.map((code) => (
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Card className="border-transparent shadow bg-gradient-to-br from-sky-50 via-white to-sky-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700">Produits (filtrés)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Territoire: {territory}</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-amber-50 via-white to-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-700">Premium</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-700">{summary.premium}</div>
              <div className="text-xs text-muted-foreground">{pct(summary.premium, summary.total)}</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-blue-50 via-white to-indigo-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-700">Aligné</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">{summary.aligned}</div>
              <div className="text-xs text-muted-foreground">{pct(summary.aligned, summary.total)}</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-emerald-50 via-white to-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-emerald-700">Sous-pricé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-700">{summary.underpriced}</div>
              <div className="text-xs text-muted-foreground">{pct(summary.underpriced, summary.total)}</div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow bg-gradient-to-br from-rose-50 via-white to-rose-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-rose-700">Gap moyen vs best</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-rose-700">
                {summary.avgGap === null ? "—" : `${summary.avgGap.toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">Sur produits avec données</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="border-slate-200 shadow lg:col-span-2">
            <CardHeader>
              <CardTitle>Produit sélectionné</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedSku ? (
                <div className="text-sm text-muted-foreground">
                  Sélectionne un SKU pour voir la position Orliman (rang, écarts, comparaison).
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
                      <div className="mt-1 text-xs text-muted-foreground">
                        Source prix: <span className="font-semibold">{selected.ourPriceSource}</span> · Base HT reco:{" "}
                        <span className="font-semibold">{selected.baseHtSource}</span>
                      </div>
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
                            : "text-slate-500 border-slate-300",
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
                        <CardTitle className="text-sm">Prix</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Orliman (TTC)</div>
                          <div className="font-semibold">{money(selected.ourPriceTtc)}</div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          TVA: {selected.vatRate ?? "n/a"}% · OM: {selected.omRate ?? "n/a"}% · OMR:{" "}
                          {selected.omrRate ?? "n/a"}% {selected.omYear ? `· (année ${selected.omYear})` : ""}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-700">Reco TTC (taxes + OM/OMR + fees)</div>
                          <div className="text-sm font-semibold">{money(selected.recommendedTtc)}</div>
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

          <Card className="border-slate-200 shadow">
            <CardHeader>
              <CardTitle>Distribution rang Orliman</CardTitle>
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
                Basé sur produits avec prix Orliman + &gt;=1 prix concurrent.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle className="text-lg">Résumé DROM</CardTitle>
            <CardDescription>Position prix Orliman vs concurrents sur les DOM-TOM.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {dromSummary.map((d) => (
              <div key={d.territory} className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{d.territory}</span>
                  <Badge variant="outline">{d.count} SKU</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Gap moyen: {d.avgGap !== null ? `${d.avgGap.toFixed(1)}%` : "n/a"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Meilleur: {d.bestLabel || "n/a"}{" "}
                  {d.bestGap !== null ? `(${(d.bestGap as number).toFixed(1)}%)` : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle>Positionnement (liste)</CardTitle>
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
                    <TableHead className="text-right">Prix Orliman (TTC)</TableHead>
                    <TableHead className="text-right">Reco TTC (taxes/OM/OMR/fees)</TableHead>
                    <TableHead className="text-right">LPPR FR</TableHead>
                    <TableHead className="text-right">LPPR DROM</TableHead>
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
                      <TableCell className="font-medium">
                        {row.label || "—"}
                        <div className="text-[10px] text-muted-foreground">
                          Source prix: {row.ourPriceSource} · Base HT: {row.baseHtSource}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">{money(row.ourPriceTtc)}</TableCell>

                      <TableCell className="text-right">
                        {row.recommendedTtc !== null ? money(row.recommendedTtc) : "—"}
                        <div className="text-[10px] text-muted-foreground">
                          TVA: {row.vatRate ?? "n/a"}% · OM: {row.omRate ?? "n/a"}% · OMR:{" "}
                          {row.omrRate ?? "n/a"}% · Fees: {row.extraFee ?? 0}€
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        {row.lpprMetropole !== null ? money(row.lpprMetropole) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.lpprDrom !== null ? money(row.lpprDrom) : "—"}
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
                            : "text-slate-700",
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
                              : "text-slate-500 border-slate-300",
                          )}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                        Aucun produit trouvé.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}

            <div className="pt-2 text-xs text-muted-foreground">
              Astuce : clique une ligne pour sélectionner le produit et voir le détail en haut.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
