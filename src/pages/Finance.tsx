import { useState } from 'react';
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
import { mockFlows, incotermRules, deductibilityRules } from '@/data/mockData';
import type { Flow, Payer } from '@/types';
import { 
  Euro, 
  Download, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';

export default function Finance() {
  const [selectedFlow, setSelectedFlow] = useState<string>(mockFlows[0].id);
  
  const flow = mockFlows.find(f => f.id === selectedFlow);
  const incotermRule = flow ? incotermRules.find(r => r.incoterm === flow.incoterm) : null;
  const zoneRules = flow ? deductibilityRules.filter(r => r.zone === flow.zone) : [];

  if (!flow || !incotermRule) return null;

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
                {mockFlows.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.flow_code} - {f.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
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
