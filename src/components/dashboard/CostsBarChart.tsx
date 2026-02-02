import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type CostsRow = {
  destination: string;
  transport?: number;
  douane?: number;

  /**
   * Nouveau monde: droits & taxes (générique)
   * - utilise `taxes` si présent
   * - fallback sur `om` si ton backend renvoie encore l'ancien champ
   */
  taxes?: number;
  om?: number;
};

interface CostsBarChartProps {
  data: CostsRow[];
  title: string;
  /**
   * Optionnel : afficher en barres empilées (souvent plus lisible pour des coûts)
   */
  stacked?: boolean;
}

function formatEUR(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatAxisEUR(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 1000)}k€`;
  }
  return `${Math.round(value)}€`;
}

export function CostsBarChart({ data, title, stacked = true }: CostsBarChartProps) {
  // Normalise pour monde: "taxes" = taxes || om || 0
  const normalized = React.useMemo(() => {
    return (data || []).map((d) => ({
      destination: d.destination,
      transport: Number(d.transport || 0),
      douane: Number(d.douane || 0),
      taxes: Number(d.taxes ?? d.om ?? 0),
    }));
  }, [data]);

  // Cache la série "taxes" si elle est vide (monde : pas toujours applicable / pas de données)
  const showTaxes = React.useMemo(() => {
    return normalized.some((d) => (d.taxes || 0) > 0);
  }, [normalized]);

  if (!normalized.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">
          Aucun résultat. Sélectionne un pays/destination pour comparer les coûts (les règles varient selon les traités,
          sanctions et accords).
        </p>
      </div>
    );
  }

  const stackId = stacked ? "costs" : undefined;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={normalized} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

            <XAxis
              dataKey="destination"
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />

            <YAxis
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={formatAxisEUR}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(value: number, name: string) => [formatEUR(Number(value || 0)), name]}
              labelFormatter={(label) => `Destination : ${label}`}
            />

            <Legend
              formatter={(value) => <span className="text-sm text-foreground">{String(value)}</span>}
            />

            <Bar
              dataKey="transport"
              name="Transport"
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
              stackId={stackId}
            />

            <Bar
              dataKey="douane"
              name="Douane & dédouanement"
              fill="hsl(var(--chart-3))"
              radius={[4, 4, 0, 0]}
              stackId={stackId}
            />

            {showTaxes ? (
              <Bar
                dataKey="taxes"
                name="Droits & taxes"
                fill="hsl(var(--chart-4))"
                radius={[4, 4, 0, 0]}
                stackId={stackId}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
