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

const PRICE_TABLE = "product_prices";

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"] as const;
type DromCode = (typeof DROM_CODES)[number];

const BAR_PALETTE = ["#0ea5e9", "#a855f7", "#f97316", "#22c55e", "#e11d48"];

type CompetitorPrice = { name: string; price: number };

type BaseRow = {
  productId: string;
  sku: string;
  label: string | null;
  territory: string;

  hsCode: string | null;
  hs4: string | null;

  // prix TTC Orliman
  ourPriceTtc: number | null;

  // concurrents TTC
  competitors: CompetitorPrice[];
  bestCompetitor: CompetitorPrice | null;

  gapPct: number | null;
  status: "premium" | "aligned" | "underpriced" | "no_data";
  rank: number | null;
  competitorCount: number;

  // fiscalité (%)
  vatRate: number | null;
  omRate: number | null;
  omrRate: number | null;
  omYear: number | null;

  // LPPR
  lpprMetropole: number | null;
  lpprDrom: number | null;

  // base HT pour faire une reco TTC “taxes+OM+OMR” (approximée)
  baseHtForReco: number | null;
};

type PositionRow = BaseRow & {
  extraFee: number;
  recommendedTtc: number | null;
};

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

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const [baseRowsMain, setBaseRowsMain] = React.useState<BaseRow[]>([]);
  const [baseRowsDrom, setBaseRowsDrom] = React.useState<BaseRow[]>([]);
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
        // 1) product_prices : territoire sélectionné + DROM (pour résumé)
        const [mainRes, dromRes] = await Promise.all([
          supabase.from(PRICE_TABLE).select("*").eq("territory_code", territory).limit(5000),
          supabase.from(PRICE_TABLE).select("*").in("territory_code", [...DROM_CODES]).limit(25000),
        ]);

        if (mainRes.error) throw mainRes.error;
        if (dromRes.error) throw dromRes.error;

        const mainPrices = (mainRes.data || []) as any[];
        const dromPrices = (dromRes.data || []) as any[];

        // union des product_id (main + drom) pour récupérer SKU/label/HS/LPPR
        const allProductIds = Array.from(
          new Set(
            [...mainPrices, ...dromPrices]
              .map((r) => r.product_id)
              .filter(Boolean)
              .map((x) => String(x)),
          ),
        );

        // 2) products : mapping id -> infos produit
        const productMap = new Map<
          string,
          { sku: string; label: string | null; hs_code: string | null; hs4: string | null; lppr: number | null }
        >();

        if (allProductIds.length) {
          const chunks = chunkArray(allProductIds, 500);
          for (const ch of chunks) {
            const pr = await supabase
              .from("products")
              .select("id, code_article, libelle_article, hs_code, hs4, tarif_lppr_eur")
              .in("id", ch);

            if (pr.error) throw pr.error;

            (pr.data || []).forEach((p: any) => {
              const id = String(p.id);
              productMap.set(id, {
                sku: String(p.code_article || id),
                label: (p.libelle_article ?? null) as string | null,
                hs_code: p.hs_code ? String(p.hs_code) : null,
                hs4: p.hs4 ? String(p.hs4) : null,
                lppr: toNum(p.tarif_lppr_eur),
              });
            });
          }
        }

        // 3) TVA + OM/OMR + coeff LPPR
        const [vatRes, omRes, coefRes] = await Promise.all([
          supabase.from("vat_rates").select("territory_code, rate"),
          supabase.from("om_rates").select("territory_code, hs4, om_rate, omr_rate, year"),
          supabase.from("lpp_majoration_coefficients").select("territory_code, coef"),
        ]);

        if (vatRes.error) console.warn("VAT fetch error", vatRes.error);
        if (omRes.error) console.warn("OM fetch error", omRes.error);
        if (coefRes.error) console.warn("LPPR coef fetch error", coefRes.error);

        const vatMap = new Map<string, number>();
        (vatRes.data || []).forEach((v: any) => {
          const code = String(v.territory_code || "").toUpperCase();
          const rate = toNum(v.rate);
          if (code && rate !== null) vatMap.set(code, rate);
        });

        // OM : garder la ligne la plus récente par (territory, hs4)
        const omMap = new Map<string, { om: number | null; omr: number | null; year: number | null }>();
        (omRes.data || []).forEach((o: any) => {
          const code = String(o.territory_code || "").toUpperCase();
          const h = String(o.hs4 || "");
          const key = `${code}:${h}`;
          const year = toNum(o.year) ?? null;

          const cur = omMap.get(key);
          const curYear = cur?.year ?? -1;
          const nextYear = year ?? -1;

          if (!cur || nextYear >= curYear) {
            omMap.set(key, { om: toNum(o.om_rate), omr: toNum(o.omr_rate), year });
          }
        });

        const coefMap = new Map<string, number>();
        (coefRes.data || []).forEach((c: any) => {
          const t = String(c.territory_code || "").toUpperCase();
          const coef = toNum(c.coef);
          if (t && coef !== null) coefMap.set(t, coef);
        });

        const mapPriceRow = (r: any): BaseRow | null => {
          const productId = r.product_id ? String(r.product_id) : null;
          if (!productId) return null;

          const terr = String(r.territory_code || territory).toUpperCase();
          const p = productMap.get(productId);

          const sku = p?.sku || productId;
          const label = p?.label ?? null;

          const hsCode = p?.hs_code ?? null;
          const hs4 = p?.hs4 ?? hs4FromHs(hsCode);

          // prix TTC Orliman : FR => metropole, sinon OM si dispo sinon metropole
          const plvMetTtc = toNum(r.plv_metropole_ttc);
          const plvOmTtc = toNum(r.plv_om_ttc);
          const ourPriceTtc = terr === "FR" ? plvMetTtc : (plvOmTtc ?? plvMetTtc);

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

          const { gapPct, status } = computeStatusAndGap(ourPriceTtc, bestCompetitor);
          const rank =
            ourPriceTtc !== null && competitors.length > 0 ? computeRank(ourPriceTtc, competitors) : null;

          const vatRate = vatMap.get(terr) ?? null;

          // base HT approx pour reco TTC (on "retire" la TVA de notre TTC)
          let baseHtForReco: number | null = null;
          if (ourPriceTtc !== null && vatRate !== null) {
            baseHtForReco = ourPriceTtc / (1 + vatRate / 100);
          }

          // OM/OMR via hs4
          let omRate: number | null = null;
          let omrRate: number | null = null;
          let omYear: number | null = null;
          if (hs4) {
            const omRow = omMap.get(`${terr}:${hs4}`);
            omRate = omRow?.om ?? null;
            omrRate = omRow?.omr ?? null;
            omYear = omRow?.year ?? null;
          }

          // LPPR
          const lpprBase = p?.lppr ?? null;
          const coef = coefMap.get(terr) ?? 1;
          const lpprDrom = lpprBase !== null ? lpprBase * coef : null;

          return {
            productId,
            sku,
            label,
            territory: terr,

            hsCode,
            hs4,

            ourPriceTtc,

            competitors,
            bestCompetitor,

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

            baseHtForReco,
          };
        };

        const mainMapped = mainPrices.map(mapPriceRow).filter(Boolean) as BaseRow[];
        const dromMapped = dromPrices.map(mapPriceRow).filter(Boolean) as BaseRow[];

        if (!active) return;

        setBaseRowsMain(mainMapped);
        setBaseRowsDrom(dromMapped);

        if (selectedSku && !mainMapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
      } catch (err: any) {
        console.error("Chargement WatchCommercial échoué", err);
        if (!active) return;
        setError(err?.message || "Erreur chargement concurrence (product_prices)");
        setBaseRowsMain([]);
        setBaseRowsDrom([]);
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

  // Reco TTC recalculée localement (sans reload DB)
  const rowsMain: PositionRow[] = React.useMemo(() => {
    return baseRowsMain.map((r) => {
      const extraFee = (extraFees as any)[r.territory] ?? 0;
      const vat = r.vatRate ?? 0;
      const om = r.omRate ?? 0;
      const omr = r.omrRate ?? 0;

      const recommendedTtc =
        r.baseHtForReco !== null
          ? r.baseHtForReco * (1 + (vat + om + omr) / 100) + extraFee
          : null;

      return { ...r, extraFee, recommendedTtc };
    });
  }, [baseRowsMain, extraFees]);

  const rowsDrom: PositionRow[] = React.useMemo(() => {
    return baseRowsDrom.map((r) => {
      const extraFee = (extraFees as any)[r.territory] ?? 0;
      const vat = r.vatRate ?? 0;
      const om = r.omRate ?? 0;
      const omr = r.omrRate ?? 0;

      const recommendedTtc =
        r.baseHtForReco !== null
          ? r.baseHtForReco * (1 + (vat + om + omr) / 100) + extraFee
          : null;

      return { ...r, extraFee, recommendedTtc };
    });
  }, [baseRowsDrom, extraFees]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rowsMain;
    return rowsMain.filter((r) => (r.sku + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rowsMain, search]);

  const selected = React.useMemo(() => {
    if (!selectedSku) return null;
    return rowsMain.find((r) => r.sku === selectedSku) || null;
  }, [rowsMain, selectedSku]);

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
    return (DROM_CODES as readonly DromCode[]).map((code) => {
      const terrRows = rowsDrom.filter((r) => (r.territory || "").toUpperCase() === code);
      const count = terrRows.length;

      const finiteGaps = terrRows
        .filter((r) => Number.isFinite(r.gapPct as number))
        .map((r) => r.gapPct as number);

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
  }, [rowsDrom]);

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
            <h1 className="text-3xl font-bold text-slate-900">Watch Commercial</h1>
            <p className="text-sm text-slate-600">
              Source: <span className="font-mono">{PRICE_TABLE}</span> + <span className="font-mono">products</span> (SKU/HS/LPPR).
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
                        HS4: {selected.hs4 ?? "n/a"} · TVA: {selected.vatRate ?? "n/a"}% · OM: {selected.omRate ?? "n/a"}% · OMR:{" "}
                        {selected.omrRate ?? "n/a"}% {selected.omYear ? `· (année ${selected.omYear})` : ""}
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
            <CardDescription>Position prix Orliman vs concurrents sur les DOM-TOM (GP/MQ/GF/RE/YT).</CardDescription>
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
                  Meilleur: {d.bestLabel || "n/a"} {d.bestGap !== null ? `(${Number(d.bestGap).toFixed(1)}%)` : ""}
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
                    <TableHead className="text-right">Prix Orliman</TableHead>
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
                        <div className="text-[10px] text-muted-foreground">HS4: {row.hs4 ?? "n/a"}</div>
                      </TableCell>

                      <TableCell className="text-right">{money(row.ourPriceTtc)}</TableCell>

                      <TableCell className="text-right">
                        {row.recommendedTtc !== null ? money(row.recommendedTtc) : "—"}
                        <div className="text-[10px] text-muted-foreground">
                          TVA: {row.vatRate ?? "n/a"}% · OM: {row.omRate ?? "n/a"}% · OMR: {row.omrRate ?? "n/a"}% · Fees:{" "}
                          {row.extraFee ?? 0}€
                        </div>
                      </TableCell>

                      <TableCell className="text-right">{row.lpprMetropole !== null ? money(row.lpprMetropole) : "—"}</TableCell>
                      <TableCell className="text-right">{row.lpprDrom !== null ? money(row.lpprDrom) : "—"}</TableCell>

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
