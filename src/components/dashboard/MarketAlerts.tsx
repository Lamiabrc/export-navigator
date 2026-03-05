import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MarketAlertsProps = {
  isEn: boolean;
};

type AlertRow = {
  country: string;
  titleFr: string;
  titleEn: string;
  source: string;
  dateFr: string;
  dateEn: string;
};

const ALERTS: AlertRow[] = [
  {
    country: "Iran",
    titleFr: "Nouveau barème douanier",
    titleEn: "New customs tariff schedule",
    source: "Douane Iran",
    dateFr: "12 avril 2026",
    dateEn: "April 12, 2026",
  },
  {
    country: "EAU",
    titleFr: "Restriction export métaux",
    titleEn: "Metal export restriction",
    source: "Dubai Trade",
    dateFr: "10 avril 2026",
    dateEn: "April 10, 2026",
  },
  {
    country: "OMC",
    titleFr: "Négociations commerciales",
    titleEn: "Trade negotiations",
    source: "WTO",
    dateFr: "8 avril 2026",
    dateEn: "April 8, 2026",
  },
];

export function MarketAlerts({ isEn }: MarketAlertsProps) {
  const copy = isEn
    ? {
        title: "Export Market Alerts",
        colCountry: "Country",
        colNews: "News",
        colSource: "Source",
        colDate: "Date",
        cta: "View all monitoring",
      }
    : {
        title: "Alertes marchés export",
        colCountry: "Pays",
        colNews: "Titre actualité",
        colSource: "Source",
        colDate: "Date",
        cta: "Voir toute la veille",
      };

  return (
    <section>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg text-slate-900">{copy.title}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/veille">{copy.cta}</Link>
          </Button>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_2.2fr_1.3fr_1.1fr] gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600 md:grid">
              <span>{copy.colCountry}</span>
              <span>{copy.colNews}</span>
              <span>{copy.colSource}</span>
              <span>{copy.colDate}</span>
            </div>

            {ALERTS.map((alert) => (
              <article
                key={`${alert.country}-${alert.source}-${alert.dateFr}`}
                className="grid gap-1 rounded-lg border border-slate-200 bg-white px-3 py-3 md:grid-cols-[1fr_2.2fr_1.3fr_1.1fr] md:items-center md:gap-3"
              >
                <p className="text-sm font-semibold text-slate-900">{alert.country}</p>
                <p className="text-sm text-slate-800">{isEn ? alert.titleEn : alert.titleFr}</p>
                <p className="text-sm text-slate-600">{alert.source}</p>
                <p className="text-sm text-slate-600">{isEn ? alert.dateEn : alert.dateFr}</p>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
