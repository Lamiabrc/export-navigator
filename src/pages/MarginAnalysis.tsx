import { useState, useCallback, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, Euro, TrendingUp, Download, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface InvoiceEntry {
  id: string;
  postalCode: string;
  client: string;
  invoiceNumber: string;
  montantHT: number;
  destination: string;
  suggestedMinTransit: number;
}

interface TransitRates {
  [destination: string]: { baseRate: number; minAmount: number };
}

const defaultTransitRates: TransitRates = {
  'Martinique': { baseRate: 8, minAmount: 150 },
  'Guadeloupe': { baseRate: 8, minAmount: 150 },
  'Guyane': { baseRate: 10, minAmount: 180 },
  'Réunion': { baseRate: 9, minAmount: 160 },
  'Mayotte': { baseRate: 11, minAmount: 200 },
  'Belgique': { baseRate: 3, minAmount: 80 },
  'Espagne': { baseRate: 4, minAmount: 90 },
  'Luxembourg': { baseRate: 3, minAmount: 75 },
  'Suisse': { baseRate: 5, minAmount: 120 },
  'default': { baseRate: 6, minAmount: 100 },
};

const postalCodeToDestination: Record<string, string> = {
  '972': 'Martinique', '971': 'Guadeloupe', '973': 'Guyane', '974': 'Réunion', '976': 'Mayotte',
};

const detectDestination = (postalCode: string): string => {
  const prefix = postalCode.slice(0, 3);
  if (postalCodeToDestination[prefix]) return postalCodeToDestination[prefix];
  if (/^[0-9]{4}$/.test(postalCode)) return 'Belgique';
  if (/^[1-9][0-9]{3}$/.test(postalCode) && postalCode.length === 4) return 'Suisse';
  return 'Autre';
};

export default function MarginAnalysis() {
  const [entries, setEntries] = useState<InvoiceEntry[]>([]);
  const [transitRates, setTransitRates] = useLocalStorage<TransitRates>('orliman_transit_rates', defaultTransitRates);
  const [filterDestination, setFilterDestination] = useState<string>('all');

  const parseCSV = (content: string): InvoiceEntry[] => {
    const lines = content.split('\n').filter(line => line.trim());
    const result: InvoiceEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
      if (values.length >= 4) {
        const postalCode = values[0];
        const client = values[1];
        const invoiceNumber = values[2];
        const montantHT = parseFloat(values[3].replace(',', '.').replace(/\s/g, '')) || 0;
        const destination = detectDestination(postalCode);
        const rate = transitRates[destination] || transitRates['default'];
        const suggestedMinTransit = Math.max((rate.baseRate / 100) * montantHT, rate.minAmount);
        result.push({ id: `${i}-${invoiceNumber}`, postalCode, client, invoiceNumber, montantHT, destination, suggestedMinTransit });
      }
    }
    return result;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target?.result as string);
        setEntries(parsed);
        toast.success(`${parsed.length} factures importées`);
      } catch { toast.error('Erreur lors de la lecture du fichier CSV'); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const downloadTemplate = () => {
    const template = `code_postal;client;numero_facture;montant_ht\n97200;Client Martinique;FAC-001;5000\n97100;Client Guadeloupe;FAC-002;3500`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'modele_factures.csv'; a.click();
  };

  const filteredEntries = useMemo(() => filterDestination === 'all' ? entries : entries.filter(e => e.destination === filterDestination), [entries, filterDestination]);
  const uniqueDestinations = useMemo(() => [...new Set(entries.map(e => e.destination))], [entries]);
  const stats = useMemo(() => {
    if (!entries.length) return null;
    const totalHT = entries.reduce((s, e) => s + e.montantHT, 0);
    const totalTransit = entries.reduce((s, e) => s + e.suggestedMinTransit, 0);
    return { count: entries.length, totalHT, totalTransit, avgRate: (totalTransit / totalHT) * 100 };
  }, [entries]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analyse des Frais de Transit</h1>
          <p className="text-muted-foreground">Importez vos factures pour calculer les frais de transit minimum suggérés</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Import des factures</CardTitle>
            <CardDescription>Format CSV: code_postal;client;numero_facture;montant_ht</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Input type="file" accept=".csv" onChange={handleFileUpload} className="flex-1" />
            <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Modèle</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Taux par destination</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(transitRates).map(([dest, rate]) => (
                <div key={dest} className="p-2 border rounded space-y-1">
                  <Label className="text-xs font-medium">{dest === 'default' ? 'Défaut' : dest}</Label>
                  <div className="flex gap-1">
                    <Input type="number" value={rate.baseRate} onChange={(e) => setTransitRates({ ...transitRates, [dest]: { ...rate, baseRate: parseFloat(e.target.value) || 0 } })} className="h-7 text-xs" placeholder="%" />
                    <Input type="number" value={rate.minAmount} onChange={(e) => setTransitRates({ ...transitRates, [dest]: { ...rate, minAmount: parseFloat(e.target.value) || 0 } })} className="h-7 text-xs" placeholder="Min €" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-3"><FileSpreadsheet className="h-8 w-8 text-primary/50" /><div><p className="text-xs text-muted-foreground">Factures</p><p className="text-2xl font-bold">{stats.count}</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><Euro className="h-8 w-8 text-blue-500/50" /><div><p className="text-xs text-muted-foreground">Total HT</p><p className="text-2xl font-bold">{stats.totalHT.toLocaleString('fr-FR')} €</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><TrendingUp className="h-8 w-8 text-orange-500/50" /><div><p className="text-xs text-muted-foreground">Transit suggéré</p><p className="text-2xl font-bold">{stats.totalTransit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><Calculator className="h-8 w-8 text-green-500/50" /><div><p className="text-xs text-muted-foreground">Taux moyen</p><p className="text-2xl font-bold">{stats.avgRate.toFixed(1)}%</p></div></CardContent></Card>
          </div>
        )}

        {entries.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Détail des factures</CardTitle>
              <Select value={filterDestination} onValueChange={setFilterDestination}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {uniqueDestinations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Facture</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Code Postal</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="text-right">Montant HT</TableHead>
                    <TableHead className="text-right">Transit Min. Suggéré</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.invoiceNumber}</TableCell>
                      <TableCell>{e.client}</TableCell>
                      <TableCell>{e.postalCode}</TableCell>
                      <TableCell><Badge variant="outline">{e.destination}</Badge></TableCell>
                      <TableCell className="text-right">{e.montantHT.toLocaleString('fr-FR')} €</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{e.suggestedMinTransit.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
