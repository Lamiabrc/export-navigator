import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Step = { label: string; value: number };

export function MarginWaterfall({ steps }: { steps: Step[] }) {
  const total = steps.reduce((s, v) => s + v.value, 0);
  const max = Math.max(...steps.map((s) => Math.abs(s.value)), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Margin drivers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <svg viewBox="0 0 100 10" className="w-full h-20">
          {steps.map((s, idx) => {
            const width = (Math.abs(s.value) / max) * 90;
            const x = 5;
            const y = idx * 12 + 2;
            return (
              <g key={s.label} transform={`translate(${x}, ${y})`}>
                <rect
                  x={0}
                  y={idx}
                  width={width}
                  height={8}
                  fill={s.value >= 0 ? "#10b981" : "#f97316"}
                  opacity={0.9}
                />
                <text x={width + 2} y={8} className="text-[8px] fill-current">
                  {s.label} ({s.value.toFixed(0)})
                </text>
              </g>
            );
          })}
        </svg>
        <div className="text-sm font-semibold">Total marge: {total.toFixed(0)}</div>
      </CardContent>
    </Card>
  );
}
