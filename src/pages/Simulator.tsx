import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { calculateCosts, type ProductType, type CostBreakdown } from '@/utils/costCalculator';
import { getZoneFromDestination } from '@/data/referenceRates';
import { useReferenceRates } from '@/hooks/useReferenceRates';
import type { Destination, Incoterm, TransportMode } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calculator, 
  Euro, 
  MapPin, 
  Truck, 
  Package, 
  TrendingUp,
  Check,
  AlertCircle,
  Info,
  Download,
} from 'lucide-react';

const destinations: Destination[] = [
  'Guadeloupe', 'Martinique', 'Guyane', 'Reunion', 'Mayotte',
  'Belgique', 'Espagne', 'Luxembourg', 'Suisse'
];

const incoterms: Incoterm[] = ['EXW', 'FCA', 'DAP', 'DDP'];
const transportModes: TransportMode[] = ['Routier', 'Maritime', 'Aerien', 'Express', 'Ferroviaire'];

export default function Simulator() {
  const { vatRates, octroiMerRates, transportCosts, serviceCharges } = useReferenceRates();
  
  const [goodsValue, setGoodsValue] = useState<number>(10000);
  const [destination, setDestination] = useState<Destination>('Martinique');
  const [incoterm, setIncoterm] = useState<Incoterm>('DAP');
  const [productType, setProductType] = useState<ProductType>('lppr');
  const [transportMode, setTransportMode] = useState<TransportMode>('Maritime');
  const [weight, setWeight] = useState<number>(100);
  const [margin, setMargin] = useState<number>(25);

  const zone = getZoneFromDestination(destination);

  const costBreakdown = useMemo<CostBreakdown | null>(() => {
    if (goodsValue <= 0) return null;

    return calculateCosts({
      goodsValue,
      destination,
      incoterm,
      productType,
      transportMode,
      weight,
      margin,
      customRates: { vatRates, octroiMerRates, transportCosts, serviceCharges },
    });
  }, [goodsValue, destination, incoterm, productType, transportMode, weight, margin, vatRates, octroiMerRates, transportCosts, serviceCharges]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const exportToCsv = () => {
    if (!costBreakdown) return;

    const lines = [
      ['Simulateur Export ORLIMAN', ''],
      ['', ''],
      ['Paramètres', ''],
      ['Valeur marchandise', formatCurrency(goodsValue)],
      ['Destination', destination],
      ['Zone', zone],
      ['Incoterm', incoterm],
      ['Type produit', productType === 'lppr' ? 'LPPR (remboursé)' : 'Standard'],
      ['Transport', transportMode],
      ['Poids (kg)', weight.toString()],
      ['', ''],
      ['Détail des charges', ''],
      ['Poste', 'Montant', 'Payeur', 'TVA récupérable'],
      ...costBreakdown.lines.map(l => [
        l.label,
        formatCurrency(l.amount),
        l.payer,
        l.isRecoverable ? 'Oui' : 'Non'
      ]),
      ['', ''],
      ['Résumé', ''],
      ['Prix de revient', formatCurrency(costBreakdown.prixDeRevient)],
      ['Prix vente HT conseillé', formatCurrency(costBreakdown.prixVenteHT)],
      ['TVA récupérable', formatCurrency(costBreakdown.totalTvaRecuperablePrestations)],
    ];

    const csvContent = lines.map(row => row.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulation_${destination}_${incoterm}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-6 w-6 text-accent" />
              Simulateur de prix export
            </h1>
            <p className="mt-1 text-muted-foreground">
              Estimez vos coûts selon destination, incoterm et type de produit
            </p>
          </div>
          {costBreakdown && (
            <Button variant="outline" onClick={exportToCsv}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Paramètres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Goods Value */}
              <div className="space-y-2">
                <Label htmlFor="goods_value" className="flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Valeur marchandise HT
                </Label>
                <Input
                  id="goods_value"
                  type="number"
                  min="0"
                  step="100"
                  value={goodsValue}
                  onChange={(e) => setGoodsValue(Number(e.target.value))}
                />
              </div>

              {/* Destination */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Destination
                </Label>
                <Select value={destination} onValueChange={(v) => setDestination(v as Destination)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">DROM</div>
                    {destinations.filter(d => ['Guadeloupe', 'Martinique', 'Guyane', 'Réunion', 'Mayotte'].includes(d)).map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">UE</div>
                    {destinations.filter(d => ['Belgique', 'Espagne', 'Luxembourg'].includes(d)).map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Hors UE</div>
                    {destinations.filter(d => ['Suisse'].includes(d)).map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Badge 
                    variant={zone === 'UE' ? 'default' : zone === 'DROM' ? 'secondary' : 'outline'}
                    className={
                      zone === 'UE' ? 'badge-ue' : 
                      zone === 'DROM' ? 'badge-drom' : 
                      'badge-hors-ue'
                    }
                  >
                    Zone {zone}
                  </Badge>
                </div>
              </div>

              {/* Incoterm */}
              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incoterms.map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {incoterm === 'EXW' && 'Client assume tous les frais'}
                  {incoterm === 'FCA' && 'Fournisseur gère export uniquement'}
                  {incoterm === 'DAP' && 'Fournisseur livre, client gère import'}
                  {incoterm === 'DDP' && 'Fournisseur assume tout'}
                </p>
              </div>

              {/* Product Type */}
              <div className="space-y-2">
                <Label>Type de produit</Label>
                <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lppr">LPPR (remboursé)</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
                {productType === 'lppr' && (
                  <p className="text-xs text-[hsl(var(--status-ok))]">
                    ✓ TVA réduite 2.1% en DROM, OM exonéré produits orthopédiques
                  </p>
                )}
              </div>

              {/* Transport Mode */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Mode de transport
                </Label>
                <Select value={transportMode} onValueChange={(v) => setTransportMode(v as TransportMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transportModes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Weight */}
              <div className="space-y-2">
                <Label htmlFor="weight">Poids estimé (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                />
              </div>

              {/* Margin */}
              <div className="space-y-2">
                <Label htmlFor="margin" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Marge souhaitée (%)
                </Label>
                <Input
                  id="margin"
                  type="number"
                  min="0"
                  max="100"
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {costBreakdown ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Valeur marchandise</p>
                      <p className="text-xl font-bold">{formatCurrency(goodsValue)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Prix de revient</p>
                      <p className="text-xl font-bold text-primary">
                        {formatCurrency(costBreakdown.prixDeRevient)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        +{((costBreakdown.prixDeRevient / goodsValue - 1) * 100).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-accent/30 bg-accent/5">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Prix vente HT conseillé</p>
                      <p className="text-xl font-bold text-accent">
                        {formatCurrency(costBreakdown.prixVenteHT)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Marge {margin}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-[hsl(var(--status-ok))]/30 bg-[hsl(var(--status-ok))]/5">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">TVA récupérable</p>
                      <p className="text-xl font-bold text-[hsl(var(--status-ok))]">
                        {formatCurrency(costBreakdown.totalTvaRecuperablePrestations)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Neutre trésorerie
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Détail des charges</CardTitle>
                    <CardDescription>
                      Répartition selon Incoterm {incoterm} vers {destination}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Prestations with recoverable VAT */}
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Check className="h-4 w-4 text-[hsl(var(--status-ok))]" />
                          Prestations avec TVA récupérable
                        </h4>
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3 font-medium">Poste</th>
                                <th className="text-right p-3 font-medium">Montant HT</th>
                                <th className="text-right p-3 font-medium">TVA</th>
                                <th className="text-center p-3 font-medium">Payeur</th>
                              </tr>
                            </thead>
                            <tbody>
                              {costBreakdown.lines
                                .filter(l => l.category === 'prestation' && l.isRecoverable)
                                .map((line, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="p-3">{line.label}</td>
                                    <td className="p-3 text-right font-medium">{formatCurrency(line.amount)}</td>
                                    <td className="p-3 text-right text-[hsl(var(--status-ok))]">
                                      {formatCurrency(line.tvaAmount)}
                                    </td>
                                    <td className="p-3 text-center">
                                      <Badge variant={line.payer === 'Fournisseur' ? 'default' : 'outline'}>
                                        {line.payer}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Non-recoverable taxes */}
                      {costBreakdown.lines.filter(l => l.category === 'taxe').length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-[hsl(var(--status-risk))]" />
                            Taxes non récupérables (impactent le prix de revient)
                          </h4>
                          <div className="rounded-lg border border-[hsl(var(--status-risk))]/30 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-[hsl(var(--status-risk))]/5">
                                <tr>
                                  <th className="text-left p-3 font-medium">Taxe</th>
                                  <th className="text-right p-3 font-medium">Montant</th>
                                  <th className="text-center p-3 font-medium">Payeur</th>
                                  <th className="text-left p-3 font-medium">Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {costBreakdown.lines
                                  .filter(l => l.category === 'taxe')
                                  .map((line, i) => (
                                    <tr key={i} className="border-t">
                                      <td className="p-3">{line.label}</td>
                                      <td className="p-3 text-right font-medium text-[hsl(var(--status-risk))]">
                                        {formatCurrency(line.amount)}
                                      </td>
                                      <td className="p-3 text-center">
                                        <Badge variant="destructive">{line.payer}</Badge>
                                      </td>
                                      <td className="p-3 text-xs text-muted-foreground">{line.notes}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* TVA Import */}
                      {costBreakdown.lines.filter(l => l.category === 'tva_import').length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            TVA Import
                          </h4>
                          <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-3 font-medium">Type</th>
                                  <th className="text-right p-3 font-medium">Montant</th>
                                  <th className="text-center p-3 font-medium">Récupérable</th>
                                  <th className="text-left p-3 font-medium">Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {costBreakdown.lines
                                  .filter(l => l.category === 'tva_import')
                                  .map((line, i) => (
                                    <tr key={i} className="border-t">
                                      <td className="p-3">{line.label}</td>
                                      <td className="p-3 text-right font-medium">{formatCurrency(line.amount)}</td>
                                      <td className="p-3 text-center">
                                        {line.isRecoverable ? (
                                          <Badge className="badge-ok">Oui (autoliq.)</Badge>
                                        ) : (
                                          <Badge variant="secondary">Client</Badge>
                                        )}
                                      </td>
                                      <td className="p-3 text-xs text-muted-foreground">{line.notes}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Totals */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Charges fournisseur</p>
                          <p className="text-lg font-bold">{formatCurrency(costBreakdown.totalFournisseur)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Charges client</p>
                          <p className="text-lg font-bold">{formatCurrency(costBreakdown.totalClient)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-[hsl(var(--status-risk))]/5">
                          <p className="text-xs text-muted-foreground">Taxes non récup.</p>
                          <p className="text-lg font-bold text-[hsl(var(--status-risk))]">
                            {formatCurrency(costBreakdown.totalTaxesNonRecuperables)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-[hsl(var(--status-ok))]/5">
                          <p className="text-xs text-muted-foreground">TVA récupérable</p>
                          <p className="text-lg font-bold text-[hsl(var(--status-ok))]">
                            {formatCurrency(costBreakdown.totalTvaRecuperablePrestations)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="flex items-center justify-center h-64">
                <CardContent className="text-center">
                  <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Entrez une valeur marchandise pour voir l'estimation
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
