import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { isMissingTableError } from "@/domain/calc";
import worldMap from "@/assets/world-map.svg";
import { TERRITORY_COORDS } from "@/domain/geo/territoryCoords";
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

type SalesRow = {
  id: string;
  sale_date: string;
  territory_code: string | null;
  amount_ht: number | null;
  amount_ttc: number | null;
};

type CostRow = {
  id: string;
  date: string | null;
  destination: string | null;
  amount: number | null;
  cost_type: string | null;
};

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

type SvgMeta = {
  width: number;
  height: number;
  geo: { left: number; top: number; right: number; bottom: number };
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

// fallback si jamais fetch/parse du svg échoue
const FALLBACK_META: SvgMeta = {
  width: 1009.6727,
  height: 665.963,
  geo: { left: -169.110266, top: 83.600842, right: 190.486279, bottom: -58.508473 },
};

async function loadSvgMeta(url: string): Promise<SvgMeta> {
  const txt = await fetch(url).then((r) => r.text());

  const w = Number((txt.match(/width="([\d.]+)/)?.[1] ?? FALLBACK_META.width).toString());
  const h = Number((txt.match(/height="([\d.]+)/)?.[1] ?? FALLBACK_META.height).toString());

  const geoStr = txt.match(/mapsvg:geoViewBox="([^"]+)"/)?.[1];
  if (!geoStr) return { ...FALLBACK_META, width: w || FALLBACK_META.width, height: h || FALLBACK_META.height };

  const parts = geoStr.split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return { ...FALLBACK_META, width: w || FALLBACK_META.width, height: h || FALLBACK_META.height };
  }

  const [left, top, right, bottom] = parts;
  return {
    width: w || FALLBACK_META.width,
    height: h || FALLBACK_META.height,
    geo: { left, top, right, bottom },
  };
}

// ✅ Projection Mercator (match world-map.svg MapSVG)
function projectMercator(lat: number, lon: number, meta: SvgMeta) {
  const { width, height, geo } = meta;

  const x = ((lon - geo.left) / (geo.right - geo.left)) * width;

  const latClamped = clamp(lat, -85, 85); // mercator safe
  const merc = (la: number) => Math.log(Math.tan(Math.PI / 4 + rad(la) / 2));

  const mercTop = merc(geo.top);
  const mercBottom = merc(geo.bottom);
  const y = ((mercTop - merc(latClamped)) / (mercTop - mercBottom)) * height;

  return { x, y };
}

const COLORS: Record<string, string> = {
  FR: "#38bdf8",
  GP: "#fb7185",
  MQ: "#f59e0b",
  GF: "#22c55e",
  RE: "#a855f7",
  YT: "#38bdf8",
  SPM: "#0ea5e9",
  BL: "#ec4899",
  MF: "#10b981",
};

const formatMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

function buildArc(sx: number, sy: number, ex: number, ey: number) {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = clamp(len * 0.14, 18, 130);
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
}

export default function ControlTower() {
  const navigate = useNavigate();
  const { resolvedRange, variables, setVariable, refreshToken, lastRefreshAt } = useGlobalFilters();

  const [svgMeta, setSvgMeta] = React.useState<SvgMeta>(FALLBACK_META);

  const [salesAll, setSalesAll] = React.useState<SalesRow[]>([]);
  const [costsAll, setCostsAll] = React.useState<CostRow[]>([]);
  const [competition, setCompetition] = React.useState<CompetitionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);
  const [zoomTarget, setZoomTarget] = React.useState<"none" | "antilles">("none");
  const [viewport, setViewport] = React.useState<{ scale: number; tx: number; ty: number }>({ scale: 1, tx: 0, ty: 0 });

  const draggingRef = React.useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const zoomLayerRef = React.useRef<HTMLDivElement | null>(null);

  // ✅ lire width/height + geoViewBox depuis le SVG (robuste si tu changes l’asset)
  React.useEffect(() => {
    let alive = true;
    loadSvgMeta(worldMap)
      .then((m) => {
        if (alive) setSvgMeta(m);
      })
      .catch(() => {
        // ignore -> fallback meta
      });
    return () => {
      alive = false;
    };
  }, []);

  // ⚠️ codes DOM-TOM
  const dromCodes = React.useMemo(() => ["GP", "MQ", "GF", "RE", "YT", "BL", "MF", "SPM"], []);

  const normalizeTerritory = React.useCallback(
    (code: string | null | undefined) => {
      const c = (code || "").toUpperCase();
      return dromCodes.includes(c) ? c : "FR";
    },
    [dromCodes]
  );

  // ✅ Destinations : on réutilise territoryCoords.ts (plus “inutile”)
  const DESTINATIONS: Destination[] = React.useMemo(() => {
    const hub = TERRITORY_COORDS.HUB; // Orliman FR
    return [
      { code: "FR", name: "Metropole", lat: hub?.lat ?? 48.86, lon: hub?.lng ?? 2.35, color: COLORS.FR },
      { code: "GP", name: "Guadeloupe", lat: TERRITORY_COORDS.GP?.lat ?? 16.265, lon: TERRITORY_COORDS.GP?.lng ?? -61.551, color: COLORS.GP },
      { code: "MQ", name: "Martinique", lat: TERRITORY_COORDS.MQ?.lat ?? 14.6415, lon: TERRITORY_COORDS.MQ?.lng ?? -61.0242, color: COLORS.MQ },
      { code: "GF", name: "Guyane", lat: TERRITORY_COORDS.GF?.lat ?? 4.0, lon: TERRITORY_COORDS.GF?.lng ?? -53.0, color: COLORS.GF },
      { code: "RE", name: "Reunion", lat: TERRITORY_COORDS.RE?.lat ?? -21.1151, lon: TERRITORY_COORDS.RE?.lng ?? 55.5364, color: COLORS.RE },
      { code: "YT", name: "Mayotte", lat: TERRITORY_COORDS.YT?.lat ?? -12.8275, lon: TERRITORY_COORDS.YT?.lng ?? 45.1662, color: COLORS.YT },
      // SPM pas dans TERRITORY_COORDS -> fallback ici
      { code: "SPM", name: "Saint-Pierre-et-Miquelon", lat: 46.8852, lon: -56.3159, color: COLORS.SPM },
      { code: "BL", name: "Saint-Barthelemy", lat: TERRITORY_COORDS.BL?.lat ?? 17.9, lon: TERRITORY_COORDS.BL?.lng ?? -62.85, color: COLORS.BL },
      { code: "MF", name: "Saint-Martin", lat: TERRITORY_COORDS.MF?.lat ?? 18.0708, lon: TERRITORY_COORDS.MF?.lng ?? -63.0501, color: COLORS.MF },
    ];
  }, []);

  // ✅ positions projetées (Mercator)
  const nodes = React.useMemo(() => {
    return DESTINATIONS.map((d) => {
      const p = projectMercator(d.lat, d.lon, svgMeta);
      return { ...d, x: p.x, y: p.y };
    });
  }, [DESTINATIONS, svgMeta]);

  const metropole = React.useMemo(() => nodes.find((n) => n.code === "FR")!, [nodes]);

  // ✅ load data (NE PAS refiltrer ici → sinon “blocage” quand filtre = vide)
  React.useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setWarning(null);
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

        let costData = costRes.data || [];
        if (costRes.error) {
          if (isMissingTableError(costRes.error)) {
            const fallback = await supabase
              .from("costs")
              .select("id,date,destination,amount,cost_type")
              .gte("date", resolvedRange.from)
              .lte("date", resolvedRange.to)
              .order("date", { ascending: false })
              .limit(5000);
            if (fallback.error) throw fallback.error;
            costData = fallback.data || [];
            setWarning("Table cost_lines absente, fallback sur costs.");
          } else {
            throw costRes.error;
          }
        }

        setSalesAll((salesRes.data || []) as SalesRow[]);
        setCostsAll((costData || []) as CostRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Erreur chargement donnees");
        // démo safe
        setSalesAll([
          { id: "demo1", sale_date: resolvedRange.from, territory_code: "GP", amount_ht: 1200, amount_ttc: 1400 },
          { id: "demo2", sale_date: resolvedRange.from, territory_code: "MQ", amount_ht: 800, amount_ttc: 920 },
        ]);
        setCostsAll([{ id: "demoC", date: resolvedRange.from, destination: "GP", amount: 300, cost_type: "transport" }]);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [resolvedRange.from, resolvedRange.to, refreshToken]);

  // competition (inchangé)
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

  const selectedTerritory = variables.territory_code ? variables.territory_code.toUpperCase() : null;

  // ✅ vues filtrées (au bon endroit)
  const salesView = React.useMemo(() => {
    if (!selectedTerritory) return salesAll;
    return salesAll.filter((r) => normalizeTerritory(r.territory_code) === selectedTerritory);
  }, [normalizeTerritory, salesAll, selectedTerritory]);

  const costsView = React.useMemo(() => {
    if (!selectedTerritory) return costsAll;
    return costsAll.filter((r) => normalizeTerritory(r.destination) === selectedTerritory);
  }, [costsAll, normalizeTerritory, selectedTerritory]);

  // ✅ KPI / totaux sur la vue filtrée
  const totals = React.useMemo(() => {
    const totalSalesHt = salesView.reduce((s, r) => s + (r.amount_ht || 0), 0);
    const totalSalesTtc = salesView.reduce((s, r) => s + (r.amount_ttc || 0), 0);
    const totalCosts = costsView.reduce((s, r) => s + (r.amount || 0), 0);
    const margin = totalSalesHt - totalCosts;

    const byTerritory = DESTINATIONS.map((d) => {
      const tSales = salesView.filter((r) => normalizeTerritory(r.territory_code) === d.code);
      const tCosts = costsView.filter((c) => normalizeTerritory(c.destination) === d.code);
      const ht = tSales.reduce((s, r) => s + (r.amount_ht || 0), 0);
      const ttc = tSales.reduce((s, r) => s + (r.amount_ttc || 0), 0);
      const c = tCosts.reduce((s, r) => s + (r.amount || 0), 0);
      const marginEstimee = ht - c;
      const tauxMarge = ht > 0 ? (marginEstimee / ht) * 100 : null;
      return { code: d.code, name: d.name, salesHt: ht, salesTtc: ttc, costs: c, margin: marginEstimee, tauxMarge };
    });

    return { totalSalesHt, totalSalesTtc, totalCosts, margin, byTerritory };
  }, [DESTINATIONS, costsView, normalizeTerritory, salesView]);

  const marginRate = React.useMemo(() => {
    if (totals.totalSalesHt <= 0) return null;
    return (totals.margin / totals.totalSalesHt) * 100;
  }, [totals.margin, totals.totalSalesHt]);

  // ✅ “zero state” seulement si vraiment aucune donnée sur la période (pas juste le filtre)
  const hasAnyData = React.useMemo(() => salesAll.length > 0 || costsAll.length > 0, [costsAll.length, salesAll.length]);
  const hasZeroState = !hasAnyData;

  const noDataForSelection = React.useMemo(() => {
    if (!selectedTerritory) return false;
    const hasSales = salesView.length > 0;
    const hasCosts = costsView.length > 0;
    return !hasSales && !hasCosts;
  }, [costsView.length, salesView.length, selectedTerritory]);

  const lastRefreshText = React.useMemo(() => {
    if (!lastRefreshAt) return "Live";
    const diffMs = Date.now() - lastRefreshAt;
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes <= 0) return "Live";
    return `il y a ${minutes} min`;
  }, [lastRefreshAt]);

  // Map flows : on suit la vue filtrée (cohérent KPI)
  const salesByTerritory = React.useMemo(() => {
    const agg: Record<string, { route: string; volume: number; ca: number; marge: number }> = {};
    salesView.forEach((s) => {
      const code = normalizeTerritory(s.territory_code);
      if (!agg[code]) agg[code] = { route: `FR→${code}`, volume: 0, ca: 0, marge: 0 };
      const ca = s.amount_ht || 0;
      const relatedCosts = costsView
        .filter((c) => normalizeTerritory(c.destination) === code)
        .reduce((t, c) => t + (c.amount || 0), 0);
      agg[code].volume += 1;
      agg[code].ca += ca;
      agg[code].marge += ca - relatedCosts;
    });
    return agg;
  }, [costsView, normalizeTerritory, salesView]);

  const topRoutes = React.useMemo(() => {
    return Object.values(salesByTerritory)
      .filter((r) => r.route !== "FR→FR")
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 6);
  }, [salesByTerritory]);

  const topLabels = React.useMemo(() => {
    const ordered = Object.entries(salesByTerritory)
      .filter(([code]) => code !== "FR")
      .sort((a, b) => b[1].ca - a[1].ca || b[1].volume - a[1].volume);
    const base = ordered.slice(0, 5).map(([code]) => code);
    if (!base.length) return new Set(["GP", "MQ", "GF", "RE", "YT"]);
    return new Set(base);
  }, [salesByTerritory]);

  const timeseries = React.useMemo(() => {
    const bucket: Record<string, { label: string; sales: number; costs: number }> = {};
    salesView.forEach((s) => {
      const key = (s.sale_date || "").slice(0, 10);
      bucket[key] ||= { label: key, sales: 0, costs: 0 };
      bucket[key].sales += s.amount_ht || 0;
    });
    costsView.forEach((c) => {
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
  }, [salesView, costsView]);

  const donuts = React.useMemo(() => {
    const total = totals.totalSalesHt || 1;
    const dromOnly = ["GP", "MQ", "GF", "RE", "YT"];
    const dromCa = dromOnly.reduce((s, code) => s + (salesByTerritory[code]?.ca || 0), 0);
    const dromMarge = dromOnly.reduce((s, code) => s + (salesByTerritory[code]?.marge || 0), 0);
    const dromVol = dromOnly.reduce((s, code) => s + (salesByTerritory[code]?.volume || 0), 0);
    const totalVol = Object.values(salesByTerritory).reduce((s, r) => s + r.volume, 0) || 1;
    return {
      dromCaPct: Math.min(100, Math.max(0, (dromCa / total) * 100)),
      dromMargePct: totals.totalSalesHt > 0 ? Math.min(100, Math.max(0, (dromMarge / totals.totalSalesHt) * 100 + 50)) : 50,
      dromVolPct: Math.min(100, Math.max(0, (dromVol / totalVol) * 100)),
      onTime: 72,
      deltaCa: 1.2,
      deltaMarge: 0.5,
      deltaVol: -0.3,
      deltaOnTime: 1.1,
    };
  }, [salesByTerritory, totals.totalSalesHt, totals.totalSalesHt]);

  const alerts = React.useMemo(() => {
    const list: { label: string; severity: "warning" }[] = [];
    if ((marginRate ?? 0) < 5) list.push({ label: "Marge < 5% sur la période", severity: "warning" });
    if (!salesView.length) list.push({ label: "Aucune vente sur la période filtrée", severity: "warning" });
    if (!costsView.length) list.push({ label: "Pas de coûts logistiques injectés", severity: "warning" });
    return list.slice(0, 3);
  }, [marginRate, salesView.length, costsView.length]);

  const actions = ["Ouvrir Explore", "Optimiser incoterm", "Importer CSV coûts"];

  // ✅ Wheel zoom (px) — OK
  React.useEffect(() => {
    const el = zoomLayerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const delta = -e.deltaY * 0.0015;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      setViewport((prev) => {
        const nextScale = Math.min(5, Math.max(1, prev.scale * (1 + delta)));
        const sx = (cx - prev.tx) / prev.scale;
        const sy = (cy - prev.ty) / prev.scale;
        const tx = cx - sx * nextScale;
        const ty = cy - sy * nextScale;
        return { scale: nextScale, tx, ty };
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ✅ Zoom Antilles (le bug était ici : tu calculais tx/ty en unités SVG, mais tu appliques en px)
  const computeZoomForSubset = React.useCallback(
    (codes: string[]) => {
      const el = zoomLayerRef.current;
      if (!el) return { scale: 1, tx: 0, ty: 0 };

      const rect = el.getBoundingClientRect();
      const subset = nodes.filter((n) => codes.includes(n.code));
      if (!subset.length) return { scale: 1, tx: 0, ty: 0 };

      // conversion SVG->px dans le conteneur
      const pts = subset.map((n) => ({
        x: (n.x / svgMeta.width) * rect.width,
        y: (n.y / svgMeta.height) * rect.height,
      }));

      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));

      const bboxW = Math.max(1, maxX - minX);
      const bboxH = Math.max(1, maxY - minY);

      const pad = 0.28; // zoom confort
      const scale = Math.min(5, Math.min(rect.width / (bboxW * (1 + pad)), rect.height / (bboxH * (1 + pad))));

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const tx = rect.width / 2 - centerX * scale;
      const ty = rect.height / 2 - centerY * scale;

      return { scale, tx, ty };
    },
    [nodes, svgMeta.height, svgMeta.width]
  );

  const zoomCss = React.useMemo(
    () => ({
      transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`,
      transformOrigin: "0 0",
    }),
    [viewport.scale, viewport.tx, viewport.ty]
  );

  const selected = selectedTerritory || hovered || "FR";

  return (
    <MainLayout wrapperClassName="control-tower-neon" variant="bare">
      <div className="space-y-4 px-3 pb-6 select-none">
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
                Dernière mise à jour : <span className="text-emerald-300">Live</span>{" "}
                {lastRefreshText !== "Live" ? `• ${lastRefreshText}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={zoomTarget === "antilles" ? "secondary" : "outline"}
                onClick={() => {
                  if (zoomTarget === "antilles") {
                    setZoomTarget("none");
                    setViewport({ scale: 1, tx: 0, ty: 0 });
                  } else {
                    setZoomTarget("antilles");
                    setViewport(computeZoomForSubset(["GP", "MQ", "BL", "MF", "GF"]));
                  }
                }}
              >
                {zoomTarget === "antilles" ? "Vue globale" : "Zoom Antilles"}
              </Button>
              <Button variant="outline" onClick={() => setVariable("territory_code", null)}>
                Reset territoire
              </Button>
              <Button onClick={() => navigate("/explore")}>Ouvrir Explore</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-8">
            <NeonSurface className="h-[460px] relative overflow-hidden">
              <div className="absolute top-3 left-3 grid grid-cols-2 md:grid-cols-4 gap-3 w-[520px] z-20">
                <NeonKpiCard label="CA HT (30j)" value={formatMoney(totals.totalSalesHt)} delta={3.2} />
                <NeonKpiCard label="CA TTC (30j)" value={formatMoney(totals.totalSalesTtc)} delta={2.4} accent="var(--chart-2)" />
                <NeonKpiCard
                  label="Marge % (30j)"
                  value={marginRate === null ? "n/a" : `${marginRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`}
                  delta={marginRate ? marginRate / 10 : 0}
                  accent="var(--chart-3)"
                />
                <NeonKpiCard label="Ventes (30j)" value={salesView.length.toString()} delta={salesView.length ? 1.1 : -0.2} accent="var(--chart-4)" />
              </div>

              <div
                ref={zoomLayerRef}
                className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-cyan-900/20 rounded-xl border border-cyan-500/20 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
                onMouseDown={(e) => {
                  draggingRef.current = { startX: e.clientX, startY: e.clientY, startTx: viewport.tx, startTy: viewport.ty };
                }}
                onMouseMove={(e) => {
                  if (!draggingRef.current) return;
                  const { startX, startY, startTx, startTy } = draggingRef.current;
                  const dx = e.clientX - startX;
                  const dy = e.clientY - startY;
                  setViewport((prev) => ({ ...prev, tx: startTx + dx, ty: startTy + dy }));
                }}
                onMouseUp={() => {
                  draggingRef.current = null;
                }}
                onMouseLeave={() => {
                  draggingRef.current = null;
                }}
              >
                <div className="absolute inset-0" style={zoomCss}>
                  <svg
                    viewBox={`0 0 ${svgMeta.width} ${svgMeta.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="absolute inset-0 w-full h-full"
                  >
                    <defs>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <style>{`
                      .arc-neon {
                        stroke-dasharray: 8 10;
                        animation: arcDash 1.35s linear infinite;
                      }
                      @keyframes arcDash { to { stroke-dashoffset: -38; } }
                    `}</style>

                    <image
                      href={worldMap}
                      x="0"
                      y="0"
                      width={svgMeta.width}
                      height={svgMeta.height}
                      preserveAspectRatio="xMidYMid meet"
                      opacity="0.4"
                      style={{ pointerEvents: "none", filter: "invert(1) saturate(1.2) contrast(1.05)" }}
                    />

                    {nodes
                      .filter((n) => n.code !== "FR")
                      .map((node) => {
                        const d = buildArc(metropole.x, metropole.y, node.x, node.y);
                        const isActive = selected === node.code;
                        const isHover = hovered === node.code;
                        const strokeWidth = isActive || isHover ? 2.6 : 1.2;

                        const territoryData = salesByTerritory[node.code];
                        const hasFlow = (territoryData?.ca || 0) > 0;
                        const showLabel = topLabels.has(node.code);

                        return (
                          <g key={node.code}>
                            {hasFlow ? (
                              <path
                                d={d}
                                fill="none"
                                stroke={node.color}
                                strokeWidth={strokeWidth}
                                strokeOpacity={isActive || isHover ? 0.95 : 0.25}
                                className="arc-neon transition-all duration-300"
                                vectorEffect="non-scaling-stroke"
                                filter="url(#glow)"
                                pointerEvents="none"
                              />
                            ) : null}

                            <circle cx={node.x} cy={node.y} r={isActive || isHover ? 12 : 9} fill={node.color} opacity={hasFlow ? 0.35 : 0.15} pointerEvents="none" />
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={isActive || isHover ? 7 : 5.5}
                              fill={node.color}
                              opacity={hasFlow ? 0.9 : 0.35}
                              className="cursor-pointer"
                              onMouseEnter={(evt) => {
                                setHovered(node.code);
                                setTooltipPos({ x: evt.clientX, y: evt.clientY });
                              }}
                              onMouseMove={(evt) => setTooltipPos({ x: evt.clientX, y: evt.clientY })}
                              onMouseLeave={() => {
                                setHovered(null);
                                setTooltipPos(null);
                              }}
                              onClick={() => setVariable("territory_code", node.code)}
                              onDoubleClick={() => {
                                setVariable("territory_code", node.code);
                                navigate("/explore");
                              }}
                            />

                            {showLabel ? (
                              <text x={node.x + 12} y={node.y - 8} className="text-xs font-semibold fill-cyan-100 drop-shadow">
                                {node.name}
                              </text>
                            ) : null}
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
                      onMouseEnter={(evt) => {
                        setHovered("FR");
                        setTooltipPos({ x: evt.clientX, y: evt.clientY });
                      }}
                      onMouseMove={(evt) => setTooltipPos({ x: evt.clientX, y: evt.clientY })}
                      onMouseLeave={() => {
                        setHovered(null);
                        setTooltipPos(null);
                      }}
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

                {/* ✅ message non bloquant si filtre = vide */}
                {noDataForSelection ? (
                  <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-30 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 shadow-lg">
                    Pas de données pour <span className="font-semibold">{selectedTerritory}</span> sur la période — clique une autre destination ou “Reset territoire”.
                  </div>
                ) : null}

                {/* Légende fixe */}
                <div className="absolute bottom-3 left-3 z-30 rounded-lg border border-cyan-500/30 bg-slate-900/70 px-3 py-2 text-xs text-cyan-50 shadow-lg">
                  <div className="font-semibold text-cyan-100 mb-1">Légende DOM-TOM</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {DESTINATIONS.filter((d) => d.code !== "FR").map((d) => (
                      <div key={d.code} className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-[11px] text-slate-200">
                          {d.code} — {d.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ✅ overlay “aucune donnée période” = pointer-events-none pour ne jamais bloquer la carte */}
              {hasZeroState ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Aucune donnée sur la période. Ajuste les filtres ou importe des ventes.
                  </div>
                </div>
              ) : null}

              {hovered && tooltipPos ? (
                <div
                  className="pointer-events-none fixed z-[9999] rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-xl"
                  style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 30 }}
                >
                  <div className="font-semibold">{hovered === "FR" ? "Metropole" : hovered}</div>
                  <div className="text-slate-300">
                    CA HT: {formatMoney(salesByTerritory[hovered]?.ca || 0)}
                    <br />
                    Ventes: {salesByTerritory[hovered]?.volume || 0}
                    <br />
                    Marge: {formatMoney(salesByTerritory[hovered]?.marge || 0)}
                  </div>
                </div>
              ) : null}
            </NeonSurface>
          </div>

          <div className="col-span-12 lg:col-span-4 grid grid-rows-4 gap-3">
            <NeonDonutCard label="% CA DROM" value={donuts.dromCaPct} delta={donuts.deltaCa} />
            <NeonDonutCard label="% Marge DROM" value={donuts.dromMargePct} delta={donuts.deltaMarge} color="var(--chart-3)" />
            <NeonDonutCard label="% Ventes DROM" value={donuts.dromVolPct} delta={donuts.deltaVol} color="var(--chart-2)" />
            <NeonDonutCard label="On-time transport" value={donuts.onTime} delta={donuts.deltaOnTime} color="var(--chart-4)" />
          </div>
        </div>

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
                <Button
                  key={a}
                  variant="outline"
                  className="border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/10"
                  onClick={() => (a === "Ouvrir Explore" ? navigate("/explore") : null)}
                >
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
        {warning ? <div className="text-sm text-amber-200">{warning}</div> : null}
      </div>
    </MainLayout>
  );
}
