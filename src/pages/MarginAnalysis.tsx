import { useState, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, 
  TrendingDown, TrendingUp, Download, Filter, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateCosts } from '@/utils/costCalculator';
import type { Destination, TransportMode } from '@/types';

interface ERPLine {
  id: string;
  reference: string;
  client: string;
  destination: Destination;
  transportMode: TransportMode;
  valeurHT: number;
  fraisTransitFactures: number;
  // Calculated fields
  fraisCalcules?: number;
  marge?: number;
  margePercent?: number;
  status?: 'ok' | 'warning' | 'risk';
}

const MARGIN_THRESHOLD = 0.17; // 17%

export default function MarginAnalysis() {
  const [data, setData] = useState<ERPLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'warning' | 'risk'>('all');

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('Fichier CSV vide ou invalide');
        return;
      }

      // Parse header
      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      
      // Expected columns mapping
      const colMap = {
        reference: headers.findIndex(h => h.includes('ref') || h.includes('code')),
        client: headers.findIndex(h => h.includes('client') || h.includes('nom')),
        destination: headers.findIndex(h => h.includes('dest') || h.includes('pays')),
        transport: headers.findIndex(h => h.includes('transport') || h.includes('mode')),
        valeurHT: headers.findIndex(h => h.includes('valeur') || h.includes('ht') || h.includes('montant')),
        fraisFactures: headers.findIndex(h => h.includes('frais') || h.includes('transit') || h.includes('factur'))
      };

      // Parse data rows
      const parsedData: ERPLine[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(c => c.trim());
        
        if (cols.length < 4) continue;

        const reference = colMap.reference >= 0 ? cols[colMap.reference] : `REF-${i}`;
        const client = colMap.client >= 0 ? cols[colMap.client] : 'Client';
        const destRaw = colMap.destination >= 0 ? cols[colMap.destination] : 'Martinique';
        const transportRaw = colMap.transport >= 0 ? cols[colMap.transport] : 'Maritime';
        const valeurHT = parseFloat((colMap.valeurHT >= 0 ? cols[colMap.valeurHT] : cols[4] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
        const fraisFactures = parseFloat((colMap.fraisFactures >= 0 ? cols[colMap.fraisFactures] : cols[5] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;

        // Map destination
        const destination = mapDestination(destRaw);
        const transportMode = mapTransport(transportRaw);

        // Calculate expected costs
        const costResult = calculateCosts({
          destination,
          incoterm: 'DDP',
          transportMode,
          weight: 100,
          goodsValue: valeurHT,
          productType: 'standard'
        });

        const fraisCalcules = costResult.totalPrestationsHT + costResult.totalTaxesNonRecuperables;
        const marge = fraisFactures - fraisCalcules;
        const margePercent = fraisCalcules > 0 ? marge / fraisCalcules : 0;
        
        let status: 'ok' | 'warning' | 'risk' = 'ok';
        if (margePercent < 0) {
          status = 'risk';
        } else if (margePercent < MARGIN_THRESHOLD) {
          status = 'warning';
        }

        parsedData.push({
          id: `line-${i}`,
          reference,
          client,
          destination,
          transportMode,
          valeurHT,
          fraisTransitFactures: fraisFactures,
          fraisCalcules,
          marge,
          margePercent,
          status
        });
      }

      setData(parsedData);
      toast.success(`${parsedData.length} lignes importées et analysées`);
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Erreur lors de la lecture du fichier CSV');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredData = useMemo(() => {
    if (filterStatus === 'all') return data;
    return data.filter(d => d.status === filterStatus);
  }, [data, filterStatus]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    
    const totalValeurHT = data.reduce((sum, d) => sum + d.valeurHT, 0);
    const totalFraisFactures = data.reduce((sum, d) => sum + d.fraisTransitFactures, 0);
    const totalFraisCalcules = data.reduce((sum, d) => sum + (d.fraisCalcules || 0), 0);
    const totalMarge = totalFraisFactures - totalFraisCalcules;
    const margeGlobale = totalFraisCalcules > 0 ? totalMarge / totalFraisCalcules : 0;
    
    const okCount = data.filter(d => d.status === 'ok').length;
    const warningCount = data.filter(d => d.status === 'warning').length;
    const riskCount = data.filter(d => d.status === 'risk').length;

    return {
      totalValeurHT,
      totalFraisFactures,
      totalFraisCalcules,
      totalMarge,
      margeGlobale,
      okCount,
      warningCount,
      riskCount
    };
  }, [data]);

  const handleExport = useCallback(() => {
    if (data.length === 0) return;

    const headers = ['Référence', 'Client', 'Destination', 'Transport', 'Valeur HT', 'Frais facturés', 'Frais calculés', 'Marge €', 'Marge %', 'Statut'];
    const rows = data.map(d => [
      d.reference,
      d.client,
      d.destination,
      d.transportMode,
      d.valeurHT.toFixed(2),
      d.fraisTransitFactures.toFixed(2),
      (d.fraisCalcules || 0).toFixed(2),
      (d.marge || 0).toFixed(2),
      ((d.margePercent || 0) * 100).toFixed(1) + '%',
      d.status
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analyse-marge-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Export CSV téléchargé');
  }, [data]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analyse des Marges Transit</h1>
          <p className="mt-1 text-muted-foreground">
            Importez vos données ERP pour calculer les coûts théoriques et comparer avec les frais facturés (seuil marge: 17%)
          </p>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import CSV ERP
            </CardTitle>
            <CardDescription>
              Format attendu: référence; client; destination; mode transport; valeur HT; frais transit facturés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Label
                htmlFor="csv-upload"
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span>{isLoading ? 'Chargement...' : 'Sélectionner fichier CSV'}</span>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isLoading}
              />
              
              {data.length > 0 && (
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter résultats
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valeur totale HT</p>
                    <p className="text-2xl font-bold">{(stats.totalValeurHT / 1000).toFixed(0)}k €</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Marge globale</p>
                    <p className={`text-2xl font-bold ${stats.margeGlobale >= MARGIN_THRESHOLD ? 'text-[hsl(var(--status-ok))]' : 'text-[hsl(var(--status-risk))]'}`}>
                      {(stats.margeGlobale * 100).toFixed(1)}%
                    </p>
                  </div>
                  {stats.margeGlobale >= MARGIN_THRESHOLD ? (
                    <TrendingUp className="h-8 w-8 text-[hsl(var(--status-ok))] opacity-50" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-[hsl(var(--status-risk))] opacity-50" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Lignes à risque</p>
                    <p className="text-2xl font-bold text-[hsl(var(--status-risk))]">{stats.riskCount}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-[hsl(var(--status-risk))] opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Lignes OK</p>
                    <p className="text-2xl font-bold text-[hsl(var(--status-ok))]">{stats.okCount}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-[hsl(var(--status-ok))] opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data Table */}
        {data.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Analyse détaillée</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={filterStatus === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('all')}
                  >
                    Tous ({data.length})
                  </Button>
                  <Button
                    variant={filterStatus === 'risk' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('risk')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Risque ({stats?.riskCount || 0})
                  </Button>
                  <Button
                    variant={filterStatus === 'warning' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('warning')}
                  >
                    À surveiller ({stats?.warningCount || 0})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead className="text-right">Valeur HT</TableHead>
                      <TableHead className="text-right">Frais facturés</TableHead>
                      <TableHead className="text-right">Frais calculés</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map(row => (
                      <TableRow key={row.id} className={row.status === 'risk' ? 'bg-[hsl(var(--status-risk-bg))]' : ''}>
                        <TableCell className="font-medium">{row.reference}</TableCell>
                        <TableCell>{row.client}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {row.destination}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{row.valeurHT.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell className="text-right">{row.fraisTransitFactures.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell className="text-right">{(row.fraisCalcules || 0).toLocaleString('fr-FR')} €</TableCell>
                        <TableCell className="text-right">
                          <span className={row.status === 'risk' ? 'text-[hsl(var(--status-risk))] font-semibold' : ''}>
                            {((row.margePercent || 0) * 100).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.status === 'ok' && <Badge className="badge-ok">OK</Badge>}
                          {row.status === 'warning' && <Badge className="badge-warning">À surveiller</Badge>}
                          {row.status === 'risk' && <Badge className="badge-risk">Risque</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune donnée</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Importez un fichier CSV depuis votre ERP pour analyser les marges sur vos opérations de transit.
                Le système calculera automatiquement les coûts théoriques et comparera avec les frais facturés.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

// Helper functions
function mapDestination(raw: string): Destination {
  const normalized = raw.toLowerCase().trim();
  const destinations: Record<string, Destination> = {
    'martinique': 'Martinique',
    'guadeloupe': 'Guadeloupe',
    'guyane': 'Guyane',
    'reunion': 'Réunion',
    'réunion': 'Réunion',
    'mayotte': 'Mayotte',
    'belgique': 'Belgique',
    'espagne': 'Espagne',
    'luxembourg': 'Luxembourg',
    'suisse': 'Suisse'
  };
  
  for (const [key, value] of Object.entries(destinations)) {
    if (normalized.includes(key)) return value;
  }
  return 'Martinique';
}

function mapTransport(raw: string): TransportMode {
  const normalized = raw.toLowerCase().trim();
  if (normalized.includes('marit') || normalized.includes('bateau') || normalized.includes('mer')) return 'Maritime';
  if (normalized.includes('aer') || normalized.includes('avion') || normalized.includes('air')) return 'Aerien';
  if (normalized.includes('express')) return 'Express';
  if (normalized.includes('ferro') || normalized.includes('train')) return 'Ferroviaire';
  return 'Routier';
}
