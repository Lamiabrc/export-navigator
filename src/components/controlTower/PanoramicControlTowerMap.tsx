import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MapStats = {
  alerts?: number;
  updates?: number;
  total?: number;
};

type CountryStats = MapStats & {
  label?: string;
};

type SvgCountry = {
  iso: string;
  name: string;
  d: string;
};

type Props = {
  /** ISO2 (ex: "FR") */
  selectedCountry?: string | null;
  /** Libellé affiché dans le badge (si tu veux forcer un nom) */
  selectedLabel?: string;

  /**
   * Stats agrégées pour la sélection courante (optionnel).
   * Si tu filtres déjà côté parent, tu peux continuer à passer ce props.
   */
  stats?: MapStats;

  /**
   * Stats par pays (optionnel) :
   * - active un rendu "choroplèthe" (intensité)
   * - enrichit le tooltip (alertes / updates / total)
   */
  countryStats?: Record<string, CountryStats>;

  /**
   * URL du SVG à charger.
   * ⚠️ Place `world-map.svg` dans `/public/world-map.svg` pour garder la valeur par défaut.
   */
  svgUrl?: string;

  onCountrySelect: (iso: string) => void;
  onReset?: () => void;
};

function safeNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function statValue(s?: MapStats) {
  if (!s) return 0;
  const total = safeNumber(s.total);
  if (total > 0) return total;
  return safeNumber(s.alerts) + safeNumber(s.updates);
}

function isIso2(id: string) {
  return /^[A-Z]{2}$/.test(id);
}

export function PanoramicControlTowerMap({
  selectedCountry,
  selectedLabel,
  stats,
  countryStats,
  svgUrl = "/world-map.svg",
  onCountrySelect,
  onReset,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [countries, setCountries] = React.useState<SvgCountry[]>([]);
  const [viewBox, setViewBox] = React.useState<string>("0 0 1000 360");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [tooltip, setTooltip] = React.useState<{
    iso: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);

  const [hoverIso, setHoverIso] = React.useState<string | null>(null);

  // --- Load & parse SVG (dynamic map)
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(svgUrl, { cache: "force-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        if (cancelled) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");

        const widthAttr = svg?.getAttribute("width") ?? "1000";
        const heightAttr = svg?.getAttribute("height") ?? "360";
        const width = Number.parseFloat(widthAttr) || 1000;
        const height = Number.parseFloat(heightAttr) || 360;

        const vb = svg?.getAttribute("viewBox") ?? `0 0 ${width} ${height}`;
        setViewBox(vb);

        const pathNodes = Array.from(doc.querySelectorAll("path[id]"));
        const parsed = pathNodes
          .map((p) => {
            const iso = (p.getAttribute("id") ?? "").trim().toUpperCase();
            const d = (p.getAttribute("d") ?? "").trim();
            const name =
              (p.getAttribute("title") ??
                p.getAttribute("name") ??
                iso ??
                "Pays")?.trim() || iso;

            return { iso, name, d };
          })
          .filter((c) => c.iso && c.d && isIso2(c.iso));

        // petit tri pour stabilité (utile au diff / rendu)
        parsed.sort((a, b) => a.iso.localeCompare(b.iso));

        setCountries(parsed);
      } catch (e) {
        if (cancelled) return;
        setError(
          `Impossible de charger la carte (${svgUrl}). Vérifie que world-map.svg est bien dans /public (ou passe svgUrl).`
        );
        setCountries([]);
        setViewBox("0 0 1000 360");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [svgUrl]);

  // --- Resolve label & stats (badge header)
  const resolvedLabel = React.useMemo(() => {
    if (selectedLabel) return selectedLabel;
    if (!selectedCountry) return "Tous";
    const fromList = countries.find((c) => c.iso === selectedCountry)?.name;
    const fromStats = countryStats?.[selectedCountry]?.label;
    return fromList || fromStats || selectedCountry;
  }, [selectedLabel, selectedCountry, countries, countryStats]);

  const resolvedStats = React.useMemo<MapStats>(() => {
    if (stats) return stats;
    if (selectedCountry && countryStats?.[selectedCountry]) return countryStats[selectedCountry];
    return { alerts: 0, updates: 0, total: 0 };
  }, [stats, selectedCountry, countryStats]);

  const alerts = safeNumber(resolvedStats.alerts);
  const updates = safeNumber(resolvedStats.updates);
  const total = safeNumber(resolvedStats.total) || alerts + updates;

  // --- Choropleth scale (optional)
  const maxValue = React.useMemo(() => {
    if (!countryStats) return 0;
    let m = 0;
    for (const v of Object.values(countryStats)) m = Math.max(m, statValue(v));
    return m;
  }, [countryStats]);

  const getFill = React.useCallback(
    (iso: string, active: boolean, hovered: boolean) => {
      // Priorité : actif > hover > intensité > défaut
      if (active) return "rgba(56,189,248,0.85)"; // sky
      if (hovered) return "rgba(56,189,248,0.55)";

      if (countryStats && maxValue > 0) {
        const v = statValue(countryStats[iso]);
        if (v <= 0) return "rgba(148,163,184,0.28)";

        // alpha entre 0.28 et 0.72 selon l'intensité
        const t = Math.min(1, Math.max(0, v / maxValue));
        const alpha = 0.28 + t * 0.44;
        return `rgba(56,189,248,${alpha.toFixed(3)})`;
      }

      return "rgba(148,163,184,0.35)";
    },
    [countryStats, maxValue]
  );

  // --- Tooltip positioning helpers
  const getPoint = (evt: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const handleEnter = (
    evt: React.MouseEvent<SVGPathElement, MouseEvent>,
    country: SvgCountry
  ) => {
    const point = getPoint(evt);
    setHoverIso(country.iso);
    setTooltip({ iso: country.iso, name: country.name, x: point.x, y: point.y });
  };

  const handleMove = (evt: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    setTooltip((prev) => {
      if (!prev) return prev;
      const point = getPoint(evt);
      return { ...prev, x: point.x, y: point.y };
    });
  };

  const handleLeave = () => {
    setHoverIso(null);
    setTooltip(null);
  };

  const handleFocus = (evt: React.FocusEvent<SVGPathElement>, country: SvgCountry) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = evt.currentTarget.getBoundingClientRect();
    const x = target.left - rect.left + target.width / 2;
    const y = target.top - rect.top;
    setHoverIso(country.iso);
    setTooltip({ iso: country.iso, name: country.name, x, y });
  };

  const tipStats = tooltip ? countryStats?.[tooltip.iso] : undefined;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Carte export</h2>
          <p className="text-sm text-slate-600">
            Survolez pour voir le détail, cliquez un pays pour filtrer la veille.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Pays sélectionné : {resolvedLabel}</Badge>
          <Badge variant="secondary">Alertes : {alerts}</Badge>
          <Badge variant="secondary">Mises à jour : {updates}</Badge>
          <Badge variant="secondary">Total : {total}</Badge>

          {onReset ? (
            <Button size="sm" variant="outline" onClick={onReset}>
              Réinitialiser filtre
            </Button>
          ) : null}
        </div>
      </div>

      <div className="svgMap-container">
        <div
          ref={containerRef}
          className="relative svgMap-map-wrapper svgMap-panorama overflow-hidden border border-slate-800/30 shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
        >
          {/* Fallback / loading */}
          {loading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow">
                Chargement de la carte…
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/60 backdrop-blur-sm">
              <div className="max-w-[560px] rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700 shadow">
                {error}
              </div>
            </div>
          ) : null}

          <svg
            className="svgMap-map-image h-auto w-full"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Carte monde interactive"
            onClick={(evt) => {
              // clic "dans le vide" => reset (si dispo)
              if (!onReset) return;
              if (evt.target === evt.currentTarget) onReset();
            }}
            style={{
              // fallback si ton CSS svgMap utilise la variable
              ["--svg-map-country-fill" as string]: "rgba(148,163,184,0.35)",
            }}
          >
            {/* fond transparent */}
            <rect x="0" y="0" width="100%" height="100%" fill="transparent" pointerEvents="none" />

            {/* Pays (chargés dynamiquement depuis world-map.svg) */}
            <g aria-label="Pays">
              {countries.map((country) => {
                const active = !!selectedCountry && selectedCountry === country.iso;
                const hovered = hoverIso === country.iso;
                const fill = getFill(country.iso, active, hovered);

                return (
                  <path
                    key={country.iso}
                    d={country.d}
                    data-iso={country.iso}
                    aria-label={country.name}
                    role="button"
                    aria-pressed={active}
                    tabIndex={0}
                    className={`svgMap-country${active ? " svgMap-active" : ""}`}
                    style={{
                      fill,
                      stroke: "rgba(15,23,42,0.28)",
                      strokeWidth: 0.6,
                      vectorEffect: "non-scaling-stroke",
                      cursor: "pointer",
                      outline: "none",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCountrySelect(country.iso);
                    }}
                    onMouseEnter={(evt) => handleEnter(evt, country)}
                    onMouseMove={handleMove}
                    onMouseLeave={handleLeave}
                    onFocus={(evt) => handleFocus(evt, country)}
                    onBlur={handleLeave}
                    onKeyDown={(evt) => {
                      if (evt.key === "Enter" || evt.key === " ") {
                        evt.preventDefault();
                        onCountrySelect(country.iso);
                      }
                      if (evt.key === "Escape") {
                        onReset?.();
                      }
                    }}
                  />
                );
              })}
            </g>
          </svg>

          {/* halo/gradient overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(244,63,94,0.12),transparent_40%)]" />

          {/* Tooltip */}
          {tooltip ? (
            <div
              className="svgMap-tooltip svgMap-active pointer-events-none absolute z-20"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: "translate(10px, -10px)",
              }}
            >
              <div className="svgMap-tooltip-content-container rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow">
                <div className="svgMap-tooltip-title text-sm font-semibold text-slate-900">
                  {tooltip.name}
                </div>

                <div className="svgMap-tooltip-content mt-1 text-slate-700">
                  Code : <span className="font-mono">{tooltip.iso}</span>
                </div>

                {tipStats ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-slate-50 px-2 py-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Alertes</div>
                      <div className="font-semibold text-slate-900">
                        {safeNumber(tipStats.alerts)}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Updates</div>
                      <div className="font-semibold text-slate-900">
                        {safeNumber(tipStats.updates)}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Total</div>
                      <div className="font-semibold text-slate-900">
                        {safeNumber(tipStats.total) || safeNumber(tipStats.alerts) + safeNumber(tipStats.updates)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* petit triangle */}
              <div
                className="svgMap-tooltip-pointer"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                  borderTop: "10px solid rgba(255,255,255,0.95)",
                  marginLeft: 12,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
