import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import worldMap from "@/assets/world-map.svg";

type Destination = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
};

type SalesRow = { id: string; sale_date: string; territory_code: string | null; amount_ht: number | null; amount_ttc: number | null };
type CostRow = { id: string; date: string | null; destination: string | null; amount: number | null; cost_type: string | null };
type CompetitionRow = {
  sku: string;
  label: string | null;
  territory_code: string | null;
  orliman: number | null;
  bestCompetitor: number | null;
  bestName: string | null;
  gapPct: number | null;
  status: "premium" | "aligned" | "underpriced" | "no_data";
};

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 640;

const DESTINATIONS: Destination[] = [
  { code: "FR", name: "Metropole", lat: 46.6, lon: 2.3, color: "#38bdf8" },
  { code: "GP", name: "Guadeloupe", lat: 16.265, lon: -61.551, color: "#fb7185" },
  { code: "MQ", name: "Martinique", lat: 14.6415, lon: -61.0242, color: "#f59e0b" },
  { code: "GF", name: "Guyane", lat: 4.0, lon: -53.0, color: "#22c55e" },
  { code: "RE", name: "Reunion", lat: -21.1151, lon: 55.5364, color: "#a855f7" },
  { code: "YT", name: "Mayotte", lat: -12.8275, lon: 45.1662, color: "#38bdf8" },
  { code: "SPM", name: "Saint-Pierre-et-Miquelon", lat: 46.8852, lon: -56.3159, color: "#0ea5e9" },
  { code: "BL", name: "Saint-Barthelemy", lat: 17.9, lon: -62.85, color: "#ec4899" },
  { code: "MF", name: "Saint-Martin", lat: 18.0708, lon: -63.0501, color: "#10b981" },
];

const formatMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));

const project = (lat: number, lon: number) => {
  const x = ((lon + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return { x, y };
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const buildArc = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const midX = (a.x + b.x) / 2;
  const midY = Math.min(a.y, b.y) - distance(a, b) * 0.18;
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
};

export default function ControlTower() {
  const navigate = useNavigate();
  const { resolvedRange, variables, setVariable, refreshToken, lastRefreshAt } = useGlobalFilters();

  const [sales, setSales] = React.useState<SalesRow[]>([]);
  const [costs, setCosts] = React.useState<CostRow[]>([]);
  const [competition, setCompetition] = React.useState<CompetitionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!SUPABASE_ENV_OK) throw new Error("Supabase non configure");

        const salesQuery = supabase
          .from("sales")
          .select("id,sale_date,territory_code,amount_ht,amount_ttc")
          .gte("sale_date", resolvedRange.from)
          .lte("sale_date", resolvedRange.to)
          .order("sale_date", { ascending: false })
          .limit(5000);

        const costQuery = supabase
          .from("cost_lines")
          .select("id,date,destination,amount,cost_type")
          .gte("date", resolvedRange.from)
          .lte("date", resolvedRange.to)
          .order("date", { ascending: false })
          .limit(5000);

        const [salesRes, costRes] = await Promise.all([salesQuery, costQuery]);
        if (!active) return;
        if (salesRes.error) throw salesRes.error;
        if (costRes.error) throw costRes.error;

        const filteredSales = (salesRes.data || []).filter((row) =>
          variables.territory_code ? row.territory_code === variables.territory_code : true
        );
        const filteredCosts = (costRes.data || []).filter((row) =>
          variables.territory_code ? row.destination === variables.territory_code : true
        );

        setSales(filteredSales as SalesRow[]);
        setCosts(filteredCosts as CostRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Erreur chargement donnees");
        setSales([
          { id: "demo1", sale_date: resolvedRange.from, territory_code: "GP", amount_ht: 1200, amount_ttc: 1400 },
          { id: "demo2", sale_date: resolvedRange.from, territory_code: "MQ", amount_ht: 800, amount_ttc: 920 },
        ]);
        setCosts([{ id: "demoC", date: resolvedRange.from, destination: "GP", amount: 300, cost_type: "transport" }]);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [resolvedRange.from, resolvedRange.to, variables.territory_code, refreshToken]);

  React.useEffect(() => {
    let active = true;
    const loadCompetition = async () => {
      try {
        if (!SUPABASE_ENV_OK) throw new Error("Supabase non configure");
        const { data, error } = await supabase
          .from("v_export_pricing")
          .select("sku,label,territory_code,plv_metropole_ttc,plv_om_ttc,thuasne_price_ttc,donjoy_price_ttc,gibaud_price_ttc")
          .in("territory_code", DESTINATIONS.map((d) => d.code))
          .limit(2000);
        if (!active) return;
        if (error) throw error;

        const rows: CompetitionRow[] = (data || []).map((row: any) => {
          const territory = row.territory_code || "FR";
          const orliman = territory === "FR" ? Number(row.plv_metropole_ttc) || null : Number(row.plv_om_ttc) || Number(row.plv_metropole_ttc) || null;
          const competitors = [
            { name: "Thuasne", price: Number(row.thuasne_price_ttc) || null },
            { name: "Donjoy", price: Number(row.donjoy_price_ttc) || null },
            { name: "Gibaud", price: Number(row.gibaud_price_ttc) || null },
          ].filter((c) => c.price !== null) as { name: string; price: number }[];
          const best = competitors.length ? competitors.reduce((m, c) => (c.price < m.price ? c : m), competitors[0]) : null;
          const gapPct = orliman && best ? ((orliman - best.price) / best.price) * 100 : null;
          let status: CompetitionRow["status"] = "no_data";
          if (gapPct !== null) {
            if (gapPct > 5) status = "premium";
            else if (gapPct < -5) status = "underpriced";
            else status = "aligned";
          }
          return {
            sku: row.sku,
            label: row.label,
            territory_code: territory,
            orliman,
            bestCompetitor: best?.price ?? null,
            bestName: best?.name ?? null,
            gapPct,
            status,
          };
        });
        setCompetition(rows);
      } catch (err) {
        console.error(err);
        if (!active) return;
        setCompetition([]);
      }
    };
    void loadCompetition();
    return () => {
      active = false;
    };
  }, []);

  const totals = React.useMemo(() => {
    const totalSalesHt = sales.reduce((s, r) => s + (r.amount_ht || 0), 0);
    const totalSalesTtc = sales.reduce((s, r) => s + (r.amount_ttc || 0), 0);
    const totalCosts = costs.reduce((s, r) => s + (r.amount || 0), 0);
    const margin = totalSalesHt - totalCosts;

    const byTerritory = DESTINATIONS.map((d) => {
      const tSales = sales.filter((r) => (r.territory_code || "FR") === d.code);
      const tCosts = costs.filter((c) => (c.destination || "FR") === d.code);
      const ht = tSales.reduce((s, r) => s + (r.amount_ht || 0), 0);
      const ttc = tSales.reduce((s, r) => s + (r.amount_ttc || 0), 0);
      const c = tCosts.reduce((s, r) => s + (r.amount || 0), 0);
      const marginEstimee = ht - c;
      const tauxMarge = ht > 0 ? (marginEstimee / ht) * 100 : null;
      return { code: d.code, name: d.name, salesHt: ht, salesTtc: ttc, costs: c, margin: marginEstimee, tauxMarge };
    }).sort((a, b) => {
      if (b.salesHt !== a.salesHt) return b.salesHt - a.salesHt;
      if (b.margin !== a.margin) return b.margin - a.margin;
      return 0;
    });

    return { totalSalesHt, totalSalesTtc, totalCosts, margin, byTerritory };
  }, [sales, costs]);

  const marginRate = React.useMemo(() => {
    if (totals.totalSalesHt <= 0) return null;
    return (totals.margin / totals.totalSalesHt) * 100;
  }, [totals.margin, totals.totalSalesHt]);

  const hasZeroState = React.useMemo(() => {
    const allZero =
      totals.totalSalesHt === 0 && totals.totalSalesTtc === 0 && totals.totalCosts === 0 && totals.margin === 0;
    return allZero || (!sales.length && !costs.length);
  }, [totals.totalSalesHt, totals.totalSalesTtc, totals.totalCosts, totals.margin, sales.length, costs.length]);

  const lastRefreshText = React.useMemo(() => {
    if (!lastRefreshAt) return "Live";
    const diffMs = Date.now() - lastRefreshAt;
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes <= 0) return "Live";
    return `il y a ${minutes} min`;
  }, [lastRefreshAt]);

  const selected = variables.territory_code || hovered || "FR";

  const nodes = React.useMemo(
    () =>
      DESTINATIONS.map((d) => {
        const base = project(d.lat, d.lon);
        return { ...d, x: base.x, y: base.y };
      }),
    []
  );
  const metropole = nodes.find((n) => n.code === "FR")!;
  const competitionByTerritory = React.useMemo(() => {
    return DESTINATIONS.map((d) => {
      const rows = competition.filter((r) => r.territory_code === d.code && Number.isFinite(r.gapPct));
      const avgGap = rows.length ? rows.reduce((s, r) => s + (r.gapPct as number), 0) / rows.length : null;
      return {
        territory: d.code,
        count: rows.length,
        avgGap,
      };
    });
  }, [competition]);
  const sortedTerritories = React.useMemo(() => {
    return totals.byTerritory.slice().sort((a, b) => {
      if (b.salesHt !== a.salesHt) return b.salesHt - a.salesHt;
      if (b.salesHt === 0 && a.salesHt === 0) {
        if (b.margin !== a.margin) return b.margin - a.margin;
      } else if (b.margin !== a.margin) {
        return b.margin - a.margin;
      }
      const gapA = competitionByTerritory.find((c) => c.territory === a.code)?.avgGap ?? -Infinity;
      const gapB = competitionByTerritory.find((c) => c.territory === b.code)?.avgGap ?? -Infinity;
      return gapB - gapA;
    });
  }, [competitionByTerritory, totals.byTerritory]);
  const topList = sortedTerritories.slice(0, 5);

  return (
    <MainLayout contentClassName="md:p-6 bg-slate-950">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs text-cyan-300/90 uppercase tracking-[0.35em]">Tour de controle export</p>
            <h1 className="text-3xl font-bold text-cyan-50 drop-shadow-sm">Flux DOM-TOM en temps reel</h1>
            <p className="text-sm text-slate-300/80">Carte interactive : clic = filtre territoire, double clic = Explore prefiltre.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-right justify-end">
            <div className="text-xs text-slate-300/80">
              <div className="font-semibold text-cyan-100">Période : {resolvedRange.label || "dernière période disponible"}</div>
              <div className="text-[11px] text-slate-400">
                Dernière mise à jour : <span className="text-emerald-300">Live</span>{" "}
                {lastRefreshText !== "Live" ? `· ${lastRefreshText}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setVariable("territory_code", null)}>Reset territoire</Button>
              <Button onClick={() => navigate("/explore")}>Ouvrir Explore</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <div className="space-y-4">
            <Card className="bg-slate-900/80 border-cyan-500/30 shadow-[0_10px_60px_rgba(14,116,144,0.25)] backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center flex-wrap gap-2 text-cyan-100">
                KPIs globaux
                <Badge variant="secondary" className="rounded-full bg-cyan-500/20 text-cyan-200 border-cyan-500/40">Live</Badge>
                {hasZeroState ? (
                  <Badge variant="outline" className="border-amber-400/40 text-amber-200 bg-amber-500/10">0€ = aucune donnée</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasZeroState ? (
                <EmptyState
                  onExplore={() => navigate("/explore")}
                  onImport={() => navigate("/sales")}
                  showImportCta
                />
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Kpi label="Ventes HT (€)" value={formatMoney(totals.totalSalesHt)} accent="text-sky-400" loading={isLoading} />
                <Kpi label="Ventes TTC (€)" value={formatMoney(totals.totalSalesTtc)} accent="text-slate-400" loading={isLoading} />
                <Kpi label="Coûts (€)" value={formatMoney(totals.totalCosts)} accent="text-amber-400" loading={isLoading} />
                <Kpi label="Marge estimée (€)" value={formatMoney(totals.margin)} accent="text-emerald-400" loading={isLoading} />
                <Kpi
                  label="Taux de marge (%)"
                  value={
                    marginRate === null
                      ? "—"
                      : `${marginRate.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`
                  }
                  accent={
                    marginRate === null
                      ? "text-slate-300/70"
                      : marginRate >= 20
                        ? "text-emerald-400"
                        : marginRate >= 10
                          ? "text-amber-300"
                          : "text-rose-400"
                  }
                  loading={isLoading}
                  badge={
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        marginRate === null
                          ? "text-slate-300 border-slate-500/40 bg-slate-700/30"
                          : marginRate >= 20
                            ? "text-emerald-200 border-emerald-400/40 bg-emerald-500/10"
                            : marginRate >= 10
                              ? "text-amber-200 border-amber-400/40 bg-amber-500/10"
                              : "text-rose-200 border-rose-400/40 bg-rose-500/10"
                      )}
                    >
                      {marginRate === null ? "N/A" : marginRate >= 20 ? "Solide" : marginRate >= 10 ? "À surveiller" : "À risque"}
                    </Badge>
                  }
                />
              </div>
              {error ? <div className="text-xs text-rose-400">{error}</div> : null}
            </CardContent>
          </Card>

            <Card className="relative overflow-hidden border-cyan-500/30 bg-slate-950 shadow-[0_10px_80px_rgba(8,47,73,0.35)]">
            <CardContent className="p-0">
              <div className="relative w-full h-[460px] lg:h-[520px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl">
                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.16) 0, transparent 40%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.18) 0, transparent 35%), radial-gradient(circle at 30% 80%, rgba(34,197,94,0.12) 0, transparent 35%)" }} />
                <div className="absolute inset-6 rounded-xl border border-cyan-500/10" />
                <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
                <img
                  src={worldMap}
                  alt="Fond carte monde"
                  className="absolute inset-0 h-full w-full object-cover opacity-55 pointer-events-none"
                  style={{ mixBlendMode: "screen" }}
                />

                <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full h-full relative z-10">
                  {nodes.filter((n) => n.code !== "FR").map((node) => {
                    const path = buildArc(metropole, node);
                    const isActive = selected === node.code;
                    const isHover = hovered === node.code;
                    return (
                      <g key={node.code}>
                        <path
                          d={path}
                          fill="none"
                          stroke={node.color}
                          strokeWidth={isActive || isHover ? 2.6 : 1.2}
                          strokeOpacity={isActive || isHover ? 0.9 : 0.35}
                          className="transition-all duration-300"
                        />
                        <circle cx={node.x} cy={node.y} r={isActive || isHover ? 12 : 9} fill={node.color} opacity={0.35} />
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isActive || isHover ? 7 : 5.5}
                          fill={node.color}
                          className="cursor-pointer"
                          onMouseEnter={() => setHovered(node.code)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => setVariable("territory_code", node.code)}
                          onDoubleClick={() => {
                            setVariable("territory_code", node.code);
                            navigate("/explore");
                          }}
                        />
                        <text x={node.x + 12} y={node.y - 8} className="text-xs font-semibold fill-cyan-100 drop-shadow">
                          {node.name}
                        </text>
                      </g>
                    );
                  })}

                  <motion.circle
                    cx={metropole.x}
                    cy={metropole.y}
                    r={hovered === "FR" || selected === "FR" ? 15 : 12}
                    fill="#0ea5e9"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered("FR")}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setVariable("territory_code", "FR")}
                    onDoubleClick={() => {
                      setVariable("territory_code", null);
                      navigate("/explore");
                    }}
                  />
                  <text x={metropole.x + 18} y={metropole.y + 4} className="text-sm font-bold fill-cyan-100 drop-shadow">
                    Metropole
                  </text>
                </svg>
              </div>
            </CardContent>
          </Card>

            <Card className="bg-slate-900/80 border-cyan-500/30 shadow-[0_10px_60px_rgba(14,116,144,0.25)] backdrop-blur">
              <CardHeader>
                <CardTitle className="text-cyan-100">Actions recommandées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-slate-300/80">Filtres actifs :</div>
                <div className="flex flex-wrap gap-2 text-xs text-cyan-100">
                  <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-50">
                    Territoire : {variables.territory_code || "Tous"}
                  </Badge>
                  <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-50">
                    Période : {resolvedRange.label}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <Button variant="outline" className="justify-start" onClick={() => navigate("/explore")}>
                    Ouvrir Explore
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate("/costs")}>
                    Voir Coûts & logistique
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate("/taxes-om")}>
                    Vérifier Taxes/OM
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900/80 border-cyan-500/30 shadow-[0_10px_60px_rgba(14,116,144,0.25)] backdrop-blur">
            <CardHeader>
              <CardTitle className="text-cyan-100">Dash par territoire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[520px] overflow-auto">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                topList.map((t) => {
                  const comp = competitionByTerritory.find((c) => c.territory === t.code);
                  const avgGap = comp?.avgGap;
                  const isTop = t.tauxMarge !== null && t.tauxMarge >= 20 && t.salesHt > 0;
                  const isRisk = (t.tauxMarge !== null && t.tauxMarge < 10) || (avgGap ?? -Infinity) > 20;
                  const badgeTone = isTop
                    ? { label: "Top", className: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40" }
                    : isRisk
                      ? { label: "À risque", className: "bg-rose-500/10 text-rose-200 border-rose-400/40" }
                      : null;
                  return (
                    <button
                      key={t.code}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2 text-left transition",
                        selected === t.code ? "border-cyan-400/50 bg-cyan-500/10" : "border-cyan-500/20 hover:bg-slate-800"
                      )}
                      onClick={() => setVariable("territory_code", t.code)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-cyan-100 flex items-center gap-2">
                          {t.name}
                          {badgeTone ? (
                            <Badge variant="outline" className={cn("text-[11px]", badgeTone.className)}>{badgeTone.label}</Badge>
                          ) : null}
                        </div>
                        <Badge variant="outline">{t.code}</Badge>
                      </div>
                      <div className="text-xs text-slate-300/80">Ventes: {formatMoney(t.salesHt)}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span>Marge: {formatMoney(t.margin)}</span>
                        <span className="text-slate-500">•</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="underline decoration-dotted underline-offset-4 cursor-help">Gap moyen</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-left">
                              Écart moyen entre prix catalogue et prix réellement vendu (transport & fiscalité inclus).
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>{avgGap === null ? "n/a" : `${avgGap.toFixed(1)}%`}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function EmptyState({ onExplore, onImport, showImportCta = true }: { onExplore: () => void; onImport?: () => void; showImportCta?: boolean }) {
  const canImport = Boolean(onImport);
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 px-3 py-3 text-sm text-amber-100 shadow-inner shadow-amber-500/10">
      <div className="font-semibold text-amber-50">Aucune donnée sur la période</div>
      <p className="text-amber-100/80 text-xs">Importez des ventes ou ajustez vos filtres (territoire / dates).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onExplore}>Ouvrir Explore</Button>
        {showImportCta ? (
          canImport ? (
            <Button size="sm" variant="outline" onClick={onImport}>Importer des ventes</Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" disabled>Importer des ventes</Button>
                </TooltipTrigger>
                <TooltipContent>Bientôt</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        ) : null}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent, loading, badge }: { label: string; value: string; accent?: string; loading?: boolean; badge?: React.ReactNode }) {
  if (loading) return <Skeleton className="h-10 w-full" />;
  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-950/80 px-3 py-3 shadow-inner shadow-cyan-500/10">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-300/80">{label}</div>
        {badge}
      </div>
      <div className={cn("text-xl font-bold", accent)}>{value}</div>
    </div>
  );
}
