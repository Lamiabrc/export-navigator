import * as React from "react";
import worldMapRaw from "@/assets/world-map.svg?raw";
import { TERRITORY_PCT } from "@/domain/geo/territoryPct";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw } from "lucide-react";

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
  data?: TerritoryData;
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

const css = `
.arc-animate { stroke-dasharray: 5 7; animation: dash 1.8s linear infinite; }
@keyframes dash { to { stroke-dashoffset: -24; } }
`;

function parseSvg(raw: string) {
  // viewBox
  const vbMatch = raw.match(/viewBox="([^"]+)"/i);
  const vb = vbMatch?.[1]?.trim().split(/\s+/).map(Number) ?? [0, 0, 1010, 666];
  const [vbX, vbY, vbW, vbH] = vb.length === 4 ? vb : [0, 0, 1010, 666];

  // inner content (everything inside <svg ...>...</svg>)
  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "");

  return { vbX, vbY, vbW, vbH, inner };
}

export function ExportMap({
  dataByTerritory,
  selectedTerritory,
  onSelectTerritory,
  dateRangeLabel,
  mode = "overview",
}: Props) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = React.useState<{ code: string; x: number; y: number } | null>(null);

  const map = React.useMemo(() => parseSvg(worldMapRaw), []);

  // Pan/Zoom
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const panRef = React.useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  }>({ active: false, pointerId: null, startX: 0, startY: 0, ox: 0, oy: 0 });

  const debug = React.useMemo(
    () => typeof window !== "undefined" && window.location.search.includes("debug=1"),
    []
  );

  // ✅ conversion % -> coordonnées EXACTES du viewBox du SVG
  const toXY = React.useCallback(
    (code: string) => {
      const pct = (TERRITORY_PCT as any)[code];
      if (!pct) return null;
      return {
        x: map.vbX + (pct.x / 100) * map.vbW,
        y: map.vbY + (pct.y / 100) * map.vbH,
      };
    },
    [map.vbH, map.vbW, map.vbX, map.vbY]
  );

  const hub = toXY("HUB_FR");

  const points: Point[] = React.useMemo(() => {
    return Object.entries(TERRITORY_PCT as any)
      .filter(([code]) => code !== "HUB_FR")
      .map(([code, meta]: any) => {
        const pos = toXY(code);
        return {
          code,
          name: meta.label || code,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          data: dataByTerritory[code],
        };
      });
  }, [dataByTerritory, toXY]);

  const visiblePoints = React.useMemo(() => {
    return points.filter((p) => (mode === "drom" ? DROM_CODES.includes(p.code) : true));
  }, [points, mode]);

  const totalLines = React.useMemo(
    () => Object.values(dataByTerritory).reduce((s, d) => s + (d?.lines || 0), 0),
    [dataByTerritory]
  );
  const hasData = totalLines > 0;

  const maxCa = React.useMemo(
    () => Math.max(0, ...Object.values(dataByTerritory).map((d) => d?.ca_ht || 0)),
    [dataByTerritory]
  );

  const topTerritories = React.useMemo(() => {
    const sorted = visiblePoints
      .map((p) => ({ code: p.code, ca: p.data?.ca_ht || 0 }))
      .sort((a, b) => b.ca - a.ca)
      .map((x) => x.code);
    return new Set(sorted.slice(0, 5));
  }, [visiblePoints]);

  // ⚠️ on garde ton ordre (translate puis scale) :
  // p' = (p + offset) * scale  => p = p'/scale - offset
  const transform = `translate(${offset.x},${offset.y}) scale(${scale})`;
  const viewBox = `${map.vbX} ${map.vbY} ${map.vbW} ${map.vbH}`;

  const hoveredMeta = hover ? (TERRITORY_PCT as any)[hover.code] : undefined;
  const hoveredData = hover ? dataByTerritory[hover.code] : undefined;

  const zoomIn = () => setScale((s) => clamp(s * 1.12, 0.85, 3.5));
  const zoomOut = () => setScale((s) => clamp(s / 1.12, 0.85, 3.5));
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setScale((s) => clamp(s * factor, 0.85, 3.5));
  };

  const startPan = (e: React.PointerEvent) => {
    panRef.current.active = true;
    panRef.current.pointerId = e.pointerId;
    panRef.current.startX = e.clientX;
    panRef.current.startY = e.clientY;
    panRef.current.ox = offset.x;
    panRef.current.oy = offset.y;
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const movePan = (e: React.PointerEvent) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setOffset({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
  };

  const endPan = (e: React.PointerEvent) => {
    if (panRef.current.pointerId === e.pointerId) {
      panRef.current.active = false;
      panRef.current.pointerId = null;
    }
  };

  // ✅ Debug: Shift+clic sur la carte => log % exact à mettre dans TERRITORY_PCT
  const debugClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!debug || !e.shiftKey) return;
    const svg = svgRef.current;
    if (!svg) return;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const pSvg = pt.matrixTransform(ctm.inverse());

    // enlever pan/zoom (ordre translate->scale)
    const baseX = pSvg.x / scale - offset.x;
    const baseY = pSvg.y / scale - offset.y;

    const pctX = ((baseX - map.vbX) / map.vbW) * 100;
    const pctY = ((baseY - map.vbY) / map.vbH) * 100;

    const out = { x: Number(pctX.toFixed(1)), y: Number(pctY.toFixed(1)) };
    // eslint-disable-next-line no-console
    console.log("[ExportMap] SHIFT+click => TERRITORY_PCT =", out);

    void navigator.clipboard?.writeText(`${out.x}, ${out.y}`).catch(() => {});
  };

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl bg-slate-950/80 border border-slate-800">
      <style>{css}</style>

      <div className="absolute top-3 left-3 z-20 text-xs text-slate-300/85">
        <div>
          Survole = infos • Clic = filtre • Double-clic = reset filtre
          {debug ? <span className="ml-2 text-amber-300">• debug=1 : SHIFT+clic = récupère %</span> : null}
        </div>
        <div className="text-slate-400">{dateRangeLabel}</div>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <Button size="sm" variant="secondary" className="h-8 px-2" onClick={zoomOut} title="Zoom -">
          <Minus className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" className="h-8 px-2" onClick={zoomIn} title="Zoom +">
          <Plus className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={resetView} title="Reset vue">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onPointerLeave={() => {
          panRef.current.active = false;
          panRef.current.pointerId = null;
        }}
        onClick={debugClick}
      >
        <g transform={transform}>
          {/* ✅ Fond INLINE : même repère que tes overlays */}
          <g
            style={{ filter: "invert(1) saturate(1.2) contrast(1.05)", opacity: 0.45, pointerEvents: "none" as any }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: map.inner }}
          />

          {/* Arcs */}
          {hasData && hub
            ? visiblePoints.map((p) => {
                const ca = p.data?.ca_ht || 0;
                if (ca <= 0) return null;
                const width = scaleStroke(ca, maxCa);
                const arc = buildArc(hub.x, hub.y, p.x, p.y);
                return (
                  <path
                    key={`arc-${p.code}`}
                    d={arc}
                    stroke={pickColor(p.code)}
                    strokeWidth={width}
                    fill="none"
                    className="arc-animate"
                    strokeOpacity={0.65}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                );
              })
            : null}

          {/* Hub */}
          {hub ? (
            <g
              className="cursor-pointer"
              onPointerEnter={(e) => setHover({ code: "HUB_FR", x: e.clientX, y: e.clientY })}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTerritory(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <circle cx={hub.x} cy={hub.y} r={11} fill="#38bdf8" opacity={0.92} />
              <text x={hub.x + 14} y={hub.y + 4} className="text-xs font-bold fill-cyan-100 drop-shadow">
                Hub
              </text>
            </g>
          ) : null}

          {/* Points */}
          {visiblePoints.map((p) => {
            const ca = p.data?.ca_ht || 0;
            const lines = p.data?.lines || 0;

            const isSelected = selectedTerritory === p.code;
            const isTop = topTerritories.has(p.code);

            const r = markerSize(ca);
            const label = p.name;
            const offsetLabel = LABEL_OFFSETS[p.code] || { dx: 10, dy: -8 };

            const fill = isSelected ? "#38bdf8" : pickColor(p.code);
            const opacity = ca > 0 ? 0.8 : 0.25;

            return (
              <g key={p.code} className="select-none">
                <circle cx={p.x} cy={p.y} r={Math.max(14, r + 10)} fill="transparent" />

                <circle cx={p.x} cy={p.y} r={r + 6} fill="#0f172a" opacity={0.35} pointerEvents="none" />

                {ca > 0 ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 2}
                    fill="none"
                    stroke={fill}
                    strokeOpacity={0.45}
                    strokeWidth={2}
                    pointerEvents="none"
                  >
                    <animate attributeName="r" values={`${r + 2};${r + 18}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.45;0" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                ) : null}

                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={fill}
                  opacity={isSelected ? 0.95 : opacity}
                  className="cursor-pointer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerEnter={(e) => setHover({ code: p.code, x: e.clientX, y: e.clientY })}
                  onPointerMove={(e) => setHover({ code: p.code, x: e.clientX, y: e.clientY })}
                  onPointerLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTerritory(p.code);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelectTerritory(null);
                  }}
                />

                {(isTop || isSelected) && (
                  <g transform={`translate(${p.x + offsetLabel.dx},${p.y + offsetLabel.dy})`} pointerEvents="none">
                    <rect
                      x={-4}
                      y={-12}
                      width={Math.min(220, label.length * 7 + 12)}
                      height={20}
                      rx={6}
                      fill="#0f172a"
                      opacity={0.75}
                    />
                    <text className="text-[11px] font-semibold fill-slate-100" x={4} y={4}>
                      {label}
                    </text>
                  </g>
                )}

                {debug ? (
                  <text x={p.x + 6} y={p.y + 18} fontSize={10} fill="#fbbf24">
                    {p.code} ({lines})
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hover && hoveredMeta ? (
        <div
          className="pointer-events-none fixed z-30 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl text-xs text-slate-100"
          style={{ left: hover.x + 12, top: hover.y + 12, minWidth: 190 }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{hoveredMeta.label || hover.code}</span>
            <span className="text-[10px] text-slate-400">{hover.code}</span>
          </div>

          <div className="mt-1 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">CA HT</span>
              <span>{money(hoveredData?.ca_ht || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CA TTC</span>
              <span>{money(hoveredData?.ca_ttc || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TVA</span>
              <span>{money(hoveredData?.vat || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ventes</span>
              <span>{(hoveredData?.lines || 0).toLocaleString("fr-FR")}</span>
            </div>

            {!hoveredData ? (
              <div className="mt-2 text-[11px] text-amber-200/90">
                Pas de données pour ce territoire (code non présent ou ventes = 0).
              </div>
            ) : null}
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

function money(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );
}

function buildArc(sx: number, sy: number, ex: number, ey: number) {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = clamp(len * 0.12, 12, 100);
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
