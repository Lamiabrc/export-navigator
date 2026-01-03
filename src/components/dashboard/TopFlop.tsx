import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = { label: string; value: number; pct: number };

export function TopFlop({ top, flop }: { top: Item[]; flop: Item[] }) {
  const renderList = (list: Item[], title: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">Aucun élément.</p> : null}
      {list.slice(0, 10).map((item) => (
        <div key={item.label} className="flex items-center justify-between text-sm">
          <div className="truncate">{item.label}</div>
          <div className="text-xs text-muted-foreground">{item.pct.toFixed(1)}% | {fmt(item.value)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Top / Flop</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {renderList(top, "Top 10 marge")}
        {renderList(flop, "Flop (marge basse)")}
      </CardContent>
    </Card>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
