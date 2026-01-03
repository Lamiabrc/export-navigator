import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Kpi = {
  label: string;
  value: string;
  delta?: string;
  onClick?: () => void;
  accent?: string;
};

export function KpiBar({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {items.map((kpi) => (
        <Card
          key={kpi.label}
          className={cn("cursor-pointer border border-border hover:border-primary/50 transition", kpi.accent)}
          onClick={kpi.onClick}
        >
          <CardContent className="p-3 space-y-1">
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
            <div className="text-xl font-bold">{kpi.value}</div>
            {kpi.delta ? <div className="text-[11px] text-muted-foreground">{kpi.delta}</div> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
