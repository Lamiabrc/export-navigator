import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  FileSearch,
  FileText,
  Upload,
  MapPin,
  Scale,
  Truck,
  TrendingDown,
  TrendingUp,
  Euro,
  Percent,
  RotateCcw,
  Info,
} from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getZoneFromDestination } from "@/data/referenceRates";
import type { Destination, Incoterm, TransportMode } from "@/types";

import { extractInvoiceFromPdf, type ParsedInvoice, type ParsedInvoiceLineItem } from "@/lib/pdf/extractInvoice";
import { supabase } from "@/integrations/supabase/client";
import { useInvoiceTracker } from "@/hooks/useInvoiceTracker";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

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

type TerritoryCode = "GP" | "MQ" | "GF" | "RE" | "YT";

type OmRateRow = {
  hs4: string;
  om_rate: number | null;
  omr_rate: number | null;
  year: number | null;
};

type OmComputedLine = {
  key: string;
  description: string;
  hsCode: string;
  hs4: string;
  baseHT: number;
  omRateRaw: number;
  omRateFraction: number;
  omAmount: number;
};

type Verdict = "favorable" | "defavorable" | "na";

type VerificationResult = {
  invoice: ParsedInvoice;
  destination: Destination;
  zone: string;
  territory: TerritoryCode | null;

  transit: number | null;
  omTotal: number | null;
  verdict: Verdict;

  alerts: string[];
};

function safeNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(amount) ? amount : 0);
}

function normalizeRateToFraction(rate: number) {
  if (!Number.isFinite(rate)) return 0;
  // si la source fournit 12.5 => 0.125
  if (rate > 1) return rate / 100;
  return rate; // déjà en fraction
}

function formatRatePercent(rateRaw: number) {
  const frac = normalizeRateToFraction(rateRaw);
  return `${(frac * 100).toFixed(2)}%`;
}

function getTerritoryCodeFromDestination(dest: Destination): TerritoryCode | null {
  if (dest === "Guadeloupe") return "GP";
  if (dest === "Martinique") return "MQ";
  if (dest === "Guyane") return "GF";
  if (dest === "Reunion") return "RE";
  if (dest === "Mayotte") return "YT";
  return null;
}

function detectDestinationFromText(text: string): Destination | null {
  const t = (text || "").toUpperCase();

  const m = t.match(/97(1|2|3|4|6)\d{2}/);
  if (m) {
    const prefix = m[0].slice(0, 3);
    if (prefix === "971") return "Guadeloupe";
    if (prefix === "972") return "Martinique";
    if (prefix === "973") return "Guyane";
    if (prefix === "974") return "Reunion";
    if (prefix === "976") return "Mayotte";
  }

  if (t.includes("GUADELOUPE")) return "Guadeloupe";
  if (t.includes("MARTINIQUE") || t.includes("LE LAMENTIN")) return "Martinique";
  if (t.includes("GUYANE")) return "Guyane";
  if (t.includes("RÉUNION") || t.includes("REUNION")) return "Reunion";
  if (t.includes("MAYOTTE")) return "Mayotte";

  return null;
}

function isShippingLike(desc: string) {
  const d = (desc || "").toLowerCase();
  return /(transport|transit|livraison|exp[ée]dition|shipping|fret|affranchissement|port)\b/.test(d);
}

async function parseCsvInvoice(file: File): Promise<ParsedInvoice> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const delimiter = (() => {
    const s = lines.slice(0, 10).join("\n");
    const semis = (s.match(/;/g) || []).length;
    const commas = (s.match(/,/g) || []).length;
    const tabs = (s.match(/\t/g) || []).length;
    if (tabs > semis && tabs > commas) return "\t";
    if (semis >= commas) return ";";
    return ",";
  })();

  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const idx = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));

  const iDesc = idx(["description", "désignation", "designation", "libelle", "libellé", "article"]);
  const iHs = idx(["hs", "taric", "nc"]);
  const iQty = idx(["qte", "qté", "quantite", "quantité", "qty"]);
  const iHt = idx(["total ht", "montant ht", "ht"]);

  const items: ParsedInvoiceLineItem[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(delimiter);
    const desc = iDesc >= 0 ? (cols[iDesc] || "").trim() : "";
    const hs = iHs >= 0 ? (cols[iHs] || "").trim().replace(/[^\d]/g, "") : "";
    const qty = iQty >= 0 ? Number(String(cols[iQty] || "").replace(",", ".")) : null;
    const ht = iHt >= 0 ? Number(String(cols[iHt] || "").replace(/\s/g, "").replace(",", ".")) : null;

    if (!desc && !hs) continue;

    items.push({
      description: desc || undefined,
      hsCode: hs || null,
      quantity: Number.isFinite(qty as number) ? (qty as number) : null,
      amountHT: Number.isFinite(ht as number) ? (ht as number) : null,
    });
  }

  const goodsSum = items.filter((it) => !isShippingLike(it.description || "")).reduce((s, it) => s + safeNum(it.amountHT), 0);
  const transit = items.filter((it) => isShippingLike(it.description || "")).reduce((s, it) => s + safeNum(it.amountHT), 0);

  return {
    invoiceNumber: null,
    supplier: null,
    date: null,
    totalHT: goodsSum > 0 ? goodsSum : null,
    totalTVA: null,
    totalTTC: null,
    transitFees: transit > 0 ? transit : null,
    billingCountry: null,
    vatExemptionMention: null,
    lineItems: items,
    rawText: text,
    transitDetectionSource: transit > 0 ? "line_items" : "none",
  };
}

export default function InvoiceVerification() {
  const { toast } = useToast();
  const { upsert, items: trackedItems } = useInvoiceTracker();

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);

  // Contexte (auto si possible)
  const [destination, setDestination] = useState<Destination>("Martinique");
  const [incoterm, setIncoterm] = useState<Incoterm>("DAP");
  const [transportMode, setTransportMode] = useState<TransportMode>("Maritime");

  const [omLines, setOmLines] = useState<OmComputedLine[]>([]);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const zone = getZoneFromDestination(destination);
  const territory = useMemo(() => getTerritoryCodeFromDestination(destination), [destination]);

  const reset = () => {
    setCurrentFile(null);
    setIsProcessing(false);
    setParsed(null);
    setOmLines([]);
    setResult(null);
    setDestination("Martinique");
    setIncoterm("DAP");
    setTransportMode("Maritime");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

    if (!isPdf && !isCsv) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier PDF ou CSV",
        variant: "destructive",
      });
      return;
    }

    setCurrentFile(file);
    setParsed(null);
    setOmLines([]);
    setResult(null);
  };

  const analyzeFile = useCallback(async () => {
    if (!currentFile) return;

    setIsProcessing(true);
    try {
      const isPdf = currentFile.type === "application/pdf" || currentFile.name.toLowerCase().endsWith(".pdf");
      const invoice = isPdf ? await extractInvoiceFromPdf(currentFile) : await parseCsvInvoice(currentFile);

      setParsed(invoice);

      // auto-destination si DOM détectable
      const autoDest = detectDestinationFromText(invoice.rawText);
      if (autoDest) setDestination(autoDest);

      toast({ title: "Analyse terminée", description: "Lignes + totaux détectés. Lance le contrôle." });
    } catch (err) {
      toast({
        title: "Analyse impossible",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [currentFile, toast]);

  const hs4List = useMemo(() => {
    if (!parsed) return [];
    const set = new Set<string>();
    for (const li of parsed.lineItems || []) {
      const hs = (li.hsCode || "").replace(/[^\d]/g, "");
      if (hs.length >= 4) set.add(hs.slice(0, 4));
    }
    return Array.from(set);
  }, [parsed]);

  async function fetchOmRates(territoryCode: TerritoryCode, hs4s: string[]) {
    if (!hs4s.length) return new Map<string, OmRateRow>();

    const { data, error } = await supabase
      .from("om_rates")
      .select("hs4, om_rate, omr_rate, year")
      .eq("territory_code", territoryCode)
      .in("hs4", hs4s);

    if (error) throw error;

    const byHs4 = new Map<string, OmRateRow>();
    for (const r of (data || []) as OmRateRow[]) {
      const key = String(r.hs4 || "").trim();
      if (!key) continue;
      const cur = byHs4.get(key);
      const y = r.year ?? 0;
      const cy = cur?.year ?? 0;
      if (!cur || y >= cy) byHs4.set(key, r);
    }
    return byHs4;
  }

  const buildOmLines = useCallback(async (inv: ParsedInvoice, dest: Destination) => {
    const terr = getTerritoryCodeFromDestination(dest);
    const z = getZoneFromDestination(dest);

    if (!terr || z !== "DROM") {
      setOmLines([]);
      return [];
    }

    const hs4s = Array.from(
      new Set(
        (inv.lineItems || [])
          .map((l) => String(l.hsCode || "").replace(/[^\d]/g, ""))
          .filter((hs) => hs.length >= 4)
          .map((hs) => hs.slice(0, 4)),
      ),
    );

    const ratesByHs4 = await fetchOmRates(terr, hs4s);

    const computed: OmComputedLine[] = [];

    for (const li of inv.lineItems || []) {
      const desc = (li.description || "").trim();
      const base = safeNum(li.amountHT);
      if (base <= 0) continue;
      if (isShippingLike(desc)) continue;

      const hs = String(li.hsCode || "").replace(/[^\d]/g, "");
      if (hs.length < 4) continue;

      const hs4 = hs.slice(0, 4);
      const rateRow = ratesByHs4.get(hs4);
      const rateRaw = safeNum(rateRow?.om_rate ?? 0);
      const rateFrac = normalizeRateToFraction(rateRaw);

      const om = base * rateFrac;

      computed.push({
        key: `${hs}-${desc}-${base}`,
        description: desc || "(ligne produit)",
        hsCode: hs,
        hs4,
        baseHT: base,
        omRateRaw: rateRaw,
        omRateFraction: rateFrac,
        omAmount: om,
      });
    }

    setOmLines(computed);
    return computed;
  }, []);

  const runVerification = useCallback(async () => {
    if (!parsed) return;

    const alerts: string[] = [];
    const z = getZoneFromDestination(destination);
    const terr = getTerritoryCodeFromDestination(destination);

    // ✅ TVA / exonération
    const billingCountry = parsed.billingCountry;
    const tva = safeNum(parsed.totalTVA);
    const hasMention = !!parsed.vatExemptionMention;

    if (billingCountry && billingCountry !== "France") {
      if (tva > 0.01) alerts.push(`Facturation ${billingCountry} : TVA présente (${formatCurrency(tva)}) alors qu’attendu = TVA absente.`);
      if (!hasMention) alerts.push(`Facturation ${billingCountry} : mention d’exonération/autoliquidation absente (attendue).`);
    }

    if (billingCountry === "France") {
      if (tva <= 0.01 && !hasMention) {
        alerts.push("Facturation France : TVA absente sans mention d’exonération/autoliquidation.");
      }
    }

    // ✅ Transit
    const transit = parsed.transitFees;
    if (transit === null || transit <= 0) {
      alerts.push("Frais de transit / transport non détectés sur la facture (vérifier le PDF ou la mise en page).");
    }

    // ✅ OM théorique
    let omTotal: number | null = null;

    if (z === "DROM" && terr) {
      const computed = await buildOmLines(parsed, destination);
      const total = computed.reduce((s, l) => s + safeNum(l.omAmount), 0);
      omTotal = total > 0 ? total : 0;
      if (!computed.length) alerts.push("Aucune ligne produit avec HS code exploitable pour calculer l’OM.");
    } else {
      omTotal = 0;
    }

    // ✅ Verdict OM vs Transit
    let verdict: Verdict = "na";
    if (omTotal !== null && transit !== null && transit > 0) {
      verdict = omTotal < transit ? "defavorable" : "favorable";
      if (verdict === "defavorable") {
        alerts.push(`Facture défavorable : OM théorique (${formatCurrency(omTotal)}) < transit facturé (${formatCurrency(transit)}).`);
      }
    }

    const vr: VerificationResult = {
      invoice: parsed,
      destination,
      zone: z,
      territory: terr,
      transit: transit ?? null,
      omTotal,
      verdict,
      alerts,
    };

    setResult(vr);

    // tracking (local)
    if (parsed.invoiceNumber) {
      const totalHT = safeNum(parsed.totalHT);
      const transitFees = safeNum(parsed.transitFees);
      const marginAmount = totalHT - transitFees;
      const marginPercent = totalHT > 0 ? (marginAmount / totalHT) * 100 : 0;

      upsert({
        invoiceNumber: parsed.invoiceNumber,
        supplier: parsed.supplier || "",
        date: parsed.date || "",
        totalHT,
        totalTTC: safeNum(parsed.totalTTC),
        transitFees: parsed.transitFees ?? null,
        marginAmount,
        marginPercent,
        filename: currentFile?.name,
        analyzedAt: new Date().toISOString(),
      });
    }

    toast({
      title: "Contrôle terminé",
      description: alerts.length ? `${alerts.length} alerte(s)` : "Aucune anomalie détectée",
      variant: alerts.length ? "destructive" : "default",
    });
  }, [parsed, destination, buildOmLines, toast, upsert, currentFile]);

  useEffect(() => {
    setOmLines([]);
    setResult(null);
  }, [destination]);

  const verdictUi = useMemo(() => {
    if (!result) return { label: "N/A", badge: "outline" as const, border: "border-border" };
    if (result.verdict === "favorable") return { label: "Favorable", badge: "default" as const, border: "border-status-ok/50" };
    if (result.verdict === "defavorable") return { label: "Défavorable", badge: "destructive" as const, border: "border-status-risk/50" };
    return { label: "N/A", badge: "outline" as const, border: "border-border" };
  }, [result]);

  // ====== Détails calcul OM ======
  const omStats = useMemo(() => {
    const baseTotal = omLines.reduce((s, l) => s + safeNum(l.baseHT), 0);
    const omTotal = omLines.reduce((s, l) => s + safeNum(l.omAmount), 0);
    const nb = omLines.length;
    const avgRate = baseTotal > 0 ? omTotal / baseTotal : 0; // fraction
    return { baseTotal, omTotal, nb, avgRate };
  }, [omLines]);

  const comparison = useMemo(() => {
    const transit = safeNum(result?.transit);
    const om = safeNum(result?.omTotal);
    const delta = transit - om; // positif => transit > om
    const ratio = om > 0 ? transit / om : null;
    const deltaPct = om > 0 ? (delta / om) * 100 : null;
    return { transit, om, delta, ratio, deltaPct };
  }, [result]);

  // Chart: OM vs Transit
  const barData = useMemo(() => {
    if (!result) return [];
    return [
      { name: "Transit", value: safeNum(result.transit) },
      { name: "OM théorique", value: safeNum(result.omTotal) },
    ];
  }, [result]);

  // Chart: OM par HS4 (top 6)
  const omByHs4 = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of omLines) {
      map.set(l.hs4, (map.get(l.hs4) || 0) + safeNum(l.omAmount));
    }
    const arr = Array.from(map.entries())
      .map(([hs4, value]) => ({ hs4, value }))
      .sort((a, b) => b.value - a.value);

    const top = arr.slice(0, 6);
    const rest = arr.slice(6).reduce((s, x) => s + x.value, 0);
    if (rest > 0) top.push({ hs4: "Autres", value: rest });
    return top;
  }, [omLines]);

  const pieColors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--muted-foreground))",
    "hsl(var(--secondary))",
    "hsl(var(--ring))",
    "hsl(var(--foreground))",
    "hsl(var(--border))",
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Vérification facture (PDF / CSV)
          </h1>
          <p className="mt-1 text-muted-foreground">
            Détection lignes produits + HS • OM théorique vs transit • Contrôle TVA (pays facturation)
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
                  Import facture (PDF ou CSV)
                </CardTitle>
                <CardDescription>Analyse automatique : lignes produits + montants + HS (si possible)</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <Input
                    type="file"
                    accept="application/pdf,text/csv,.pdf,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="invoice-file"
                  />
                  <label htmlFor="invoice-file" className="cursor-pointer">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    {currentFile ? (
                      <p className="text-sm font-medium text-foreground">{currentFile.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Cliquez ou glissez un PDF/CSV ici</p>
                    )}
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button onClick={analyzeFile} disabled={!currentFile || isProcessing} className="w-full">
                    {isProcessing ? "Analyse en cours..." : "Analyser le fichier"}
                  </Button>
                  <Button onClick={runVerification} disabled={!parsed || isProcessing} className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Lancer le contrôle
                  </Button>
                  <Button variant="outline" onClick={reset} className="w-full">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Réinitialiser
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5" />
                  Aucun champ manuel : tout vient du PDF/CSV. Tu peux uniquement ajuster le contexte (destination/incoterm/transport) si besoin.
                </p>
              </CardContent>
            </Card>

            {/* Contexte */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Contexte (si détection incertaine)
                </CardTitle>
                <CardDescription>La destination impacte l’OM. Par défaut, on tente de la déduire du PDF (ex: 972xx = Martinique).</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                        {destinations.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                      <Badge variant={zone === "UE" ? "default" : zone === "DROM" ? "secondary" : "outline"}>
                        Zone {zone}
                      </Badge>
                      {territory && <Badge variant="outline">Territory {territory}</Badge>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Transport
                    </Label>
                    <Select value={transportMode} onValueChange={(v) => setTransportMode(v as TransportMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {transportModes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Label className="mt-3 block">Incoterm</Label>
                    <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {incoterms.map((i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Données détectées */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Données détectées
                </CardTitle>
                <CardDescription>Lecture seule depuis le PDF/CSV (aucune saisie manuelle)</CardDescription>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                {!parsed ? (
                  <p className="text-muted-foreground">Analyse un fichier pour voir les champs détectés.</p>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Facture</span>
                      <span className="font-medium">{parsed.invoiceNumber || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fournisseur</span>
                      <span className="font-medium">{parsed.supplier || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{parsed.date || "-"}</span>
                    </div>

                    <Separator className="my-2" />

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total HT</span>
                      <span className="font-medium">{formatCurrency(safeNum(parsed.totalHT))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TVA</span>
                      <span className="font-medium">{formatCurrency(safeNum(parsed.totalTVA))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transit</span>
                      <span className="font-medium">{parsed.transitFees ? formatCurrency(parsed.transitFees) : formatCurrency(0)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-base">
                      <span>Total TTC</span>
                      <span>{formatCurrency(safeNum(parsed.totalTTC))}</span>
                    </div>

                    <Separator className="my-2" />

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pays facturation (détecté)</span>
                      <span className="font-medium">{parsed.billingCountry || "-"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Mention :</span> {parsed.vatExemptionMention || "-"}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Source transit :</span> {parsed.transitDetectionSource || "none"}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Lignes détectées :</span> {(parsed.lineItems || []).length}
                      {hs4List.length ? ` • HS4 distincts : ${hs4List.length}` : ""}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right */}
          <div className="space-y-6">
            {!result ? (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center">
                  <FileSearch className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Analyse un fichier puis lance le contrôle.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Alertes */}
                {result.alerts.length > 0 && (
                  <Card className="border-status-warning/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-status-warning" />
                        Alertes ({result.alerts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.alerts.map((a, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-status-risk mt-0.5 shrink-0" />
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* OM vs Transit (résumé) */}
                <Card className={verdictUi.border}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Scale className="h-5 w-5" />
                      OM théorique vs Transit
                      <Badge variant={verdictUi.badge}>{verdictUi.label}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Destination {result.destination} • Zone {result.zone} • Incoterm {incoterm} • {transportMode}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Transit facturé</p>
                        <p className="text-xl font-bold">{formatCurrency(comparison.transit)}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">OM théorique (total)</p>
                        <p className="text-xl font-bold">{formatCurrency(comparison.om)}</p>
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-lg flex items-center justify-between ${
                        comparison.delta > 0 ? "bg-status-warning/10" : "bg-status-ok/10"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {comparison.delta > 0 ? (
                          <TrendingUp className="h-5 w-5 text-status-warning" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-status-ok" />
                        )}
                        <span className="font-medium">Écart (Transit - OM)</span>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {comparison.delta >= 0 ? "+" : ""}
                          {formatCurrency(comparison.delta)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {comparison.deltaPct === null ? "-" : `${comparison.deltaPct >= 0 ? "+" : ""}${comparison.deltaPct.toFixed(1)}%`}
                          {comparison.ratio !== null ? ` • Ratio ${comparison.ratio.toFixed(2)}x` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Base OM (somme HT)</p>
                        <p className="text-base font-bold">{formatCurrency(omStats.baseTotal)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Taux moyen OM</p>
                        <p className="text-base font-bold">{(omStats.avgRate * 100).toFixed(2)}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Lignes OM</p>
                        <p className="text-base font-bold">{omStats.nb}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Graphiques */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Euro className="h-5 w-5" />
                      Graphiques (réel vs théorique)
                    </CardTitle>
                    <CardDescription>Lecture interactive : comparaison globale + répartition OM par HS4</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(v) => `${Math.round(v)}€`} />
                          <Tooltip formatter={(v: any) => formatCurrency(safeNum(v))} />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <Separator />

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip formatter={(v: any) => formatCurrency(safeNum(v))} />
                          <Legend />
                          <Pie
                            data={omByHs4}
                            dataKey="value"
                            nameKey="hs4"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {omByHs4.map((_, idx) => (
                              <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {omByHs4.length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucune donnée HS4/OM à afficher (HS manquants ou destination non DROM).</p>
                    )}
                  </CardContent>
                </Card>

                {/* Détail calcul OM (par ligne) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Détail du calcul OM théorique
                    </CardTitle>
                    <CardDescription>
                      Chaque ligne : Base HT × Taux OM (HS4) = OM. Les lignes “transport/transit” sont exclues.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {!omLines.length ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun détail OM (soit destination ≠ DROM, soit HS manquants, soit lignes produits non détectées).
                      </p>
                    ) : (
                      <>
                        <div className="max-h-[360px] overflow-auto rounded-lg border">
                          <div className="min-w-[900px]">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium bg-muted/60">
                              <div className="col-span-5">Désignation</div>
                              <div className="col-span-2">HS</div>
                              <div className="col-span-1">HS4</div>
                              <div className="col-span-2 text-right">Base HT</div>
                              <div className="col-span-1 text-right">Taux</div>
                              <div className="col-span-1 text-right">OM</div>
                            </div>

                            {omLines.map((l) => (
                              <div key={l.key} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-t">
                                <div className="col-span-5">
                                  <div className="font-medium truncate" title={l.description}>
                                    {l.description}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Base × taux = {formatCurrency(l.baseHT)} × {formatRatePercent(l.omRateRaw)}
                                  </div>
                                </div>
                                <div className="col-span-2 font-mono text-xs">{l.hsCode || "-"}</div>
                                <div className="col-span-1 font-mono text-xs">{l.hs4}</div>
                                <div className="col-span-2 text-right">{formatCurrency(l.baseHT)}</div>
                                <div className="col-span-1 text-right">{formatRatePercent(l.omRateRaw)}</div>
                                <div className="col-span-1 text-right font-bold">{formatCurrency(l.omAmount)}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Base OM totale</p>
                            <p className="text-base font-bold">{formatCurrency(omStats.baseTotal)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">OM total</p>
                            <p className="text-base font-bold">{formatCurrency(omStats.omTotal)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Taux moyen</p>
                            <p className="text-base font-bold">{(omStats.avgRate * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
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
                <p className="text-xl font-bold">{trackedItems.length}</p>
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
                  {trackedItems.length
                    ? `${(trackedItems.reduce((s, i) => s + (i.marginPercent || 0), 0) / trackedItems.length).toFixed(1)}%`
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
                  {trackedItems.length
                    ? `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                        trackedItems.reduce((s, i) => s + (i.transitFees || 0), 0) / trackedItems.length || 0,
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
