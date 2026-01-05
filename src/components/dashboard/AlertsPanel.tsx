import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type AlertItem = { id: string; severity: "danger" | "warning" | "info"; title: string; description?: string; action?: string };

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  const color = (s: AlertItem["severity"]) =>
    s === "danger" ? "bg-rose-500/15 text-rose-700 border-rose-200" : s === "warning" ? "bg-amber-500/15 text-amber-700 border-amber-200" : "bg-sky-500/10 text-sky-700 border-sky-200";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Alertes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Aucune alerte.</p> : null}
        {alerts.map((a) => (
          <div key={a.id} className={`rounded-lg border p-3 text-sm ${color(a.severity)}`}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{a.title}</div>
              <Badge variant="outline">{a.severity}</Badge>
            </div>
            {a.description ? <div className="text-xs text-muted-foreground">{a.description}</div> : null}
            {a.action ? <div className="text-xs mt-1">Action: {a.action}</div> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
