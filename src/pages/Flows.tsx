import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportCircuits } from '@/data/exportCircuits';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Ship, Truck, FileText, Euro, Map } from 'lucide-react';
import { ExportMindMap } from '@/components/flows/ExportMindMap';

const zoneColors: Record<string, string> = {
  'UE': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Hors UE': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'DROM': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Multiple': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const circuitIcons: Record<string, React.ReactNode> = {
  'fca_client_place': <Truck className="h-8 w-8" />,
  'ddp_direct': <Globe className="h-8 w-8" />,
  'platform_drom': <Ship className="h-8 w-8" />,
  'ue_intra': <Euro className="h-8 w-8" />,
  'suisse': <FileText className="h-8 w-8" />,
  'hors_ue': <Globe className="h-8 w-8" />,
};

export default function Flows() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Circuits Export</h1>
          <p className="mt-1 text-muted-foreground">
            Vue cartographique des flux d'export depuis la France avec les 3 couches de coûts
          </p>
        </div>

        <Tabs defaultValue="mindmap" className="space-y-6">
          <TabsList>
            <TabsTrigger value="mindmap" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              Carte des flux
            </TabsTrigger>
            <TabsTrigger value="circuits" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Circuits détaillés
            </TabsTrigger>
          </TabsList>

          {/* Mind Map Tab */}
          <TabsContent value="mindmap">
            <ExportMindMap />
          </TabsContent>

          {/* Circuits Grid Tab */}
          <TabsContent value="circuits">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exportCircuits.map((circuit) => (
                <Link key={circuit.id} to={`/flows/${circuit.id}`}>
                  <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {circuitIcons[circuit.id]}
                        </div>
                        <Badge variant="outline" className={zoneColors[circuit.zone]}>
                          {circuit.zone}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-4">{circuit.shortName}</CardTitle>
                      <CardDescription className="text-sm">
                        Incoterm: <span className="font-semibold text-foreground">{circuit.incoterm}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {circuit.description}
                      </p>
                      
                      <div className="flex items-center justify-between pt-3 border-t">
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
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Info */}
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
                <p className="text-xs text-muted-foreground">TVA import (récupérable sauf exceptions) - Taux: 2.1% à 20%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
