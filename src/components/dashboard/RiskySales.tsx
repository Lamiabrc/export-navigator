import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = { id: string; client_id: string | null; product_ref: string | null; amount_ht: number | null; margin: number | null; sale_date: string };

export function RiskySales({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Ventes à risque</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune vente sous seuil.</p> : null}
        {rows.slice(0, 20).map((r) => (
          <div key={r.id} className="rounded-lg border p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{r.product_ref || "Produit"}</span>
              <span className="text-xs text-muted-foreground">{r.sale_date}</span>
            </div>
            <div className="text-xs text-muted-foreground">Client: {r.client_id || "n/a"}</div>
            <div className="text-xs">CA: {fmt(r.amount_ht || 0)} | Marge: {fmt(r.margin || 0)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
