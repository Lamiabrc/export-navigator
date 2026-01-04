import React from "react";
import { Badge } from "@/components/ui/badge";
import { CompetitorEvent } from "@/hooks/useCompetitorEvents";
import { Competitor } from "@/hooks/useCompetitors";

const KIND_COLORS: Record<string, string> = {
  promo: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  rupture: "bg-rose-500/15 text-rose-600 border-rose-500/40",
  lancement: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
  communication: "bg-sky-500/15 text-sky-600 border-sky-500/40",
};

export function EventsFeed({ events, competitorsById }: { events: CompetitorEvent[]; competitorsById: Map<string, Competitor> }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold">Signaux & événements</h3>
        <p className="text-sm text-muted-foreground">Promos, ruptures, nouveaux distributeurs, communications.</p>
      </div>
      <div className="divide-y">
        {events.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">Aucun événement.</div>
        ) : (
          events.slice(0, 80).map((e) => {
            const badgeClass = KIND_COLORS[(e.kind || "").toLowerCase()] || "bg-muted text-foreground border-border";
            const competitorName = e.competitor_id ? competitorsById.get(e.competitor_id)?.name || e.competitor_id : "n/a";
            return (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{e.event_date || ""}</span>
                  <Badge variant="outline" className={badgeClass}>
                    {e.kind || "event"}
                  </Badge>
                  {e.territory_code ? <Badge variant="outline">{e.territory_code}</Badge> : null}
                  <span className="ml-auto font-semibold text-foreground">{competitorName}</span>
                </div>
                <div className="text-sm font-semibold">{e.title}</div>
                <div className="text-sm text-muted-foreground">{e.details || e.source || ""}</div>
                {typeof e.impact_score === "number" ? (
                  <div className="text-[11px] text-muted-foreground mt-1">Impact: {e.impact_score}/10</div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
