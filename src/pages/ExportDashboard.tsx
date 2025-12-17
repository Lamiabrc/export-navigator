import { useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFlows } from '@/hooks/useFlows';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Package, 
  Euro, 
  TrendingUp, 
  Download, 
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';

export default function ExportDashboard() {
  const { flows, isLoading } = useFlows();

  const stats = useMemo(() => {
    if (!flows.length) return null;

    const totalGoodsValue = flows.reduce((s, f) => s + f.goods_value, 0);
    const totalCosts = flows.reduce((s, f) => 
      s + f.cost_transport + f.cost_customs_clearance + f.cost_duties + 
      f.cost_import_vat + f.cost_octroi_mer + f.cost_octroi_mer_regional + f.cost_other, 0
    );
    const totalOM = flows.reduce((s, f) => s + f.cost_octroi_mer + f.cost_octroi_mer_regional, 0);

    const flowsByStatus = {
      termine: flows.filter(f => 
        f.status_order === 'termine' && 
        f.status_transport === 'termine' && 
        f.status_invoicing === 'termine'
      ).length,
      en_cours: flows.filter(f => 
        f.status_order === 'en_cours' || 
        f.status_transport === 'en_cours' ||
        f.status_export === 'en_cours'
      ).length,
      risque: flows.filter(f => f.risk_level === 'risque').length,
    };

    const flowsByDestination = flows.reduce((acc, f) => {
      acc[f.destination] = (acc[f.destination] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const valueByDestination = flows.reduce((acc, f) => {
      acc[f.destination] = (acc[f.destination] || 0) + f.goods_value;
      return acc;
    }, {} as Record<string, number>);

    const costsByDestination = flows.reduce((acc, f) => {
      const totalCost = f.cost_transport + f.cost_customs_clearance + f.cost_duties + 
                        f.cost_octroi_mer + f.cost_octroi_mer_regional + f.cost_other;
      acc[f.destination] = (acc[f.destination] || 0) + totalCost;
      return acc;
    }, {} as Record<string, number>);

    const flowsByIncoterm = flows.reduce((acc, f) => {
      acc[f.incoterm] = (acc[f.incoterm] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const flowsByZone = flows.reduce((acc, f) => {
      acc[f.zone] = (acc[f.zone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageMargin = totalGoodsValue > 0 
      ? ((totalGoodsValue - totalCosts) / totalGoodsValue * 100)
      : 0;

    return {
      totalFlows: flows.length,
      totalGoodsValue,
      totalCosts,
      totalOM,
      flowsByStatus,
      flowsByDestination,
      valueByDestination,
      costsByDestination,
      flowsByIncoterm,
      flowsByZone,
      averageMargin,
    };
  }, [flows]);

  const exportData = (format: 'csv' | 'json') => {
    if (!flows.length) return;

    if (format === 'csv') {
      const headers = [
        'Code', 'Client', 'Destination', 'Zone', 'Incoterm', 'Transport',
        'Valeur', 'Fret', 'Dédouanement', 'Droits', 'TVA Import', 'OM', 'OMR', 'Autres',
        'Statut'
      ];
      const rows = flows.map(f => [
        f.flow_code, f.client_name, f.destination, f.zone, f.incoterm, f.transport_mode,
        f.goods_value, f.cost_transport, f.cost_customs_clearance, f.cost_duties,
        f.cost_import_vat, f.cost_octroi_mer, f.cost_octroi_mer_regional, f.cost_other,
        f.risk_level
      ]);
      
      const csvContent = [headers, ...rows].map(r => r.join(';')).join('\n');
      downloadFile(csvContent, `export_flows_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    } else {
      const jsonContent = JSON.stringify(flows, null, 2);
      downloadFile(jsonContent, `export_flows_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const COLORS = [
    'hsl(220, 80%, 28%)',   // primary
    'hsl(25, 95%, 53%)',    // accent
    'hsl(142, 71%, 45%)',   // success
    'hsl(280, 67%, 50%)',   // purple
    'hsl(0, 84%, 60%)',     // danger
  ];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  if (!stats) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Aucune donnée disponible</p>
        </div>
      </MainLayout>
    );
  }

  const destinationChartData = Object.entries(stats.flowsByDestination).map(([name, value]) => ({
    name, value
  }));

  const incotermChartData = Object.entries(stats.flowsByIncoterm).map(([name, value]) => ({
    name, value
  }));

  const valueByDestChartData = Object.entries(stats.valueByDestination).map(([destination, value]) => ({
    destination,
    value,
    costs: stats.costsByDestination[destination] || 0,
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Tableau de bord Export
            </h1>
            <p className="mt-1 text-muted-foreground">
              Vue d'ensemble de l'activité export et indicateurs clés
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportData('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => exportData('json')}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total flux"
            value={stats.totalFlows}
            subtitle="Flux enregistrés"
            icon={Package}
          />
          <KPICard
            title="CA Export"
            value={formatCurrency(stats.totalGoodsValue)}
            subtitle="Valeur marchandises"
            icon={Euro}
            trend={{ value: 12, isPositive: true }}
          />
          <KPICard
            title="Total charges"
            value={formatCurrency(stats.totalCosts)}
            subtitle={`dont ${formatCurrency(stats.totalOM)} OM/OMR`}
            icon={TrendingUp}
          />
          <KPICard
            title="Marge moyenne"
            value={`${stats.averageMargin.toFixed(1)}%`}
            subtitle="Sur valeur marchandise"
            icon={TrendingUp}
            trend={{ value: stats.averageMargin > 15 ? 5 : -2, isPositive: stats.averageMargin > 15 }}
          />
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[hsl(var(--status-ok))]/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(var(--status-ok))]/10">
                <CheckCircle className="h-6 w-6 text-[hsl(var(--status-ok))]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.flowsByStatus.termine}</p>
                <p className="text-sm text-muted-foreground">Flux terminés</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[hsl(var(--status-warning))]/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(var(--status-warning))]/10">
                <Clock className="h-6 w-6 text-[hsl(var(--status-warning))]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.flowsByStatus.en_cours}</p>
                <p className="text-sm text-muted-foreground">Flux en cours</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[hsl(var(--status-risk))]/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(var(--status-risk))]/10">
                <AlertTriangle className="h-6 w-6 text-[hsl(var(--status-risk))]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.flowsByStatus.risque}</p>
                <p className="text-sm text-muted-foreground">Flux à risque</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Destinations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Répartition par destination
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={destinationChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {destinationChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart - Incoterms */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Répartition par Incoterm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incotermChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {incotermChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart - Value by Destination */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Valeur et coûts par destination</CardTitle>
              <CardDescription>Comparaison valeur marchandise vs charges totales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueByDestChartData} layout="vertical">
                    <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                    <YAxis type="category" dataKey="destination" width={100} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Bar dataKey="value" name="Valeur marchandise" fill="hsl(220, 80%, 28%)" />
                    <Bar dataKey="costs" name="Charges totales" fill="hsl(25, 95%, 53%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zone Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition par zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.flowsByZone).map(([zone, count]) => (
                <div key={zone} className="flex items-center gap-3 p-4 rounded-lg border">
                  <Badge 
                    variant="outline"
                    className={
                      zone === 'UE' ? 'badge-ue' : 
                      zone === 'DROM' ? 'badge-drom' : 
                      'badge-hors-ue'
                    }
                  >
                    {zone}
                  </Badge>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">flux</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
