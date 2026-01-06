import * as React from "react";
import worldMap from "@/assets/world-map.svg";
import { TERRITORY_PCT } from "@/domain/geo/territoryPct";

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

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];
const LABEL_OFFSETS: Record<string, { dx: number; dy: number }> = {
  GP: { dx: -10, dy: -12 },
  MQ: { dx: -10, dy: 12 },
  GF: { dx: 10, dy: 0 },
  RE: { dx: 10, dy: 0 },
  YT: { dx: 10, dy: -10 },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const pulseStyle = `
.map-pulse { position: relative; }
.map-pulse::after {
  content:""; position:absolute; inset:-4px; border-radius:9999px;
  border:2px solid rgba(99, 102, 241, 0.4); animation:pulse 1.8s ease-out infinite;
}
@keyframes pulse {
  0% { opacity:0.8; transform:scale(0.8);}
  70% { opacity:0; transform:scale(1.6);}
  100% { opacity:0; transform:scale(1.6);}
}
.arc-animate { stroke-dasharray: 4 6; animation: dash 1.8s linear infinite; }
@keyframes dash { to { stroke-dashoffset: -20; } }
`;

export function ExportMap({ dataByTerritory, selectedTerritory, onSelectTerritory, dateRangeLabel, mode = "overview" }: Props) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [size, setSize] = React.useState({ w: 1010, h: 520 });
  const [hover, setHover] = React.useState<{ code: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = React.useState<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [scale, setScale] = React.useState(1);
  const debug = React.useMemo(() => typeof window !== "undefined" && window.location.search.includes("debug=1"), []);

  // ResizeObserver pour garder arcs/points alignés
  React.useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ w: cr.width || 1010, h: cr.height || 520 });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const toXY = React.useCallback(
    (code: string) => {
      const pct = TERRITORY_PCT[code];
      if (!pct) return null;
      return { x: (pct.x / 100) * size.w, y: (pct.y / 100) * size.h };
    },
    [size.w, size.h],
  );

  const hub = toXY("HUB_FR");

  const points: Point[] = React.useMemo(() => {
    return Object.entries(TERRITORY_PCT)
      .filter(([code]) => code !== "HUB_FR")
      .map(([code, pct]) => {
        const pos = toXY(code);
        return {
          code,
          name: pct.label || code,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          data: dataByTerritory[code],
        };
      });
  }, [dataByTerritory, toXY]);

  const totalLines = React.useMemo(() => Object.values(dataByTerritory).reduce((s, d) => s + (d.lines || 0), 0), [dataByTerritory]);
  const hasData = totalLines > 0;

  const topTerritories = React.useMemo(() => {
    const sorted = points
      .map((p) => ({ p, ca: p.data?.ca_ht || 0 }))
      .sort((a, b) => b.ca - a.ca)
      .map((a) => a.p);
    return new Set(sorted.slice(0, 5).map((p) => p.code));
  }, [points]);

  const maxCa = React.useMemo(() => Math.max(0, ...Object.values(dataByTerritory).map((d) => d.ca_ht)), [dataByTerritory]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.08 : 0.92;
    const next = clamp(scale * factor, 0.8, 3.5);
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

  const transform = `translate(${offset.x},${offset.y}) scale(${scale})`;
  const viewBox = `0 0 ${size.w} ${size.h}`;

  const hoveredData = hover ? dataByTerritory[hover.code] : undefined;
  const hoveredPct = hover ? TERRITORY_PCT[hover.code] : undefined;

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
          <image href={worldMap} x={0} y={0} width={size.w} height={size.h} opacity={0.45} style={{ filter: "invert(1) saturate(1.2) contrast(1.05)" }} />

          {hasData &&
            hub &&
            points
              .filter((p) => (mode === "drom" ? DROM_CODES.includes(p.code) : true))
              .map((p) => {
                if (!p.data || p.data.ca_ht <= 0) return null;
                const width = scaleStroke(p.data.ca_ht, maxCa);
                const arc = buildArc(hub.x, hub.y, p.x, p.y);
                return (
                  <g key={`arc-${p.code}`}>
                    <path
                      d={arc}
                      stroke={pickColor(p.code)}
                      strokeWidth={width}
                      fill="none"
                      className="arc-animate"
                      strokeOpacity={0.65}
                      vectorEffect="non-scaling-stroke"
                    />
                    {debug ? <circle cx={p.x} cy={p.y} r={2} fill="#fbbf24" /> : null}
                  </g>
                );
              })}

          {hub ? (
            <g
              onMouseEnter={(e) => setHover({ code: "HUB_FR", x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectTerritory(null)}
              className="cursor-pointer"
            >
              <circle cx={hub.x} cy={hub.y} r={10} fill="#38bdf8" opacity={0.9} />
              <text x={hub.x + 12} y={hub.y + 4} className="text-xs font-bold fill-cyan-100 drop-shadow">
                Hub
              </text>
              {debug ? <line x1={hub.x - 4} y1={hub.y} x2={hub.x + 4} y2={hub.y} stroke="#f87171" /> : null}
            </g>
          ) : null}

          {hasData &&
            points
              .filter((p) => (mode === "drom" ? DROM_CODES.includes(p.code) : true))
              .map((p) => {
                const ca = p.data?.ca_ht || 0;
                const sizePt = markerSize(ca);
                const isSelected = selectedTerritory === p.code;
                const isTop = topTerritories.has(p.code);
                const showLabel = isTop;
                const label = p.name;
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
                      <circle cx={p.x} cy={p.y} r={sizePt + 4} fill="#0f172a" opacity={0.4} />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={sizePt}
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

          {debug &&
            points.map((p) => (
              <g key={`debug-${p.code}`}>
                <line x1={p.x - 3} y1={p.y} x2={p.x + 3} y2={p.y} stroke="#22d3ee" />
                <line x1={p.x} y1={p.y - 3} x2={p.x} y2={p.y + 3} stroke="#22d3ee" />
              </g>
            ))}
        </g>
      </svg>

      {hover && hoveredData && hoveredPct ? (
        <div
          className="pointer-events-none fixed z-30 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl text-xs text-slate-100"
          style={{ left: hover.x + 12, top: hover.y + 12, minWidth: 180 }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{hoveredPct.label || hoveredPct.code}</span>
            <span className="text-[10px] text-slate-400">{hoveredPct.code}</span>
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

function buildArc(sx: number, sy: number, ex: number, ey: number) {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = clamp(len * 0.18, 20, 120);
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
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

function pickColor(code: string) {
  if (DROM_CODES.includes(code)) return "#22d3ee";
  return "#60a5fa";
}
