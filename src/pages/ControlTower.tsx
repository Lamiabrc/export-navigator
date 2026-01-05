import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import worldMap from "@/assets/world-map.svg";
import {
  NeonSurface,
  NeonKpiCard,
  NeonDonutCard,
  NeonBarCard,
  NeonLineCard,
} from "@/components/dashboard/neon/NeonPrimitives";

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
    });

    return { totalSalesHt, totalSalesTtc, totalCosts, margin, byTerritory };
  }, [sales, costs]);

  const marginRate = React.useMemo(() => {
    if (totals.totalSalesHt <= 0) return null;
    return (totals.margin / totals.totalSalesHt) * 100;
  }, [totals.margin, totals.totalSalesHt]);

  const hasZeroState = React.useMemo(() => {
    const allZero = totals.totalSalesHt === 0 && totals.totalSalesTtc === 0 && totals.totalCosts === 0 && totals.margin === 0;
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
      return { territory: d.code, count: rows.length, avgGap };
    });
  }, [competition]);

  const topRoutes = React.useMemo(() => {
    const agg: Record<string, { route: string; volume: number; ca: number }> = {};
    sales.forEach((s) => {
      const code = s.territory_code || "FR";
      if (!agg[code]) agg[code] = { route: `FRA→${code}`, volume: 0, ca: 0 };
      agg[code].volume += 1;
      agg[code].ca += s.amount_ht || 0;
    });
    return Object.values(agg).sort((a, b) => b.volume - a.volume).slice(0, 6);
  }, [sales]);

  const timeseries = React.useMemo(() => {
    const bucket: Record<string, { label: string; sales: number; costs: number }> = {};
    sales.forEach((s) => {
      const key = (s.sale_date || "").slice(0, 10);
      bucket[key] ||= { label: key, sales: 0, costs: 0 };
      bucket[key].sales += s.amount_ht || 0;
    });
    costs.forEach((c) => {
      const key = (c.date || "").slice(0, 10);
      bucket[key] ||= { label: key, sales: 0, costs: 0 };
      bucket[key].costs += c.amount || 0;
    });
    return Object.values(bucket)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((row) => {
        const margin = row.sales - row.costs;
        return { ...row, marginPct: row.sales > 0 ? (margin / row.sales) * 100 : 0 };
      });
  }, [sales, costs]);

  const donuts = React.useMemo(() => {
    const base = marginRate ?? 10;
    const clamp = (v: number) => Math.min(95, Math.max(35, v));
    return {
      transport: clamp(70 + base / 6),
      docs: clamp(62 + base / 8),
      incoterm: clamp(55 + base / 10),
      invoice: clamp(68 + base / 12),
      deltaTransport: 1.2,
      deltaDocs: -0.5,
      deltaIncoterm: 0.8,
      deltaInvoice: 0.6,
    };
  }, [marginRate]);

  const alerts = React.useMemo(() => {
    const list = [];
    if ((marginRate ?? 0) < 5) list.push({ label: "Marge < 5% sur la période", severity: "warning" });
    if (!sales.length) list.push({ label: "Aucune vente sur la période filtrée", severity: "warning" });
    if (!costs.length) list.push({ label: "Pas de coûts logistiques injectés", severity: "warning" });
    return list.slice(0, 3);
  }, [marginRate, sales.length, costs.length]);

  const actions = ["Ouvrir Explore", "Optimiser incoterm", "Importer CSV coûts"];

  return (
    <MainLayout className="control-tower-neon min-h-screen">
      <div className="space-y-4 px-3 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs text-cyan-200/80 uppercase tracking-[0.35em]">Tour de controle export</p>
            <h1 className="text-3xl font-bold text-slate-50 drop-shadow-sm">Flux DOM-TOM en temps réel</h1>
            <p className="text-sm text-slate-300/80">Carte : clic = filtre, double clic = Explore préfiltré.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-right justify-end">
            <div className="text-xs text-slate-300/80">
              <div className="font-semibold text-cyan-100">Période : {resolvedRange.label || "dernière période"}</div>
              <div className="text-[11px] text-slate-400">
                Dernière mise à jour : <span className="text-emerald-300">Live</span> {lastRefreshText !== "Live" ? `• ${lastRefreshText}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setVariable("territory_code", null)}>
                Reset territoire
              </Button>
              <Button onClick={() => navigate("/explore")}>Ouvrir Explore</Button>
            </div>
          </div>
        </div>

        {/* Ligne 1 : carte + donuts */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-8">
            <NeonSurface className="h-[460px] relative overflow-hidden">
              <div className="absolute top-3 left-3 grid grid-cols-3 gap-3 w-[360px] z-20">
                <NeonKpiCard label="CA cumulé" value={formatMoney(totals.totalSalesHt)} delta={3.2} />
                <NeonKpiCard label="On-time transport" value={`${donuts.transport.toFixed(0)}%`} delta={donuts.deltaTransport} />
                <NeonKpiCard label="Lead time (j)" value={(donuts.transport / 10).toFixed(1)} delta={-1.1} accent="var(--chart-3)" />
              </div>

              <img
                src={worldMap}
                alt="World map"
                className="absolute inset-0 h-full w-full object-cover opacity-70 pointer-events-none"
                style={{ mixBlendMode: "screen" }}
              />

              <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full h-full relative z-10">
                {nodes
                  .filter((n) => n.code !== "FR")
                  .map((node) => {
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

              {hasZeroState ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Aucune donnée sur la période. Ajuste les filtres ou importe des ventes.
                  </div>
                </div>
              ) : null}
            </NeonSurface>
          </div>

          <div className="col-span-12 lg:col-span-4 grid grid-rows-4 gap-3">
            <NeonDonutCard label="On-time transport" value={donuts.transport} delta={donuts.deltaTransport} />
            <NeonDonutCard label="Docs conformes" value={donuts.docs} delta={donuts.deltaDocs} color="var(--chart-2)" />
            <NeonDonutCard label="Incoterm correct" value={donuts.incoterm} delta={donuts.deltaIncoterm} color="var(--chart-3)" />
            <NeonDonutCard label="Factures validées" value={donuts.invoice} delta={donuts.deltaInvoice} color="var(--chart-4)" />
          </div>
        </div>

        {/* Ligne 2 : barres + mini DOM + courbe */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-4">
            <NeonBarCard title="Top routes par volume" data={topRoutes} dataKey="volume" labelKey="route" />
          </div>
          <div className="col-span-12 md:col-span-4">
            <NeonSurface className="h-full">
              <div className="mb-2 text-sm text-slate-300/80">DOM focus</div>
              <div className="text-xs text-slate-300/80">A brancher: SLA moyen + coût moyen / territoire.</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-100">
                {totals.byTerritory
                  .filter((t) => t.code !== "FR")
                  .slice(0, 4)
                  .map((t) => (
                    <div key={t.code} className="rounded-lg border border-cyan-500/20 bg-slate-900/50 px-2 py-2">
                      <div className="flex items-center justify-between text-xs text-slate-300/80">
                        <span>{t.name}</span>
                        <span className="text-cyan-200">{t.code}</span>
                      </div>
                      <div className="text-sm font-semibold">{formatMoney(t.salesHt)}</div>
                      <div className="text-[11px] text-slate-400">
                        Marge: {t.margin >= 0 ? "+" : ""}
                        {formatMoney(t.margin)} {t.tauxMarge !== null ? `(${t.tauxMarge.toFixed(1)}%)` : ""}
                      </div>
                    </div>
                  ))}
              </div>
            </NeonSurface>
          </div>
          <div className="col-span-12 md:col-span-4">
            <NeonLineCard
              title="CA / Marge / Coûts (30j)"
              data={timeseries}
              lines={[
                { key: "sales", color: "var(--chart-1)" },
                { key: "marginPct", color: "var(--chart-3)" },
                { key: "costs", color: "var(--chart-2)" },
              ]}
            />
          </div>
        </div>

        {/* Ligne 3 : alertes + actions */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-6">
            <NeonSurface>
              <div className="mb-2 text-sm text-slate-300/80">Alertes</div>
              {!alerts.length ? (
                <div className="text-xs text-slate-400">Aucune alerte</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {alerts.map((a) => (
                    <li key={a.label} className="flex items-center gap-2">
                      <span className="text-amber-300">●</span>
                      <span>{a.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Button onClick={() => navigate("/explore")}>Ouvrir Explore</Button>
              </div>
            </NeonSurface>
          </div>
          <div className="col-span-12 md:col-span-6">
            <NeonSurface className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button key={a} variant="outline" className="border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/10" onClick={() => a === "Ouvrir Explore" ? navigate("/explore") : null}>
                  {a}
                </Button>
              ))}
            </NeonSurface>
          </div>
        </div>

        {error ? (
          <div className="text-sm text-rose-300">
            Erreur chargement données : {error}. Affichage des données démo si disponibles.
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
