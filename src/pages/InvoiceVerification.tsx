import { useCallback, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Euro, Percent, FileSearch, RotateCcw } from 'lucide-react';
import { extractInvoiceFromPdf } from '@/lib/pdf/extractInvoice';
import { useInvoiceTracker } from '@/hooks/useInvoiceTracker';

interface ExtractedInvoice {
  invoiceNumber?: string;
  invoiceDate?: string;
  supplierName?: string;
  totalHT?: number;
  totalTVA?: number;
  totalTTC?: number;
  transitFees?: number;
}

interface VerificationResult {
  invoice: ExtractedInvoice;
  marginAnalysis?: {
    marginAmount: number;
    marginPercent: number;
    status: 'ok' | 'warning' | 'error';
  };
  alerts: string[];
}

export default function InvoiceVerification() {
  const { toast } = useToast();
  const { upsert, items } = useInvoiceTracker();

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  // Manual input fields for extracted data
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [manualTotalHT, setManualTotalHT] = useState('');
  const [manualTotalTVA, setManualTotalTVA] = useState('');
  const [manualTransit, setManualTransit] = useState('');
  const [manualSupplier, setManualSupplier] = useState('');
  const [manualDate, setManualDate] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setCurrentFile(file);
      setExtractedData(null);
      setVerificationResult(null);
      setManualInvoiceNumber('');
      setManualTotalHT('');
      setManualTotalTVA('');
      setManualTransit('');
      setManualSupplier('');
      setManualDate('');
    } else {
      toast({
        title: 'Format invalide',
        description: 'Veuillez sélectionner un fichier PDF',
        variant: 'destructive',
      });
    }
  };

  const runExtraction = useCallback(async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    try {
      const parsed = await extractInvoiceFromPdf(currentFile);
      const totalTVA = parsed.totalTTC !== null && parsed.totalHT !== null ? parsed.totalTTC - parsed.totalHT : null;
      const extracted: ExtractedInvoice = {
        invoiceNumber: parsed.invoiceNumber || '',
        invoiceDate: parsed.date || '',
        supplierName: parsed.supplier || '',
        totalHT: parsed.totalHT ?? undefined,
        totalTVA: totalTVA ?? undefined,
        totalTTC: parsed.totalTTC ?? undefined,
        transitFees: parsed.transitFees ?? undefined,
      };
      setExtractedData(extracted);
      setManualInvoiceNumber(extracted.invoiceNumber || '');
      setManualTotalHT(extracted.totalHT?.toString() || '');
      setManualTotalTVA(extracted.totalTVA?.toString() || '');
      setManualTransit(extracted.transitFees?.toString() || '');
      setManualSupplier(extracted.supplierName || '');
      setManualDate(extracted.invoiceDate || '');
      toast({ title: 'Extraction effectuée', description: 'Vérifiez ou corrigez les montants avant calcul.' });
    } catch (err) {
      toast({
        title: 'Extraction impossible',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [currentFile, toast]);

  const verifyMargin = useCallback(() => {
    const ht = parseFloat(manualTotalHT) || 0;
    const tva = parseFloat(manualTotalTVA) || 0;
    const transit = parseFloat(manualTransit) || 0;
    const ttc = ht + tva;

    const invoiceData: ExtractedInvoice = {
      invoiceNumber: manualInvoiceNumber,
      invoiceDate: manualDate,
      supplierName: manualSupplier,
      totalHT: ht,
      totalTVA: tva,
      totalTTC: ttc,
      transitFees: transit,
    };

    const alerts: string[] = [];
    if (!invoiceData.invoiceNumber) {
      alerts.push('Numéro de facture manquant (clé unique)');
    }
    if (!invoiceData.totalHT || invoiceData.totalHT <= 0 || Number.isNaN(invoiceData.totalHT)) {
      alerts.push('Montant HT invalide ou manquant');
    }
    if (!invoiceData.totalTTC || invoiceData.totalTTC <= 0 || Number.isNaN(invoiceData.totalTTC)) {
      alerts.push('Montant TTC manquant ou invalide (calculé : HT + TVA)');
    }

    const marginAmount = invoiceData.totalHT - (invoiceData.transitFees || 0);
    const marginPercent = invoiceData.totalHT > 0 ? (marginAmount / invoiceData.totalHT) * 100 : 0;
    let status: 'ok' | 'warning' | 'error' = 'ok';
    if (marginAmount < 0) {
      status = 'error';
      alerts.push('Marge négative après transit');
    } else if (marginPercent < 5) {
      status = 'warning';
      alerts.push('Marge très faible (<5%)');
    }

    setVerificationResult({
      invoice: invoiceData,
      marginAnalysis: { marginAmount, marginPercent, status },
      alerts,
    });

    if (invoiceData.invoiceNumber) {
      upsert({
        invoiceNumber: invoiceData.invoiceNumber,
        supplier: invoiceData.supplierName,
        date: invoiceData.invoiceDate,
        totalHT: invoiceData.totalHT,
        totalTTC: invoiceData.totalTTC,
        transitFees: invoiceData.transitFees,
        marginAmount,
        marginPercent,
        filename: currentFile?.name,
        analyzedAt: new Date().toISOString(),
      });
    }

    toast({
      title: 'Vérification terminée',
      description: alerts.length > 0 ? `${alerts.length} alerte(s) détectée(s)` : 'Aucune anomalie détectée',
      variant: alerts.length > 0 ? 'destructive' : 'default',
    });
  }, [manualInvoiceNumber, manualTotalHT, manualTotalTVA, manualTransit, manualSupplier, manualDate, upsert, currentFile, toast]);

  const resetForm = () => {
    setCurrentFile(null);
    setExtractedData(null);
    setVerificationResult(null);
    setManualInvoiceNumber('');
    setManualTotalHT('');
    setManualTotalTVA('');
    setManualTransit('');
    setManualSupplier('');
    setManualDate('');
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Vérification Facture PDF
          </h1>
          <p className="mt-1 text-muted-foreground">
            Importez une facture PDF pour extraire HT, TTC, transit et calculer la marge (clé = n° facture)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Upload & Extraction */}
          <div className="space-y-6">
            {/* Upload Zone */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Facture PDF
                </CardTitle>
                <CardDescription>Sélectionnez un fichier PDF à analyser</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <Input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" id="pdf-upload" />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    {currentFile ? (
                      <p className="text-sm font-medium text-foreground">{currentFile.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Cliquez ou glissez un fichier PDF ici</p>
                    )}
                  </label>
                </div>

                {currentFile && (
                  <Button onClick={runExtraction} disabled={isProcessing} className="w-full">
                    {isProcessing ? 'Extraction en cours...' : 'Analyser le PDF'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Manual Input / Correction */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Données facture</CardTitle>
                <CardDescription>
                  Vérifiez et corrigez les montants extraits. Le n° facture est la clé unique du suivi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">N° Facture</Label>
                    <Input
                      id="invoiceNumber"
                      value={manualInvoiceNumber}
                      onChange={(e) => setManualInvoiceNumber(e.target.value)}
                      placeholder="FAC-XXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceDate">Date</Label>
                    <Input id="invoiceDate" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Fournisseur</Label>
                  <Input
                    id="supplier"
                    value={manualSupplier}
                    onChange={(e) => setManualSupplier(e.target.value)}
                    placeholder="Nom du fournisseur"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalHT">Total HT (€)</Label>
                    <Input
                      id="totalHT"
                      type="number"
                      step="0.01"
                      value={manualTotalHT}
                      onChange={(e) => setManualTotalHT(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalTVA">TVA (€)</Label>
                    <Input
                      id="totalTVA"
                      type="number"
                      step="0.01"
                      value={manualTotalTVA}
                      onChange={(e) => setManualTotalTVA(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transit">Frais de transit / transport (€)</Label>
                  <Input
                    id="transit"
                    type="number"
                    step="0.01"
                    value={manualTransit}
                    onChange={(e) => setManualTransit(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button onClick={verifyMargin} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Vérifier la marge
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Verification Results */}
          <div className="space-y-6">
            {verificationResult ? (
              <>
                {/* Margin Analysis */}
                {verificationResult.marginAnalysis && (
                  <Card
                    className={
                      verificationResult.marginAnalysis.status === 'ok'
                        ? 'border-status-ok/50'
                        : verificationResult.marginAnalysis.status === 'warning'
                        ? 'border-status-warning/50'
                        : 'border-status-risk/50'
                    }
                  >
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Analyse de marge
                        <Badge
                          variant={verificationResult.marginAnalysis.status === 'ok' ? 'default' : 'destructive'}
                          className={
                            verificationResult.marginAnalysis.status === 'ok'
                              ? 'bg-status-ok text-white'
                              : verificationResult.marginAnalysis.status === 'warning'
                              ? 'bg-status-warning text-white'
                              : 'bg-status-risk text-white'
                          }
                        >
                          {verificationResult.marginAnalysis.status === 'ok'
                            ? 'OK'
                            : verificationResult.marginAnalysis.status === 'warning'
                            ? 'Attention'
                            : 'Alerte'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">HT (recette)</p>
                          <p className="text-xl font-bold">{formatCurrency(verificationResult.invoice.totalHT || 0)}</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Transit / transport</p>
                          <p className="text-xl font-bold">
                            {formatCurrency(verificationResult.invoice.transitFees || 0)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`p-4 rounded-lg flex items-center justify-between ${
                          verificationResult.marginAnalysis.marginAmount < 0
                            ? 'bg-status-risk/10'
                            : verificationResult.marginAnalysis.marginPercent < 5
                            ? 'bg-status-warning/10'
                            : 'bg-status-ok/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {verificationResult.marginAnalysis.marginAmount < 0 ? (
                            <TrendingDown className="h-5 w-5 text-status-risk" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-status-ok" />
                          )}
                          <span className="font-medium">Marge (après transit)</span>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${
                              verificationResult.marginAnalysis.marginAmount < 0
                                ? 'text-status-risk'
                                : 'text-status-ok'
                            }`}
                          >
                            {verificationResult.marginAnalysis.marginAmount > 0 ? '+' : ''}
                            {formatCurrency(verificationResult.marginAnalysis.marginAmount)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {verificationResult.marginAnalysis.marginPercent > 0 ? '+' : ''}
                            {verificationResult.marginAnalysis.marginPercent.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alerts */}
                {verificationResult.alerts.length > 0 && (
                  <Card className="border-status-warning/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-status-warning" />
                        Alertes ({verificationResult.alerts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {verificationResult.alerts.map((alert, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <XCircle className="h-4 w-4 text-status-risk mt-0.5 shrink-0" />
                            <span>{alert}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Invoice Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Récapitulatif facture</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">N° Facture</span>
                        <span className="font-medium">{verificationResult.invoice.invoiceNumber || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fournisseur</span>
                        <span className="font-medium">{verificationResult.invoice.supplierName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">{verificationResult.invoice.invoiceDate || '-'}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total HT</span>
                        <span className="font-medium">{formatCurrency(verificationResult.invoice.totalHT || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TVA</span>
                        <span className="font-medium">{formatCurrency(verificationResult.invoice.totalTVA || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transit</span>
                        <span className="font-medium">
                          {formatCurrency(verificationResult.invoice.transitFees || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium text-base">
                        <span>Total TTC</span>
                        <span>{formatCurrency(verificationResult.invoice.totalTTC || 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center">
                  <FileSearch className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Importez une facture PDF ou saisissez les données manuellement pour lancer la vérification
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Factures analysées</p>
                <p className="text-xl font-bold">{items.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Euro className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marge moyenne</p>
                <p className="text-xl font-bold">
                  {items.length
                    ? `${(items.reduce((s, i) => s + (i.marginPercent || 0), 0) / items.length).toFixed(1)}%`
                    : '-'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-ok/10">
                <Percent className="h-5 w-5 text-status-ok" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Frais transit moyens</p>
                <p className="text-xl font-bold">
                  {items.length
                    ? `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                        items.reduce((s, i) => s + (i.transitFees || 0), 0) / items.length || 0,
                      )}`
                    : '-'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
