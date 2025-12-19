import { useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { SageInvoice } from '@/types/sage';
import type { CostDoc } from '@/types/costs';
import { reconcile } from '@/lib/reco/reconcile';
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Euro,
  Percent,
  FileSearch,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface ExtractedInvoice {
  invoiceNumber?: string;
  invoiceDate?: string;
  supplierName?: string;
  totalHT?: number;
  totalTVA?: number;
  totalTTC?: number;
  lines?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }>;
}

interface VerificationResult {
  invoice: ExtractedInvoice;
  matchedCostDoc?: CostDoc;
  marginAnalysis?: {
    expectedCost: number;
    actualCost: number;
    difference: number;
    differencePercent: number;
    status: 'ok' | 'warning' | 'error';
  };
  alerts: string[];
}

export default function InvoiceVerification() {
  const { toast } = useToast();
  const [costDocs] = useLocalStorage<CostDoc[]>('costDocs', []);
  const [sageInvoices] = useLocalStorage<SageInvoice[]>('sageInvoices', []);
  
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  
  // Manual input fields for extracted data
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [manualTotalHT, setManualTotalHT] = useState('');
  const [manualTotalTVA, setManualTotalTVA] = useState('');
  const [manualSupplier, setManualSupplier] = useState('');
  const [manualDate, setManualDate] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setCurrentFile(file);
      setExtractedData(null);
      setVerificationResult(null);
      // Reset manual fields
      setManualInvoiceNumber('');
      setManualTotalHT('');
      setManualTotalTVA('');
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

  const simulateExtraction = useCallback(() => {
    // Simulate PDF extraction (in production, this would use a PDF parsing service)
    setIsProcessing(true);
    
    setTimeout(() => {
      // Simulated extracted data - in real implementation, this would come from PDF parsing
      const mockExtracted: ExtractedInvoice = {
        invoiceNumber: `FAC-${Math.floor(Math.random() * 10000)}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        supplierName: 'Transitaire Express',
        totalHT: Math.floor(Math.random() * 5000) + 500,
        totalTVA: 0,
        totalTTC: 0,
      };
      mockExtracted.totalTVA = Math.round(mockExtracted.totalHT! * 0.2);
      mockExtracted.totalTTC = mockExtracted.totalHT! + mockExtracted.totalTVA;
      
      setExtractedData(mockExtracted);
      setManualInvoiceNumber(mockExtracted.invoiceNumber || '');
      setManualTotalHT(mockExtracted.totalHT?.toString() || '');
      setManualTotalTVA(mockExtracted.totalTVA?.toString() || '');
      setManualSupplier(mockExtracted.supplierName || '');
      setManualDate(mockExtracted.invoiceDate || '');
      
      setIsProcessing(false);
      toast({
        title: 'Extraction réussie',
        description: 'Les données ont été extraites du PDF. Vérifiez et corrigez si nécessaire.',
      });
    }, 1500);
  }, [toast]);

  const verifyMargin = useCallback(() => {
    const invoiceData: ExtractedInvoice = {
      invoiceNumber: manualInvoiceNumber,
      invoiceDate: manualDate,
      supplierName: manualSupplier,
      totalHT: parseFloat(manualTotalHT) || 0,
      totalTVA: parseFloat(manualTotalTVA) || 0,
      totalTTC: (parseFloat(manualTotalHT) || 0) + (parseFloat(manualTotalTVA) || 0),
    };

    // Find matching cost doc
    const matchedDoc = costDocs.find(doc => 
      doc.invoiceNumber === invoiceData.invoiceNumber ||
      doc.supplier?.toLowerCase().includes(invoiceData.supplierName?.toLowerCase() || '')
    );

    const alerts: string[] = [];
    let marginAnalysis;

    if (matchedDoc) {
      const expectedCost = matchedDoc.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
      const actualCost = invoiceData.totalHT || 0;
      const difference = actualCost - expectedCost;
      const differencePercent = expectedCost > 0 ? (difference / expectedCost) * 100 : 0;

      let status: 'ok' | 'warning' | 'error' = 'ok';
      if (Math.abs(differencePercent) > 10) {
        status = 'error';
        alerts.push(`Écart significatif de ${differencePercent.toFixed(1)}% par rapport au coût prévu`);
      } else if (Math.abs(differencePercent) > 5) {
        status = 'warning';
        alerts.push(`Écart modéré de ${differencePercent.toFixed(1)}% par rapport au coût prévu`);
      }

      marginAnalysis = {
        expectedCost,
        actualCost,
        difference,
        differencePercent,
        status,
      };
    } else {
      alerts.push('Aucun document de coût correspondant trouvé');
    }

    // Additional checks
    if (!invoiceData.invoiceNumber) {
      alerts.push('Numéro de facture manquant');
    }
    if (!invoiceData.totalHT || invoiceData.totalHT <= 0) {
      alerts.push('Montant HT invalide ou manquant');
    }

    setVerificationResult({
      invoice: invoiceData,
      matchedCostDoc: matchedDoc,
      marginAnalysis,
      alerts,
    });

    toast({
      title: 'Vérification terminée',
      description: alerts.length > 0 
        ? `${alerts.length} alerte(s) détectée(s)`
        : 'Aucune anomalie détectée',
      variant: alerts.length > 0 ? 'destructive' : 'default',
    });
  }, [manualInvoiceNumber, manualTotalHT, manualTotalTVA, manualSupplier, manualDate, costDocs, toast]);

  const resetForm = () => {
    setCurrentFile(null);
    setExtractedData(null);
    setVerificationResult(null);
    setManualInvoiceNumber('');
    setManualTotalHT('');
    setManualTotalTVA('');
    setManualSupplier('');
    setManualDate('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

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
            Importez une facture PDF pour vérifier la marge et détecter les anomalies
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
                <CardDescription>
                  Sélectionnez un fichier PDF pour extraire les données
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    {currentFile ? (
                      <p className="text-sm font-medium text-foreground">{currentFile.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Cliquez ou glissez un fichier PDF ici
                      </p>
                    )}
                  </label>
                </div>

                {currentFile && !extractedData && (
                  <Button 
                    onClick={simulateExtraction} 
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? 'Extraction en cours...' : 'Extraire les données'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Manual Input / Correction */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Données facture</CardTitle>
                <CardDescription>
                  {extractedData 
                    ? 'Vérifiez et corrigez les données extraites'
                    : 'Ou saisissez manuellement les informations'
                  }
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
                    <Input
                      id="invoiceDate"
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                    />
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
                  <Card className={
                    verificationResult.marginAnalysis.status === 'ok' 
                      ? 'border-status-ok/50' 
                      : verificationResult.marginAnalysis.status === 'warning'
                        ? 'border-status-warning/50'
                        : 'border-status-risk/50'
                  }>
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
                          {verificationResult.marginAnalysis.status === 'ok' ? 'OK' : 
                           verificationResult.marginAnalysis.status === 'warning' ? 'Attention' : 'Alerte'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Coût prévu</p>
                          <p className="text-xl font-bold">
                            {formatCurrency(verificationResult.marginAnalysis.expectedCost)}
                          </p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Coût réel (facture)</p>
                          <p className="text-xl font-bold">
                            {formatCurrency(verificationResult.marginAnalysis.actualCost)}
                          </p>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg flex items-center justify-between ${
                        verificationResult.marginAnalysis.difference > 0 
                          ? 'bg-status-risk/10' 
                          : 'bg-status-ok/10'
                      }`}>
                        <div className="flex items-center gap-2">
                          {verificationResult.marginAnalysis.difference > 0 ? (
                            <TrendingDown className="h-5 w-5 text-status-risk" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-status-ok" />
                          )}
                          <span className="font-medium">Écart</span>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            verificationResult.marginAnalysis.difference > 0 
                              ? 'text-status-risk' 
                              : 'text-status-ok'
                          }`}>
                            {verificationResult.marginAnalysis.difference > 0 ? '+' : ''}
                            {formatCurrency(verificationResult.marginAnalysis.difference)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {verificationResult.marginAnalysis.differencePercent > 0 ? '+' : ''}
                            {verificationResult.marginAnalysis.differencePercent.toFixed(1)}%
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

                {/* Matched Document */}
                {verificationResult.matchedCostDoc && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Document de coût associé
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">N° Document</span>
                          <span className="font-medium">{verificationResult.matchedCostDoc.docNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fournisseur</span>
                          <span className="font-medium">{verificationResult.matchedCostDoc.supplier || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Lignes</span>
                          <span className="font-medium">{verificationResult.matchedCostDoc.lines.length}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-medium">
                          <span>Total</span>
                          <span>
                            {formatCurrency(
                              verificationResult.matchedCostDoc.lines.reduce((sum, l) => sum + (l.amount || 0), 0)
                            )}
                          </span>
                        </div>
                      </div>
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
                <p className="text-sm text-muted-foreground">Documents de coûts</p>
                <p className="text-xl font-bold">{costDocs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Euro className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Factures Sage</p>
                <p className="text-xl font-bold">{sageInvoices.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-ok/10">
                <Percent className="h-5 w-5 text-status-ok" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taux de rapprochement</p>
                <p className="text-xl font-bold">
                  {sageInvoices.length > 0 
                    ? `${Math.round((costDocs.length / sageInvoices.length) * 100)}%`
                    : '-'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
