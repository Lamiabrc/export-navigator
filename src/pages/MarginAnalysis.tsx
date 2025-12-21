import { useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { SageInvoice } from '@/types/sage';
import type { CostDoc } from '@/types/costs';
import { COST_DOCS_KEY, SAGE_INVOICES_KEY } from '@/lib/constants/storage';
import { reconcile } from '@/lib/reco/reconcile';
import { aggregateCases, margin, transitCoverage } from '@/lib/kpi/exportKpis';

export default function MarginAnalysis() {
  const [sageInvoices] = useLocalStorage<SageInvoice[]>(SAGE_INVOICES_KEY, []);
  const [costDocs] = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);

  const cases = useMemo(() => reconcile(sageInvoices, costDocs), [sageInvoices, costDocs]);
  const aggregates = useMemo(() => aggregateCases(cases), [cases]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analyse Marges & Couverture Transit</h1>
          <p className="text-muted-foreground">
            KPIs issus du rapprochement factures/coûts : couverture transit, marge et pertes
          </p>
        </div>

        {cases.length === 0 && (
          <Card>
            <CardContent className="py-6 text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Importez des données dans l’onglet Imports CSV pour activer l’analyse.
            </CardContent>
          </Card>
        )}

        {cases.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Couverture transit moyenne</p>
                  <p className="text-3xl font-bold">
                    {Math.round(aggregates.coverageAverage * 100)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Montant non couvert</p>
                  <p className="text-3xl font-bold text-amber-600">
                    {aggregates.uncoveredTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Dossiers analysés</p>
                  <p className="text-3xl font-bold">{cases.length}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top 20 dossiers en perte</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Incoterm</TableHead>
                      <TableHead className="text-right">Marge (€/%)</TableHead>
                      <TableHead>Couverture transit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregates.topLosses.map((c) => {
                      const m = margin(c);
                      const cov = transitCoverage(c);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.invoice.invoiceNumber}</TableCell>
                          <TableCell>{c.invoice.clientName}</TableCell>
                          <TableCell>{c.invoice.incoterm || 'NC'}</TableCell>
                          <TableCell className="text-right text-destructive">
                            {m.amount.toLocaleString('fr-FR')} ({m.rate.toFixed(1)}%)
                          </TableCell>
                          <TableCell>
                            {cov.transitCosts > 0 ? (
                              `${Math.round(cov.coverage * 100)}%`
                            ) : (
                              <span className="text-muted-foreground text-xs">n/a</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Marge par destination</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byDestination).map(([dest, data]) => (
                    <div key={dest} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{dest}</Badge>
                        <span className="text-xs text-muted-foreground">{data.count} dossiers</span>
                      </div>
                      <span className={data.margin < 0 ? 'text-destructive' : ''}>
                        {data.margin.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge par client</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byClient).map(([client, data]) => (
                    <div key={client} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{client}</Badge>
                        <span className="text-xs text-muted-foreground">{data.count} dossiers</span>
                      </div>
                      <span className={data.margin < 0 ? 'text-destructive' : ''}>
                        {data.margin.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge par incoterm</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byIncoterm).map(([incoterm, data]) => (
                    <div key={incoterm} className="flex items-center justify-between">
                      <Badge variant="outline">{incoterm}</Badge>
                      <span className={data.margin < 0 ? 'text-destructive' : ''}>
                        {data.margin.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge par transitaire</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byForwarder).map(([forwarder, data]) => (
                    <div key={forwarder} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {data.margin < 0 ? (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-primary" />
                        )}
                        <Badge variant="outline">{forwarder}</Badge>
                        <span className="text-xs text-muted-foreground">{data.count} dossiers</span>
                      </div>
                      <span className={data.margin < 0 ? 'text-destructive' : ''}>
                        {data.margin.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
