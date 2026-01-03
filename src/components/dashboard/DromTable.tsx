import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Row = { territory: string; ca: number; margin: number; transport: number; taxes: number; contribution: number };

export function DromTable({ rows, onSelect }: { rows: Row[]; onSelect?: (t: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">DROM Focus</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="py-2 px-2">Territoire</th>
              <th className="py-2 px-2 text-right">CA</th>
              <th className="py-2 px-2 text-right">Marge</th>
              <th className="py-2 px-2 text-right">Transport</th>
              <th className="py-2 px-2 text-right">Taxes</th>
              <th className="py-2 px-2 text-right">% contrib</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-3 px-2 text-muted-foreground" colSpan={6}>Aucune donnée.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.territory} className="border-b hover:bg-muted/40 cursor-pointer" onClick={() => onSelect?.(row.territory)}>
                  <td className="py-2 px-2 font-semibold flex items-center gap-2">
                    <Badge variant="outline">{row.territory}</Badge>
                  </td>
                  <td className="py-2 px-2 text-right">{fmt(row.ca)}</td>
                  <td className={cn("py-2 px-2 text-right", row.margin < 0 ? "text-red-600" : "text-emerald-600")}>{fmt(row.margin)}</td>
                  <td className="py-2 px-2 text-right">{fmt(row.transport)}</td>
                  <td className="py-2 px-2 text-right">{fmt(row.taxes)}</td>
                  <td className="py-2 px-2 text-right">{row.contribution.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
