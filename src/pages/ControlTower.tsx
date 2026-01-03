import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  offset?: { x: number; y: number };
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
const MAP_HEIGHT = 680;

const DESTINATIONS: Destination[] = [
  { code: "FR", name: "Metropole", lat: 46.6, lon: 2.3, color: "#38bdf8" },
  { code: "GP", name: "Guadeloupe", lat: 16.265, lon: -61.551, color: "#fb7185", offset: { x: 32, y: -20 } },
  { code: "MQ", name: "Martinique", lat: 14.6415, lon: -61.0242, color: "#f59e0b", offset: { x: 6, y: 28 } },
  { code: "GF", name: "Guyane", lat: 4.0, lon: -53.0, color: "#22c55e" },
  { code: "RE", name: "Reunion", lat: -21.1151, lon: 55.5364, color: "#a855f7" },
  { code: "YT", name: "Mayotte", lat: -12.8275, lon: 45.1662, color: "#38bdf8" },
  { code: "SPM", name: "Saint-Pierre-et-Miquelon", lat: 46.8852, lon: -56.3159, color: "#0ea5e9" },
  { code: "BL", name: "Saint-Barthelemy", lat: 17.9, lon: -62.85, color: "#ec4899", offset: { x: -24, y: -18 } },
  { code: "MF", name: "Saint-Martin", lat: 18.0708, lon: -63.0501, color: "#10b981", offset: { x: 20, y: 8 } },
];

const formatMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));

const project = (lat: number, lon: number) => {
  const x = ((lon + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return { x, y };
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export default function ControlTower() {
  const navigate = useNavigate();
  const { resolvedRange, variables, setVariable, refreshToken } = useGlobalFilters();

  const [sales, setSales] = React.useState<SalesRow[]>([]);
  const [costs, setCosts] = React.useState<CostRow[]>([]);
  const [competition, setCompetition] = React.useState<CompetitionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [hovered, setHovered] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) return;
      setIsLoading(true);
      setError(null);
      try {
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
      if (!SUPABASE_ENV_OK) return;
      try {
        const territory = variables.territory_code || "FR";
        const { data, error: sbError } = await supabase
          .from("v_export_pricing")
          .select("sku,label,territory_code,plv_metropole_ttc,plv_om_ttc,thuasne_price_ttc,donjoy_price_ttc,gibaud_price_ttc")
          .eq("territory_code", territory)
          .limit(400);
        if (!active) return;
        if (sbError) throw sbError;

        const rows: CompetitionRow[] = (data || []).map((row: any) => {
          const orliman =
            territory === "FR"
              ? Number(row.plv_metropole_ttc) || null
              : Number(row.plv_om_ttc) || Number(row.plv_metropole_ttc) || null;
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
            territory_code: row.territory_code,
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
        if (active) setCompetition([]);
      }
    };
    void loadCompetition();
    return () => {
      active = false;
    };
  }, [variables.territory_code]);

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
      return { code: d.code, name: d.name, salesHt: ht, salesTtc: ttc, costs: c, margin: ht - c };
    }).sort((a, b) => b.salesHt - a.salesHt);

    return { totalSalesHt, totalSalesTtc, totalCosts, margin, byTerritory };
  }, [sales, costs]);

  const selected = variables.territory_code || hovered || "FR";
  const activeDest = DESTINATIONS.find((d) => d.code === selected) || DESTINATIONS[0];

  const nodes = React.useMemo(
    () =>
      DESTINATIONS.map((d) => {
        const base = project(d.lat, d.lon);
        return {
          ...d,
          x: base.x + (d.offset?.x || 0),
          y: base.y + (d.offset?.y || 0),
        };
      }),
    []
  );
  const metropole = nodes.find((n) => n.code === "FR")!;

const topList = totals.byTerritory.slice(0, 5);

const REGIONS = [
  // Rough simplified polygons (lat, lon) for a minimal world outline
  {
    name: "Americas North",
    points: [
      { lat: 72, lon: -168 },
      { lat: 12, lon: -168 },
      { lat: 12, lon: -52 },
      { lat: 72, lon: -52 },
    ],
  },
  {
    name: "Americas South",
    points: [
      { lat: 12, lon: -82 },
      { lat: -56, lon: -82 },
      { lat: -56, lon: -34 },
      { lat: 12, lon: -34 },
    ],
  },
  {
    name: "Europe Africa",
    points: [
      { lat: 72, lon: -25 },
      { lat: 72, lon: 50 },
      { lat: -36, lon: 50 },
      { lat: -36, lon: -25 },
    ],
  },
  {
    name: "Asia",
    points: [
      { lat: 78, lon: 45 },
      { lat: 78, lon: 180 },
      { lat: -10, lon: 180 },
      { lat: -10, lon: 45 },
    ],
  },
  {
    name: "Australia",
    points: [
      { lat: -8, lon: 110 },
      { lat: -8, lon: 160 },
      { lat: -45, lon: 160 },
      { lat: -45, lon: 110 },
    ],
  },
];

const regionPath = (pts: { lat: number; lon: number }[]) => {
  if (!pts.length) return "";
  const first = project(pts[0].lat, pts[0].lon);
  const rest = pts.slice(1).map((p) => project(p.lat, p.lon));
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")} Z`;
};

// Silhouette monde simplifiee pour un fond plus geographique (projection large)
const WORLD_PATH =
  "M146 52 L200 48 L260 70 L320 60 L340 90 L330 130 L290 140 L250 130 L210 150 L190 120 L160 110 L120 130 L110 160 L130 190 L170 200 L210 220 L220 250 L210 280 L170 270 L140 260 L110 280 L90 320 L70 330 L50 310 L40 280 L60 250 L80 220 L60 190 L50 150 L60 110 Z " +
  "M420 110 L460 120 L500 140 L520 170 L540 210 L530 240 L500 250 L470 240 L440 220 L430 190 L410 160 L400 130 Z " +
  "M600 90 L640 100 L680 120 L700 150 L710 190 L700 230 L670 240 L630 230 L600 210 L580 180 L570 140 Z " +
  "M760 200 L800 210 L830 230 L850 260 L840 290 L810 300 L780 290 L760 260 Z " +
  "M880 120 L930 130 L970 150 L990 180 L1000 220 L980 250 L950 260 L910 250 L880 230 L870 190 L860 150 Z " +
  "M720 320 L760 330 L780 360 L770 400 L740 420 L700 410 L680 380 L690 340 Z " +
  "M500 320 L540 330 L560 360 L550 390 L520 400 L490 380 L480 350 Z";

return (
    <MainLayout contentClassName="md:p-6 bg-slate-950">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-cyan-300/90 uppercase tracking-[0.35em]">Tour de controle export</p>
            <h1 className="text-3xl font-bold text-cyan-50 drop-shadow-sm">Flux DOM-TOM en temps reel</h1>
            <p className="text-sm text-slate-300/80">
              Carte geographique fidele: clic = filtre territoire, double clic = Explore prefiltre.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setVariable("territory_code", null)}>Reset territoire</Button>
            <Button onClick={() => navigate("/explore")}>Ouvrir Explore</Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px,1fr,340px]">
          <Card className="bg-slate-900/80 border-cyan-500/30 shadow-[0_10px_60px_rgba(14,116,144,0.25)] backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-100">
                KPIs globaux
                <Badge variant="secondary" className="rounded-full bg-cyan-500/20 text-cyan-200 border-cyan-500/40">Live</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Kpi label="Ventes HT" value={formatMoney(totals.totalSalesHt)} accent="text-sky-400" loading={isLoading} />
              <Kpi label="Ventes TTC" value={formatMoney(totals.totalSalesTtc)} accent="text-slate-400" loading={isLoading} />
              <Kpi label="Couts" value={formatMoney(totals.totalCosts)} accent="text-amber-400" loading={isLoading} />
              <Separator className="bg-cyan-500/30" />
              <Kpi label="Marge estimee" value={formatMoney(totals.margin)} accent="text-emerald-400" loading={isLoading} />
              {error ? <div className="text-xs text-rose-400">{error}</div> : null}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-cyan-500/30 bg-slate-950 shadow-[0_10px_80px_rgba(8,47,73,0.35)]">
            <CardContent className="p-0">
              <div className="relative w-full h-[680px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl">
                <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.18) 0, transparent 40%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.2) 0, transparent 35%), radial-gradient(circle at 30% 80%, rgba(34,197,94,0.14) 0, transparent 35%)" }} />
                <img
                  src={worldMap}
                  alt="Fond carte monde"
                  className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen pointer-events-none"
                />
                <div className="absolute inset-6 rounded-xl border border-cyan-500/10" />
                <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

                <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full h-full relative z-10">
                  <g className="opacity-30">
                    {REGIONS.map((r) => (
                      <path
                        key={r.name}
                        d={regionPath(r.points)}
                        fill="url(#regionFill)"
                        stroke="#38bdf8"
                        strokeWidth={0.6}
                        strokeOpacity={0.25}
                      />
                    ))}
                    <defs>
                      <linearGradient id="regionFill" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.08" />
                      </linearGradient>
                    </defs>
                  </g>

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
                          strokeWidth={isActive || isHover ? 2.8 : 1.4}
                          strokeOpacity={isActive || isHover ? 0.9 : 0.35}
                          className="transition-all duration-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.3)]"
                        />
                        <motion.circle
                          cx={node.x}
                          cy={node.y}
                          r={isActive || isHover ? 10 : 7}
                          fill={node.color}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.4 }}
                          className="cursor-pointer drop-shadow-[0_0_16px_rgba(56,189,248,0.65)]"
                          onMouseEnter={() => setHovered(node.code)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => setVariable("territory_code", node.code)}
                          onDoubleClick={() => {
                            setVariable("territory_code", node.code);
                            navigate("/explore");
                          }}
                        />
                        <text
                          x={node.x + 14}
                          y={node.y + 4}
                          className="text-xs font-semibold fill-cyan-100 drop-shadow"
                        >
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
                    className="cursor-pointer drop-shadow-[0_0_16px_rgba(14,165,233,0.65)]"
                    onMouseEnter={() => setHovered("FR")}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setVariable("territory_code", "FR")}
                    onDoubleClick={() => {
                      setVariable("territory_code", null);
                      navigate("/explore");
                    }}
                  />
                  <text
                    x={metropole.x + 18}
                    y={metropole.y + 4}
                    className="text-sm font-bold fill-cyan-100 drop-shadow"
                  >
                    Metropole
                  </text>
                </svg>

                <div className="absolute inset-0 pointer-events-none">
                  <Stars />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-cyan-500/30 shadow-[0_10px_60px_rgba(14,116,144,0.25)] backdrop-blur">
            <CardHeader>
              <CardTitle className="text-cyan-100">Top destinations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                topList.map((t) => (
                  <button
                    key={t.code}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition",
                      selected === t.code ? "border-cyan-400/50 bg-cyan-500/10" : "border-cyan-500/20 hover:bg-slate-800"
                    )}
                    onClick={() => setVariable("territory_code", t.code)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-cyan-100">{t.name}</div>
                      <Badge variant="outline">{t.code}</Badge>
                    </div>
                    <div className="text-xs text-slate-300/80">Ventes: {formatMoney(t.salesHt)}</div>
                  </button>
                ))
              )}

              <Separator className="bg-cyan-500/30" />
              <div>
                <p className="text-xs text-slate-300/80 mb-1">Detail selection</p>
                <DetailBlock
                  dest={activeDest}
                  data={totals.byTerritory.find((t) => t.code === activeDest.code)}
                  loading={isLoading}
                />
                <CompetitionBlock rows={competition} territory={activeDest.code} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function Kpi({ label, value, accent, loading }: { label: string; value: string; accent?: string; loading?: boolean }) {
  if (loading) return <Skeleton className="h-12 w-full" />;
  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-950/80 px-3 py-2 shadow-inner shadow-cyan-500/10">
      <div className="text-xs text-slate-300/80">{label}</div>
      <div className={cn("text-xl font-bold", accent)}>{value}</div>
    </div>
  );
}

function DetailBlock({ dest, data, loading }: { dest: Destination; data?: { salesHt: number; costs: number; margin: number }; loading?: boolean }) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  const margin = data ? data.margin : 0;
  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-950/80 px-3 py-3 space-y-2 shadow-inner shadow-cyan-500/10">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: dest.color }} />
        <div>
          <div className="text-sm font-semibold text-cyan-100">{dest.name}</div>
          <div className="text-[11px] text-slate-400">{dest.code}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-900 px-2 py-2 border border-cyan-500/20">
          <div className="text-[11px] text-slate-400">Ventes HT</div>
          <div className="font-semibold">{formatMoney(data?.salesHt || 0)}</div>
        </div>
        <div className="rounded-lg bg-slate-900 px-2 py-2 border border-cyan-500/20">
          <div className="text-[11px] text-slate-400">Couts</div>
          <div className="font-semibold">{formatMoney(data?.costs || 0)}</div>
        </div>
        <div className="rounded-lg bg-slate-900 px-2 py-2 border border-cyan-500/20">
          <div className="text-[11px] text-slate-400">Marge</div>
          <div className={cn("font-semibold", margin >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatMoney(margin)}</div>
        </div>
      </div>
    </div>
  );
}

function CompetitionBlock({ rows, territory }: { rows: CompetitionRow[]; territory: string }) {
  const filtered = rows.filter((r) => (r.territory_code || "FR") === territory).slice(0, 3);
  if (filtered.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3 space-y-2 shadow-inner shadow-cyan-500/10">
      <div className="flex items-center justify-between text-xs text-slate-300/80">
        <span>Concurrence</span>
        <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-200">
          {territory}
        </Badge>
      </div>
      {filtered.map((row) => (
        <div key={row.sku} className="rounded-lg border border-cyan-500/20 bg-slate-900/80 px-3 py-2">
          <div className="text-sm font-semibold text-cyan-100 truncate">{row.label || row.sku}</div>
          <div className="text-[11px] text-slate-400">SKU {row.sku}</div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-slate-300/80">
            <div>
              <div className="text-slate-400">Orliman</div>
              <div className="font-semibold text-cyan-200">{row.orliman ? formatMoney(row.orliman) : "?"}</div>
            </div>
            <div>
              <div className="text-slate-400">Best</div>
              <div className="font-semibold text-emerald-200">
                {row.bestCompetitor ? formatMoney(row.bestCompetitor) : "?"} {row.bestName ? `(${row.bestName})` : ""}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Gap</div>
              <div className={cn("font-semibold", row.gapPct !== null && row.gapPct > 5 ? "text-amber-300" : row.gapPct !== null && row.gapPct < -5 ? "text-emerald-300" : "text-slate-200")}>
                {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "n/a"}
              </div>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Statut: <span className={cn("font-semibold", row.status === "premium" ? "text-amber-300" : row.status === "underpriced" ? "text-emerald-300" : "text-cyan-200")}>{row.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildArc(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2 - Math.min(140, distance(a, b) * 0.2);
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
}

function Stars() {
  const dots = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 120; i++) {
      arr.push({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
      });
    }
    return arr;
  }, []);

  return (
    <div className="absolute inset-0">
      {dots.map((d) => (
        <span
          key={d.id}
          className="absolute rounded-full bg-slate-300 animate-pulse"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
            animationDuration: `${4 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}
