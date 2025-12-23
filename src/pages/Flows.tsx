import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportCircuits } from '@/data/exportCircuits';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Ship, Truck, FileText, Euro, Map, HelpCircle } from 'lucide-react';
import { ExportMindMap } from '@/components/flows/ExportMindMap';
import { computeCircuitSummary } from '@/lib/stats/computeCircuitSummary';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useImportedInvoices } from '@/hooks/useImportedInvoices';
import type { CostDoc } from '@/types/costs';
import { COST_DOCS_KEY } from '@/lib/constants/storage';
import { zoneLabel } from '@/types/circuits';

const zoneColors: Record<string, string> = {
  UE: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  HORS_UE: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  DROM: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  MULTI: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const circuitIcons: Record<string, ReactNode> = {
  fca_client_place: <Truck className="h-8 w-8" />,
  ddp_direct: <Globe className="h-8 w-8" />,
  platform_drom: <Ship className="h-8 w-8" />,
  ue_intra: <Euro className="h-8 w-8" />,
  suisse: <FileText className="h-8 w-8" />,
  hors_ue: <Globe className="h-8 w-8" />,
};

export default function Flows() {
  const { value: importedInvoices } = useImportedInvoices();
  const { value: costDocs } = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);
  const { referenceData } = useReferenceData();

  const summaries = useMemo(
    () => computeCircuitSummary(exportCircuits, importedInvoices, costDocs, referenceData),
    [importedInvoices, costDocs, referenceData]
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Circuits Export</h1>
          <p className="mt-1 text-muted-foreground">
            Vue cartographique des flux d'export depuis la France avec les 3 couches de coûts (transport, douane/DDP, TVA)
          </p>
        </div>

        <Tabs defaultValue="mindmap" className="space-y-6">
          <TabsList>
            <TabsTrigger value="mindmap" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              Carte des flux (couches)
            </TabsTrigger>
            <TabsTrigger value="circuits" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Circuits détaillés
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mindmap">
            <ExportMindMap />
          </TabsContent>

          <TabsContent value="circuits">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exportCircuits.map((circuit) => {
                const summary = summaries[circuit.id];
                const coverageBadge = summary?.avgTransitCoverage ?? '—';
                const warnsBadge = summary?.riskWarnsCount ?? '—';
                const blockersBadge = summary?.riskBlockersCount ?? '—';
                const casesCount = summary?.casesCount ?? '—';
                const displayIncoterm = circuit.defaultIncoterm ?? circuit.incoterms[0];

                return (
                  <Link key={circuit.id} to={`/flows/${circuit.id}`}>
                    <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {circuitIcons[circuit.id] ?? <HelpCircle className="h-8 w-8" />}
                          </div>
                          <Badge variant="outline" className={zoneColors[circuit.zone] ?? 'bg-gray-100 text-gray-600'}>
                            {zoneLabel(circuit.zone)}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg mt-4">{circuit.shortName}</CardTitle>
                        <CardDescription className="text-sm">
                          Incoterm: <span className="font-semibold text-foreground">{displayIncoterm}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{circuit.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {circuit.costItems.slice(0, 3).map((cost) => (
                            <Badge key={cost.id} variant="secondary" className="text-xs">
                              {cost.label}
                            </Badge>
                          ))}
                          {circuit.costItems.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{circuit.costItems.length - 3}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap text-xs">
                          <Badge variant="outline">Couverture: {coverageBadge}</Badge>
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Warns: {warnsBadge}
                          </Badge>
                          <Badge variant="outline" className="border-red-300 text-red-700">
                            Blockers: {blockersBadge}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
                          <span>Dossiers: {casesCount}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <div className="bg-muted/50 rounded-xl p-6">
          <h3 className="font-semibold mb-2">Comprendre les couches de coûts</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
              <div>
                <p className="font-medium text-sm">Transport & Frais</p>
                <p className="text-xs text-muted-foreground">Fret, manutention, assurance - Documents: CMR/BL/AWB</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
              <div>
                <p className="font-medium text-sm">Douanes & Taxes DDP</p>
                <p className="text-xs text-muted-foreground">Droits de douane, OM/OMR (non récupérables) - Documents: DAU, EUR.1</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
              <div>
                <p className="font-medium text-sm">TVA Import</p>
                <p className="text-xs text-muted-foreground">TVA import (récupérable selon territoire/régime) - taux selon réglementation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
