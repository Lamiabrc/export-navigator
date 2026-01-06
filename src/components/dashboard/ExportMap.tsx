import * as React from "react";
import { geoEquirectangular, GeoProjection } from "d3-geo";
import worldMap from "@/assets/world-map.svg";
import { TERRITORY_COORDS, getCoord } from "@/domain/geo/territoryCoords";

type TerritoryData = {
  ca_ht: number;
  ca_ttc: number;
  vat: number;
  lines: number;
};

type Props = {
  dataByTerritory: Record<string, TerritoryData>;
  selectedTerritory: string | null;
  onSelectTerritory: (code: string | null) => void;
  dateRangeLabel?: string;
  mode?: "overview" | "drom";
};

type Point = {
  code: string;
  name: string;
  x: number;
  y: number;
  data: TerritoryData | undefined;
};

// Dimensions natives de la carte SVG
const VIEW_W = 1010;
const VIEW_H = 520;
const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT", "BL", "MF"];
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const pulseStyle = `
.map-pulse {
  position: relative;
}
.map-pulse::after {
  content:"";
  position:absolute;
  inset:-4px;
  border-radius:9999px;
  border:2px solid rgba(99, 102, 241, 0.4);
  animation:pulse 1.8s ease-out infinite;
}
@keyframes pulse {
  0% { opacity:0.8; transform:scale(0.8);}
  70% { opacity:0; transform:scale(1.6);}
  100% { opacity:0; transform:scale(1.6);}
}
.arc-animate {
  stroke-dasharray: 4 6;
  animation: dash 1.8s linear infinite;
}
@keyframes dash {
  to { stroke-dashoffset: -20; }
}
`;

// Offsets pour limiter les chevauchements (Antilles principalement)
const LABEL_OFFSETS: Record<string, { dx: number; dy: number }> = {
  GP: { dx: 8, dy: -10 },
  MQ: { dx: -4, dy: 6 },
  BL: { dx: -10, dy: -10 },
  MF: { dx: 8, dy: 12 },
  GF: { dx: 6, dy: 12 },
};

export function ExportMap({ dataByTerritory, selectedTerritory, onSelectTerritory, dateRangeLabel, mode = "overview" }: Props) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [size, setSize] = React.useState({ w: VIEW_W, h: VIEW_H });
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [drag, setDrag] = React.useState<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [hover, setHover] = React.useState<{ code: string; x: number; y: number } | null>(null);

  // Responsive : ajuste les dimensions via ResizeObserver
  React.useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ w: cr.width || VIEW_W, h: cr.height || VIEW_H });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const projection: GeoProjection = React.useMemo(
    () => geoEquirectangular().fitSize([VIEW_W, VIEW_H], { type: "Sphere" }),
    [size.w, size.h],
  );

  const points: Point[] = React.useMemo(() => {
    const res: Point[] = [];
    Object.values(TERRITORY_COORDS).forEach((c) => {
      if (c.code === "HUB") return;
      const projected = projection([c.lng, c.lat]);
      if (!projected) return;
      res.push({ code: c.code, name: c.name, x: projected[0], y: projected[1], data: dataByTerritory[c.code] });
    });
    return res;
  }, [dataByTerritory, projection]);

  const hub = React.useMemo(() => {
    const c = TERRITORY_COORDS.HUB;
    const projected = projection([c.lng, c.lat]);
    return projected ? { ...c, x: projected[0], y: projected[1] } : { ...c, x: VIEW_W / 2, y: VIEW_H / 2 };
  }, [projection]);

  const topTerritories = React.useMemo(() => {
    const sorted = points
      .map((p) => ({ p, ca: p.data?.ca_ht || 0 }))
      .sort((a, b) => b.ca - a.ca)
      .map((a) => a.p);
    const limit = scale > 1.4 ? 6 : 4;
    return new Set(sorted.slice(0, limit).map((p) => p.code));
  }, [points, scale]);

  const maxCa = React.useMemo(() => Math.max(0, ...Object.values(dataByTerritory).map((d) => d.ca_ht)), [dataByTerritory]);
  const totalLines = React.useMemo(() => Object.values(dataByTerritory).reduce((s, d) => s + (d.lines || 0), 0), [dataByTerritory]);
  const hasData = totalLines > 0;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.08 : 0.92;
    const next = clamp(scale * factor, 0.8, 4);
    setScale(next);
  };

  const handleMouseDown = (e: React.MouseEvent) => setDrag({ startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y });
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setOffset({ x: drag.ox + dx, y: drag.oy + dy });
  };
  const handleMouseUp = () => setDrag(null);
  const handleMouseLeave = () => setDrag(null);

  const hoveredData = hover ? dataByTerritory[hover.code] : undefined;
  const hoveredCoord = hover ? getCoord(hover.code) : undefined;

  const viewBox = `0 0 ${VIEW_W} ${VIEW_H}`;
  const transform = `translate(${offset.x},${offset.y}) scale(${scale})`;

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl bg-slate-950/80 border border-slate-800">
      <style>{pulseStyle}</style>
      <div className="absolute top-3 left-3 text-xs text-slate-300/80">
        Carte : clic = filtre, double clic = reset. <span className="text-slate-400">{dateRangeLabel}</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={transform}>
          <image href={worldMap} x={0} y={0} width={VIEW_W} height={VIEW_H} opacity={0.45} style={{ filter: "invert(1) saturate(1.2) contrast(1.05)" }} />

          {hasData &&
            points
              .filter((p) => (mode === "drom" ? DROM_CODES.includes(p.code) : true))
              .map((p) => {
                const ca = p.data?.ca_ht || 0;
                if (ca <= 0) return null;
                const width = scaleStroke(ca, maxCa);
                return (
                  <path
                    key={`arc-${p.code}`}
                    d={buildArc(hub.x, hub.y, p.x, p.y)}
                    stroke={p.data ? pickColor(p.code) : "#60a5fa"}
                    strokeWidth={width}
                    fill="none"
                    className="arc-animate"
                    strokeOpacity={0.6}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

          {hasData &&
            points
              .filter((p) => (mode === "drom" ? DROM_CODES.includes(p.code) : true))
              .map((p) => {
                const ca = p.data?.ca_ht || 0;
                const size = markerSize(ca);
                const isSelected = selectedTerritory === p.code;
                const isTop = topTerritories.has(p.code);
                const showLabel = isTop || scale > 1.3;
                const label = scale > 1.3 || !["GP", "MQ", "BL"].includes(p.code) ? p.name : p.code;
                const offsetLabel = LABEL_OFFSETS[p.code] || { dx: 10, dy: -8 };
                return (
                  <g key={p.code} className="transition-all duration-300">
                    <g
                      onMouseEnter={(e) => setHover({ code: p.code, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onSelectTerritory(p.code)}
                      onDoubleClick={() => onSelectTerritory(null)}
                      className="cursor-pointer"
                    >
                      <circle cx={p.x} cy={p.y} r={size + 4} fill="#0f172a" opacity={0.4} />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={size}
                        className={ca > 0 ? "map-pulse" : ""}
                        fill={isSelected ? "#38bdf8" : pickColor(p.code)}
                        opacity={isSelected ? 0.95 : 0.75}
                      />
                    </g>
                    {showLabel ? (
                      <g transform={`translate(${p.x + offsetLabel.dx},${p.y + offsetLabel.dy})`}>
                        <rect x={-4} y={-12} width={label.length * 7 + 12} height={20} rx={6} fill="#0f172a" opacity={0.7} />
                        <text className="text-[11px] font-semibold fill-slate-100" x={4} y={4}>
                          {label}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}

          {/* Hub */}
          <g
            onMouseEnter={(e) => setHover({ code: "HUB", x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelectTerritory(null)}
            className="cursor-pointer"
          >
            <circle cx={hub.x} cy={hub.y} r={10} fill="#38bdf8" opacity={0.9} />
            <text x={hub.x + 12} y={hub.y + 4} className="text-xs font-bold fill-cyan-100 drop-shadow">
              Hub FR
            </text>
          </g>
        </g>
      </svg>

      {hover && hoveredData && hoveredCoord ? (
        <div
          className="pointer-events-none fixed z-30 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl text-xs text-slate-100"
          style={{ left: hover.x + 12, top: hover.y + 12, minWidth: 180 }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{hoveredCoord.name}</span>
            <span className="text-[10px] text-slate-400">{hoveredCoord.code}</span>
          </div>
          <div className="mt-1 space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">CA HT</span><span>{formatMoney(hoveredData.ca_ht)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">CA TTC</span><span>{formatMoney(hoveredData.ca_ttc)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">TVA</span><span>{formatMoney(hoveredData.vat)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Ventes</span><span>{hoveredData.lines}</span></div>
          </div>
        </div>
      ) : null}

      {!hasData ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-500/15">
            Aucune donnée sur la période. Ajuste les filtres ou importe des ventes.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function buildArc(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 - Math.hypot(dx, dy) * 0.2;
  return `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}`;
}

function markerSize(ca: number) {
  if (ca <= 0) return 5;
  return clamp(Math.sqrt(ca) * 0.02, 6, 14);
}

function scaleStroke(ca: number, max: number) {
  if (max <= 0) return 1.2;
  const ratio = ca / max;
  return clamp(1 + ratio * 6, 1.2, 8);
}

function hasData(data: Record<string, TerritoryData>) {
  return Object.values(data).some((d) => d.ca_ht > 0);
}

function pickColor(code: string) {
  if (DROM_CODES.includes(code)) return "#22d3ee";
  if (code === "BE" || code === "CH" || code === "LU") return "#a78bfa";
  return "#60a5fa";
}
