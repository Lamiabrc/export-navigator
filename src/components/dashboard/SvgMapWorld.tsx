import * as React from "react";
import worldMapRaw from "@/assets/world-map.svg?raw";
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

const DROM = ["GP", "MQ", "GF", "RE", "YT"] as const;

const OFFSETS: Record<string, { dx: number; dy: number }> = {
  GP: { dx: -10, dy: -12 },
  MQ: { dx: -10, dy: 12 },
  GF: { dx: 10, dy: 0 },
  RE: { dx: 10, dy: 0 },
  YT: { dx: 10, dy: -10 },
};

const COLORS: Record<string, string> = {
  FR: "#38bdf8",
  GP: "#fb7185",
  MQ: "#f59e0b",
  GF: "#22c55e",
  RE: "#a855f7",
  YT: "#38bdf8",
  HUB_FR: "#38bdf8",
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const css = `
.arc-animate { stroke-dasharray: 8 10; animation: arcDash 1.3s linear infinite; }
@keyframes arcDash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -36; } }
`;

function parseSvg(raw: string) {
  const vb = raw.match(/viewBox="([^"]+)"/i)?.[1] ?? "0 0 1010 666";
  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "");
  return { viewBox: vb, inner };
}

function pickColor(code: string) {
  return COLORS[code] || ((DROM as readonly string[]).includes(code) ? "#22d3ee" : "#60a5fa");
}

function markerSize(ca: number) {
  if (ca <= 0) return 5;
  return clamp(Math.sqrt(ca) * 0.02, 6, 14);
}

function scaleStroke(ca: number, maxCa: number) {
  if (ca <= 0 || maxCa <= 0) return 1.2;
  const pct = ca / maxCa;
  return clamp(1.2 + pct * 3.2, 1.2, 4.4);
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

export function SvgMapWorld({
  dataByTerritory,
  selectedTerritory,
  onSelectTerritory,
  dateRangeLabel,
  mode = "overview",
}: Props) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const map = React.useMemo(() => parseSvg(worldMapRaw), []);

  const [anchors, setAnchors] = React.useState<Record<string, { x: number; y: number }>>({});
  const [hover, setHover] = React.useState<{ code: string; x: number; y: number } | null>(null);

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

  // ✅ Lire les ancres directement dans le SVG (anchor-HUB_FR, anchor-GP, ...)
  React.useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const codes = ["HUB_FR", ...DROM] as string[];
    const next: Record<string, { x: number; y: number }> = {};

    for (const code of codes) {
      const el = svg.querySelector(`#anchor-${code}`) as SVGCircleElement | null;
      if (!el) continue;
      const x = el.cx?.baseVal?.value ?? Number(el.getAttribute("cx") || "0");
      const y = el.cy?.baseVal?.value ?? Number(el.getAttribute("cy") || "0");
      if (x && y) next[code] = { x, y };
    }

    setAnchors(next);
  }, [map.inner]);

  const hub = anchors["HUB_FR"];

  const points = React.useMemo(() => {
    const list = (DROM as readonly string[]).map((code) => ({
      code,
      x: anchors[code]?.x ?? 0,
      y: anchors[code]?.y ?? 0,
      data: dataByTerritory[code],
      name: code,
    }));
    return mode === "drom" ? list : list; // (si tu ajoutes d'autres ancres plus tard, on élargira ici)
  }, [anchors, dataByTerritory, mode]);

  const totalLines = React.useMemo(
    () => Object.values(dataByTerritory).reduce((s, d) => s + (Number(d?.lines) || 0), 0),
    [dataByTerritory]
  );
  const hasData = totalLines > 0;

  const maxCa = React.useMemo(
    () => Math.max(0, ...Object.values(dataByTerritory).map((d) => Number(d?.ca_ht) || 0)),
    [dataByTerritory]
  );

  const top = React.useMemo(() => {
    const sorted = points
      .map((p) => ({ code: p.code, ca: Number(p.data?.ca_ht) || 0 }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5)
      .map((x) => x.code);
    return new Set(sorted);
  }, [points]);

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

  const transform = `translate(${offset.x},${offset.y}) scale(${scale})`;

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl bg-slate-950/80 border border-slate-800">
      <style>{css}</style>

      <div className="absolute top-3 left-3 z-20 text-xs text-slate-300/85">
        <div>Carte SVG : survole = infos • clic = filtre • double-clic = reset</div>
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
        viewBox={map.viewBox}
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
      >
        <g transform={transform}>
          {/* Fond : inline (même repère que les ancres) */}
          <g
            style={{
              filter: "invert(1) saturate(1.2) contrast(1.05)",
              opacity: 0.45,
              pointerEvents: "none",
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: map.inner }}
          />

          {/* Arcs */}
          {hasData && hub
            ? points.map((p) => {
                const ca = Number(p.data?.ca_ht) || 0;
                if (ca <= 0 || !p.x || !p.y) return null;
                const width = scaleStroke(ca, maxCa);
                const d = buildArc(hub.x, hub.y, p.x, p.y);
                return (
                  <path
                    key={`arc-${p.code}`}
                    d={d}
                    fill="none"
                    stroke={pickColor(p.code)}
                    strokeWidth={width}
                    strokeOpacity={0.65}
                    className="arc-animate"
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
              onPointerMove={(e) => setHover({ code: "HUB_FR", x: e.clientX, y: e.clientY })}
              onPointerLeave={() => setHover(null)}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTerritory(null);
              }}
            >
              <circle cx={hub.x} cy={hub.y} r={11} fill={pickColor("HUB_FR")} opacity={0.92} />
              <text x={hub.x + 14} y={hub.y + 4} fill="#e2e8f0" fontSize={12} fontWeight={700}>
                Hub
              </text>
            </g>
          ) : null}

          {/* Points */}
          {points.map((p) => {
            if (!p.x || !p.y) return null;

            const ca = Number(p.data?.ca_ht) || 0;
            const r = markerSize(ca);
            const isSelected = selectedTerritory === p.code;
            const showLabel = top.has(p.code);
            const fill = isSelected ? "#38bdf8" : pickColor(p.code);
            const opacity = isSelected ? 0.95 : ca > 0 ? 0.8 : 0.35;
            const off = OFFSETS[p.code] || { dx: 10, dy: -8 };

            return (
              <g key={p.code}>
                {/* Hit area */}
                <circle cx={p.x} cy={p.y} r={Math.max(14, r + 10)} fill="transparent" />

                {/* Glow */}
                <circle cx={p.x} cy={p.y} r={r + 6} fill="#0f172a" opacity={0.35} pointerEvents="none" />

                {/* Pulse */}
                {ca > 0 ? (
                  <circle cx={p.x} cy={p.y} r={r + 2} fill="none" stroke={fill} strokeOpacity={0.45} strokeWidth={2} pointerEvents="none">
                    <animate attributeName="r" values={`${r + 2};${r + 18}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.45;0" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                ) : null}

                {/* Dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={fill}
                  opacity={opacity}
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

                {/* Label */}
                {(showLabel || isSelected) ? (
                  <g transform={`translate(${p.x + off.dx},${p.y + off.dy})`} pointerEvents="none">
                    <rect x={-4} y={-12} width={p.code.length * 7 + 60} height={20} rx={6} fill="#0f172a" opacity={0.72} />
                    <text x={4} y={4} fill="#e2e8f0" fontSize={11} fontWeight={700}>
                      {p.code}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hover ? (
        <div
          className="pointer-events-none fixed z-30 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl text-xs text-slate-100"
          style={{ left: hover.x + 12, top: hover.y + 12, minWidth: 190 }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{hover.code === "HUB_FR" ? "Hub" : hover.code}</span>
            <span className="text-[10px] text-slate-400">{hover.code}</span>
          </div>

          <div className="mt-1 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">CA HT</span>
              <span>{money(dataByTerritory[hover.code]?.ca_ht || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CA TTC</span>
              <span>{money(dataByTerritory[hover.code]?.ca_ttc || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TVA</span>
              <span>{money(dataByTerritory[hover.code]?.vat || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ventes</span>
              <span>{(dataByTerritory[hover.code]?.lines || 0).toLocaleString("fr-FR")}</span>
            </div>
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
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));
}
