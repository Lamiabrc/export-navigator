import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompetitorSnapshot } from "@/hooks/useCompetitorSnapshots";
import { CompetitorEvent } from "@/hooks/useCompetitorEvents";
import { cn } from "@/lib/utils";

const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];

type TerritoryCard = {
  code: string;
  competitors: number;
  bestPrice: number | null;
  ourPrice: number | null;
  gapPct: number | null;
  events: CompetitorEvent[];
  alert: boolean;
};

export function DromCompetitionCards({
  snapshots,
  events,
  ourPrices,
  thresholds,
}: {
  snapshots: CompetitorSnapshot[];
  events: CompetitorEvent[];
  ourPrices?: Map<string, number>;
  thresholds: { priceGapAlertPct: number; promoImpactScoreMin: number };
}) {
  const cards: TerritoryCard[] = React.useMemo(() => {
    return DROM_CODES.map((code) => {
      const territorySnaps = snapshots.filter((s) => (s.territory_code || "").toUpperCase() === code);
      const compSet = new Set(territorySnaps.map((s) => s.competitor_id).filter(Boolean));
      const best = territorySnaps.reduce((min: number | null, s) => {
        const v = s.net_price_est ?? null;
        if (v === null || v === undefined) return min;
        if (min === null) return v;
        return v < min ? v : min;
      }, null as number | null);

      const ourKey = `${code}::latest`;
      const ourPrice = ourPrices?.get(ourKey) ?? null;
      const gapPct = ourPrice && best ? ((ourPrice - best) / best) * 100 : null;
      const territoryEvents = events.filter((e) => (e.territory_code || "").toUpperCase() === code).slice(0, 2);
      const alert = (gapPct !== null && gapPct > thresholds.priceGapAlertPct) || territoryEvents.some((e) => (e.impact_score || 0) >= thresholds.promoImpactScoreMin);

      return {
        code,
        competitors: compSet.size,
        bestPrice: best,
        ourPrice,
        gapPct,
        events: territoryEvents,
        alert,
      };
    });
  }, [events, snapshots, ourPrices, thresholds]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.code} className={cn("border", card.alert ? "border-amber-500/60 shadow-amber-500/20 shadow-lg" : "border-border")}>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              {card.code}
              {card.alert ? <Badge variant="destructive">Alerte</Badge> : <Badge variant="outline">OK</Badge>}
            </CardTitle>
            <Badge variant="secondary">{card.competitors} concurrents</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Best net" value={price(card.bestPrice)} accent="text-emerald-500" />
              <Stat label="Notre net" value={price(card.ourPrice)} />
              <Stat label="Écart %" value={card.gapPct !== null ? `${card.gapPct.toFixed(1)}%` : "n/a"} accent={card.gapPct !== null && card.gapPct > thresholds.priceGapAlertPct ? "text-amber-600 font-semibold" : "text-muted-foreground"} />
              <Stat label="Events" value={`${card.events.length}`} />
            </div>
            <div className="space-y-2">
              {card.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Pas d'événement récent.</p>
              ) : (
                card.events.map((e) => (
                  <div key={e.id} className="rounded-lg border p-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{e.title}</span>
                      <Badge variant="outline">{e.kind}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{e.details || e.source || ""}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold", accent)}>{value}</div>
    </div>
  );
}

function price(v: number | null) {
  if (v === null || v === undefined) return "n/a";
  return v.toFixed(2);
}
