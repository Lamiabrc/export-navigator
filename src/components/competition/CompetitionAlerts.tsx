import React from "react";
import { Badge } from "@/components/ui/badge";
import { CompetitorSnapshot } from "@/hooks/useCompetitorSnapshots";
import { CompetitorEvent } from "@/hooks/useCompetitorEvents";
import { Competitor } from "@/hooks/useCompetitors";

type Alert = {
  id: string;
  title: string;
  description: string;
  territory?: string | null;
  action?: string;
};

export function CompetitionAlerts({
  snapshots,
  events,
  competitorsById,
  thresholds,
}: {
  snapshots: CompetitorSnapshot[];
  events: CompetitorEvent[];
  competitorsById: Map<string, Competitor>;
  thresholds: { priceGapAlertPct: number; priceDropAlertPct: number; promoImpactScoreMin: number };
}) {
  const alerts: Alert[] = React.useMemo(() => {
    const list: Alert[] = [];

    // Prix : écart vs meilleur
    const byKey = new Map<string, CompetitorSnapshot[]>();
    snapshots.forEach((s) => {
      const key = `${s.product_ref || "NA"}::${s.territory_code || "NA"}`;
      const arr = byKey.get(key) || [];
      arr.push(s);
      byKey.set(key, arr);
    });

    byKey.forEach((arr, key) => {
      const best = arr.reduce((min: CompetitorSnapshot | null, cur) => {
        if (cur.net_price_est === null || cur.net_price_est === undefined) return min;
        if (!min || (min.net_price_est ?? Infinity) > (cur.net_price_est ?? Infinity)) return cur;
        return min;
      }, null);
      if (!best) return;
      const last = arr[arr.length - 1];
      const ourPrice = last?.list_price || null;
      if (ourPrice && best.net_price_est && ourPrice > best.net_price_est * (1 + thresholds.priceGapAlertPct / 100)) {
        const competitorName = best.competitor_id ? competitorsById.get(best.competitor_id)?.name || best.competitor_id : "concurrent";
        list.push({
          id: `gap-${key}`,
          territory: best.territory_code,
          title: `Écart prix > ${thresholds.priceGapAlertPct}% sur ${best.product_ref}`,
          description: `${competitorName} est à ${best.net_price_est} vs nous ${ourPrice}.`,
          action: "Simuler alignement et vérifier remise",
        });
      }
    });

    // Evénements forts
    events.forEach((e) => {
      if ((e.impact_score || 0) >= thresholds.promoImpactScoreMin) {
        const competitorName = e.competitor_id ? competitorsById.get(e.competitor_id)?.name || e.competitor_id : "concurrent";
        list.push({
          id: `event-${e.id}`,
          territory: e.territory_code,
          title: `${competitorName}: ${e.kind || "event"} impact ${e.impact_score}`,
          description: e.title || e.details || "",
          action: "Prioriser veille & stock DROM",
        });
      }
    });

    return list;
  }, [events, snapshots, competitorsById, thresholds]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="font-semibold">Alertes concurrence</h3>
          <p className="text-sm text-muted-foreground">Écarts prix, promos fortes, ruptures.</p>
        </div>
        <Badge variant="secondary">{alerts.length} alerte(s)</Badge>
      </div>
      <div className="divide-y">
        {alerts.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">Aucune alerte générée.</div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {a.territory ? <Badge variant="outline">{a.territory}</Badge> : null}
              </div>
              <div className="text-sm font-semibold">{a.title}</div>
              <div className="text-sm text-muted-foreground">{a.description}</div>
              {a.action ? <div className="text-[11px] text-foreground mt-1">Action: {a.action}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
