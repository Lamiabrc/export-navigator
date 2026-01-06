import * as React from "react";
import svgMap from "svgmap";
import "svg-pan-zoom/dist/svg-pan-zoom.min.js";
import "@/styles/svgmap.css";
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

const DROM = ["GP", "MQ", "GF", "RE", "YT"];
const OFFSETS: Record<string, { dx: number; dy: number }> = {
  GP: { dx: -10, dy: -12 },
  MQ: { dx: -10, dy: 12 },
  GF: { dx: 10, dy: 0 },
  RE: { dx: 10, dy: 0 },
  YT: { dx: 10, dy: -10 },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function SvgMapWorld({
  dataByTerritory,
  selectedTerritory,
  onSelectTerritory,
  dateRangeLabel,
  mode = "overview",
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [svgEl, setSvgEl] = React.useState<SVGSVGElement | null>(null);
  const [size, setSize] = React.useState({ w: 1000, h: 520 });

  // init svgMap
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const id = `svgmap-${Math.random().toString(36).slice(2)}`;
    container.id = id;

    const instance = new (svgMap as any)({
      targetElementID: id,
      data: {
        data: {
          ca: { name: "CA", format: "{0}" },
        },
        applyData: "ca",
        values: { FR: { ca: Object.values(dataByTerritory).reduce((s, d) => s + (d.ca_ht || 0), 0) } },
      },
      colorMin: "#0ea5e9",
      colorMax: "#38bdf8",
      mouseWheelZoomEnabled: true,
      zoomMin: 1,
      zoomMax: 20,
      noDataText: "Aucune donnée",
    });

    const svg = container.querySelector("svg") as SVGSVGElement | null;
    setSvgEl(svg);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ w: cr.width || 1000, h: cr.height || 520 });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      container.innerHTML = "";
    };
  }, [dataByTerritory]);

  // draw overlays (markers + arcs) in same SVG group
  React.useEffect(() => {
    if (!svgEl) return;
    const vb = svgEl.getAttribute("viewBox")?.split(" ").map(Number);
    if (!vb || vb.length < 4) return;
    const [, , vbW, vbH] = vb;

    const rootGroup = svgEl.querySelector("g");
    if (!rootGroup) return;
    const old = svgEl.querySelector("#export-overlays");
    if (old) old.remove();

    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
    overlay.setAttribute("id", "export-overlays");

    const toXY = (code: string) => {
      const pct = TERRITORY_PCT[code];
      if (!pct) return null;
      return { x: (pct.x / 100) * vbW, y: (pct.y / 100) * vbH };
    };

    const hub = toXY("HUB_FR");
    const points = Object.entries(TERRITORY_PCT)
      .filter(([code]) => code !== "HUB_FR")
      .map(([code, meta]) => {
        const pos = toXY(code);
        return {
          code,
          name: meta.label || code,
          x: pos?.x || 0,
          y: pos?.y || 0,
          data: dataByTerritory[code],
        };
      });

    const totalLines = Object.values(dataByTerritory).reduce((s, d) => s + (d.lines || 0), 0);
    const hasData = totalLines > 0;
    const maxCa = Math.max(0, ...Object.values(dataByTerritory).map((d) => d.ca_ht));
    const top = new Set(
      points
        .map((p) => ({ p, ca: p.data?.ca_ht || 0 }))
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5)
        .map((a) => a.p.code),
    );

    const pulseStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    pulseStyle.textContent = `
      .map-pulse { position: relative; }
      .map-pulse::after { content:""; position:absolute; inset:-4px; border-radius:9999px; border:2px solid rgba(99,102,241,0.4); animation:pulse 1.8s ease-out infinite; }
      @keyframes pulse { 0% { opacity:0.8; transform:scale(0.8);} 70% { opacity:0; transform:scale(1.6);} 100% { opacity:0; transform:scale(1.6);} }
    `;
    overlay.appendChild(pulseStyle);

    if (hasData && hub) {
      points
        .filter((p) => (mode === "drom" ? DROM.includes(p.code) : true))
        .forEach((p) => {
          if (!p.data || p.data.ca_ht <= 0) return;
          const width = scaleStroke(p.data.ca_ht, maxCa);
          const d = buildArc(hub.x, hub.y, p.x, p.y);
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", d);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", pickColor(p.code));
          path.setAttribute("stroke-width", width.toString());
          path.setAttribute("stroke-opacity", "0.65");
          path.setAttribute("class", "arc-animate");
          overlay.appendChild(path);
        });
    }

    // Hub marker
    if (hub) {
      const gHub = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gHub.setAttribute("cursor", "pointer");
      gHub.addEventListener("click", () => onSelectTerritory(null));
      const c1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c1.setAttribute("cx", hub.x.toString());
      c1.setAttribute("cy", hub.y.toString());
      c1.setAttribute("r", "10");
      c1.setAttribute("fill", "#38bdf8");
      c1.setAttribute("opacity", "0.9");
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", (hub.x + 12).toString());
      t.setAttribute("y", (hub.y + 4).toString());
      t.setAttribute("class", "text-xs font-bold fill-cyan-100");
      t.textContent = "Hub";
      gHub.appendChild(c1);
      gHub.appendChild(t);
      overlay.appendChild(gHub);
    }

    if (hasData) {
      points
        .filter((p) => (mode === "drom" ? DROM.includes(p.code) : true))
        .forEach((p) => {
          const ca = p.data?.ca_ht || 0;
          const size = markerSize(ca);
          const isSelected = selectedTerritory === p.code;
          const showLabel = top.has(p.code);
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g.setAttribute("cursor", "pointer");
          g.addEventListener("click", () => onSelectTerritory(p.code));

          const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          c.setAttribute("cx", p.x.toString());
          c.setAttribute("cy", p.y.toString());
          c.setAttribute("r", (size + 4).toString());
          c.setAttribute("fill", "#0f172a");
          c.setAttribute("opacity", "0.4");
          const c2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          c2.setAttribute("cx", p.x.toString());
          c2.setAttribute("cy", p.y.toString());
          c2.setAttribute("r", size.toString());
          c2.setAttribute("fill", isSelected ? "#38bdf8" : pickColor(p.code));
          c2.setAttribute("opacity", isSelected ? "0.95" : "0.75");
          g.appendChild(c);
          g.appendChild(c2);

          if (showLabel) {
            const off = OFFSETS[p.code] || { dx: 10, dy: -8 };
            const label = p.name;
            const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            bg.setAttribute("x", (p.x + off.dx - 4).toString());
            bg.setAttribute("y", (p.y + off.dy - 12).toString());
            bg.setAttribute("width", (label.length * 7 + 12).toString());
            bg.setAttribute("height", "20");
            bg.setAttribute("rx", "6");
            bg.setAttribute("fill", "#0f172a");
            bg.setAttribute("opacity", "0.7");
            text.setAttribute("x", (p.x + off.dx + 4).toString());
            text.setAttribute("y", (p.y + off.dy + 4).toString());
            text.setAttribute("class", "text-[11px] font-semibold fill-slate-100");
            text.textContent = label;
            g.appendChild(bg);
            g.appendChild(text);
          }
          overlay.appendChild(g);
        });
    }

    rootGroup.appendChild(overlay);
  }, [dataByTerritory, mode, onSelectTerritory, selectedTerritory, size.w, size.h, svgEl]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl bg-slate-950/80 border border-slate-800">
      <div className="absolute top-3 left-3 text-xs text-slate-300/80 z-10">
        Carte svgMap : clic = filtre, double clic = reset. <span className="text-slate-400">{dateRangeLabel}</span>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

function pickColor(code: string) {
  if (DROM.includes(code)) return "#22d3ee";
  return "#60a5fa";
}

function markerSize(ca: number) {
  if (ca <= 0) return 5;
  return clamp(Math.sqrt(ca) * 0.02, 6, 14);
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
