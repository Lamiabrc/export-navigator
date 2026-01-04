import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompetitorSnapshot } from "@/hooks/useCompetitorSnapshots";
import { Competitor } from "@/hooks/useCompetitors";
import { cn } from "@/lib/utils";

type Row = {
  key: string;
  product_ref: string;
  territory: string;
  ourPrice: number | null;
  bestPrice: number | null;
  bestCompetitor?: string;
  gapPct: number | null;
  trend: number[];
};

export function BenchmarkTable({
  snapshots,
  competitorsById,
  ourPrices,
  thresholds,
  onSimulate,
}: {
  snapshots: CompetitorSnapshot[];
  competitorsById: Map<string, Competitor>;
  ourPrices?: Map<string, number>;
  thresholds: { priceGapAlertPct: number; priceDropAlertPct: number };
  onSimulate?: (row: Row) => void;
}) {
  const rows: Row[] = React.useMemo(() => {
    const groups = new Map<string, CompetitorSnapshot[]>();
    snapshots.forEach((s) => {
      const key = `${s.product_ref || "NA"}::${s.territory_code || "NA"}`;
      const arr = groups.get(key) || [];
      arr.push(s);
      groups.set(key, arr);
    });

    return Array.from(groups.entries()).map(([key, list]) => {
      const sorted = list
        .filter((l) => l.net_price_est !== null && l.net_price_est !== undefined)
        .sort((a, b) => (a.snapshot_date || "").localeCompare(b.snapshot_date || ""));
      const last = sorted[sorted.length - 1];
      const best = sorted.reduce(
        (min, cur) => {
          if (cur.net_price_est === null || cur.net_price_est === undefined) return min;
          if (min.net_price_est === null || min.net_price_est === undefined) return cur;
          return cur.net_price_est < min.net_price_est ? cur : min;
        },
        sorted[0] ?? ({} as CompetitorSnapshot),
      );

      const ourKey = `${last?.product_ref || ""}::${last?.territory_code || ""}`;
      const ourPrice = ourPrices?.get(ourKey) ?? null;
      const bestPrice = best?.net_price_est ?? null;
      const gapPct = ourPrice && bestPrice ? ((ourPrice - bestPrice) / bestPrice) * 100 : null;

      return {
        key,
        product_ref: last?.product_ref || "NA",
        territory: last?.territory_code || "NA",
        ourPrice,
        bestPrice,
        bestCompetitor: best?.competitor_id ? competitorsById.get(best.competitor_id)?.name || best.competitor_id : undefined,
        gapPct,
        trend: sorted.slice(-8).map((s) => Number(s.net_price_est ?? 0)),
      };
    });
  }, [snapshots, competitorsById, ourPrices]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="font-semibold">Benchmark Prix</h3>
          <p className="text-sm text-muted-foreground">Prix nets estimés vs concurrents (dernier snapshot)</p>
        </div>
        <Badge variant="outline">Seuil écart {thresholds.priceGapAlertPct}%</Badge>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2">Produit / Territoire</th>
              <th className="px-3 py-2 text-right">Notre net</th>
              <th className="px-3 py-2 text-right">Best concurrent</th>
              <th className="px-3 py-2 text-right">Écart %</th>
              <th className="px-3 py-2">Tendance 30j</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                  Aucun snapshot concurrent.
                </td>
              </tr>
            ) : (
              rows.slice(0, 120).map((row) => {
                const alert = row.gapPct !== null && row.gapPct > thresholds.priceGapAlertPct;
                return (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{row.product_ref}</div>
                      <div className="text-xs text-muted-foreground">{row.territory}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{row.ourPrice ? row.ourPrice.toFixed(2) : "?"}</td>
                    <td className="px-3 py-2 text-right">
                      {row.bestPrice ? row.bestPrice.toFixed(2) : "?"}
                      <div className="text-[11px] text-muted-foreground">{row.bestCompetitor || "n/a"}</div>
                    </td>
                    <td className={cn("px-3 py-2 text-right font-semibold", alert ? "text-amber-600" : "text-emerald-500")}>
                      {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "n/a"}
                    </td>
                    <td className="px-3 py-2">
                      <Sparkline values={row.trend} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onSimulate?.(row)}>
                        Simuler alignement
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-xs text-muted-foreground">n/a</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const norm = values.map((v) => (max === min ? 0.5 : (v - min) / (max - min)));
  const points = norm.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${100 - v * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="h-10 w-24 text-muted-foreground">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
      <circle cx="100" cy={100 - norm[norm.length - 1] * 100} r="3" fill="currentColor" />
    </svg>
  );
}
