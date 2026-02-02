import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Step = { label: string; value: number };

export function MarginWaterfall({
  steps,
  format = (n) => n.toFixed(0),
  title = "Drivers de marge",
}: {
  steps: Step[];
  title?: string;
  format?: (n: number) => string;
}) {
  // Cumul (waterfall)
  const rows = React.useMemo(() => {
    let running = 0;
    return steps.map((s) => {
      const start = running;
      const end = running + s.value;
      running = end;
      return { ...s, start, end };
    });
  }, [steps]);

  const total = rows.length ? rows[rows.length - 1].end : 0;

  // Domaine (pour mapper en x)
  const minV = Math.min(0, ...rows.flatMap((r) => [r.start, r.end]));
  const maxV = Math.max(0, ...rows.flatMap((r) => [r.start, r.end]));
  const range = Math.max(maxV - minV, 1);

  // Layout SVG
  const padLeft = 6; // en "unités" du viewBox
  const padRight = 4;
  const plotW = 100 - padLeft - padRight;

  const rowH = 12;
  const topPad = 6;
  const bottomPad = 10;
  const svgH = topPad + rows.length * rowH + bottomPad;

  const xOf = (v: number) => padLeft + ((v - minV) / range) * plotW;
  const xZero = xOf(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <svg
          viewBox={`0 0 100 ${svgH}`}
          className="w-full"
          style={{ height: Math.max(140, rows.length * 22) }}
          role="img"
          aria-label="Waterfall des drivers de marge"
        >
          {/* baseline 0 */}
          <line
            x1={xZero}
            x2={xZero}
            y1={0}
            y2={svgH}
            stroke="currentColor"
            opacity={0.18}
            strokeWidth={0.6}
          />

          {rows.map((r, idx) => {
            const y = topPad + idx * rowH;

            const x1 = xOf(r.start);
            const x2 = xOf(r.end);
            const x = Math.min(x1, x2);
            const w = Math.max(Math.abs(x2 - x1), 0.6);

            const isPos = r.value >= 0;

            return (
              <g key={`${r.label}-${idx}`} transform={`translate(0, ${y})`}>
                {/* connecteur vers la barre (petite ligne horizontale) */}
                <line
                  x1={x1}
                  x2={x}
                  y1={4}
                  y2={4}
                  stroke="currentColor"
                  opacity={0.14}
                  strokeWidth={0.6}
                />

                {/* barre cumulée */}
                <rect
                  x={x}
                  y={0}
                  width={w}
                  height={8}
                  rx={2}
                  fill={isPos ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                  opacity={0.85}
                />

                {/* libellé à gauche */}
                <text
                  x={2}
                  y={7}
                  fontSize={3.2}
                  fill="currentColor"
                  opacity={0.85}
                >
                  {r.label}
                </text>

                {/* valeur à droite */}
                <text
                  x={96}
                  y={7}
                  fontSize={3.2}
                  textAnchor="end"
                  fill="currentColor"
                  opacity={0.8}
                >
                  {format(r.value)}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total marge</span>
          <span className="font-semibold">{format(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
