import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { FlowsChart } from '@/components/dashboard/FlowsChart';
import { CostsBarChart } from '@/components/dashboard/CostsBarChart';
import { RecentFlowsTable } from '@/components/dashboard/RecentFlowsTable';
import { useFlows } from '@/hooks/useFlows';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle,
  Euro,
} from 'lucide-react';

export default function Dashboard() {
  const { flows, isLoading } = useFlows();

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
      </div>
    </MainLayout>
  );
}
