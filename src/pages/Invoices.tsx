import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, ExternalLink, Shield, ShieldAlert } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { reconcile } from '@/lib/reco/reconcile';
import { evaluateCase } from '@/lib/rules/riskEngine';
import { aggregateCases, margin, transitCoverage } from '@/lib/kpi/exportKpis';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { SageInvoice } from '@/types/sage';
import type { CostDoc } from '@/types/costs';
import type { ExportCase } from '@/types/case';
import { COST_DOCS_KEY, SAGE_INVOICES_KEY } from '@/lib/constants/storage';

const statusBadge = (status: ExportCase['matchStatus']) => {
  switch (status) {
    case 'match':
      return <Badge className="bg-green-100 text-green-700 border-green-200">Match OK</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partiel</Badge>;
    default:
      return <Badge variant="outline">Aucun</Badge>;
  }
};

const alertBadge = (alertsCount: number, hasBlocker: boolean) => {
  if (alertsCount === 0) return <Badge variant="outline">Aucune alerte</Badge>;
  if (hasBlocker)
    return <Badge className="bg-red-100 text-red-700 border-red-200">{alertsCount} alerte(s)</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{alertsCount} alerte(s)</Badge>;
};

export default function Invoices() {
  const [sageInvoices] = useLocalStorage<SageInvoice[]>(SAGE_INVOICES_KEY, []);
  const [costDocs] = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);
  const { referenceData } = useReferenceData();

  const cases = useMemo(() => {
    const base = reconcile(sageInvoices, costDocs);
    return base.map((c) => {
      const risk = evaluateCase(c, referenceData);
      return { ...c, alerts: risk.alerts, riskScore: risk.riskScore };
    });
  }, [sageInvoices, costDocs, referenceData]);

  const aggregates = useMemo(() => aggregateCases(cases), [cases]);
  const matchCounts = useMemo(
    () =>
      cases.reduce(
        (acc, c) => {
          acc[c.matchStatus] += 1;
          return acc;
        },
        { match: 0, partial: 0, none: 0 } as Record<ExportCase['matchStatus'], number>
      ),
    [cases]
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contrôle & Rapprochement factures</h1>
            <p className="text-muted-foreground">
              Factures Sage ↔ coûts réels (transit/douane) avec score de match et alertes
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/imports">
              <Button variant="outline">Aller aux imports CSV</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Factures importées</p>
              <p className="text-2xl font-bold">{sageInvoices.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Match complet</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {matchCounts.match}
                <CheckCircle className="h-5 w-5 text-green-600" />
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Partiel</p>
              <p className="text-2xl font-bold text-amber-600">{matchCounts.partial}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Sans match</p>
              <p className="text-2xl font-bold text-muted-foreground">{matchCounts.none}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rapprochements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Client / Destination</TableHead>
                    <TableHead className="text-right">HT</TableHead>
                    <TableHead>Rapprochement</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Couverture transit</TableHead>
                    <TableHead>Alertes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Importez des fichiers dans l’onglet Imports CSV pour lancer le rapprochement.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cases.map((c) => {
                      const coverage = transitCoverage(c);
                      const hasBlocker = (c.alerts || []).some((a) => a.severity === 'blocker');
                      const flowId = c.invoice.flowCode || c.costDocs[0]?.flowCode;
                      return (
                        <TableRow key={c.id} className="hover:bg-muted/40">
                          <TableCell className="font-medium">{c.invoice.invoiceNumber}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{c.invoice.clientName}</span>
                              <span className="text-xs text-muted-foreground">{c.invoice.destination || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.invoice.totalHT?.toLocaleString('fr-FR') || '-'}
                          </TableCell>
                          <TableCell>{statusBadge(c.matchStatus)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{Math.round(c.matchScore)}%</Badge>
                          </TableCell>
                          <TableCell>
                            {coverage.transitCosts > 0 ? (
                              <span className="text-sm">
                                {Math.round(coverage.coverage * 100)}%{' '}
                                <span className="text-muted-foreground">
                                  ({coverage.uncovered.toLocaleString('fr-FR')} non couvert)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">n/a</span>
                            )}
                          </TableCell>
                          <TableCell>{alertBadge(c.alerts?.length || 0, hasBlocker)}</TableCell>
                          <TableCell className="text-right">
                            {flowId ? (
                              <Link to={`/flows/${flowId}`}>
                                <Button variant="ghost" size="sm" className="gap-1">
                                  <ExternalLink className="h-4 w-4" />
                                  Voir dossier
                                </Button>
                              </Link>
                            ) : (
                              <Button variant="ghost" size="sm" disabled>
                                <Shield className="h-4 w-4 mr-1" />
                                Associer flux
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {aggregates.topLosses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top dossiers en perte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {aggregates.topLosses.map((c) => {
                  const m = margin(c);
                  return (
                    <div key={c.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{c.invoice.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{c.invoice.clientName}</p>
                        </div>
                        <Badge variant="outline">Incoterm {c.invoice.incoterm || 'NC'}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-destructive">
                        Perte: {m.amount.toLocaleString('fr-FR')} ({m.rate.toFixed(1)}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {cases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alertes globales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {cases.flatMap((c) => c.alerts || []).length === 0 ? (
                  <Badge variant="outline">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aucune alerte
                  </Badge>
                ) : (
                  cases.flatMap((c) => c.alerts || []).map((alert) => (
                    <Badge
                      key={`${alert.code}-${alert.id}`}
                      className={`flex items-center gap-1 ${
                        alert.severity === 'blocker'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : alert.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}
                    >
                      {alert.severity === 'blocker' ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      {alert.code}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
