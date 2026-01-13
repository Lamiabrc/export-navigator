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
  tarif_lppr_eur: number | null;
};

type LppCoefRow = { territory_code: string; coef: number | null };

type VatRow = { territory_code: string; rate: number | null };

type OmRow = {
  territory_code: string;
  hs4: string;
  om_rate: number | null;
  omr_rate: number | null;
};

type CompetitorPrice = { name: string; price: number };

type PositionRow = {
  productId: string;
  sku: string;
  label: string | null;
  territory: string;

  lpprMetropole: number | null;
  lpprDrom: number | null;

  ourPrice: number | null;

  thuasneFr: number | null;
  thuasneTerritory: number | null;
  thuasneExpectedDrom: number | null; // FR * 1.02
  thuasneEffective: number | null; // territory || expected

  donjoy: number | null; // Enovis (Donjoy)
  gibaud: number | null;

  competitors: CompetitorPrice[];
  bestCompetitor: CompetitorPrice | null;

  gapPct: number | null; // our vs best competitor
  rank: number | null;
  competitorCount: number;

  status: "premium" | "aligned" | "underpriced" | "no_data";

  hs4: string | null;
  omTotalRate: number | null; // OM + OMR
  thuasneOmTotalRateBilled: number | null; // OM total * 1.025

  thuasneDromUpliftObservedPct: number | null; // (th_drom/th_fr - 1)*100
};

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];

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

function pct(n: number | null | undefined) {
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

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const [territory, setTerritory] = React.useState<string>(variables.territory_code || "FR");
  const [search, setSearch] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState<string>("");

  const [rows, setRows] = React.useState<PositionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showSources, setShowSources] = React.useState(true);

  // Frais supplémentaires par DOM (€/commande) : utilisé dans la lecture / simulation si tu veux l’exploiter ensuite
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
        // On charge toujours le territoire demandé + FR pour calculer "Thuasne attendu DROM (FR * 1.02)"
        const wantedTerritories = Array.from(new Set(["FR", territory.toUpperCase()]));

        const { data: pp, error: ppErr } = await supabase
          .from("product_prices")
          .select("product_id, territory_code, plv_metropole_ttc, plv_om_ttc, thuasne_price_ttc, donjoy_price_ttc, gibaud_price_ttc")
          .in("territory_code", wantedTerritories)
          .limit(10000);

        if (!active) return;
        if (ppErr) throw ppErr;

        const ppRows = (pp || []) as unknown as ProductPriceRow[];

        // map product -> {FR, TERR}
        const byProduct = new Map<string, { FR?: ProductPriceRow; TERR?: ProductPriceRow }>();
        for (const r of ppRows) {
          const pid = r.product_id;
          if (!pid) continue;
          const rec = byProduct.get(pid) || {};
          const t = (r.territory_code || "").toUpperCase();
          if (t === "FR") rec.FR = r;
          if (t === territory.toUpperCase()) rec.TERR = r;
          byProduct.set(pid, rec);
        }

        const productIds = Array.from(byProduct.keys());
        if (!productIds.length) {
          setRows([]);
          setSelectedSku("");
          return;
        }

        const { data: products, error: pErr } = await supabase
          .from("products")
          .select("id, code_article, libelle_article, hs_code, tarif_lppr_eur")
          .in("id", productIds);

        if (!active) return;
        if (pErr) throw pErr;

        const productMap = new Map<string, ProductRow>();
        (products || []).forEach((p: any) => productMap.set(p.id, p as ProductRow));

        const [coefRes, vatRes] = await Promise.all([
          supabase.from("lpp_majoration_coefficients").select("territory_code, coef"),
          supabase.from("vat_rates").select("territory_code, rate"),
        ]);

        const coefData = (coefRes.data || []) as unknown as LppCoefRow[];
        const vatData = (vatRes.data || []) as unknown as VatRow[];

        const coefMap = new Map<string, number>();
        coefData.forEach((c) => {
          const code = (c.territory_code || "").toUpperCase();
          const v = num(c.coef);
          if (code && v !== null) coefMap.set(code, v);
        });

        const vatMap = new Map<string, number>();
        vatData.forEach((v) => {
          const code = (v.territory_code || "").toUpperCase();
          const r = num(v.rate);
          if (code && r !== null) vatMap.set(code, r);
        });

        // OM/OMR : on récupère uniquement le territoire sélectionné (FR inutile)
        const hs4List = productIds
          .map((id) => hs4Of(productMap.get(id)?.hs_code ?? null))
          .filter(Boolean) as string[];
        const hs4Uniq = Array.from(new Set(hs4List));

        let omRows: OmRow[] = [];
        if (hs4Uniq.length && territory.toUpperCase() !== "FR") {
          const { data: omData, error: omErr } = await supabase
            .from("om_rates")
            .select("territory_code, hs4, om_rate, omr_rate")
            .eq("territory_code", territory.toUpperCase())
            .in("hs4", hs4Uniq)
            .limit(10000);

          if (!active) return;
          if (omErr) console.warn("OM fetch warning", omErr.message);
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
            const terr = territory.toUpperCase();

            const isDrom = territoryIsDrom(terr);

            const lpprMetropole = num(p?.tarif_lppr_eur ?? null);
            const coef = terr === "FR" ? 1 : num(coefMap.get(terr) ?? null) ?? 1;
            const lpprDrom = lpprMetropole !== null ? lpprMetropole * coef : null;

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

            const thuasneOmTotalRateBilled =
              omTotalRate !== null ? omTotalRate * 1.025 : null;

            const thuasneDromUpliftObservedPct =
              isDrom && thuasneFr !== null && thuasneTerritory !== null
                ? ((thuasneTerritory / thuasneFr) - 1) * 100
                : null;

            return {
              productId: pid,
              sku,
              label,
              territory: terr,

              lpprMetropole,
              lpprDrom,

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

        // si le SKU sélectionné n’existe plus dans le territoire, on reset
        if (selectedSku && !mapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
      } catch (e: any) {
        console.error(e);
        if (!active) return;
        setError(e?.message || "Erreur chargement (product_prices / products / taxes)");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.sku + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rows, search]);

  const selected = React.useMemo(() => {
    if (!selectedSku) return null;
    return rows.find((r) => r.sku === selectedSku) || null;
  }, [rows, selectedSku]);

  // Synthèse “intelligence économique” (actionnable)
  const summary = React.useMemo(() => {
    const base = filtered;
    const total = base.length;

    const withCompetitor = base.filter((r) => r.competitorCount > 0).length;
    const coveragePct = total ? (withCompetitor / total) * 100 : 0;

    const premium = base.filter((r) => r.status === "premium").length;
    const aligned = base.filter((r) => r.status === "aligned").length;
    const underpriced = base.filter((r) => r.status === "underpriced").length;
    const noData = base.filter((r) => r.status === "no_data").length;

    const gaps = base.filter((r) => Number.isFinite(r.gapPct as number)).map((r) => r.gapPct as number);
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

    const isDrom = territoryIsDrom(territory.toUpperCase());
    const upliftVals = isDrom
      ? base
          .filter((r) => Number.isFinite(r.thuasneDromUpliftObservedPct as number))
          .map((r) => r.thuasneDromUpliftObservedPct as number)
      : [];
    const upliftMedian = upliftVals.length ? median(upliftVals) : null;

    const anomaliesThuasne = isDrom
      ? base.filter((r) => r.thuasneDromUpliftObservedPct !== null && Math.abs((r.thuasneDromUpliftObservedPct as number) - 2) > 0.5).length
      : 0;

    return {
      total,
      withCompetitor,
      coveragePct,
      premium,
      aligned,
      underpriced,
      noData,
      avgGap,
      upliftMedian,
      anomaliesThuasne,
    };
  }, [filtered, territory]);

  const toLowerPrice = React.useMemo(() => {
    return filtered
      .filter((r) => r.status === "premium" && r.bestCompetitor && r.ourPrice !== null)
      .sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0))
      .slice(0, 14);
  }, [filtered]);

  const toRaisePrice = React.useMemo(() => {
    return filtered
      .filter((r) => r.status === "underpriced" && r.bestCompetitor && r.ourPrice !== null)
      .sort((a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0))
      .slice(0, 14);
  }, [filtered]);

  const anomaliesThuasne = React.useMemo(() => {
    const isDrom = territoryIsDrom(territory.toUpperCase());
    if (!isDrom) return [];
    return filtered
      .filter((r) => r.thuasneDromUpliftObservedPct !== null && Math.abs((r.thuasneDromUpliftObservedPct as number) - 2) > 0.5)
      .sort((a, b) => Math.abs((b.thuasneDromUpliftObservedPct as number) - 2) - Math.abs((a.thuasneDromUpliftObservedPct as number) - 2))
      .slice(0, 14);
  }, [filtered, territory]);

  const missingData = React.useMemo(() => {
    return filtered
      .filter((r) => r.ourPrice === null || r.competitorCount === 0)
      .slice(0, 14);
  }, [filtered]);

  const headerTerritoryLabel = React.useMemo(() => {
    const t = territory.toUpperCase();
    if (t === "FR") return "Métropole (FR)";
    if (t === "GP") return "Guadeloupe (GP)";
    if (t === "MQ") return "Martinique (MQ)";
    if (t === "GF") return "Guyane (GF)";
    if (t === "RE") return "Réunion (RE)";
    if (t === "YT") return "Mayotte (YT)";
    return t;
  }, [territory]);

  return (
    <MainLayout contentClassName="md:p-6 bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(34,211,238,0.10),transparent_55%),radial-gradient(900px_520px_at_90%_10%,rgba(168,85,247,0.10),transparent_55%),linear-gradient(to_bottom,#020617,#0b1020)]">
      <div className="space-y-4 text-slate-100">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/90">Veille concurrentielle · stratégie prix</p>
            <h1 className="text-3xl font-bold text-white">Concurrence & stratégie prix</h1>
            <p className="text-sm text-slate-300">
              Territoire : <span className="font-semibold text-slate-100">{headerTerritoryLabel}</span> · Objectif :{" "}
              <span className="text-slate-200">signaux actionnables</span> (premium / sous-pricé / anomalies / manque données).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={territory} onValueChange={setTerritory}>
              <SelectTrigger className="w-[220px] bg-slate-950/60 border-cyan-400/20 text-slate-100">
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
              placeholder="Rechercher (SKU ou libellé)"
              className="w-[280px] bg-slate-950/60 border-cyan-400/20 text-slate-100 placeholder:text-slate-500"
            />

            <Select value={selectedSku} onValueChange={setSelectedSku}>
              <SelectTrigger className="w-[280px] bg-slate-950/60 border-cyan-400/20 text-slate-100">
                <SelectValue placeholder="Sélectionner un produit (SKU)" />
              </SelectTrigger>
              <SelectContent>
                {filtered.slice(0, 700).map((r) => (
                  <SelectItem key={r.sku} value={r.sku}>
                    {r.sku} — {(r.label || "Produit").slice(0, 46)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="secondary"
              className="bg-slate-950/60 border border-cyan-400/20 text-slate-100 hover:bg-slate-900"
              onClick={() => setShowSources((s) => !s)}
            >
              <Database className="h-4 w-4 mr-2" />
              {showSources ? "Masquer sources" : "Afficher sources"}
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border border-rose-400/30 bg-rose-950/20">
            <CardContent className="pt-6">
              <div className="text-sm text-rose-200">{error}</div>
            </CardContent>
          </Card>
        ) : null}

        {/* Control tower: Hypothèses + lecture rapide + sources */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="border border-cyan-400/20 bg-slate-950/50 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-cyan-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Hypothèses concurrentielles (à afficher clairement)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Règles appliquées / visibles pour la lecture business.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-cyan-400/15 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-100">Thuasne — DROM</div>
                  <Badge variant="outline" className="border-cyan-300/30 text-cyan-200">
                    +2%
                  </Badge>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Prix DROM attendu = <span className="text-slate-100">prix catalogue FR</span> × 1.02
                </div>

                {/* Sous-info OM majoré */}
                <div className="mt-2 text-xs text-slate-300">
                  <span className="text-slate-200 font-medium">Sous-info facturation Thuasne :</span>{" "}
                  OM facturé = OM statutaire × <span className="text-slate-100">1.025</span> (soit +2,5%).
                </div>
              </div>

              <div className="rounded-lg border border-violet-400/15 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-100">Enovis (Donjoy)</div>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    info non dispo
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Pas d’hypothèse de majoration fiable → on affiche uniquement les prix présents en base.
                </div>
              </div>

              <div className="rounded-lg border border-violet-400/15 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-100">Gibaud</div>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    info non dispo
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Pas d’hypothèse de majoration fiable → on affiche uniquement les prix présents en base.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-emerald-400/20 bg-slate-950/50 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-emerald-200 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Lecture rapide (pertinence business)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Couverture, signal premium/sous-pricé, anomalies Thuasne.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">Produits (filtrés)</div>
                <div className="text-2xl font-bold text-white">{summary.total}</div>
              </div>

              <div className="rounded-xl border border-emerald-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">Couverture concurrence</div>
                <div className="text-2xl font-bold text-emerald-200">{summary.coveragePct.toFixed(0)}%</div>
                <div className="text-[11px] text-slate-400">{summary.withCompetitor} / {summary.total} avec ≥1 concurrent</div>
              </div>

              <div className="rounded-xl border border-amber-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">À baisser (premium)</div>
                <div className="text-2xl font-bold text-amber-200">{summary.premium}</div>
                <div className="text-[11px] text-slate-400">&gt; +5% vs best concurrent</div>
              </div>

              <div className="rounded-xl border border-cyan-400/15 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">À monter (sous-pricé)</div>
                <div className="text-2xl font-bold text-cyan-200">{summary.underpriced}</div>
                <div className="text-[11px] text-slate-400">&lt; -5% vs best concurrent</div>
              </div>

              {territoryIsDrom(territory.toUpperCase()) ? (
                <>
                  <div className="rounded-xl border border-violet-400/15 bg-slate-950/40 p-3 col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">Thuasne : uplift observé (médiane)</div>
                        <div className="text-2xl font-bold text-violet-200">
                          {summary.upliftMedian === null ? "—" : `${summary.upliftMedian.toFixed(2)}%`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Anomalies vs règle 2%</div>
                        <div className="text-2xl font-bold text-rose-200">{summary.anomaliesThuasne}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      “Anomalie” = écart &gt; 0,5 point vs 2% (si prix FR et DROM Thuasne présents).
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3 col-span-2">
                  <div className="text-xs text-slate-400">Thuasne uplift DROM</div>
                  <div className="text-sm text-slate-300">Non applicable en territoire FR.</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-700/60 bg-slate-950/50 shadow-[0_0_40px_rgba(168,85,247,0.06)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Sources & définitions (éviter “données incomprises”)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Affiche d’où viennent les chiffres et à quoi ils servent.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {showSources ? (
                <>
                  <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
                    <div className="font-semibold text-slate-100">Provenance</div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      <li>• Prix (Orliman + concurrents) : table <span className="font-mono text-slate-100">product_prices</span></li>
                      <li>• Référence LPPR : table <span className="font-mono text-slate-100">products.tarif_lppr_eur</span></li>
                      <li>• LPPR DROM : table <span className="font-mono text-slate-100">lpp_majoration_coefficients</span> (coef par territoire)</li>
                      <li>• OM/OMR : table <span className="font-mono text-slate-100">om_rates</span> (clé : hs4)</li>
                      <li>• TVA : table <span className="font-mono text-slate-100">vat_rates</span></li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
                    <div className="font-semibold text-slate-100">Définitions KPI</div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      <li>• <span className="text-slate-100">Best concurrent</span> = le plus bas prix disponible (Thuasne / Enovis / Gibaud)</li>
                      <li>• <span className="text-slate-100">Gap %</span> = (Orliman − Best) / Best</li>
                      <li>• <span className="text-slate-100">Premium</span> = gap &gt; +5% (action : baisser/justifier)</li>
                      <li>• <span className="text-slate-100">Sous-pricé</span> = gap &lt; −5% (action : monter/optimiser)</li>
                      <li>• <span className="text-slate-100">OM total</span> = OM + OMR (si disponibles). Thuasne OM facturé = OM total × 1.025</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400">
                  Sources masquées — clique “Afficher sources” si tu veux auditer la provenance.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Frais DOM */}
        <Card className="border border-amber-400/15 bg-slate-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-200">Frais supplémentaires par DOM (€/commande)</CardTitle>
            <CardDescription className="text-slate-400">
              Paramètre interne : utile pour simuler une recommandation TTC “décisionnelle” ensuite.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {DROM_CODES.map((code) => (
              <div key={code} className="space-y-1">
                <div className="text-xs text-slate-300 font-medium">{code}</div>
                <Input
                  type="number"
                  value={extraFees[code] ?? 0}
                  onChange={(e) => handleExtraFeeChange(code, e.target.value)}
                  className="h-9 bg-slate-950/60 border-amber-400/15 text-slate-100"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action boards (très parlant / interactif) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <Card className="border border-amber-400/20 bg-slate-950/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-200 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                À baisser (premium)
              </CardTitle>
              <CardDescription className="text-slate-400">Orliman est au-dessus du best concurrent.</CardDescription>
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
                      "w-full text-left rounded-lg border px-3 py-2 transition",
                      "bg-slate-950/40 border-amber-400/15 hover:border-amber-300/35 hover:bg-slate-950/60",
                      selectedSku === r.sku && "border-amber-300/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-400 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-100 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        {/* LPPR avant prix */}
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR FR: {money(r.lpprMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR DROM: {money(r.lpprDrom)}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant="outline" className="border-amber-300/35 text-amber-200">
                          {pct(r.gapPct)}
                        </Badge>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Orli: {money(r.ourPrice)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Best: {r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-400">Aucune opportunité “à baisser” sur ce filtre.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-cyan-400/20 bg-slate-950/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-cyan-200 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                À monter (sous-pricé)
              </CardTitle>
              <CardDescription className="text-slate-400">Orliman est sous le marché (best concurrent).</CardDescription>
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
                      "w-full text-left rounded-lg border px-3 py-2 transition",
                      "bg-slate-950/40 border-cyan-400/15 hover:border-cyan-300/35 hover:bg-slate-950/60",
                      selectedSku === r.sku && "border-cyan-300/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-400 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-100 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        {/* LPPR avant prix */}
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR FR: {money(r.lpprMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR DROM: {money(r.lpprDrom)}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant="outline" className="border-cyan-300/35 text-cyan-200">
                          {pct(r.gapPct)}
                        </Badge>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Orli: {money(r.ourPrice)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Best: {r.bestCompetitor ? `${money(r.bestCompetitor.price)} (${r.bestCompetitor.name})` : "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-400">Aucune opportunité “à monter” sur ce filtre.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-violet-400/20 bg-slate-950/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-violet-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Anomalies Thuasne
              </CardTitle>
              <CardDescription className="text-slate-400">
                Écart observé vs règle DROM +2% (si données présentes).
              </CardDescription>
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
                      "w-full text-left rounded-lg border px-3 py-2 transition",
                      "bg-slate-950/40 border-violet-400/15 hover:border-violet-300/35 hover:bg-slate-950/60",
                      selectedSku === r.sku && "border-violet-300/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-400 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-100 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        {/* LPPR avant prix */}
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR FR: {money(r.lpprMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR DROM: {money(r.lpprDrom)}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant="outline" className="border-violet-300/35 text-violet-200">
                          uplift {r.thuasneDromUpliftObservedPct === null ? "—" : `${r.thuasneDromUpliftObservedPct.toFixed(2)}%`}
                        </Badge>
                        <div className="text-[11px] text-slate-400 mt-1">
                          FR: {money(r.thuasneFr)} · DROM: {money(r.thuasneTerritory)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          attendu: {money(r.thuasneExpectedDrom)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-400">Aucune anomalie Thuasne détectable (ou hors DROM).</div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-700/60 bg-slate-950/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Données manquantes
              </CardTitle>
              <CardDescription className="text-slate-400">À compléter côté veille / pricing interne.</CardDescription>
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
                      "w-full text-left rounded-lg border px-3 py-2 transition",
                      "bg-slate-950/40 border-slate-700/60 hover:border-slate-500 hover:bg-slate-950/60",
                      selectedSku === r.sku && "border-slate-400"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-400 font-mono">{r.sku}</div>
                        <div className="text-sm text-slate-100 font-semibold line-clamp-1">{r.label || "Produit"}</div>
                        {/* LPPR avant prix */}
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR FR: {money(r.lpprMetropole)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            LPPR DROM: {money(r.lpprDrom)}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400">
                        <div>Orli: {money(r.ourPrice)}</div>
                        <div>Concurrents: {r.competitorCount}</div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-400">OK — pas de manque critique sur ce filtre.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Produit sélectionné */}
        <Card className="border border-cyan-400/20 bg-slate-950/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">Produit sélectionné</CardTitle>
            <CardDescription className="text-slate-400">
              LPPR en référence (Métropole/DROM) avant lecture des prix et des écarts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : !selected ? (
              <div className="text-sm text-slate-400">Sélectionne un SKU (liste ou recherche) pour afficher l’analyse.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 font-mono">{selected.sku}</div>
                    <div className="text-lg font-semibold text-white">{selected.label || "Produit"}</div>
                    <div className="text-sm text-slate-300">Territoire : {selected.territory}</div>

                    {/* LPPR bien visible en premier */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-600 text-slate-100">
                        LPPR Métropole : {money(selected.lpprMetropole)}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-100">
                        LPPR DROM : {money(selected.lpprDrom)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        selected.status === "premium"
                          ? "text-amber-200 border-amber-300/35"
                          : selected.status === "underpriced"
                          ? "text-cyan-200 border-cyan-300/35"
                          : selected.status === "aligned"
                          ? "text-emerald-200 border-emerald-300/35"
                          : "text-slate-300 border-slate-600"
                      )}
                    >
                      {selected.status}
                    </Badge>

                    <Badge variant="outline" className="text-slate-100 border-slate-600">
                      Rang Orliman : {selected.rank ?? "—"}
                    </Badge>

                    <Badge variant="outline" className="text-slate-100 border-slate-600">
                      Gap vs best : {selected.gapPct === null ? "—" : `${selected.gapPct.toFixed(1)}%`}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border border-slate-700/60 bg-slate-950/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-100">Prix (TTC) — lecture simple</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-200">Orliman</div>
                        <div className="font-semibold text-white">{money(selected.ourPrice)}</div>
                      </div>

                      <div className="h-px bg-slate-800 my-2" />

                      <div className="flex items-center justify-between">
                        <div className="text-slate-300">Thuasne</div>
                        <div className="text-slate-100 font-medium">{money(selected.thuasneEffective)}</div>
                      </div>
                      {territoryIsDrom(selected.territory) ? (
                        <div className="text-[11px] text-slate-400">
                          DROM attendu (FR×1.02) : {money(selected.thuasneExpectedDrom)} ·
                          uplift observé :{" "}
                          {selected.thuasneDromUpliftObservedPct === null ? "—" : `${selected.thuasneDromUpliftObservedPct.toFixed(2)}%`}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between">
                        <div className="text-slate-300">Enovis (Donjoy)</div>
                        <div className="text-slate-100 font-medium">{money(selected.donjoy)}</div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-slate-300">Gibaud</div>
                        <div className="text-slate-100 font-medium">{money(selected.gibaud)}</div>
                      </div>

                      <div className="h-px bg-slate-800 my-2" />

                      <div className="flex items-center justify-between">
                        <div className="text-slate-300">Best concurrent</div>
                        <div className="text-slate-100 font-medium">
                          {selected.bestCompetitor ? `${money(selected.bestCompetitor.price)} (${selected.bestCompetitor.name})` : "—"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-700/60 bg-slate-950/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-100">Taxes / OM (lecture auditable)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-slate-300">HS4</div>
                        <div className="text-slate-100 font-medium">{selected.hs4 ?? "—"}</div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-slate-300">OM total (OM+OMR)</div>
                        <div className="text-slate-100 font-medium">
                          {selected.omTotalRate === null ? "—" : `${selected.omTotalRate.toFixed(2)}%`}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-slate-300">OM facturé Thuasne (+2,5%)</div>
                        <div className="text-slate-100 font-medium">
                          {selected.thuasneOmTotalRateBilled === null ? "—" : `${selected.thuasneOmTotalRateBilled.toFixed(2)}%`}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3 mt-2">
                        <div className="text-xs text-slate-400">
                          Note : ici on affiche les taux (audit). La conversion en montant dépendra de la base HT / valeur taxable.
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
                        <div className="text-xs text-slate-400">
                          Frais DOM (paramètre interne) :{" "}
                          {territoryIsDrom(selected.territory) ? (
                            <span className="text-slate-200 font-medium">{extraFees[selected.territory] ?? 0}€ / commande</span>
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

        {/* Table (LPPR avant prix) */}
        <Card className="border border-slate-700/60 bg-slate-950/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">Positionnement (liste)</CardTitle>
            <CardDescription className="text-slate-400">
              Priorité lecture : <span className="text-slate-200">LPPR</span> → <span className="text-slate-200">prix Orliman</span> → best concurrent → gap/rang.
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
              <div className="overflow-auto rounded-lg border border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-950/60">
                      <TableHead className="text-slate-200">SKU</TableHead>
                      <TableHead className="text-slate-200">Produit</TableHead>
                      <TableHead className="text-right text-slate-200">LPPR FR</TableHead>
                      <TableHead className="text-right text-slate-200">LPPR DROM</TableHead>
                      <TableHead className="text-right text-slate-200">Orliman TTC</TableHead>
                      <TableHead className="text-slate-200">Best concurrent</TableHead>
                      <TableHead className="text-right text-slate-200">Gap %</TableHead>
                      <TableHead className="text-right text-slate-200">Rang</TableHead>
                      <TableHead className="text-right text-slate-200"># conc.</TableHead>
                      <TableHead className="text-slate-200">Statut</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filtered.slice(0, 500).map((row) => (
                      <TableRow
                        key={row.sku}
                        className={cn(
                          "cursor-pointer",
                          selectedSku === row.sku ? "bg-slate-900/40" : "hover:bg-slate-900/20"
                        )}
                        onClick={() => setSelectedSku(row.sku)}
                      >
                        <TableCell className="font-mono text-xs text-slate-200">{row.sku}</TableCell>
                        <TableCell className="font-medium text-slate-100">{row.label || "—"}</TableCell>

                        <TableCell className="text-right text-slate-100">{money(row.lpprMetropole)}</TableCell>
                        <TableCell className="text-right text-slate-100">{money(row.lpprDrom)}</TableCell>

                        <TableCell className="text-right text-white font-semibold">{money(row.ourPrice)}</TableCell>

                        <TableCell className="text-slate-100">
                          {row.bestCompetitor ? (
                            <div>
                              <span className="font-semibold">{money(row.bestCompetitor.price)}</span>{" "}
                              <span className="text-xs text-slate-400">({row.bestCompetitor.name})</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>

                        <TableCell
                          className={cn(
                            "text-right",
                            row.gapPct !== null && row.gapPct > 5
                              ? "text-amber-200"
                              : row.gapPct !== null && row.gapPct < -5
                              ? "text-cyan-200"
                              : "text-slate-200"
                          )}
                        >
                          {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "—"}
                        </TableCell>

                        <TableCell className="text-right text-slate-200">{row.rank ?? "—"}</TableCell>
                        <TableCell className="text-right text-slate-200">{row.competitorCount}</TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize",
                              row.status === "premium"
                                ? "text-amber-200 border-amber-300/35"
                                : row.status === "underpriced"
                                ? "text-cyan-200 border-cyan-300/35"
                                : row.status === "aligned"
                                ? "text-emerald-200 border-emerald-300/35"
                                : "text-slate-300 border-slate-600"
                            )}
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}

                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm text-slate-400">
                          Aucun produit trouvé.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="pt-2 text-xs text-slate-400">
              Astuce : clique une ligne (ou une carte “à baisser/monter”) pour verrouiller l’analyse du produit.
            </div>
          </CardContent>
        </Card>

        {/* Mini note “audit contrast / pertinence” */}
        <Card className="border border-slate-700/60 bg-slate-950/40">
          <CardContent className="pt-6 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-200 mt-0.5" />
              <div>
                <div className="text-slate-200 font-semibold">Pourquoi cette page est “pertinente” en veille & stratégie ?</div>
                <div className="mt-1">
                  Elle force une lecture décisionnelle : <span className="text-slate-200">LPPR (référence)</span> →{" "}
                  <span className="text-slate-200">Orliman</span> → <span className="text-slate-200">best concurrent</span> →{" "}
                  <span className="text-slate-200">écart</span> → <span className="text-slate-200">action</span>.
                  Et elle rend visible ce qui est manquant (donc où investir la collecte d’info).
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
