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

type Destination = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
};

type SalesRow = { id: string; sale_date: string; territory_code: string | null; amount_ht: number | null; amount_ttc: number | null };
type CostRow = { id: string; date: string | null; destination: string | null; amount: number | null; cost_type: string | null };

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 680;

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

export default function ControlTower() {
  const navigate = useNavigate();
  const { resolvedRange, variables, setVariable, refreshToken } = useGlobalFilters();

  const [sales, setSales] = React.useState<SalesRow[]>([]);
  const [costs, setCosts] = React.useState<CostRow[]>([]);
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

  const nodes = React.useMemo(() => DESTINATIONS.map((d) => ({ ...d, ...project(d.lat, d.lon) })), []);
  const metropole = nodes.find((n) => n.code === "FR")!;

  const topList = totals.byTerritory.slice(0, 5);

  return (
    <MainLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-cyan-300/90 uppercase tracking-[0.2em]">Tour de controle export</p>
            <h1 className="text-2xl font-bold text-cyan-50">Flux DOM-TOM en temps reel</h1>
            <p className="text-sm text-slate-300/80">
              Carte geographique fidele: clic = filtre territoire, double clic = Explore prefiltre.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setVariable("territory_code", null)}>Reset territoire</Button>
            <Button onClick={() => navigate("/explore")}>Ouvrir Explore</Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px,1fr,320px]">
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

          <Card className="relative overflow-hidden border-cyan-500/30 bg-slate-950">
            <CardContent className="p-0">
              <div className="relative w-full h-[640px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
                <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.14) 0, transparent 40%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.16) 0, transparent 35%), radial-gradient(circle at 30% 80%, rgba(34,197,94,0.1) 0, transparent 35%)" }} />
                <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

                <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full h-full relative z-10">
                  {nodes.filter((n) => n.code !== "FR").map((node) => {
                    const path = buildArc(metropole, node);
                    const isActive = selected === node.code;
                    return (
                      <g key={node.code}>
                        <path
                          d={path}
                          fill="none"
                          stroke={node.color}
                          strokeWidth={isActive ? 2.4 : 1.4}
                          strokeOpacity={isActive ? 0.8 : 0.35}
                          className="transition-all duration-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.3)]"
                        />
                        <motion.circle
                          cx={node.x}
                          cy={node.y}
                          r={isActive ? 9 : 7}
                          fill={node.color}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.4 }}
                          className="cursor-pointer drop-shadow-[0_0_12px_rgba(56,189,248,0.55)]"
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
                    r={14}
                    fill="#0ea5e9"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="cursor-pointer drop-shadow-[0_0_16px_rgba(14,165,233,0.55)]"
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
