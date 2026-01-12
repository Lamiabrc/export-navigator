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
  HUB_FR: "#38bdf8",
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

  // init svgMap (une seule fois)
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const id = `svgmap-${Math.random().toString(36).slice(2)}`;
    container.id = id;

    // ⚠️ svgMap colore surtout les pays ISO.
    // Ici on ne cherche pas à colorer GP/MQ/etc (pas des pays), on ajoute nos overlays (markers/arcs).
    // On met FR pour avoir au moins une donnée “CA” affichable.
    const totalFR = Object.values(dataByTerritory).reduce((s, d) => s + (Number(d.ca_ht) || 0), 0);

    // eslint-disable-next-line new-cap
    new (svgMap as any)({
      targetElementID: id,
      data: {
        data: {
          ca: { name: "CA", format: "{0}" },
        },
        applyData: "ca",
        values: {
          FR: { ca: totalFR },
        },
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

    return () => {
      container.innerHTML = "";
    };
    // on init une fois; overlays sont redessinés dans l’effet suivant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw overlays (markers + arcs) in same SVG group
  React.useEffect(() => {
    if (!svgEl) return;

    const vb = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number);
    if (!vb || vb.length < 4) return;

    const [vbX, vbY, vbW, vbH] = vb;

    // svgMap structure varie; on essaie de se raccrocher au groupe principal
    const rootGroup =
      (svgEl.querySelector("g.svgMap-map") as SVGGElement | null) ||
      (svgEl.querySelector("g") as SVGGElement | null);
    if (!rootGroup) return;

    const old = svgEl.querySelector("#export-overlays");
    if (old) old.remove();

    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
    overlay.setAttribute("id", "export-overlays");

    // styles arc animation (SVG-compatible)
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      #export-overlays .arc-animate {
        stroke-dasharray: 8 10;
        animation: arcDash 1.3s linear infinite;
      }
      @keyframes arcDash {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: -36; }
      }
      #export-overlays text { user-select: none; }
    `;
    overlay.appendChild(style);

    const toXY = (code: string) => {
      const pct = (TERRITORY_PCT as any)[code];
      if (!pct) return null;
      // ✅ IMPORTANT: prendre en compte vbX/vbY (sinon décalage)
      return {
        x: vbX + (pct.x / 100) * vbW,
        y: vbY + (pct.y / 100) * vbH,
        label: pct.label || code,
      };
    };

    const hub = toXY("HUB_FR");

    const points = Object.keys(TERRITORY_PCT)
      .filter((code) => code !== "HUB_FR")
      .map((code) => {
        const pos = toXY(code);
        return {
          code,
          name: pos?.label || code,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          data: dataByTerritory[code],
        };
      });

    const totalLines = Object.values(dataByTerritory).reduce((s, d) => s + (Number(d.lines) || 0), 0);
    const hasData = totalLines > 0;

    const maxCa = Math.max(
      0,
      ...Object.values(dataByTerritory).map((d) => Number(d?.ca_ht) || 0)
    );

    const top = new Set(
      points
        .map((p) => ({ p, ca: Number(p.data?.ca_ht) || 0 }))
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5)
        .map((a) => a.p.code)
    );

    // arcs
    if (hasData && hub) {
      points
        .filter((p) => (mode === "drom" ? DROM.includes(p.code) : true))
        .forEach((p) => {
          const ca = Number(p.data?.ca_ht) || 0;
          if (ca <= 0) return;

          const width = scaleStroke(ca, maxCa);
          const d = buildArc(hub.x, hub.y, p.x, p.y);

          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", d);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", pickColor(p.code));
          path.setAttribute("stroke-width", String(width));
          path.setAttribute("stroke-opacity", "0.65");
          path.setAttribute("class", "arc-animate");
          overlay.appendChild(path);
        });
    }

    // hub marker + pulse
    if (hub) {
      const gHub = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gHub.setAttribute("cursor", "pointer");
      gHub.addEventListener("click", () => onSelectTerritory(null));

      const pulse = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pulse.setAttribute("cx", String(hub.x));
      pulse.setAttribute("cy", String(hub.y));
      pulse.setAttribute("r", "8");
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke", pickColor("HUB_FR"));
      pulse.setAttribute("stroke-width", "2");
      pulse.setAttribute("opacity", "0.6");

      const aR = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      aR.setAttribute("attributeName", "r");
      aR.setAttribute("values", "8;18");
      aR.setAttribute("dur", "1.8s");
      aR.setAttribute("repeatCount", "indefinite");

      const aO = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      aO.setAttribute("attributeName", "opacity");
      aO.setAttribute("values", "0.6;0");
      aO.setAttribute("dur", "1.8s");
      aO.setAttribute("repeatCount", "indefinite");

      pulse.appendChild(aR);
      pulse.appendChild(aO);

      const c1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c1.setAttribute("cx", String(hub.x));
      c1.setAttribute("cy", String(hub.y));
      c1.setAttribute("r", "10");
      c1.setAttribute("fill", pickColor("HUB_FR"));
      c1.setAttribute("opacity", "0.9");

      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(hub.x + 12));
      t.setAttribute("y", String(hub.y + 4));
      t.setAttribute("fill", "#e2e8f0");
      t.setAttribute("font-size", "12");
      t.setAttribute("font-weight", "700");
      t.textContent = "Hub";

      gHub.appendChild(pulse);
      gHub.appendChild(c1);
      gHub.appendChild(t);
      overlay.appendChild(gHub);
    }

    // markers
    if (hasData) {
      points
        .filter((p) => (mode === "drom" ? DROM.includes(p.code) : true))
        .forEach((p) => {
          const ca = Number(p.data?.ca_ht) || 0;
          const size = markerSize(ca);
          const isSelected = selectedTerritory === p.code;
          const showLabel = top.has(p.code);

          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g.setAttribute("cursor", "pointer");
          g.addEventListener("click", () => onSelectTerritory(p.code));
          g.addEventListener("dblclick", () => onSelectTerritory(null));

          const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          c.setAttribute("cx", String(p.x));
          c.setAttribute("cy", String(p.y));
          c.setAttribute("r", String(size + 4));
          c.setAttribute("fill", "#0f172a");
          c.setAttribute("opacity", "0.4");

          const c2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          c2.setAttribute("cx", String(p.x));
          c2.setAttribute("cy", String(p.y));
          c2.setAttribute("r", String(size));
          c2.setAttribute("fill", isSelected ? "#38bdf8" : pickColor(p.code));
          c2.setAttribute("opacity", isSelected ? "0.95" : ca > 0 ? "0.8" : "0.35");

          g.appendChild(c);
          g.appendChild(c2);

          if (showLabel) {
            const off = OFFSETS[p.code] || { dx: 10, dy: -8 };
            const label = p.name;

            const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bg.setAttribute("x", String(p.x + off.dx - 4));
            bg.setAttribute("y", String(p.y + off.dy - 12));
            bg.setAttribute("width", String(label.length * 7 + 12));
            bg.setAttribute("height", "20");
            bg.setAttribute("rx", "6");
            bg.setAttribute("fill", "#0f172a");
            bg.setAttribute("opacity", "0.72");

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", String(p.x + off.dx + 4));
            text.setAttribute("y", String(p.y + off.dy + 4));
            text.setAttribute("fill", "#e2e8f0");
            text.setAttribute("font-size", "11");
            text.setAttribute("font-weight", "700");
            text.textContent = label;

            g.appendChild(bg);
            g.appendChild(text);
          }

          overlay.appendChild(g);
        });
    }

    rootGroup.appendChild(overlay);
  }, [dataByTerritory, mode, onSelectTerritory, selectedTerritory, svgEl]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl bg-slate-950/80 border border-slate-800">
      <div className="absolute top-3 left-3 text-xs text-slate-300/80 z-10">
        Carte svgMap : clic = filtre, double clic = reset.{" "}
        <span className="text-slate-400">{dateRangeLabel}</span>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

function pickColor(code: string) {
  return COLORS[code] || (DROM.includes(code) ? "#22d3ee" : "#60a5fa");
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
