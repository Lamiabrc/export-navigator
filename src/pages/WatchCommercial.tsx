import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { AlertTriangle, Database, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";

type ProductPriceRow = {
  product_id: string;
  territory_code: string;
  plv_metropole_ttc: number | null;
  plv_om_ttc: number | null;
  thuasne_price_ttc: number | null;
  donjoy_price_ttc: number | null;
  gibaud_price_ttc: number | null;
};

type ProductRow = {
  id: string;
  code_article: string | null; // SKU
  libelle_article: string | null; // label
  hs_code: string | null;
  tarif_ref_eur: number | null;
};

type PricingCoefRow = { territory_code: string; coef: number | null };
type OmRow = { territory_code: string; hs4: string; om_rate: number | null; omr_rate: number | null };

type CompetitorPrice = { name: string; price: number };

type PositionRow = {
  productId: string;
  sku: string;
  label: string | null;
  territory: string;

  tarif_refMetropole: number | null;
  tarif_refDrom: number | null;

  ourPrice: number | null;

  thuasneFr: number | null;
  thuasneTerritory: number | null;
  thuasneExpectedDrom: number | null; // FR * 1.02
  thuasneEffective: number | null; // territory || expected

  donjoy: number | null; // Enovis (Donjoy)
  gibaud: number | null;

  competitors: CompetitorPrice[];
  bestCompetitor: CompetitorPrice | null;

  gapPct: number | null;
  rank: number | null;
  competitorCount: number;

  status: "premium" | "aligned" | "underpriced" | "no_data";

  hs4: string | null;
  omTotalRate: number | null; // OM + OMR
  thuasneOmTotalRateBilled: number | null; // OM total * 1.025
  thuasneDromUpliftObservedPct: number | null; // (th_drom/th_fr - 1)*100
};

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];

// IMPORTANT : inclure MF/BL/SPM car ton GlobalFilter te met Saint-Martin etc.
const TERRITORIES: { code: string; label: string }[] = [
  { code: "FR", label: "Métropole (FR)" },
  { code: "GP", label: "Guadeloupe (GP)" },
  { code: "MQ", label: "Martinique (MQ)" },
  { code: "GF", label: "Guyane (GF)" },
  { code: "RE", label: "Réunion (RE)" },
  { code: "YT", label: "Mayotte (YT)" },
  { code: "MF", label: "Saint-Martin (MF)" },
  { code: "BL", label: "Saint-Barthélemy (BL)" },
  { code: "SPM", label: "Saint-Pierre-et-Miquelon (SPM)" },
];

const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
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

function pctLabel(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function computeRank(our: number, comps: CompetitorPrice[]) {
  const lower = comps.filter((c) => c.price < our).length;
  return 1 + lower;
}

function median(values: number[]) {
  const v = values.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function territoryIsDrom(territory: string) {
  return DROM_CODES.includes((territory || "").toUpperCase());
}

function hs4Of(hsCode: string | null) {
  const x = (hsCode || "").replace(/\D/g, "");
  if (x.length < 4) return null;
  return x.slice(0, 4);
}

const neonCard =
  "bg-white border border-slate-200 shadow-[0_0_0_1px_rgba(56,189,248,0.10),0_10px_30px_rgba(2,6,23,0.06)]";

const neonHeader =
  "bg-gradient-to-r from-slate-50 via-white to-sky-50 border border-slate-200 shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_12px_40px_rgba(2,6,23,0.08)]";

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const [territory, setTerritory] = React.useState<string>((variables.territory_code || "FR").toUpperCase());
  const [search, setSearch] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState<string>("");

  const [rows, setRows] = React.useState<PositionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showSources, setShowSources] = React.useState(true);

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
    if (variables.territory_code) setTerritory(String(variables.territory_code).toUpperCase());
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
        const terr = territory.toUpperCase();
        const wantedTerritories = Array.from(new Set(["FR", terr]));

        const { data: pp, error: ppErr } = await supabase
          .from("product_prices")
          .select(
            "product_id, territory_code, plv_metropole_ttc, plv_om_ttc, thuasne_price_ttc, donjoy_price_ttc, gibaud_price_ttc",
          )
          .in("territory_code", wantedTerritories)
          .limit(20000);

        if (!active) return;
        if (ppErr) throw ppErr;

        const ppRows = (pp || []) as unknown as ProductPriceRow[];

        const byProduct = new Map<string, { FR?: ProductPriceRow; TERR?: ProductPriceRow }>();
        for (const r of ppRows) {
          const pid = r.product_id;
          if (!pid) continue;
          const rec = byProduct.get(pid) || {};
          const t = (r.territory_code || "").toUpperCase();
          if (t === "FR") rec.FR = r;
          if (t === terr) rec.TERR = r;
          byProduct.set(pid, rec);
        }

        const productIds = Array.from(byProduct.keys());
        if (!productIds.length) {
          setRows([]);
          setSelectedSku("");
          return;
        }

        const { data: products, error: pErr } = await supabase
          .from("v_products_enriched")
          .select("id, code_article, libelle_article, hs_code, tarif_ref_eur")
          .in("id", productIds);

        if (!active) return;
        if (pErr) {
          if (String(pErr.message || "").toLowerCase().includes("does not exist")) {
            throw new Error(
              "Vue manquante: v_products_enriched. Cree une vue avec des champs generiques (tarif_ref_eur, code_article, libelle_article, hs_code)."
            );
          }
          throw pErr;
        }

        const productMap = new Map<string, ProductRow>();
        (products || []).forEach((p: any) => productMap.set(p.id, p as ProductRow));

        const { data: coefData, error: coefErr } = await supabase
          .from("pricing_coefficients")
          .select("territory_code, coef")
          .limit(2000);

        if (coefErr) {
          if (String(coefErr.message || "").toLowerCase().includes("does not exist")) {
            throw new Error("Table manquante: pricing_coefficients (coef DROM par territoire).");
          }
          throw coefErr;
        }

        const coefMap = new Map<string, number>();
        ((coefData || []) as unknown as PricingCoefRow[]).forEach((c) => {
          const code = (c.territory_code || "").toUpperCase();
          const v = num(c.coef);
          if (code && v !== null) coefMap.set(code, v);
        });

        const hs4List = productIds
          .map((id) => hs4Of(productMap.get(id)?.hs_code ?? null))
          .filter(Boolean) as string[];
        const hs4Uniq = Array.from(new Set(hs4List));

        let omRows: OmRow[] = [];
        if (hs4Uniq.length && terr !== "FR") {
          const { data: omData } = await supabase
            .from("om_rates")
            .select("territory_code, hs4, om_rate, omr_rate")
            .eq("territory_code", terr)
            .in("hs4", hs4Uniq)
            .limit(20000);

          omRows = (omData || []) as unknown as OmRow[];
        }

        const omMap = new Map<string, { om: number | null; omr: number | null }>();
        omRows.forEach((o) => {
          const key = (o.hs4 || "").toString();
          if (!key) return;
          omMap.set(key, { om: num(o.om_rate), omr: num(o.omr_rate) });
        });

        const mapped: PositionRow[] = productIds
          .map((pid) => {
            const p = productMap.get(pid);
            const pack = byProduct.get(pid);
            const terrRow = pack?.TERR;
            const frRow = pack?.FR;

            const sku = (p?.code_article || "").trim() || pid.slice(0, 8);
            const label = p?.libelle_article ?? null;

            const isDrom = territoryIsDrom(terr);

            const tarif_refMetropole = num(p?.tarif_ref_eur ?? null);
            const coef = terr === "FR" ? 1 : num(coefMap.get(terr) ?? null) ?? 1;
            const tarif_refDrom = tarif_refMetropole !== null ? tarif_refMetropole * coef : null;

            const ourPrice =
              terr === "FR"
                ? num(terrRow?.plv_metropole_ttc ?? null)
                : num(terrRow?.plv_om_ttc ?? null) ?? num(terrRow?.plv_metropole_ttc ?? null);

            const thuasneFr = num(frRow?.thuasne_price_ttc ?? null);
            const thuasneTerritory = num(terrRow?.thuasne_price_ttc ?? null);
            const thuasneExpectedDrom = isDrom && thuasneFr !== null ? thuasneFr * 1.02 : null;
            const thuasneEffective = terr === "FR" ? thuasneFr : (thuasneTerritory ?? thuasneExpectedDrom);

            const donjoy = num(terrRow?.donjoy_price_ttc ?? null);
            const gibaud = num(terrRow?.gibaud_price_ttc ?? null);

            const competitors: CompetitorPrice[] = [];
            if (thuasneEffective !== null) competitors.push({ name: "Thuasne", price: thuasneEffective });
            if (donjoy !== null) competitors.push({ name: "Enovis (Donjoy)", price: donjoy });
            if (gibaud !== null) competitors.push({ name: "Gibaud", price: gibaud });

            const bestCompetitor =
              competitors.length > 0 ? competitors.reduce((m, c) => (c.price < m.price ? c : m), competitors[0]) : null;

            const gapPct =
              ourPrice !== null && bestCompetitor ? ((ourPrice - bestCompetitor.price) / bestCompetitor.price) * 100 : null;

            let status: PositionRow["status"] = "no_data";
            if (gapPct !== null) {
              if (gapPct > 5) status = "premium";
              else if (gapPct < -5) status = "underpriced";
              else status = "aligned";
            }

            const rank = ourPrice !== null && competitors.length ? computeRank(ourPrice, competitors) : null;

            const hs4 = hs4Of(p?.hs_code ?? null);
            const omParts = hs4 ? omMap.get(hs4) : undefined;
            const om = omParts?.om ?? null;
            const omr = omParts?.omr ?? null;
            const omTotalRate =
              terr === "FR" ? null : (om !== null || omr !== null) ? (om ?? 0) + (omr ?? 0) : null;

            const thuasneOmTotalRateBilled = omTotalRate !== null ? omTotalRate * 1.025 : null;

            const thuasneDromUpliftObservedPct =
              isDrom && thuasneFr !== null && thuasneTerritory !== null ? ((thuasneTerritory / thuasneFr) - 1) * 100 : null;

            return {
              productId: pid,
              sku,
              label,
              territory: terr,

              tarif_refMetropole,
              tarif_refDrom,

              ourPrice,

              thuasneFr,
              thuasneTerritory,
              thuasneExpectedDrom,
              thuasneEffective,

              donjoy,
              gibaud,

              competitors,
              bestCompetitor,

              gapPct,
              rank,
              competitorCount: competitors.length,

              status,

              hs4,
              omTotalRate,
              thuasneOmTotalRateBilled,
              thuasneDromUpliftObservedPct,
            };
          })
          .sort((a, b) => (a.sku || "").localeCompare(b.sku || ""));

        setRows(mapped);
        if (selectedSku && !mapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
      } catch (e: any) {
        console.error(e);
        if (!active) return;
        setError(e?.message || "Erreur chargement (product_prices / v_products_enriched / pricing_coefficients / om_rates)");
        setRows([]);
        setSelectedSku("");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [territory]); // volontaire : pas d’effet sur client/produit global

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

    const gaps = base.filter((r) => Number.isFinite(r.gapPct as number)).map((r) => r.gapPct as number);
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

    const isDrom = territoryIsDrom(territory);
    const upliftVals = isDrom
      ? base
          .filter((r) => Number.isFinite(r.thuasneDromUpliftObservedPct as number))
          .map((r) => r.thuasneDromUpliftObservedPct as number)
      : [];
    const upliftMedian = upliftVals.length ? median(upliftVals) : null;

    const anomaliesThuasne = isDrom
      ? base.filter((r) => r.thuasneDromUpliftObservedPct !== null && Math.abs((r.thuasneDromUpliftObservedPct as number) - 2) > 0.5).length
      : 0;

    const withCompetitor = base.filter((r) => r.competitorCount > 0).length;
    const coveragePct = total ? (withCompetitor / total) * 100 : 0;

    return { total, premium, aligned, underpriced, noData, avgGap, upliftMedian, anomaliesThuasne, coveragePct };
  }, [filtered, territory]);

  const toLowerPrice = React.useMemo(() => {
    return filtered
      .filter((r) => r.status === "premium" && r.bestCompetitor && r.ourPrice !== null)
      .sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0))
      .slice(0, 12);
  }, [filtered]);

  const toRaisePrice = React.useMemo(() => {
    return filtered
      .filter((r) => r.status === "underpriced" && r.bestCompetitor && r.ourPrice !== null)
      .sort((a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0))
      .slice(0, 12);
  }, [filtered]);

  const anomaliesThuasne = React.useMemo(() => {
    if (!territoryIsDrom(territory)) return [];
    return filtered
      .filter((r) => r.thuasneDromUpliftObservedPct !== null && Math.abs((r.thuasneDromUpliftObservedPct as number) - 2) > 0.5)
      .sort(
        (a, b) =>
          Math.abs((b.thuasneDromUpliftObservedPct as number) - 2) - Math.abs((a.thuasneDromUpliftObservedPct as number) - 2),
      )
      .slice(0, 12);
  }, [filtered, territory]);

  const missingData = React.useMemo(() => {
    return filtered.filter((r) => r.ourPrice === null || r.competitorCount === 0).slice(0, 12);
  }, [filtered]);

  return (
    // IMPORTANT : on ne met PLUS de background dark sur MainLayout -> évite de casser le header global + dropdowns
    <MainLayout contentClassName="md:p-6">
      <div className="space-y-4">
        {/* Bandeau lisible + “neon” discret */}
        <div className={cn("rounded-2xl p-5", neonHeader)}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-sky-700">Veille concurrentielle · stratégie prix</p>
              <h1 className="text-3xl font-bold text-slate-900">Concurrence & stratégie prix</h1>
              <p className="text-sm text-slate-600 mt-1">
                Objectif : signaux actionnables (premium / sous-pricé / anomalies / manque données) ·{" "}
                <span className="font-semibold text-slate-800">Couverture : {summary.coveragePct.toFixed(0)}%</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select value={territory} onValueChange={(v) => setTerritory(String(v).toUpperCase())}>
                <SelectTrigger className="w-[240px] bg-white border-slate-300 text-slate-900">
                  <SelectValue placeholder="Territoire" />
                </SelectTrigger>
                <SelectContent className="z-[500]">
                  {TERRITORIES.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (SKU ou libellé)"
                className="w-[280px] bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
              />

              <Select value={selectedSku} onValueChange={setSelectedSku}>
                <SelectTrigger className="w-[280px] bg-white border-slate-300 text-slate-900">
                  <SelectValue placeholder="Sélectionner un produit (SKU)" />
                </SelectTrigger>
                <SelectContent className="z-[500]">
                  {filtered.slice(0, 700).map((r) => (
                    <SelectItem key={r.sku} value={r.sku}>
                      {r.sku} — {(r.label || "Produit").slice(0, 48)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="secondary"
                className="bg-white border border-slate-300 text-slate-900 hover:bg-slate-50"
                onClick={() => setShowSources((s) => !s)}
              >
                <Database className="h-4 w-4 mr-2" />
                {showSources ? "Masquer sources" : "Afficher sources"}
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <Card className="border border-rose-200 bg-rose-50">
            <CardContent className="pt-6">
              <div className="text-sm text-rose-700">{error}</div>
            </CardContent>
          </Card>
        ) : null}

        {/* 3 cartes “claires” (plus de gris illisibles) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-700" />
                Hypothèses concurrentielles (visibles)
              </CardTitle>
              <CardDescription className="text-slate-600">
                Règles affichées pour une lecture business non ambiguë.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-800">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Thuasne — DROM</div>
                  <Badge variant="outline" className="border-sky-300 text-sky-800">
                    +2%
                  </Badge>
                </div>
                <div className="text-xs text-slate-700 mt-1">
                  Prix DROM attendu = <span className="font-semibold">prix catalogue FR</span> × 1.02
                </div>
                <div className="mt-2 text-xs text-slate-700">
                  <span className="font-semibold">Sous-info facturation Thuasne :</span> OM facturé = OM statutaire ×{" "}
                  <span className="font-semibold">1.025</span> (soit +2,5%).
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Enovis (Donjoy)</div>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    info non dispo
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 mt-1">On affiche uniquement les prix présents en base.</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Gibaud</div>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    info non dispo
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 mt-1">On affiche uniquement les prix présents en base.</div>
              </div>
            </CardContent>
          </Card>

          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-700" />
                Lecture rapide (pertinence business)
              </CardTitle>
              <CardDescription className="text-slate-600">Premium / sous-pricé / anomalies / gap moyen.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-600">Produits (filtrés)</div>
                <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-600">Couverture concurrence</div>
                <div className="text-2xl font-bold text-slate-900">{summary.coveragePct.toFixed(0)}%</div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs text-amber-800">À baisser (premium)</div>
                <div className="text-2xl font-bold text-amber-900">{summary.premium}</div>
                <div className="text-[11px] text-amber-800">&gt; +5% vs best</div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs text-emerald-800">À monter (sous-pricé)</div>
                <div className="text-2xl font-bold text-emerald-900">{summary.underpriced}</div>
                <div className="text-[11px] text-emerald-800">&lt; -5% vs best</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 col-span-2">
                <div className="text-xs text-slate-600">Gap moyen vs best (sur données)</div>
                <div className="text-2xl font-bold text-slate-900">
                  {summary.avgGap === null ? "—" : `${summary.avgGap.toFixed(1)}%`}
                </div>
                {territoryIsDrom(territory) ? (
                  <div className="text-xs text-slate-600 mt-1">
                    Uplift Thuasne médiane :{" "}
                    <span className="font-semibold">{summary.upliftMedian === null ? "—" : `${summary.upliftMedian.toFixed(2)}%`}</span>{" "}
                    · anomalies : <span className="font-semibold">{summary.anomaliesThuasne}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-1">Uplift Thuasne : n/a sur territoire non DROM.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <Database className="h-4 w-4 text-violet-700" />
                Sources & définitions (audit)
              </CardTitle>
              <CardDescription className="text-slate-600">Évite les “données incomprises”.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {showSources ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-900">Provenance</div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      <li>• Prix (MPL Conseil Export + concurrents) : <span className="font-mono">product_prices</span></li>
                      <li>• Tarif ref. : <span className="font-mono">v_products_enriched.tarif_ref_eur</span></li>
                      <li>• Tarif ref. DROM : <span className="font-mono">pricing_coefficients</span></li>
                      <li>• OM/OMR : <span className="font-mono">om_rates</span> (clé hs4)</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-900">Définitions</div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      <li>• Best concurrent = prix le plus bas disponible (Thuasne / Enovis / Gibaud)</li>
                      <li>• Gap % = (MPL Conseil Export − Best) / Best</li>
                      <li>• Premium = gap &gt; +5% (action baisser/justifier)</li>
                      <li>• Sous-pricé = gap &lt; −5% (action monter/optimiser)</li>
                      <li>• OM total = OM + OMR ; Thuasne OM facturé = OM total × 1.025</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-600">Sources masquées.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Frais DOM */}
        <Card className={neonCard}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-900">Frais supplémentaires par DROM (€/commande)</CardTitle>
            <CardDescription className="text-slate-600">Paramètre interne de simulation.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {DROM_CODES.map((code) => (
              <div key={code} className="space-y-1">
                <div className="text-xs text-slate-600 font-medium">{code}</div>
                <Input
                  type="number"
                  value={extraFees[code] ?? 0}
                  onChange={(e) => handleExtraFeeChange(code, e.target.value)}
                  className="h-9 bg-white border-slate-300 text-slate-900"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Boards actionnables */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-700" />
                À baisser (premium)
              </CardTitle>
              <CardDescription className="text-slate-600">MPL Conseil Export au-dessus du best concurrent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : toLowerPrice.length ? (
                toLowerPrice.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 transition",
                      "bg-white hover:bg-amber-50 border-slate-200 hover:border-amber-200",
                      selectedSku === r.sku && "border-amber-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-900 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. FR: {money(r.tarif_refMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. DROM: {money(r.tarif_refDrom)}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-amber-200 text-amber-800">
                          {pctLabel(r.gapPct)}
                        </Badge>
                        <div className="text-[11px] text-slate-600 mt-1">MPL: {money(r.ourPrice)}</div>
                        <div className="text-[11px] text-slate-600">
                          Best: {r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-600">Aucune opportunité.</div>
              )}
            </CardContent>
          </Card>

          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-700" />
                À monter (sous-pricé)
              </CardTitle>
              <CardDescription className="text-slate-600">MPL Conseil Export sous le marché.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : toRaisePrice.length ? (
                toRaisePrice.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 transition",
                      "bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-200",
                      selectedSku === r.sku && "border-emerald-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-900 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. FR: {money(r.tarif_refMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. DROM: {money(r.tarif_refDrom)}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                          {pctLabel(r.gapPct)}
                        </Badge>
                        <div className="text-[11px] text-slate-600 mt-1">MPL: {money(r.ourPrice)}</div>
                        <div className="text-[11px] text-slate-600">
                          Best: {r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-600">Aucune opportunité.</div>
              )}
            </CardContent>
          </Card>

          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-violet-700" />
                Anomalies Thuasne
              </CardTitle>
              <CardDescription className="text-slate-600">Écart vs règle DROM +2% (si données).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : anomaliesThuasne.length ? (
                anomaliesThuasne.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 transition",
                      "bg-white hover:bg-violet-50 border-slate-200 hover:border-violet-200",
                      selectedSku === r.sku && "border-violet-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-900 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. FR: {money(r.tarif_refMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. DROM: {money(r.tarif_refDrom)}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-violet-200 text-violet-800">
                          uplift {r.thuasneDromUpliftObservedPct === null ? "—" : `${r.thuasneDromUpliftObservedPct.toFixed(2)}%`}
                        </Badge>
                        <div className="text-[11px] text-slate-600 mt-1">
                          FR: {money(r.thuasneFr)} · DROM: {money(r.thuasneTerritory)}
                        </div>
                        <div className="text-[11px] text-slate-600">attendu: {money(r.thuasneExpectedDrom)}</div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-600">Aucune anomalie détectable (ou hors DROM).</div>
              )}
            </CardContent>
          </Card>

          <Card className={neonCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-700" />
                Données manquantes
              </CardTitle>
              <CardDescription className="text-slate-600">À compléter côté veille/pricing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : missingData.length ? (
                missingData.map((r) => (
                  <button
                    key={r.sku}
                    onClick={() => setSelectedSku(r.sku)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 transition",
                      "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300",
                      selectedSku === r.sku && "border-slate-400"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-900 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. FR: {money(r.tarif_refMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            Tarif ref. DROM: {money(r.tarif_refDrom)}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-600">
                        <div>MPL: {money(r.ourPrice)}</div>
                        <div>Concurrents: {r.competitorCount}</div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-600">OK — pas de manque critique.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Produit sélectionné */}
        <Card className={neonCard}>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Produit sélectionné</CardTitle>
            <CardDescription className="text-slate-600">
              Tarif ref. en référence (Métropole/DROM) avant lecture des prix et des écarts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : !selected ? (
              <div className="text-sm text-slate-600">Sélectionne un SKU pour afficher l’analyse.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-mono">{selected.sku}</div>
                    <div className="text-lg font-semibold text-slate-900">{selected.label || "Produit"}</div>
                    <div className="text-sm text-slate-600">Territoire : {selected.territory}</div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-200 text-slate-800">
                        Tarif ref. Métropole : {money(selected.tarif_refMetropole)}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 text-slate-800">
                        Tarif ref. DROM : {money(selected.tarif_refDrom)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        selected.status === "premium"
                          ? "text-amber-800 border-amber-200 bg-amber-50"
                          : selected.status === "underpriced"
                          ? "text-emerald-800 border-emerald-200 bg-emerald-50"
                          : selected.status === "aligned"
                          ? "text-sky-800 border-sky-200 bg-sky-50"
                          : "text-slate-700 border-slate-200 bg-slate-50"
                      )}
                    >
                      {selected.status}
                    </Badge>

                    <Badge variant="outline" className="text-slate-800 border-slate-200 bg-white">
                      Rang MPL Conseil Export : {selected.rank ?? "—"}
                    </Badge>

                    <Badge variant="outline" className="text-slate-800 border-slate-200 bg-white">
                      Gap vs best : {selected.gapPct === null ? "—" : `${selected.gapPct.toFixed(1)}%`}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border border-slate-200 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-900">Prix TTC — lecture simple</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">MPL Conseil Export</div>
                        <div className="font-semibold">{money(selected.ourPrice)}</div>
                      </div>

                      <div className="h-px bg-slate-200 my-2" />

                      <div className="flex items-center justify-between">
                        <div>Thuasne</div>
                        <div className="font-medium">{money(selected.thuasneEffective)}</div>
                      </div>
                      {territoryIsDrom(selected.territory) ? (
                        <div className="text-[11px] text-slate-600">
                          DROM attendu (FR×1.02) : {money(selected.thuasneExpectedDrom)} · uplift observé :{" "}
                          {selected.thuasneDromUpliftObservedPct === null ? "—" : `${selected.thuasneDromUpliftObservedPct.toFixed(2)}%`}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between">
                        <div>Enovis (Donjoy)</div>
                        <div className="font-medium">{money(selected.donjoy)}</div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>Gibaud</div>
                        <div className="font-medium">{money(selected.gibaud)}</div>
                      </div>

                      <div className="h-px bg-slate-200 my-2" />

                      <div className="flex items-center justify-between">
                        <div className="text-slate-700">Best concurrent</div>
                        <div className="font-medium">
                          {selected.bestCompetitor ? `${money(selected.bestCompetitor.price)} (${selected.bestCompetitor.name})` : "—"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-200 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-900">OM (audit)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="text-slate-700">HS4</div>
                        <div className="font-medium">{selected.hs4 ?? "—"}</div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-slate-700">OM total (OM+OMR)</div>
                        <div className="font-medium">
                          {selected.omTotalRate === null ? "—" : `${selected.omTotalRate.toFixed(2)}%`}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-slate-700">OM facturé Thuasne (+2,5%)</div>
                        <div className="font-medium">
                          {selected.thuasneOmTotalRateBilled === null ? "—" : `${selected.thuasneOmTotalRateBilled.toFixed(2)}%`}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mt-2">
                        <div className="text-xs text-slate-600">
                          Ici on affiche des <span className="font-semibold">taux</span> (audit). La conversion en montant dépendra de la base taxable.
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600">
                          Frais DOM paramétrés :{" "}
                          {territoryIsDrom(selected.territory) ? (
                            <span className="font-semibold text-slate-800">{extraFees[selected.territory] ?? 0}€ / commande</span>
                          ) : (
                            <span className="text-slate-500">n/a</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table : Tarif ref. AVANT prix */}
        <Card className={neonCard}>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Positionnement (liste)</CardTitle>
            <CardDescription className="text-slate-600">
              Lecture : <span className="font-semibold">Tarif ref.</span> → MPL Conseil Export → best concurrent → gap/rang.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>SKU</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Tarif ref. FR</TableHead>
                      <TableHead className="text-right">Tarif ref. DROM</TableHead>
                      <TableHead className="text-right">MPL Conseil Export TTC</TableHead>
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
                        className={cn("cursor-pointer", selectedSku === row.sku ? "bg-sky-50" : "hover:bg-slate-50")}
                        onClick={() => setSelectedSku(row.sku)}
                      >
                        <TableCell className="font-mono text-xs text-slate-700">{row.sku}</TableCell>
                        <TableCell className="font-medium text-slate-900">{row.label || "—"}</TableCell>

                        <TableCell className="text-right text-slate-900">{money(row.tarif_refMetropole)}</TableCell>
                        <TableCell className="text-right text-slate-900">{money(row.tarif_refDrom)}</TableCell>

                        <TableCell className="text-right font-semibold text-slate-900">{money(row.ourPrice)}</TableCell>

                        <TableCell className="text-slate-900">
                          {row.bestCompetitor ? (
                            <div>
                              <span className="font-semibold">{money(row.bestCompetitor.price)}</span>{" "}
                              <span className="text-xs text-slate-500">({row.bestCompetitor.name})</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        <TableCell
                          className={cn(
                            "text-right",
                            row.gapPct !== null && row.gapPct > 5
                              ? "text-amber-700"
                              : row.gapPct !== null && row.gapPct < -5
                              ? "text-emerald-700"
                              : "text-slate-700"
                          )}
                        >
                          {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "—"}
                        </TableCell>

                        <TableCell className="text-right text-slate-700">{row.rank ?? "—"}</TableCell>
                        <TableCell className="text-right text-slate-700">{row.competitorCount}</TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize",
                              row.status === "premium"
                                ? "text-amber-800 border-amber-200 bg-amber-50"
                                : row.status === "underpriced"
                                ? "text-emerald-800 border-emerald-200 bg-emerald-50"
                                : row.status === "aligned"
                                ? "text-sky-800 border-sky-200 bg-sky-50"
                                : "text-slate-700 border-slate-200 bg-slate-50"
                            )}
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}

                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm text-slate-500">
                          Aucun produit trouvé.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="pt-2 text-xs text-slate-500">
              Astuce : clique une carte “À baisser/monter” ou une ligne pour verrouiller l’analyse.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
