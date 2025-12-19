<<<<<<< Updated upstream
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
=======
import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Filter, Plus } from 'lucide-react';
import { useFlows } from '@/hooks/useFlows';
import { useInvoices } from '@/hooks/useInvoices';
import type { Invoice, InvoiceType } from '@/types';

export default function Invoices() {
  const { flows } = useFlows();
  const { invoices, addInvoice, deleteInvoice } = useInvoices();
  const [filter, setFilter] = useState<InvoiceType | 'all'>('all');
  const [selectedFlow, setSelectedFlow] = useState<string>('all');
  const [form, setForm] = useState<Omit<Invoice, 'id'>>({
    flow_id: 'none',
    type: 'transport',
    label: '',
    amount_ht: 0,
    currency: 'EUR',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    file_url: '',
    notes: '',
  });

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        const typeOk = filter === 'all' || inv.type === filter;
        const flowOk = selectedFlow === 'all' || inv.flow_id === selectedFlow;
        return typeOk && flowOk;
      }),
    [filter, invoices, selectedFlow]
  );

  const totalByType = (type: InvoiceType) =>
    filteredInvoices
      .filter((i) => i.type === type)
      .reduce((sum, i) => sum + i.amount_ht, 0);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Factures et rapprochements</p>
          <h1 className="text-2xl font-bold text-foreground">Factures (transport, douane, client)</h1>
>>>>>>> Stashed changes
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedFlow} onValueChange={setSelectedFlow}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrer par flux" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les flux</SelectItem>
              {flows.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.flow_code} - {f.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as InvoiceType | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type de facture" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="client">Client (recette)</SelectItem>
              <SelectItem value="transport">Transport</SelectItem>
              <SelectItem value="douane">Douane/Taxes</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtrer
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

<<<<<<< Updated upstream
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
                          <TableCell>
                            {alertBadge(c.alerts?.length || 0, hasBlocker)}
                          </TableCell>
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
=======
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total recettes (client)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalByType('client').toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-muted-foreground">Somme des factures client filtrées</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Frais transport</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalByType('transport').toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-muted-foreground">Somme transport filtrée</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Douane/Taxes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalByType('douane').toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-muted-foreground">Droits, OM/OMR, TVA import facturés</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {filteredInvoices.map((inv) => {
          const flow = flows.find((f) => f.id === inv.flow_id);
          return (
            <Card key={inv.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {flow?.flow_code || 'Hors flux'}
                </CardTitle>
                <Badge variant="secondary">{inv.type}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {inv.amount_ht.toLocaleString('fr-FR', { style: 'currency', currency: inv.currency })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {flow?.client_name || inv.vendor || '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{inv.vendor}</p>
                    <p className="text-xs text-muted-foreground">{inv.date}</p>
                    <Button size="sm" variant="ghost" onClick={() => deleteInvoice(inv.id)}>
                      Supprimer
                    </Button>
                  </div>
                </div>
                {inv.notes && <p className="text-xs text-muted-foreground mt-2">{inv.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ajouter une facture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Flux (optionnel)</Label>
                <Select value={form.flow_id} onValueChange={(v) => setForm({ ...form, flow_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Hors flux" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Hors flux</SelectItem>
                    {flows.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.flow_code} - {f.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as InvoiceType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client (recette)</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="douane">Douane/Taxes</SelectItem>
                    <SelectItem value="autre">Autres frais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
>>>>>>> Stashed changes
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant HT</Label>
                <Input
                  type="number"
                  value={form.amount_ht}
                  onChange={(e) => setForm({ ...form, amount_ht: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as 'EUR' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fournisseur / Client</Label>
                <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Intitulé</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (!form.label || !form.amount_ht) {
                  return;
                }
                addInvoice({
                  ...form,
                  flow_id: form.flow_id === 'none' ? undefined : form.flow_id,
                });
                setForm({
                  flow_id: 'none',
                  type: 'transport',
                  label: '',
                  amount_ht: 0,
                  currency: 'EUR',
                  date: new Date().toISOString().split('T')[0],
                  vendor: '',
                  file_url: '',
                  notes: '',
                });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter la facture
            </Button>
          </CardContent>
        </Card>

<<<<<<< Updated upstream
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
=======
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle>Conseils de contrôle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Comparer transport réel vs estimation (poids/incoterm/mode).</p>
            <p>En DROM, OM/OMR selon code produit : Orthopédie (9021) exonéré.</p>
            <p>UE/Belgique : autoliquidation, pas de TVA facturée si n° TVA client.</p>
            <p>Suisse : EUR.1 pour franchise droits, TVA 8.1% non récupérable fournisseur.</p>
          </CardContent>
        </Card>
>>>>>>> Stashed changes
      </div>
    </MainLayout>
  );
}
