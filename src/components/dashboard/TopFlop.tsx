import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = { label: string; value: number; pct: number };

export function TopFlop({ top, flop }: { top: Item[]; flop: Item[] }) {
  const renderList = (list: Item[], title: string, accent: "top" | "flop") => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">Aucun élément.</p> : null}
      {list.slice(0, 10).map((item) => {
        const pct = Number.isFinite(item.pct) ? Math.max(0, Math.min(100, item.pct)) : 0;
        const gradient =
          accent === "top"
            ? "from-emerald-400 via-sky-400 to-blue-500"
            : "from-rose-400 via-amber-400 to-orange-500";
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="truncate">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.pct.toFixed(1)}% | {fmt(item.value)}</div>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${gradient}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Top / Flop</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {renderList(top, "Top 10 marge", "top")}
        {renderList(flop, "Flop (marge basse)", "flop")}
      </CardContent>
    </Card>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
