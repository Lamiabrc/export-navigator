import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Globe,
  Scale,
} from "lucide-react";

import { extractInvoiceFromPdf } from "@/lib/pdf/extractInvoice";
import { useInvoiceTracker } from "@/hooks/useInvoiceTracker";

import { calculateCosts, type ProductType, type CostBreakdown } from "@/utils/costCalculator";
import { getZoneFromDestination } from "@/data/referenceRates";
import { useReferenceRates } from "@/hooks/useReferenceRates";
import type { Destination, Incoterm, TransportMode } from "@/types";

import { supabase } from "@/integrations/supabase/client";

interface ExtractedLineItem {
  description?: string;
  codeArticle?: string | null;
  ean13?: string | null;
  hsCode?: string | null;
  amountHT?: number | null;
  quantity?: number | null;
}

interface ExtractedInvoice {
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  supplierName?: string | null;

  totalHT?: number | null;
  totalTVA?: number | null;
  totalTTC?: number | null;
  transitFees?: number | null;

  billingCountry?: string | null;
  vatExemptionMention?: string | null;

  lineItems?: ExtractedLineItem[];
  rawText?: string | null;

  // debug (optionnel) venant de extractInvoice.ts
  transitDetectionSource?: "line_items" | "text_fallback" | "none";
}

type InvoiceVerdict = "favorable" | "defavorable" | "not_applicable";

interface OmRateRow {
  hs4: string;
  om_rate: number | null;
  omr_rate: number | null;
  year: number | null;
  source: string | null;
}

interface OmLine {
  key: string;
  description: string;
  hsCode: string;
  hs4: string;
  baseHT: number;
  totalRate: number;
  omAmount: number;
  year?: number | null;
  source?: string | null;
  missingRate?: boolean;
  missingHs?: boolean;
}

interface VerificationResult {
  invoice: ExtractedInvoice;
  costBreakdown?: CostBreakdown | null;

  vatCheck?: {
    billingCountry: string | null;
    isFrance: boolean | null;
    tvaAmount: number;
    mention: string | null;
    ok: boolean;
    reason: string;
  };

  om?: {
    territoryCode: string | null;
    productsTotalHT: number;
    lines: OmLine[];
    omTheoretical: number;
    transitActualHT: number;
    deltaTransitMinusOM: number;
    verdict: InvoiceVerdict;
  };

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

const destinations: Destination[] = ["Guadeloupe", "Martinique", "Guyane", "Reunion", "Mayotte", "Belgique", "Espagne", "Luxembourg", "Suisse"];
const incoterms: Incoterm[] = ["EXW", "FCA", "DAP", "DDP"];
const transportModes: TransportMode[] = ["Routier", "Maritime", "Aerien", "Express", "Ferroviaire"];

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(amount) ? amount : 0);
}

function normalizeDigits(v: string) {
  return (v || "").replace(/[^\d]/g, "");
}
function hs4FromHsCode(v: string) {
  const s = normalizeDigits(v || "");
  return s.length >= 4 ? s.slice(0, 4) : "";
}
function normalizeCountry(v: string) {
  return (v || "").trim().toLowerCase();
}
function isFranceCountry(v: string) {
  const c = normalizeCountry(v);
  return c === "france" || c === "fr" || c === "fra";
}
const normalizeRate = (r: number) => (r > 1 ? r / 100 : r);

function territoryCodeFromDestination(dest: Destination): string | null {
  switch (dest) {
    case "Guadeloupe": return "GP";
    case "Martinique": return "MQ";
    case "Guyane": return "GF";
    case "Reunion": return "RE";
    case "Mayotte": return "YT";
    default: return null;
  }
}

async function fetchOmRatesByHs4(territoryCode: string, hs4List: string[]) {
  const uniqueHs4 = Array.from(new Set(hs4List.filter(Boolean)));
  if (!territoryCode || uniqueHs4.length === 0) return new Map<string, OmRateRow>();

  const { data, error } = await supabase
    .from("om_rates")
    .select("hs4, om_rate, omr_rate, year, source")
    .eq("territory_code", territoryCode)
    .in("hs4", uniqueHs4)
    .order("year", { ascending: false });

  if (error) throw error;

  const map = new Map<string, OmRateRow>();
  (data || []).forEach((row: any) => {
    const k = String(row.hs4 || "");
    if (!k) return;
    if (!map.has(k)) {
      map.set(k, {
        hs4: k,
        om_rate: row.om_rate ?? null,
        omr_rate: row.omr_rate ?? null,
        year: row.year ?? null,
        source: row.source ?? null,
      });
    }
  });

  return map;
}

function inferBillingCountryFromText(rawText?: string | null): string | undefined {
  const t = (rawText || "").toUpperCase();
  if (t.includes(" FRANCE")) return "France";
  if (t.includes(" BELGIQUE") || t.includes(" BELGIUM")) return "Belgique";
  if (t.includes(" ESPAGNE") || t.includes(" SPAIN")) return "Espagne";
  if (t.includes(" LUXEMBOURG")) return "Luxembourg";
  if (t.includes(" SUISSE") || t.includes(" SWITZERLAND")) return "Suisse";
  return undefined;
}

function inferVatExemptionMentionFromText(rawText?: string | null): string | undefined {
  const lines = (rawText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const keywords = ["exon", "exonération", "tva non applicable", "article 262", "262 ter", "autoliquidation", "reverse charge", "vat exempt", "tax exempt"];
  return lines.find((l) => keywords.some((k) => l.toLowerCase().includes(k)));
}

function parseNumberFr(s: string): number {
  const cleaned = (s || "").replace(/\s/g, "").replace(/\u00a0/g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function detectDelimiter(firstLine: string) {
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}
function parseCsvText(text: string): ExtractedInvoice {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return {};

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));

  const idxInvoice = idx(["invoice_number", "numero_facture", "facture", "n_facture", "n°facture"]);
  const idxDate = idx(["date", "invoice_date", "date_facture"]);
  const idxSupplier = idx(["supplier", "fournisseur", "vendor"]);
  const idxTotalHT = idx(["total_ht", "montant_ht", "ht", "totalht"]);
  const idxTotalTVA = idx(["total_tva", "tva", "vat"]);
  const idxTransit = idx(["transit", "frais_transit", "transport", "montant_transport"]);

  const idxDesc = idx(["libelle", "description", "designation", "produit", "product"]);
  const idxHs = idx(["hs_code", "hscode", "hs", "taric", "nc"]);
  const idxAmountLine = idx(["montant_ligne_ht", "amount_ht", "ligne_ht", "total_ligne", "montant"]);
  const idxCodeArticle = idx(["code_article", "sku", "ref", "reference"]);
  const idxEan = idx(["ean13", "ean", "gtin", "code_barre"]);

  const rows = lines.slice(1).map((l) => l.split(delimiter));
  const firstRow = rows[0] || [];

  const invoiceNumber = idxInvoice >= 0 ? (firstRow[idxInvoice] || "").trim() : undefined;
  const invoiceDate = idxDate >= 0 ? (firstRow[idxDate] || "").trim() : undefined;
  const supplierName = idxSupplier >= 0 ? (firstRow[idxSupplier] || "").trim() : undefined;

  const totalHT = idxTotalHT >= 0 ? parseNumberFr(firstRow[idxTotalHT] || "") : undefined;
  const totalTVA = idxTotalTVA >= 0 ? parseNumberFr(firstRow[idxTotalTVA] || "") : undefined;
  const transitFees = idxTransit >= 0 ? parseNumberFr(firstRow[idxTransit] || "") : undefined;
  const totalTTC = (totalHT || 0) + (totalTVA || 0);

  const lineItems: ExtractedLineItem[] = rows
    .map((r) => {
      const description = idxDesc >= 0 ? (r[idxDesc] || "").trim() : "";
      const hsCode = idxHs >= 0 ? normalizeDigits(r[idxHs] || "") : "";
      const amountHT = idxAmountLine >= 0 ? parseNumberFr(r[idxAmountLine] || "") : 0;
      const codeArticle = idxCodeArticle >= 0 ? (r[idxCodeArticle] || "").trim() : "";
      const ean13 = idxEan >= 0 ? normalizeDigits(r[idxEan] || "") : "";

      const keep = description || hsCode || codeArticle || ean13 || amountHT > 0;
      if (!keep) return null;

      return { description, hsCode, amountHT, codeArticle, ean13 };
    })
    .filter(Boolean) as ExtractedLineItem[];

  return {
    invoiceNumber,
    invoiceDate,
    supplierName,
    totalHT: totalHT || undefined,
    totalTVA: totalTVA || undefined,
    totalTTC: totalTTC || undefined,
    transitFees: transitFees || undefined,
    lineItems: lineItems.length ? lineItems : undefined,
  };
}

async function enrichHsCodesFromProducts(lines: ExtractedLineItem[]): Promise<ExtractedLineItem[]> {
  const needs = lines.filter((l) => !normalizeDigits(l.hsCode || ""));
  const codes = Array.from(new Set(needs.map((l) => (l.codeArticle || "").trim()).filter(Boolean)));
  const eans = Array.from(new Set(needs.map((l) => normalizeDigits(l.ean13 || "")).filter(Boolean)));
  if (codes.length === 0 && eans.length === 0) return lines;

  const byCode = new Map<string, string>();
  const byEan = new Map<string, string>();

  if (codes.length) {
    const { data } = await supabase.from("products").select("code_article, hs_code").in("code_article", codes);
    (data || []).forEach((p: any) => {
      const ca = (p.code_article || "").trim();
      const hs = normalizeDigits(p.hs_code || "");
      if (ca && hs) byCode.set(ca, hs);
    });
  }

  if (eans.length) {
    const { data } = await supabase.from("products").select("code_acl13_ou_ean13, hs_code");
    (data || []).forEach((p: any) => {
      const ean = normalizeDigits(p.code_acl13_ou_ean13 || "");
      const hs = normalizeDigits(p.hs_code || "");
      if (ean && hs && eans.includes(ean)) byEan.set(ean, hs);
    });
  }

  return lines.map((l) => {
    const hs = normalizeDigits(l.hsCode || "");
    if (hs) return l;

    const ca = (l.codeArticle || "").trim();
    const ean = normalizeDigits(l.ean13 || "");
    const found = (ca && byCode.get(ca)) || (ean && byEan.get(ean)) || "";
    return found ? { ...l, hsCode: found } : l;
  });
}

export default function InvoiceVerification() {
  const { toast } = useToast();
  const { upsert, items } = useInvoiceTracker();
  const { vatRates, octroiMerRates, transportCosts, serviceCharges } = useReferenceRates();

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const [destination, setDestination] = useState<Destination>("Martinique");
  const [incoterm, setIncoterm] = useState<Incoterm>("DAP");
  const [transportMode, setTransportMode] = useState<TransportMode>("Maritime");
  const [productType, setProductType] = useState<ProductType>("lppr");
  const [weightKg, setWeightKg] = useState<number>(10);
  const [margin, setMargin] = useState<number>(25);

  const zone = getZoneFromDestination(destination);
  const territoryCode = territoryCodeFromDestination(destination);

  const extractedLines = useMemo(() => extractedData?.lineItems || [], [extractedData]);
  const productsTotalHT = useMemo(() => extractedLines.reduce((s, l) => s + safeNumber(l.amountHT), 0), [extractedLines]);

  const goodsValueForCalc = useMemo(() => (productsTotalHT > 0 ? productsTotalHT : safeNumber(extractedData?.totalHT)), [productsTotalHT, extractedData?.totalHT]);

  const expectedBreakdown = useMemo<CostBreakdown | null>(() => {
    const ht = goodsValueForCalc;
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
  }, [goodsValueForCalc, destination, incoterm, productType, transportMode, weightKg, margin, vatRates, octroiMerRates, transportCosts, serviceCharges]);

  const resetForm = () => {
    setCurrentFile(null);
    setExtractedData(null);
    setVerificationResult(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isCsv = file.type === "text/csv" || name.endsWith(".csv") || file.type === "application/vnd.ms-excel";

    if (!isPdf && !isCsv) {
      toast({ title: "Format invalide", description: "Veuillez sélectionner un fichier PDF ou CSV", variant: "destructive" });
      return;
    }

    setCurrentFile(file);
    setExtractedData(null);
    setVerificationResult(null);
  };

  const analyzeFile = useCallback(async () => {
    if (!currentFile) return;
    setIsProcessing(true);

    try {
      const name = currentFile.name.toLowerCase();
      const isPdf = currentFile.type === "application/pdf" || name.endsWith(".pdf");
      const isCsv = currentFile.type === "text/csv" || name.endsWith(".csv") || currentFile.type === "application/vnd.ms-excel";

      let extracted: ExtractedInvoice = {};

      if (isPdf) {
        const parsed: any = await extractInvoiceFromPdf(currentFile);

        extracted = {
          invoiceNumber: parsed.invoiceNumber || null,
          invoiceDate: parsed.date || null,
          supplierName: parsed.supplier || null,
          totalHT: parsed.totalHT ?? null,
          totalTVA: parsed.totalTVA ?? null,
          totalTTC: parsed.totalTTC ?? null,
          transitFees: parsed.transitFees ?? null,
          billingCountry: parsed.billingCountry || null,
          vatExemptionMention: parsed.vatExemptionMention || null,
          lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
          rawText: typeof parsed.rawText === "string" ? parsed.rawText : null,
          transitDetectionSource: parsed.transitDetectionSource || "none",
        };

        if (!extracted.billingCountry) extracted.billingCountry = inferBillingCountryFromText(extracted.rawText);
        if (!extracted.vatExemptionMention) extracted.vatExemptionMention = inferVatExemptionMentionFromText(extracted.rawText);
      }

      if (isCsv) {
        const text = await currentFile.text();
        extracted = parseCsvText(text);
      }

      if (extracted.lineItems && extracted.lineItems.length) {
        extracted.lineItems = await enrichHsCodesFromProducts(extracted.lineItems);
      }

      setExtractedData(extracted);

      toast({
        title: "Analyse effectuée",
        description: "Lignes produits détectées + HS enrichi si possible. Lance le contrôle.",
      });
    } catch (err) {
      toast({ title: "Analyse impossible", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [currentFile, toast]);

  const runVerification = useCallback(async () => {
    if (!extractedData) return;
    setIsVerifying(true);

    try {
      const alerts: string[] = [];
      let hardError = false;

      const tva = safeNumber(extractedData.totalTVA);
      const transitRaw = extractedData.transitFees;
      const transit = safeNumber(transitRaw);
      const totalHT = safeNumber(extractedData.totalHT);

      if (!extractedData.invoiceNumber) {
        alerts.push("Numéro de facture non détecté.");
        hardError = true;
      }
      if (totalHT <= 0) {
        alerts.push("Total HT non détecté / invalide.");
        hardError = true;
      }

      // ✅ Transit doit être trouvé, sinon pas de verdict OM
      const transitDetected = transitRaw !== null && transitRaw !== undefined && transit > 0.0001;
      if (!transitDetected) {
        alerts.push("Frais de transit / transport non détectés sur la facture (vérifier le PDF ou la mise en page).");
        hardError = true;
      }

      // ✅ TVA rules
      const billingCountry = (extractedData.billingCountry || "").trim();
      const billingKnown = billingCountry.length > 0;
      const billingIsFrance = billingKnown ? isFranceCountry(billingCountry) : null;

      const mention = (extractedData.vatExemptionMention || "").trim();
      let vatOk = true;
      let vatReason = "OK";

      if (!billingKnown) {
        vatOk = false;
        vatReason = "Pays de facturation non détecté (adresse facturation).";
        alerts.push(vatReason);
      } else if (billingIsFrance === false) {
        if (tva > 0.01) {
          vatOk = false;
          vatReason = "Facturation hors France : TVA détectée (attendu = TVA absente).";
          alerts.push(vatReason);
          hardError = true;
        }
        if (tva <= 0.01 && mention.length < 8) {
          vatOk = false;
          vatReason = "Facturation hors France : TVA absente mais mention d’exonération non détectée.";
          alerts.push(vatReason);
          hardError = true;
        }
      } else if (billingIsFrance === true) {
        if (tva <= 0.01) {
          vatOk = false;
          vatReason = "Facturation France : TVA absente (attendu = TVA présente).";
          alerts.push(vatReason);
          hardError = true;
        }
      }

      // ✅ OM HS
      const lines = extractedData.lineItems || [];
      let omSection: VerificationResult["om"] = {
        territoryCode,
        productsTotalHT: 0,
        lines: [],
        omTheoretical: 0,
        transitActualHT: transit,
        deltaTransitMinusOM: 0,
        verdict: "not_applicable",
      };

      if (zone === "DROM") {
        if (!territoryCode) {
          alerts.push("Destination DROM : territory_code introuvable (GP/MQ/RE/YT/GF).");
          hardError = true;
        }
        if (!lines.length) {
          alerts.push("Destination DROM : aucune ligne produit détectée → OM théorique impossible.");
          hardError = true;
        }

        const omCandidates = lines.map((l, idx) => {
          const hs = normalizeDigits(l.hsCode || "");
          const hs4 = hs4FromHsCode(hs);
          const baseHT = safeNumber(l.amountHT);
          const description = (l.description || l.codeArticle || l.ean13 || `Ligne ${idx + 1}`).toString();
          return { idx, description, hs, hs4, baseHT };
        });

        const missingBase = omCandidates.filter((l) => l.baseHT <= 0);
        if (missingBase.length) {
          alerts.push(`Montant HT ligne manquant pour ${missingBase.length} ligne(s) → OM ligne impossible.`);
          hardError = true;
        }

        const missingHs = omCandidates.filter((l) => !l.hs || !l.hs4);
        if (missingHs.length) {
          alerts.push(`HS code manquant pour ${missingHs.length} ligne(s) (même après enrichissement).`);
          hardError = true;
        }

        const productsTotal = omCandidates.reduce((s, l) => s + safeNumber(l.baseHT), 0);

        const hs4List = omCandidates.map((l) => l.hs4).filter(Boolean);
        const rates = territoryCode ? await fetchOmRatesByHs4(territoryCode, hs4List) : new Map<string, OmRateRow>();

        const omLines: OmLine[] = omCandidates.map((l) => {
          const rateRow = l.hs4 ? rates.get(l.hs4) : undefined;

          const om_rate = normalizeRate(safeNumber(rateRow?.om_rate ?? 0));
          const omr_rate = normalizeRate(safeNumber(rateRow?.omr_rate ?? 0));
          const totalRate = om_rate + omr_rate;

          const missingRate = !!l.hs4 && !rateRow;
          const omAmount = l.baseHT * totalRate;

          return {
            key: `${l.idx}-${l.hs4}-${l.baseHT}`,
            description: l.description,
            hsCode: l.hs,
            hs4: l.hs4,
            baseHT: l.baseHT,
            totalRate,
            omAmount,
            year: rateRow?.year ?? null,
            source: rateRow?.source ?? null,
            missingRate,
            missingHs: !l.hs || !l.hs4,
          };
        });

        const missingRateCount = omLines.filter((x) => x.missingRate).length;
        if (missingRateCount) {
          alerts.push(`Taux OM manquant pour ${missingRateCount} ligne(s) (HS4 non trouvé dans om_rates).`);
          hardError = true;
        }

        const omTheoretical = omLines.reduce((s, l) => s + safeNumber(l.omAmount), 0);

        // ✅ si transit non détecté => pas de verdict (évite faux défavorable)
        let verdict: InvoiceVerdict = transitDetected ? "favorable" : "not_applicable";
        if (transitDetected && omTheoretical < transit) {
          verdict = "defavorable";
          alerts.push(`Facture défavorable : OM théorique (${formatCurrency(omTheoretical)}) < transit facturé (${formatCurrency(transit)}).`);
          hardError = true;
        }

        omSection = {
          territoryCode,
          productsTotalHT: productsTotal,
          lines: omLines,
          omTheoretical,
          transitActualHT: transit,
          deltaTransitMinusOM: transit - omTheoretical,
          verdict,
        };
      }

      // ✅ Référence transit / charges (optionnel)
      const bd = expectedBreakdown;
      let transitEstimatedHT = 0;
      let supplierChargesHT = 0;
      let taxesNonRecup = 0;

      if (bd) {
        transitEstimatedHT = bd.lines
          .filter((l) => l.category === "prestation" && l.payer === "Fournisseur")
          .reduce((s, l) => s + safeNumber(l.amount), 0);

        supplierChargesHT = safeNumber((bd as any).totalFournisseur);
        taxesNonRecup = safeNumber((bd as any).totalTaxesNonRecuperables);

        const delta = transit - transitEstimatedHT;
        const denom = Math.max(1, transitEstimatedHT);
        const deltaPct = (delta / denom) * 100;

        const toleranceEuro = Math.max(50, 0.15 * denom);
        if (transitDetected && Math.abs(delta) > toleranceEuro) {
          alerts.push(`Transit incohérent vs estimation: écart ${formatCurrency(delta)} (${deltaPct.toFixed(1)}%).`);
        }
      } else {
        alerts.push("Impossible de calculer l’attendu (références / base invalide).");
      }

      let status: "ok" | "warning" | "error" = "ok";
      if (hardError) status = "error";
      else if (alerts.length > 0) status = "warning";

      const result: VerificationResult = {
        invoice: extractedData,
        costBreakdown: bd,
        alerts,
        vatCheck: {
          billingCountry: billingCountry || null,
          isFrance: billingIsFrance,
          tvaAmount: tva,
          mention: mention || null,
          ok: vatOk,
          reason: vatReason,
        },
        om: omSection,
        analysis: {
          transitEstimatedHT,
          transitActualHT: transit,
          transitDeltaHT: transit - transitEstimatedHT,
          transitDeltaPercent: transitEstimatedHT > 0 ? ((transit - transitEstimatedHT) / transitEstimatedHT) * 100 : 0,
          supplierChargesHT,
          taxesNonRecup,
          status,
        },
      };

      setVerificationResult(result);

      if (extractedData.invoiceNumber) {
        const marginAmount = safeNumber(extractedData.totalHT) - safeNumber(extractedData.transitFees);
        const marginPercent = safeNumber(extractedData.totalHT) > 0 ? (marginAmount / safeNumber(extractedData.totalHT)) * 100 : 0;

        upsert({
          invoiceNumber: extractedData.invoiceNumber,
          supplier: extractedData.supplierName,
          date: extractedData.invoiceDate,
          totalHT: extractedData.totalHT,
          totalTTC: extractedData.totalTTC,
          transitFees: extractedData.transitFees,
          marginAmount,
          marginPercent,
          filename: currentFile?.name,
          analyzedAt: new Date().toISOString(),
        });
      }

      toast({
        title: "Contrôle terminé",
        description: alerts.length > 0 ? `${alerts.length} alerte(s)` : "Aucune anomalie détectée",
        variant: status === "ok" ? "default" : "destructive",
      });
    } catch (err) {
      toast({ title: "Erreur contrôle", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  }, [extractedData, expectedBreakdown, zone, territoryCode, toast, upsert, currentFile?.name]);

  const verdictBadge = (v?: InvoiceVerdict) => {
    if (v === "defavorable") return { label: "Défavorable", cls: "bg-status-risk text-white" };
    if (v === "favorable") return { label: "Favorable", cls: "bg-status-ok text-white" };
    return { label: "N/A", cls: "bg-muted text-foreground" };
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Vérification facture (PDF / CSV)
          </h1>
          <p className="mt-1 text-muted-foreground">Détection lignes + HS • OM théorique vs transit • Contrôle TVA (pays facturation)</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
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
                  <Input type="file" accept=".pdf,.csv,application/pdf,text/csv" onChange={handleFileChange} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    {currentFile ? <p className="text-sm font-medium text-foreground">{currentFile.name}</p> : <p className="text-sm text-muted-foreground">Cliquez ou glissez un PDF/CSV ici</p>}
                  </label>
                </div>

                {currentFile && (
                  <Button onClick={analyzeFile} disabled={isProcessing} className="w-full">
                    {isProcessing ? "Analyse en cours..." : "Analyser le fichier"}
                  </Button>
                )}

                {extractedData && (
                  <Button onClick={runVerification} disabled={isVerifying} className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isVerifying ? "Contrôle..." : "Lancer le contrôle"}
                  </Button>
                )}

                <Button variant="outline" onClick={resetForm} className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              </CardContent>
            </Card>

            {extractedData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Données détectées</CardTitle>
                  <CardDescription>Lecture seule depuis le PDF/CSV</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transit détecté</span>
                    <span className="font-medium">
                      {formatCurrency(safeNumber(extractedData.transitFees))}
                      {extractedData.transitDetectionSource && extractedData.transitDetectionSource !== "none" && (
                        <Badge variant="outline" className="ml-2">
                          {extractedData.transitDetectionSource === "line_items" ? "lignes facture" : "fallback texte"}
                        </Badge>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {verificationResult ? (
              <>
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

                {verificationResult.om && (
                  <Card className={verificationResult.om.verdict === "defavorable" ? "border-status-risk/50" : "border-status-ok/50"}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        OM théorique vs Transit
                        <Badge className={verdictBadge(verificationResult.om.verdict).cls}>{verdictBadge(verificationResult.om.verdict).label}</Badge>
                      </CardTitle>
                      <CardDescription>Destination {destination} • Zone {zone}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Transit facturé</p>
                          <p className="text-xl font-bold">{formatCurrency(verificationResult.om.transitActualHT)}</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">OM théorique</p>
                          <p className="text-xl font-bold">{formatCurrency(verificationResult.om.omTheoretical)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center">
                  <FileSearch className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Importez un PDF/CSV puis lancez l’analyse et le contrôle.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

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
                <p className="text-xl font-bold">{items.length ? `${(items.reduce((s, i) => s + (i.marginPercent || 0), 0) / items.length).toFixed(1)}%` : "-"}</p>
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
                    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                        items.reduce((s, i) => s + (i.transitFees || 0), 0) / items.length || 0,
                      )
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
