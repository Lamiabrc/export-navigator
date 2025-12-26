import { useCallback, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
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
  RotateCcw,
  Calculator,
  MapPin,
  Truck,
  Info,
} from "lucide-react";
import { extractInvoiceFromPdf } from "@/lib/pdf/extractInvoice";
import { useInvoiceTracker } from "@/hooks/useInvoiceTracker";

import { calculateCosts, type ProductType, type CostBreakdown } from "@/utils/costCalculator";
import { getZoneFromDestination } from "@/data/referenceRates";
import { useReferenceRates } from "@/hooks/useReferenceRates";
import type { Destination, Incoterm, TransportMode } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  costBreakdown?: CostBreakdown | null;
  analysis?: {
    transitEstimatedHT: number;
    transitActualHT: number;
    transitDeltaHT: number;
    transitDeltaPercent: number;
    supplierChargesHT: number;
    taxesNonRecup: number;
    status: "ok" | "warning" | "error";
  };
  alerts: string[];
}

const destinations: Destination[] = [
  "Guadeloupe",
  "Martinique",
  "Guyane",
  "Reunion",
  "Mayotte",
  "Belgique",
  "Espagne",
  "Luxembourg",
  "Suisse",
];

const incoterms: Incoterm[] = ["EXW", "FCA", "DAP", "DDP"];
const transportModes: TransportMode[] = ["Routier", "Maritime", "Aerien", "Express", "Ferroviaire"];

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function InvoiceVerification() {
  const { toast } = useToast();
  const { upsert, items } = useInvoiceTracker();

  const { vatRates, octroiMerRates, transportCosts, serviceCharges } = useReferenceRates();

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  // Manual input fields for extracted data
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState("");
  const [manualTotalHT, setManualTotalHT] = useState("");
  const [manualTotalTVA, setManualTotalTVA] = useState("");
  const [manualTransit, setManualTransit] = useState("");
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualDate, setManualDate] = useState("");

  // ✅ Contexte export
  const [destination, setDestination] = useState<Destination>("Martinique");
  const [incoterm, setIncoterm] = useState<Incoterm>("DAP");
  const [transportMode, setTransportMode] = useState<TransportMode>("Maritime");
  const [productType, setProductType] = useState<ProductType>("lppr");
  const [weightKg, setWeightKg] = useState<number>(10);
  const [margin, setMargin] = useState<number>(25);

  const zone = getZoneFromDestination(destination);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setCurrentFile(file);
      setExtractedData(null);
      setVerificationResult(null);

      setManualInvoiceNumber("");
      setManualTotalHT("");
      setManualTotalTVA("");
      setManualTransit("");
      setManualSupplier("");
      setManualDate("");
    } else {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier PDF",
        variant: "destructive",
      });
    }
  };

  const runExtraction = useCallback(async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    try {
      const parsed = await extractInvoiceFromPdf(currentFile);
      const totalTVA =
        parsed.totalTTC !== null && parsed.totalHT !== null ? parsed.totalTTC - parsed.totalHT : null;

      const extracted: ExtractedInvoice = {
        invoiceNumber: parsed.invoiceNumber || "",
        invoiceDate: parsed.date || "",
        supplierName: parsed.supplier || "",
        totalHT: parsed.totalHT ?? undefined,
        totalTVA: totalTVA ?? undefined,
        totalTTC: parsed.totalTTC ?? undefined,
        transitFees: parsed.transitFees ?? undefined,
      };

      setExtractedData(extracted);
      setManualInvoiceNumber(extracted.invoiceNumber || "");
      setManualTotalHT(extracted.totalHT?.toString() || "");
      setManualTotalTVA(extracted.totalTVA?.toString() || "");
      setManualTransit(extracted.transitFees?.toString() || "");
      setManualSupplier(extracted.supplierName || "");
      setManualDate(extracted.invoiceDate || "");

      toast({ title: "Extraction effectuée", description: "Vérifiez/corrigez puis lancez le contrôle." });
    } catch (err) {
      toast({
        title: "Extraction impossible",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [currentFile, toast]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
      Number.isFinite(amount) ? amount : 0,
    );

  // ✅ Calcul attendu (à partir des tables référence)
  const expectedBreakdown = useMemo<CostBreakdown | null>(() => {
    const ht = safeNumber(manualTotalHT);
    if (ht <= 0) return null;

    return calculateCosts({
      goodsValue: ht,
      destination,
      incoterm,
      productType,
      transportMode,
      weight: safeNumber(weightKg),
      margin: safeNumber(margin),
      customRates: { vatRates, octroiMerRates, transportCosts, serviceCharges },
    });
  }, [
    manualTotalHT,
    destination,
    incoterm,
    productType,
    transportMode,
    weightKg,
    margin,
    vatRates,
    octroiMerRates,
    transportCosts,
    serviceCharges,
  ]);

  const verifyInvoice = useCallback(() => {
    const ht = safeNumber(manualTotalHT);
    const tva = safeNumber(manualTotalTVA);
    const transit = safeNumber(manualTransit);
    const ttc = ht + tva;

    const invoiceData: ExtractedInvoice = {
      invoiceNumber: manualInvoiceNumber.trim(),
      invoiceDate: manualDate,
      supplierName: manualSupplier.trim(),
      totalHT: ht,
      totalTVA: tva,
      totalTTC: ttc,
      transitFees: transit,
    };

    const alerts: string[] = [];

    // Champs clés
    if (!invoiceData.invoiceNumber) alerts.push("Numéro de facture manquant (clé unique)");
    if (!invoiceData.totalHT || invoiceData.totalHT <= 0) alerts.push("Montant HT invalide ou manquant");
    if (!invoiceData.totalTTC || invoiceData.totalTTC <= 0) alerts.push("Montant TTC invalide (calculé HT + TVA)");

    // Cohérence incoterm vs transit
    if (incoterm === "EXW" && transit > 0) alerts.push("Incoterm EXW : transit côté fournisseur devrait être ~0");
    if (incoterm === "FCA" && transit > 0) alerts.push("Incoterm FCA : transit fournisseur souvent limité (à confirmer)");

    // Comparaison vs attendu
    const bd = expectedBreakdown;
    let transitEstimatedHT = 0;
    let supplierChargesHT = 0;
    let taxesNonRecup = 0;

    if (bd) {
      // “Transit estimé” = prestations payées par fournisseur (transport + services)
      transitEstimatedHT = bd.lines
        .filter((l) => l.category === "prestation" && l.payer === "Fournisseur")
        .reduce((s, l) => s + safeNumber(l.amount), 0);

      supplierChargesHT = safeNumber(bd.totalFournisseur);
      taxesNonRecup = safeNumber(bd.totalTaxesNonRecuperables);

      // Delta transit
      const delta = transit - transitEstimatedHT;
      const denom = Math.max(1, transitEstimatedHT);
      const deltaPct = (delta / denom) * 100;

      const toleranceEuro = Math.max(50, 0.15 * denom); // 50€ ou 15%
      if (Math.abs(delta) > toleranceEuro) {
        alerts.push(
          `Transit incohérent vs estimation: écart ${formatCurrency(delta)} (${deltaPct.toFixed(1)}%)`,
        );
      }

      // DROM : si DDP + taxes attendues > 0 mais rien n’apparaît côté facture, on alerte
      if (zone === "DROM" && incoterm === "DDP" && taxesNonRecup > 0) {
        alerts.push("DROM + DDP : Octroi de mer/Taxes à intégrer (selon HS code / règles)");
      }
    } else {
      alerts.push("Impossible de calculer l’attendu (HT manquant ou invalide).");
    }

    // Statut global
    let status: "ok" | "warning" | "error" = "ok";
    if (alerts.length >= 3) status = "error";
    else if (alerts.length > 0) status = "warning";

    setVerificationResult({
      invoice: invoiceData,
      costBreakdown: bd,
      analysis: {
        transitEstimatedHT,
        transitActualHT: transit,
        transitDeltaHT: transit - transitEstimatedHT,
        transitDeltaPercent: transitEstimatedHT > 0 ? ((transit - transitEstimatedHT) / transitEstimatedHT) * 100 : 0,
        supplierChargesHT,
        taxesNonRecup,
        status,
      },
      alerts,
    });

    // tracking (local) — garde ton modèle actuel
    if (invoiceData.invoiceNumber) {
      const marginAmount = invoiceData.totalHT - (invoiceData.transitFees || 0);
      const marginPercent = invoiceData.totalHT > 0 ? (marginAmount / invoiceData.totalHT) * 100 : 0;

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
      title: "Contrôle terminé",
      description: alerts.length > 0 ? `${alerts.length} alerte(s)` : "Aucune anomalie détectée",
      variant: alerts.length > 0 ? "destructive" : "default",
    });
  }, [
    manualTotalHT,
    manualTotalTVA,
    manualTransit,
    manualInvoiceNumber,
    manualDate,
    manualSupplier,
    currentFile,
    upsert,
    toast,
    expectedBreakdown,
    destination,
    incoterm,
    productType,
    transportMode,
    zone,
    weightKg,
    margin,
  ]);

  const resetForm = () => {
    setCurrentFile(null);
    setExtractedData(null);
    setVerificationResult(null);

    setManualInvoiceNumber("");
    setManualTotalHT("");
    setManualTotalTVA("");
    setManualTransit("");
    setManualSupplier("");
    setManualDate("");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Contrôle facture (PDF)
          </h1>
          <p className="mt-1 text-muted-foreground">
            Extraction + contrôle “export réel” (destination / incoterm / transit / taxes)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left */}
          <div className="space-y-6">
            {/* Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import facture PDF
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
                      <p className="text-sm text-muted-foreground">Cliquez ou glissez un PDF ici</p>
                    )}
                  </label>
                </div>

                {currentFile && (
                  <Button onClick={runExtraction} disabled={isProcessing} className="w-full">
                    {isProcessing ? "Extraction en cours..." : "Analyser le PDF"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Contexte export */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Contexte export (pour le calcul attendu)
                </CardTitle>
                <CardDescription>Ces champs rendent le contrôle pertinent (zone / incoterm / taxes)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Destination
                    </Label>
                    <Select value={destination} onValueChange={(v) => setDestination(v as Destination)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {destinations.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Badge variant={zone === "UE" ? "default" : zone === "DROM" ? "secondary" : "outline"}>
                        Zone {zone}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Incoterm</Label>
                    <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {incoterms.map((i) => (
                          <SelectItem key={i} value={i}>{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {incoterm === "EXW" && "Client assume tous les frais"}
                      {incoterm === "FCA" && "Fournisseur gère la remise transporteur"}
                      {incoterm === "DAP" && "Fournisseur livre, client gère import"}
                      {incoterm === "DDP" && "Fournisseur assume tout"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Transport
                    </Label>
                    <Select value={transportMode} onValueChange={(v) => setTransportMode(v as TransportMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {transportModes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Type produit (taxes)</Label>
                    <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lppr">LPPR</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Poids (kg)</Label>
                    <Input type="number" min="0" step="0.1" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Marge cible (%)</Label>
                    <Input type="number" min="0" max="100" value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5" />
                  Le calcul attendu se base sur tes tables de référence (TVA, OM, transport, services). Pour OM par HS code,
                  on branchera ensuite sur le catalogue HS.
                </p>
              </CardContent>
            </Card>

            {/* Données facture */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Données facture</CardTitle>
                <CardDescription>Vérifie/corrige les montants extraits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">N° Facture</Label>
                    <Input id="invoiceNumber" value={manualInvoiceNumber} onChange={(e) => setManualInvoiceNumber(e.target.value)} placeholder="FAC-XXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceDate">Date</Label>
                    <Input id="invoiceDate" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Fournisseur</Label>
                  <Input id="supplier" value={manualSupplier} onChange={(e) => setManualSupplier(e.target.value)} placeholder="Nom du fournisseur" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalHT">Total HT (€)</Label>
                    <Input id="totalHT" type="number" step="0.01" value={manualTotalHT} onChange={(e) => setManualTotalHT(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalTVA">TVA (€)</Label>
                    <Input id="totalTVA" type="number" step="0.01" value={manualTotalTVA} onChange={(e) => setManualTotalTVA(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transit">Transit / transport facturé (€)</Label>
                  <Input id="transit" type="number" step="0.01" value={manualTransit} onChange={(e) => setManualTransit(e.target.value)} placeholder="0.00" />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button onClick={verifyInvoice} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Lancer le contrôle
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right */}
          <div className="space-y-6">
            {verificationResult ? (
              <>
                {/* Résultat principal */}
                {verificationResult.analysis && (
                  <Card
                    className={
                      verificationResult.analysis.status === "ok"
                        ? "border-status-ok/50"
                        : verificationResult.analysis.status === "warning"
                        ? "border-status-warning/50"
                        : "border-status-risk/50"
                    }
                  >
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Contrôle transit & charges
                        <Badge
                          variant={verificationResult.analysis.status === "ok" ? "default" : "destructive"}
                          className={
                            verificationResult.analysis.status === "ok"
                              ? "bg-status-ok text-white"
                              : verificationResult.analysis.status === "warning"
                              ? "bg-status-warning text-white"
                              : "bg-status-risk text-white"
                          }
                        >
                          {verificationResult.analysis.status === "ok"
                            ? "OK"
                            : verificationResult.analysis.status === "warning"
                            ? "Attention"
                            : "Alerte"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Destination {destination} • Incoterm {incoterm} • {transportMode} • Zone {zone}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Transit facturé</p>
                          <p className="text-xl font-bold">{formatCurrency(verificationResult.analysis.transitActualHT)}</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Transit estimé (référence)</p>
                          <p className="text-xl font-bold">{formatCurrency(verificationResult.analysis.transitEstimatedHT)}</p>
                        </div>
                      </div>

                      <div
                        className={`p-4 rounded-lg flex items-center justify-between ${
                          Math.abs(verificationResult.analysis.transitDeltaHT) > Math.max(50, 0.15 * Math.max(1, verificationResult.analysis.transitEstimatedHT))
                            ? "bg-status-warning/10"
                            : "bg-status-ok/10"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {verificationResult.analysis.transitDeltaHT < 0 ? (
                            <TrendingDown className="h-5 w-5 text-status-ok" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-status-warning" />
                          )}
                          <span className="font-medium">Écart transit</span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {verificationResult.analysis.transitDeltaHT >= 0 ? "+" : ""}
                            {formatCurrency(verificationResult.analysis.transitDeltaHT)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {verificationResult.analysis.transitDeltaPercent >= 0 ? "+" : ""}
                            {verificationResult.analysis.transitDeltaPercent.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Charges fournisseur estimées</p>
                          <p className="text-lg font-bold">{formatCurrency(verificationResult.analysis.supplierChargesHT)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-[hsl(var(--status-risk))]/5">
                          <p className="text-xs text-muted-foreground">Taxes non récup (estim.)</p>
                          <p className="text-lg font-bold text-[hsl(var(--status-risk))]">
                            {formatCurrency(verificationResult.analysis.taxesNonRecup)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alertes */}
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

                {/* Récap facture */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Récapitulatif facture</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">N° Facture</span>
                        <span className="font-medium">{verificationResult.invoice.invoiceNumber || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fournisseur</span>
                        <span className="font-medium">{verificationResult.invoice.supplierName || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">{verificationResult.invoice.invoiceDate || "-"}</span>
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
                        <span className="font-medium">{formatCurrency(verificationResult.invoice.transitFees || 0)}</span>
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
                    Importez un PDF (ou saisissez) puis lancez le contrôle.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Stats tracker */}
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
                <p className="text-sm text-muted-foreground">Marge moyenne (HT - transit)</p>
                <p className="text-xl font-bold">
                  {items.length
                    ? `${(items.reduce((s, i) => s + (i.marginPercent || 0), 0) / items.length).toFixed(1)}%`
                    : "-"}
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
                <p className="text-sm text-muted-foreground">Transit moyen</p>
                <p className="text-xl font-bold">
                  {items.length
                    ? `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                        items.reduce((s, i) => s + (i.transitFees || 0), 0) / items.length || 0,
                      )}`
                    : "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
