import { useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { FlowsChart } from '@/components/dashboard/FlowsChart';
import { CostsBarChart } from '@/components/dashboard/CostsBarChart';
import { RecentFlowsTable } from '@/components/dashboard/RecentFlowsTable';
import { useFlows } from '@/hooks/useFlows';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useImportedInvoices } from '@/hooks/useImportedInvoices';
import { reconcile } from '@/lib/reco/reconcile';
import { evaluateCase } from '@/lib/rules/riskEngine';
import { aggregateCases, margin } from '@/lib/kpi/exportKpis';
import type { CostDoc } from '@/types/costs';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Euro,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { COST_DOCS_KEY } from '@/lib/constants/storage';
import { usePilotageRules } from '@/hooks/usePilotageRules';

export default function Dashboard() {
  const { flows, isLoading } = useFlows();
  const { referenceData } = useReferenceData();
  const { value: importedInvoices } = useImportedInvoices();
  const { value: costDocs } = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);
  const { rules: pilotageRules } = usePilotageRules();

  // Rapprochement factures/coûts importés
  const cases = useMemo(() => {
    const base = reconcile(importedInvoices, costDocs, { rules: pilotageRules });
    return base.map((c) => {
      const risk = evaluateCase(c, referenceData, {
        coverageThreshold: pilotageRules.coverageThreshold,
      });
      return { ...c, alerts: risk.alerts, riskScore: risk.riskScore };
    });
  }, [importedInvoices, costDocs, referenceData, pilotageRules]);

  const aggregates = useMemo(() => aggregateCases(cases), [cases]);
  const matchCounts = useMemo(
    () =>
      cases.reduce(
        (acc, c) => {
          acc[c.matchStatus] += 1;
          return acc;
        },
        { match: 0, partial: 0, none: 0 } as Record<'match' | 'partial' | 'none', number>
      ),
    [cases]
  );

  // Calculate KPIs from local flows
  const totalFlows = flows.length;
  const totalGoodsValue = flows.reduce((sum, f) => sum + f.goods_value, 0);
  const totalCosts = flows.reduce((sum, f) => 
    sum + f.cost_transport + f.cost_customs_clearance + f.cost_duties + 
    f.cost_import_vat + f.cost_octroi_mer + f.cost_octroi_mer_regional + f.cost_other, 0
  );
  const totalOM = flows.reduce((sum, f) => sum + f.cost_octroi_mer + f.cost_octroi_mer_regional, 0);
  const riskyFlows = flows.filter(f => f.risk_level === 'risque').length;

  // Chart data
  const incotermData = [
    { name: 'EXW', value: flows.filter(f => f.incoterm === 'EXW').length, color: 'hsl(217, 91%, 50%)' },
    { name: 'FCA', value: flows.filter(f => f.incoterm === 'FCA').length, color: 'hsl(142, 71%, 45%)' },
    { name: 'DAP', value: flows.filter(f => f.incoterm === 'DAP').length, color: 'hsl(38, 92%, 50%)' },
    { name: 'DDP', value: flows.filter(f => f.incoterm === 'DDP').length, color: 'hsl(280, 67%, 50%)' },
  ].filter(d => d.value > 0);

  const costsByDestination = (() => {
    const agg = new Map<string, { destination: string; transport: number; douane: number; om: number }>();
    flows.forEach((f) => {
      const key = f.destination;
      const prev = agg.get(key) || { destination: key, transport: 0, douane: 0, om: 0 };
      prev.transport += f.cost_transport || 0;
      prev.douane += (f.cost_customs_clearance || 0) + (f.cost_duties || 0);
      prev.om += (f.cost_octroi_mer || 0) + (f.cost_octroi_mer_regional || 0);
      agg.set(key, prev);
    });
    return Array.from(agg.values())
      .sort((a, b) => (b.transport + b.douane + b.om) - (a.transport + a.douane + a.om))
      .slice(0, 6);
  })();

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Direction</h1>
          <p className="mt-1 text-muted-foreground">Vue d'ensemble des flux d'export et indicateurs clés</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Flux actifs"
            value={totalFlows}
            subtitle="Ce mois"
            icon={Package}
            trend={{ value: 12, isPositive: true }}
          />
          <KPICard
            title="Valeur marchandises"
            value={`${(totalGoodsValue / 1000).toFixed(0)}k €`}
            subtitle="Total exporté"
            icon={TrendingUp}
            trend={{ value: 8, isPositive: true }}
          />
          <KPICard
            title="Total charges"
            value={`${(totalCosts / 1000).toFixed(1)}k €`}
            subtitle={`dont ${(totalOM / 1000).toFixed(1)}k € OM/OMR`}
            icon={Euro}
          />
          <KPICard
            title="Flux à risque"
            value={riskyFlows}
            subtitle="Nécessite attention"
            icon={AlertTriangle}
            className={riskyFlows > 0 ? 'border-status-risk/30' : ''}
          />
          <KPICard
            title="Factures rapprochées"
            value={matchCounts.match}
            subtitle={`${cases.length} importées`}
            icon={FileCheck}
            trend={{ value: matchCounts.partial, isPositive: false }}
          />
          <KPICard
            title="Alertes factures"
            value={cases.flatMap((c) => c.alerts || []).length}
            subtitle={`${aggregates.topLosses.length} dossiers sensibles`}
            icon={ShieldAlert}
            className={cases.length ? '' : 'opacity-50'}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FlowsChart 
            data={incotermData} 
            title="Répartition par Incoterm" 
          />
          <CostsBarChart 
            data={costsByDestination} 
            title="Coûts par destination" 
          />
        </div>

        {/* Recent Flows Table */}
        <RecentFlowsTable flows={flows.slice(0, 5)} />

        {/* Synthèse factures importées */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-2">Top dossiers en perte</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Calcul basé sur les factures importées et les coûts rapprochés (transit/douane).
            </p>
            {aggregates.topLosses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Importez des factures et coûts pour activer cette section.</p>
            ) : (
              <div className="space-y-3">
                {aggregates.topLosses.slice(0, 5).map((c) => {
                  const m = margin(c);
                  return (
                    <div key={c.id} className="p-3 rounded-lg border flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{c.invoice.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.invoice.clientName} • {c.invoice.destination || 'Destination inconnue'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-destructive font-semibold">
                          {m.amount.toLocaleString('fr-FR')} ({m.rate.toFixed(1)}%)
                        </p>
                        <p className="text-xs text-muted-foreground">Incoterm {c.invoice.incoterm || 'NC'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-2">Couverture transit</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Vue rapide sur la cohérence transit/douane vs facturation.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/60">
                <p className="text-xs text-muted-foreground">Couverture moyenne</p>
                <p className="text-xl font-bold">
                  {cases.length ? `${Math.round(aggregates.coverageAverage * 100)}%` : 'n/a'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/60">
                <p className="text-xs text-muted-foreground">Montant non couvert</p>
                <p className="text-xl font-bold">
                  {cases.length ? `${Math.round(aggregates.uncoveredTotal).toLocaleString('fr-FR')} €` : 'n/a'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Source: données importées (onglet Imports CSV). Ajoutez un champ facture/transit pour améliorer le match.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
