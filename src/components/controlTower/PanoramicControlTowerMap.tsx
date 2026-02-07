import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MapCountry = {
  iso: string;
  name: string;
  path: string;
};

type MapStats = {
  alerts?: number;
  updates?: number;
  total?: number;
};

type Props = {
  selectedCountry?: string | null;
  selectedLabel?: string;
  stats?: MapStats;
  onCountrySelect: (iso: string) => void;
  onReset?: () => void;
};

const COUNTRIES: MapCountry[] = [
  { iso: "CA", name: "Canada", path: "M140 80 H310 V115 H140 Z" },
  { iso: "US", name: "Etats-Unis", path: "M150 125 H300 V175 H150 Z" },
  { iso: "MX", name: "Mexique", path: "M210 180 H275 V205 H210 Z" },
  { iso: "BR", name: "Bresil", path: "M300 230 H370 V290 H300 Z" },
  { iso: "GB", name: "Royaume-Uni", path: "M440 120 H456 V138 H440 Z" },
  { iso: "FR", name: "France", path: "M470 150 H492 V166 H470 Z" },
  { iso: "DE", name: "Allemagne", path: "M495 135 H517 V157 H495 Z" },
  { iso: "ES", name: "Espagne", path: "M440 170 H468 V186 H440 Z" },
  { iso: "IT", name: "Italie", path: "M520 170 H538 V196 H520 Z" },
  { iso: "MA", name: "Maroc", path: "M430 200 H448 V214 H430 Z" },
  { iso: "DZ", name: "Algerie", path: "M455 210 H483 V228 H455 Z" },
  { iso: "ZA", name: "Afrique du Sud", path: "M560 305 H598 V323 H560 Z" },
  { iso: "IN", name: "Inde", path: "M650 195 H695 V230 H650 Z" },
  { iso: "CN", name: "Chine", path: "M720 150 H810 V190 H720 Z" },
  { iso: "JP", name: "Japon", path: "M820 160 H838 V192 H820 Z" },
  { iso: "AU", name: "Australie", path: "M820 270 H900 V305 H820 Z" },
];

const MAP_BACKGROUND = [
  "M70 80 L280 80 L330 140 L260 210 L130 190 L70 130 Z",
  "M250 210 L320 220 L340 300 L280 340 L220 320 L205 250 Z",
  "M380 90 L520 90 L560 160 L520 260 L420 270 L360 200 Z",
  "M560 90 L860 90 L940 170 L900 250 L760 230 L620 170 Z",
  "M820 250 L900 260 L930 310 L860 320 Z",
];

export function PanoramicControlTowerMap({
  selectedCountry,
  selectedLabel,
  stats,
  onCountrySelect,
  onReset,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = React.useState<{
    iso: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);

  const resolvedLabel = selectedLabel || (selectedCountry ? selectedCountry : "Tous");
  const alerts = stats?.alerts ?? 0;
  const updates = stats?.updates ?? 0;

  const getPoint = (evt: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  };

  const handleEnter = (
    evt: React.MouseEvent<SVGPathElement, MouseEvent>,
    country: MapCountry
  ) => {
    const point = getPoint(evt);
    setTooltip({ iso: country.iso, name: country.name, x: point.x, y: point.y });
  };

  const handleMove = (evt: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    if (!tooltip) return;
    const point = getPoint(evt);
    setTooltip((prev) => (prev ? { ...prev, x: point.x, y: point.y } : prev));
  };

  const handleFocus = (
    evt: React.FocusEvent<SVGPathElement>,
    country: MapCountry
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = evt.currentTarget.getBoundingClientRect();
    const x = target.left - rect.left + target.width / 2;
    const y = target.top - rect.top;
    setTooltip({ iso: country.iso, name: country.name, x, y });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Carte export</h2>
          <p className="text-sm text-slate-600">Cliquez un pays pour filtrer la veille.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Pays selectionne: {resolvedLabel}</Badge>
          <Badge variant="secondary">Alertes: {alerts}</Badge>
          <Badge variant="secondary">Mises a jour: {updates}</Badge>
          {onReset ? (
            <Button size="sm" variant="outline" onClick={onReset}>
              Reinitialiser filtre
            </Button>
          ) : null}
        </div>
      </div>

      <div className="svgMap-container">
        <div
          ref={containerRef}
          className="svgMap-map-wrapper svgMap-panorama border border-slate-800/30 shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
        >
          <svg
            className="svgMap-map-image"
            viewBox="0 0 1000 360"
            style={{ ["--svg-map-country-fill" as string]: "rgba(148,163,184,0.55)" }}
            role="img"
            aria-label="Carte monde interactive"
          >
            <rect x="0" y="0" width="1000" height="360" fill="transparent" />
            {MAP_BACKGROUND.map((d) => (
              <path key={d} d={d} fill="rgba(148,163,184,0.12)" stroke="rgba(148,163,184,0.2)" />
            ))}

            {COUNTRIES.map((country) => {
              const active = selectedCountry === country.iso;
              return (
                <path
                  key={country.iso}
                  d={country.path}
                  data-iso={country.iso}
                  aria-label={country.name}
                  role="button"
                  tabIndex={0}
                  className={`svgMap-country${active ? " svgMap-active" : ""}`}
                  style={
                    active
                      ? { ["--svg-map-country-fill" as string]: "rgba(56,189,248,0.8)" }
                      : undefined
                  }
                  onClick={() => onCountrySelect(country.iso)}
                  onMouseEnter={(evt) => handleEnter(evt, country)}
                  onMouseMove={handleMove}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={(evt) => handleFocus(evt, country)}
                  onBlur={() => setTooltip(null)}
                  onKeyDown={(evt) => {
                    if (evt.key === "Enter" || evt.key === " ") {
                      evt.preventDefault();
                      onCountrySelect(country.iso);
                    }
                  }}
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(244,63,94,0.12),transparent_40%)]" />

          {tooltip ? (
            <div
              className="svgMap-tooltip svgMap-active"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="svgMap-tooltip-content-container">
                <div className="svgMap-tooltip-title">{tooltip.name}</div>
                <div className="svgMap-tooltip-content">
                  Code: <span>{tooltip.iso}</span>
                </div>
              </div>
              <div className="svgMap-tooltip-pointer" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
