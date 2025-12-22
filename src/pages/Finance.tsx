import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { incotermRules, deductibilityRules } from '@/data/mockData';
import { useFlows } from '@/hooks/useFlows';
import type { Flow, Payer } from '@/types';
import { 
  Euro, 
  Download, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  XCircle,
  HelpCircle,
  FilePlus,
  FolderOpen,
  Import,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { COST_DOCS_KEY, FLOWS_KEY, SAGE_INVOICES_KEY } from '@/lib/constants/storage';
import { toast } from 'sonner';

export default function Finance() {
  const { flows, isLoading } = useFlows();
  const [selectedFlow, setSelectedFlow] = useState<string>('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [diagnostic, setDiagnostic] = useState({
    flowCount: 0,
    invoiceCount: 0,
    costDocCount: 0,
  });

  useEffect(() => {
    const paramFlow = searchParams.get('flow');
    if (flows.length === 0) return;
    if (paramFlow) {
      const byId = flows.find((f) => f.id === paramFlow);
      const byCode = flows.find((f) => f.flow_code === paramFlow);
      const target = byId || byCode;
      if (target) {
        setSelectedFlow(target.id);
        return;
      }
    }
    if (!selectedFlow) setSelectedFlow(flows[0].id);
  }, [flows, selectedFlow, searchParams]);

  useEffect(() => {
    const readCount = (key: string) => {
      const stored = localStorage.getItem(key);
      if (!stored) return 0;
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.length;
        if (parsed && typeof parsed === 'object') return Object.keys(parsed).length;
        return 0;
      } catch {
        return 0;
      }
    };

    setDiagnostic({
      flowCount: flows.length,
      invoiceCount: readCount(SAGE_INVOICES_KEY),
      costDocCount: readCount(COST_DOCS_KEY),
    });
  }, [flows]);

  const addDemoFlow = () => {
    if (flows.some((f) => f.flow_code === 'DEMO-001')) {
      const existing = flows.find((f) => f.flow_code === 'DEMO-001');
      if (existing) setSelectedFlow(existing.id);
      toast.success('Flux démo déjà présent, sélectionné.');
      return;
    }
    const now = new Date();
    const departure = now.toISOString().slice(0, 10);
    const delivery = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const demo: Omit<Flow, 'id'> = {
      flow_code: 'DEMO-001',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      created_by: 'demo-user',
      client_name: 'Démo Pharma',
      destination: 'Guadeloupe',
      zone: 'DROM',
      incoterm: 'DDP',
      incoterm_place: 'Pointe-à-Pitre',
      transport_mode: 'Maritime',
      weight: 120,
      product_type: 'standard',
      margin: 0,
      departure_date: departure,
      delivery_date: delivery,
      goods_value: 125000,
      cost_transport: 3200,
      cost_customs_clearance: 280,
      cost_duties: 2500,
      cost_import_vat: 0,
      cost_octroi_mer: 6200,
      cost_octroi_mer_regional: 3000,
      cost_other: 450,
      status_order: 'en_cours',
      status_incoterm_validated: 'en_cours',
      status_export: 'en_cours',
      status_transport: 'en_cours',
      status_customs: 'non_demarre',
      status_invoicing: 'non_demarre',
      chk_invoice: 'a_faire',
      chk_packing_list: 'a_faire',
      chk_transport_doc: 'a_faire',
      chk_certificate_origin: 'na',
      chk_insurance: 'a_faire',
      comment: 'Flux démo local DDP DROM',
      risk_level: 'a_surveiller',
    } as Flow;
    // reuse useFlows addFlow via localStorage API directly to avoid hook exports
    const stored = localStorage.getItem(FLOWS_KEY);
    const arr: Flow[] = stored ? JSON.parse(stored) : [];
    const withId = { ...demo, id: crypto.randomUUID() } as Flow;
    localStorage.setItem(FLOWS_KEY, JSON.stringify([...arr, withId]));
    window.location.href = `/finance?flow=${withId.id}`;
  };

  const flow = useMemo(() => flows.find((f) => f.id === selectedFlow), [flows, selectedFlow]);
  const incotermRule = flow ? incotermRules.find(r => r.incoterm === flow.incoterm) : null;
  const zoneRules = flow ? deductibilityRules.filter(r => r.zone === flow.zone) : [];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  if (!flow || !incotermRule) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Charges & Finance</h1>
              <p className="text-muted-foreground">
                Ajoutez un premier flux ou un jeu de données démo pour activer l&apos;analyse financière.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/flows')} className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Voir les flux
              </Button>
              <Button onClick={addDemoFlow} className="gap-2">
                <FilePlus className="h-4 w-4" />
                Créer un flux démo
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Checklist express</CardTitle>
                <p className="text-sm text-muted-foreground">
                  3 étapes pour rendre les indicateurs exploitables sans connecter d&apos;autres systèmes.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FilePlus className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Créer ou importer un flux</h3>
                      <Button size="sm" variant="secondary" onClick={() => navigate('/flows')}>
                        Ouvrir Flux & Marges
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Saisissez au moins un flux (DDP/DAP/FOB) pour activer l&apos;analyse des charges.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-2/10 text-chart-2">
                    <Import className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Ajouter vos factures ou coûts</h3>
                      <Button size="sm" variant="secondary" onClick={() => navigate('/invoices')}>
                        Aller aux factures
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Glissez vos CSV SAGE ou complétez les montants manuellement pour chaque flux.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-3/10 text-chart-3">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Lancer l&apos;analyse</h3>
                      <Button size="sm" variant="secondary" onClick={() => navigate('/finance')}>
                        Actualiser
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Revenez ici pour visualiser les payeurs par charge, la déductibilité et exporter le CSV.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Diagnostic local</CardTitle>
                <p className="text-sm text-muted-foreground">Aperçu des données chargées dans ce navigateur.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Flux disponibles</p>
                  <p className="text-2xl font-bold">{diagnostic.flowCount}</p>
                  <p className="text-xs text-muted-foreground">Stockés via Flux & Marges ou le flux démo.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Factures SAGE</p>
                  <p className="text-2xl font-bold">{diagnostic.invoiceCount}</p>
                  <p className="text-xs text-muted-foreground">CSV importés ou saisis dans Charges & Finance.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Justificatifs coûts</p>
                  <p className="text-2xl font-bold">{diagnostic.costDocCount}</p>
                  <p className="text-xs text-muted-foreground">Pièces jointes ou preuves d&apos;achats enregistrées.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  const calculateCosts = () => {
    const costs = [
      { 
        type: 'Transport', 
        amount: flow.cost_transport, 
        payer: incotermRule.payer_transport,
        deductibility: zoneRules.find(r => r.charge_type === 'Transport'),
      },
      { 
        type: 'Dédouanement', 
        amount: flow.cost_customs_clearance, 
        payer: incotermRule.payer_customs_import,
        deductibility: zoneRules.find(r => r.charge_type === 'Dédouanement'),
      },
      { 
        type: 'Droits de douane', 
        amount: flow.cost_duties, 
        payer: incotermRule.payer_duties,
        deductibility: zoneRules.find(r => r.charge_type === 'Droits'),
      },
      { 
        type: 'TVA import', 
        amount: flow.cost_import_vat, 
        payer: incotermRule.payer_import_vat,
        deductibility: zoneRules.find(r => r.charge_type === 'TVA import'),
      },
      { 
        type: 'Octroi de mer', 
        amount: flow.cost_octroi_mer, 
        payer: incotermRule.payer_octroi_mer,
        deductibility: zoneRules.find(r => r.charge_type === 'OM'),
      },
      { 
        type: 'OMR', 
        amount: flow.cost_octroi_mer_regional, 
        payer: incotermRule.payer_octroi_mer,
        deductibility: zoneRules.find(r => r.charge_type === 'OMR'),
      },
      { 
        type: 'Autres frais', 
        amount: flow.cost_other, 
        payer: 'Fournisseur' as Payer,
        deductibility: null,
      },
    ];

    const supplierCosts = costs.filter(c => c.payer === 'Fournisseur').reduce((sum, c) => sum + c.amount, 0);
    const clientCosts = costs.filter(c => c.payer === 'Client').reduce((sum, c) => sum + c.amount, 0);

    return { costs, supplierCosts, clientCosts };
  };

  const { costs, supplierCosts, clientCosts } = calculateCosts();
  const totalCosts = supplierCosts + clientCosts;

  const exportCsv = () => {
    const header = ['FlowCode','Client','Destination','Zone','Incoterm','Charge','Montant','Payeur','Déductible fournisseur','Déductible client'].join(';');
    const rows = costs.map((c) => [
      flow.flow_code,
      flow.client_name,
      flow.destination,
      flow.zone,
      flow.incoterm,
      c.type,
      c.amount.toFixed(2),
      c.payer,
      c.deductibility?.deductible_supplier ?? '',
      c.deductibility?.deductible_client ?? '',
    ].join(';'));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `charges_${flow.flow_code}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const DeductibilityBadge = ({ status }: { status: 'Oui' | 'Non' | 'A valider' | undefined }) => {
    if (!status) return <span className="text-muted-foreground">-</span>;
    
    switch (status) {
      case 'Oui':
        return (
          <span className="inline-flex items-center gap-1 text-status-ok text-sm">
            <CheckCircle className="h-4 w-4" />
            Déductible
          </span>
        );
      case 'Non':
        return (
          <span className="inline-flex items-center gap-1 text-status-risk text-sm">
            <XCircle className="h-4 w-4" />
            Non déductible
          </span>
        );
      case 'A valider':
        return (
          <span className="inline-flex items-center gap-1 text-status-warning text-sm">
            <HelpCircle className="h-4 w-4" />
            À valider
          </span>
        );
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Charges & Finance</h1>
            <p className="mt-1 text-muted-foreground">Analyse des coûts et déductibilité par flux</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedFlow} onValueChange={setSelectedFlow}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {flows.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.flow_code} - {f.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Exporter
            </Button>
          </div>
        </div>

        {/* Flow Summary */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-foreground">{flow.flow_code}</h2>
                <StatusBadge status={flow.zone} type="zone" />
                <span className="font-medium text-primary">{flow.incoterm}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {flow.client_name} → {flow.destination}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Valeur marchandises</p>
              <p className="text-2xl font-bold text-foreground">
                {flow.goods_value.toLocaleString('fr-FR')} €
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                <Euro className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total charges</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalCosts.toLocaleString('fr-FR')} €
                </p>
              </div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                <TrendingDown className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Charges fournisseur</p>
                <p className="text-2xl font-bold text-foreground">
                  {supplierCosts.toLocaleString('fr-FR')} €
                </p>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                <TrendingUp className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Charges client</p>
                <p className="text-2xl font-bold text-foreground">
                  {clientCosts.toLocaleString('fr-FR')} €
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Costs Detail Table */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Détail des charges</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Répartition selon l'Incoterm {flow.incoterm} et règles de déductibilité zone {flow.zone}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type de charge</th>
                  <th className="text-right">Montant</th>
                  <th>Payeur</th>
                  <th>Déductibilité fournisseur</th>
                  <th>Déductibilité client</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((cost, index) => (
                  <tr key={index} className={cost.amount === 0 ? 'opacity-50' : ''}>
                    <td className="font-medium">{cost.type}</td>
                    <td className="text-right font-medium">
                      {cost.amount.toLocaleString('fr-FR')} €
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cost.payer === 'Fournisseur' 
                          ? 'bg-chart-2/10 text-chart-2' 
                          : 'bg-chart-3/10 text-chart-3'
                      }`}>
                        {cost.payer}
                      </span>
                    </td>
                    <td>
                      <DeductibilityBadge status={cost.deductibility?.deductible_supplier} />
                    </td>
                    <td>
                      <DeductibilityBadge status={cost.deductibility?.deductible_client} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-medium">
                  <td>Total</td>
                  <td className="text-right">{totalCosts.toLocaleString('fr-FR')} €</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Incoterm Rule Info */}
        <div className="bg-muted/50 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-3">
            Règle Incoterm : {flow.incoterm}
          </h3>
          <p className="text-muted-foreground">{incotermRule.notes}</p>
        </div>
      </div>
    </MainLayout>
  );
}
