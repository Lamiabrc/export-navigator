import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/contexts/LanguageContext";
import { getCountryLabel } from "@/lib/constants";
import { buildDashboardMetrics, listDeals } from "@/services/crm";

function money(value: number, lang: "fr" | "en") {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function DashboardVentes() {
  const { lang } = useI18n();
  const uiLang = lang === "en" ? "en" : "fr";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState(() =>
    buildDashboardMetrics([])
  );

  const copy = React.useMemo(
    () =>
      uiLang === "en"
        ? {
            title: "Sales dashboard",
            subtitle: "Top countries, top products, win rate and cycle from your deal pipeline.",
            weighted: "Weighted pipeline",
            total: "Total deals",
            open: "Open",
            won: "Won",
            lost: "Lost",
            winRate: "Win rate",
            cycle: "Average cycle",
            days: "days",
            topCountries: "Top countries",
            topProducts: "Top products",
            deals: "deals",
            amount: "Amount",
            openPipeline: "Open pipeline",
            openDeals: "Open deals",
            goPipeline: "Open pipeline board",
          }
        : {
            title: "Dashboard ventes",
            subtitle: "Top pays, top produits, taux de gain et cycle depuis le pipeline deals.",
            weighted: "Pipeline pondere",
            total: "Deals totaux",
            open: "Ouverts",
            won: "Gagnes",
            lost: "Perdus",
            winRate: "Taux de gain",
            cycle: "Cycle moyen",
            days: "jours",
            topCountries: "Top pays",
            topProducts: "Top produits",
            deals: "deals",
            amount: "Montant",
            openPipeline: "Pipeline ouvert",
            openDeals: "Deals ouverts",
            goPipeline: "Ouvrir le board pipeline",
          },
    [uiLang]
  );

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await listDeals();
        if (!mounted) return;
        setMetrics(buildDashboardMetrics(response.deals));
        setWarning(response.warning || null);
      } catch (err) {
        if (!mounted) return;
        setError((err as Error)?.message || "Load error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4">
        <Card className="border-blue-100 bg-white/95">
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {warning ? <p className="text-xs text-amber-700">{warning}</p> : null}
            {error ? <p className="text-xs text-rose-700">{error}</p> : null}
            {loading ? <p className="text-sm text-muted-foreground">{uiLang === "en" ? "Loading metrics..." : "Chargement des metriques..."}</p> : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-blue-100 bg-slate-50">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.weighted}</CardDescription>
                  <CardTitle className="text-xl">{money(metrics.weightedPipeline, uiLang)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-blue-100 bg-slate-50">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.total}</CardDescription>
                  <CardTitle className="text-xl">{metrics.totalDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-blue-100 bg-slate-50">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.winRate}</CardDescription>
                  <CardTitle className="text-xl">{metrics.winRate}%</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-blue-100 bg-slate-50">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.cycle}</CardDescription>
                  <CardTitle className="text-xl">
                    {metrics.avgCycleDays} {copy.days}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {copy.openDeals}: {metrics.openDeals}
              </Badge>
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200">
                {copy.won}: {metrics.wonDeals}
              </Badge>
              <Badge className="bg-rose-100 text-rose-900 border-rose-200">
                {copy.lost}: {metrics.lostDeals}
              </Badge>
              <Badge variant="secondary">
                {copy.openPipeline}: {money(metrics.weightedPipeline, uiLang)}
              </Badge>
            </div>

            <Button asChild>
              <Link to="/app/deals">
                {copy.goPipeline}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-blue-100 bg-white/95">
            <CardHeader>
              <CardTitle>{copy.topCountries}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.topCountries}</TableHead>
                    <TableHead>{copy.deals}</TableHead>
                    <TableHead>{copy.amount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.topCountries.map((row) => (
                    <TableRow key={row.country}>
                      <TableCell>{getCountryLabel(row.country, uiLang)}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{money(row.amount, uiLang)}</TableCell>
                    </TableRow>
                  ))}
                  {!metrics.topCountries.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        -
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-white/95">
            <CardHeader>
              <CardTitle>{copy.topProducts}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.topProducts}</TableHead>
                    <TableHead>{copy.deals}</TableHead>
                    <TableHead>{copy.amount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.topProducts.map((row) => (
                    <TableRow key={row.product}>
                      <TableCell>{row.product}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{money(row.amount, uiLang)}</TableCell>
                    </TableRow>
                  ))}
                  {!metrics.topProducts.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        -
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

