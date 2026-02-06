import * as React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Line = { label: string; amountEur: number };

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

// Couleurs basées sur le thème (pas de hex “en dur”)
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted))",
  "hsl(var(--destructive))",
  "hsl(var(--ring))",
];

export function CostBreakdownBar({ lines }: { lines: Line[] }) {
  const data = React.useMemo(
    () => lines.map((l) => ({ name: l.label, value: Math.round(l.amountEur * 100) / 100 })),
    [lines]
  );

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 24 }}>
          <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tickFormatter={(v) => eur(v)} width={92} />
          <Tooltip formatter={(v: any) => eur(Number(v))} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={COLORS[0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostSharePie({ lines }: { lines: Line[] }) {
  const data = React.useMemo(
    () => lines.map((l) => ({ name: l.label, value: Math.round(l.amountEur * 100) / 100 })),
    [lines]
  );

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip formatter={(v: any) => eur(Number(v))} />
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={105} innerRadius={55} paddingAngle={2}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
