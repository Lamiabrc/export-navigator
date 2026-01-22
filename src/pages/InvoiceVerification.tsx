// src/pages/InvoiceVerification.tsx
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
  TrendingDown,
  TrendingUp,
  Euro,
  Percent,
  RotateCcw,
  Info,
  Scale,
} from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getZoneFromDestination } from "@/data/referenceRates";
import type { Destination } from "@/types";

import { extractInvoiceFromPdf, type ParsedInvoice } from "@/lib/pdf/extractInvoice";
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

type TerritoryCode = "GP" | "MQ" | "GF" | "RE" | "YT";
type DetectionSource = "line_items" | "raw_text" | "lines_scan" | "none";
type Verdict = "favorable" | "defavorable" | "na";

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

  // On affiche un taux unique : OM + OMR (si présent)
  omRateRaw: number; // en %
  omRateFraction: number; // en fraction
  omAmount: number;
};

type VerificationResult = {
  invoice: ParsedInvoice;
  destination: Destination;
  zone: string;
  territory: TerritoryCode | null;

  // Dans ton usage : OM facturé = "Transit" (ta facturation OM)
  omBilled: number | null;
  omBilledDetectionSource: DetectionSource;

  goodsValue: number | null; // valeur marchandise attendue (Total lignes HT si présent, sinon TotalHT - transit)
  goodsValueSource: "total_lignes_ht" | "totalht_minus_transit" | "none";

  detectedGoodsBase: number; // somme des lignes produit détectées (hors transport/transit)
  baseCoverageOk: boolean;

  omTheoreticalTotal: number | null;
  verdictOm: Verdict;

  alerts: string[];
};

type DestinationHint = {
  destination: Destination;
  confidence: "high" | "medium";
  evidence: string;
};

function safeNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseEuroAmount(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v)
    .replace(/\u00A0/g, " ")
    .replace(/€/g, "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  const num = Number(s);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}

function normalizeRateToFraction(rate: number) {
  if (!Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
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

function detectDestinationHint(text: string): DestinationHint | null {
  const t = (text || "").toUpperCase();

  const m = t.match(/97(1|2|3|4|6)\d{2}/);
  if (m) {
    const prefix = m[0].slice(0, 3);
    if (prefix === "971") return { destination: "Guadeloupe", confidence: "high", evidence: "Code postal 971xx détecté" };
    if (prefix === "972") return { destination: "Martinique", confidence: "high", evidence: "Code postal 972xx détecté" };
    if (prefix === "973") return { destination: "Guyane", confidence: "high", evidence: "Code postal 973xx détecté" };
    if (prefix === "974") return { destination: "Reunion", confidence: "high", evidence: "Code postal 974xx détecté" };
    if (prefix === "976") return { destination: "Mayotte", confidence: "high", evidence: "Code postal 976xx détecté" };
  }

  if (t.includes("GUADELOUPE")) return { destination: "Guadeloupe", confidence: "medium", evidence: "Mot-clé GUADELOUPE détecté" };
  if (t.includes("MARTINIQUE") || t.includes("LE LAMENTIN")) return { destination: "Martinique", confidence: "medium", evidence: "Mot-clé MARTINIQUE / LAMENTIN détecté" };
  if (t.includes("GUYANE")) return { destination: "Guyane", confidence: "medium", evidence: "Mot-clé GUYANE détecté" };
  if (t.includes("RÉUNION") || t.includes("REUNION")) return { destination: "Reunion", confidence: "medium", evidence: "Mot-clé REUNION détecté" };
  if (t.includes("MAYOTTE")) return { destination: "Mayotte", confidence: "medium", evidence: "Mot-clé MAYOTTE détecté" };

  return null;
}

// Lignes "non marchandise" à exclure de la base marchandise
function isShippingLike(desc: string) {
  const d = (desc || "").toLowerCase();
  return /(transport|livraison|exp[ée]dition|shipping|fret|affranchissement|port)\b/.test(d);
}

// Transit = ta facturation OM (pas transport), mais ça reste "non marchandise"
function isTransitLike(desc: string) {
  const d = (desc || "").toLowerCase();
  return /\btransit\b/.test(d);
}

function isVatLine(desc: string) {
  const d = (desc || "").toLowerCase();
  return /\b(tva|vat)\b/.test(d) || /taxe\s+sur\s+la\s+valeur\s+ajout/.test(d);
}

function isOmLike(desc: string) {
  const d = (desc || "").toLowerCase();
  if (isVatLine(d)) return false;
  return /octroi\s+de\s+mer/.test(d) || /\boctroi\b/.test(d) || /\bomr\b/.test(d) || /\bom\b/.test(d) || /douane|d[ée]douan/.test(d);
}

function getLineHT(li: any) {
  return safeNum(li?.amountHT ?? li?.totalHT ?? li?.amount ?? li?.total ?? li?.total_ht ?? li?.ht);
}

// Extrait "Total lignes HT" du texte si pas déjà fourni
function detectTotalLignesHT(rawText: string): number | null {
  const t = rawText || "";
  const m = t.match(/Total\s+lignes\s+HT\s+([\d\s]+,\d{2})/i);
  if (!m) return null;
  const v = parseEuroAmount(m[1]);
  return v > 0 ? v : null;
}

/**
 * Fallback MPL Conseil Export (robuste) :
 * - EAN 13 OU 14 chiffres ✅
 * - multi-pages ✅
 * - qty = "1UN" ou "1 UN" ✅
 * - Total HT = avant-dernier montant (dernier = Taxe souvent 0,00)
 */
function parseMPL Conseil ExportLineItemsFromRawText(rawText: string) {
  const lines = (rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const isHeader = (l: string) => /^Article\b.*HS\s+code\b/i.test(l);
  const isTotalsLine = (l: string) =>
    /^(Base\s+taxe|Total\s+lignes\s+HT|Transit|Total\s+HT|Montant\s+TVA|TOTAL\s+TTC)\b/i.test(l);

  // ✅ EAN13/14 + HS8 + qty UN
  const isProductRow = (l: string) =>
    /^[A-Z0-9]{6,}\s+\d{13,14}\s+\d{8}\s+\d+\s*UN\b/i.test(l);

  const headerIdx = lines.findIndex((l) => isHeader(l));
  if (headerIdx < 0) return [];

  const items: any[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    // ignore headers repeated on page 2
    if (isHeader(line)) continue;

    // stop only at global totals
    if (isTotalsLine(line)) break;

    // ignore currency artifacts
    if (/^EUR(\s+EUR)+$/i.test(line)) continue;

    if (!isProductRow(line)) continue;

    const toks = line.split(/\s+/);
    // Ex: CP06132UL 08435025907843 64069090 1UN 11,91 35,0% 7,74 7,74 0,00
    const codeArticle = toks[0];
    const ean = toks[1];
    const hsCode = toks[2];
    const qtyToken = toks[3]; // "1UN" ou "1" (rare) mais on gère

    // total = avant-dernier token monétaire (dernier = taxe)
    const totalToken = toks[toks.length - 2];
    const totalHT = parseEuroAmount(totalToken);
    if (!Number.isFinite(totalHT) || totalHT <= 0) continue;

    const qty = Number(String(qtyToken).replace("UN", "").trim()) || null;

    // description = ligne suivante si ce n’est pas une autre ligne produit/totaux/header
    let description = codeArticle;
    const next = lines[i + 1] || "";
    if (next && !isProductRow(next) && !isTotalsLine(next) && !isHeader(next) && !/^EUR(\s+EUR)+$/i.test(next)) {
      description = `${codeArticle} • ${next}`.trim();
      i += 1;
    }

    items.push({
      description,
      hsCode,
      quantity: qty,
      amountHT: totalHT,
      ean,
      codeArticle,
    });
  }

  return items;
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

  const items: any[] = [];

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

  const goodsSum = items
    .filter((it) => !isShippingLike(it.description || "") && !isTransitLike(it.description || "") && !isOmLike(it.description || ""))
    .reduce((s, it) => s + safeNum(it.amountHT), 0);

  const transit = items.filter((it) => isTransitLike(it.description || "")).reduce((s, it) => s + safeNum(it.amountHT), 0);

  return {
    invoiceNumber: null,
    supplier: null,
    date: null,
    totalHT: goodsSum > 0 ? goodsSum + transit : null,
    totalTTC: null,
    transitFees: transit > 0 ? transit : null,
    rawText: text,
    lineItems: items,
  } as any;
}

export default function InvoiceVerification() {
  const { toast } = useToast();
  const { upsert, items: trackedItems } = useInvoiceTracker();

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);

  const [destination, setDestination] = useState<Destination>("Martinique");
  const [destinationSource, setDestinationSource] = useState<"default" | "auto" | "manual">("default");
  const [destinationEvidence, setDestinationEvidence] = useState<string | null>(null);
  const [destinationConfidence, setDestinationConfidence] = useState<"high" | "medium" | "none">("none");

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
    setDestinationSource("default");
    setDestinationEvidence(null);
    setDestinationConfidence("none");
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

    setDestinationSource("default");
    setDestinationEvidence(null);
    setDestinationConfidence("none");
  };

  const analyzeFile = useCallback(async () => {
    if (!currentFile) return;

    setIsProcessing(true);
    try {
      const isPdf = currentFile.type === "application/pdf" || currentFile.name.toLowerCase().endsWith(".pdf");
      const invoice = isPdf ? await extractInvoiceFromPdf(currentFile) : await parseCsvInvoice(currentFile);

      // 🔎 Garantir rawText
      const rawText = String((invoice as any).rawText || "");
      // 🔎 Garantir Total lignes HT
      if (!(invoice as any).goodsLinesHT) {
        const tl = detectTotalLignesHT(rawText);
        if (tl) (invoice as any).goodsLinesHT = tl;
      }

      // ✅ Fallback MPL Conseil Export : récupérer toutes les lignes produit (multi-pages)
      const fallbackItems = parseMPL Conseil ExportLineItemsFromRawText(rawText);
      const currentItems: any[] = (((invoice as any).lineItems || []) as any[]) || [];

      const sumItems = (arr: any[]) =>
        arr
          .filter((it) => !isShippingLike(String(it?.description || "")) && !isTransitLike(String(it?.description || "")) && !isOmLike(String(it?.description || "")))
          .reduce((s, it) => s + getLineHT(it), 0);

      const expectedGoods = safeNum((invoice as any).goodsLinesHT);
      const sumCurrent = sumItems(currentItems);
      const sumFallback = sumItems(fallbackItems);

      const currentError = expectedGoods > 0 ? Math.abs(sumCurrent - expectedGoods) : 999999;
      const fallbackError = expectedGoods > 0 ? Math.abs(sumFallback - expectedGoods) : 999999;

      // On remplace si le fallback colle mieux au Total lignes HT
      if (fallbackItems.length && (fallbackError + 0.01 < currentError) && sumFallback > 0) {
        (invoice as any).lineItems = fallbackItems;
        (invoice as any).lineScanSource = "lines_scan";
      }

      setParsed(invoice);

      const hint = detectDestinationHint(rawText);
      if (hint) {
        setDestination(hint.destination);
        setDestinationSource("auto");
        setDestinationEvidence(hint.evidence);
        setDestinationConfidence(hint.confidence);
      } else {
        setDestinationSource("default");
        setDestinationEvidence("Aucune preuve trouvée dans la facture (CP DOM / mots-clés)");
        setDestinationConfidence("none");
      }

      toast({ title: "Analyse terminée", description: "Données détectées. Vérifie la destination puis lance le contrôle." });
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
    const items: any[] = (((parsed as any).lineItems || []) as any[]) || [];
    const set = new Set<string>();
    for (const li of items) {
      const hs = String(li.hsCode || "").replace(/[^\d]/g, "");
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

    const items: any[] = (((inv as any).lineItems || []) as any[]) || [];

    const hs4s = Array.from(
      new Set(
        items
          .map((l) => String(l.hsCode || "").replace(/[^\d]/g, ""))
          .filter((hs) => hs.length >= 4)
          .map((hs) => hs.slice(0, 4)),
      ),
    );

    const ratesByHs4 = await fetchOmRates(terr, hs4s);

    const computed: OmComputedLine[] = [];

    for (const li of items) {
      const desc = (li.description || "").trim();
      const base = getLineHT(li);

      if (base <= 0) continue;

      // Exclure lignes non-marchandise de la base théorique
      if (isShippingLike(desc) || isTransitLike(desc) || isOmLike(desc)) continue;

      const hs = String(li.hsCode || "").replace(/[^\d]/g, "");
      if (hs.length < 4) continue;

      const hs4 = hs.slice(0, 4);
      const rateRow = ratesByHs4.get(hs4);

      // ✅ taux utilisé = OM + OMR (si présent)
      const omRate = safeNum(rateRow?.om_rate ?? 0);
      const omrRate = safeNum(rateRow?.omr_rate ?? 0);
      const totalRateRaw = omRate + omrRate;

      const rateFrac = normalizeRateToFraction(totalRateRaw);
      const om = base * rateFrac;

      computed.push({
        key: `${hs}-${desc}-${base}`,
        description: desc || "(ligne produit)",
        hsCode: hs,
        hs4,
        baseHT: base,
        omRateRaw: totalRateRaw,
        omRateFraction: rateFrac,
        omAmount: om,
      });
    }

    setOmLines(computed);
    return computed;
  }, []);

  const runVerification = useCallback(async () => {
    if (!parsed) return;

    const inv: any = parsed;
    const alerts: string[] = [];

    if (destinationSource === "default") {
      alerts.push(`Destination non prouvée dans le document : valeur par défaut à confirmer (${destination}).`);
    }

    const z = getZoneFromDestination(destination);
    const terr = getTerritoryCodeFromDestination(destination);

    // OM facturé = Transit
    const transit: number | null = inv.transitFees ?? null;
    const transitSource: DetectionSource = (inv.lineScanSource as DetectionSource) || (inv.transitDetectionSource as DetectionSource) || (transit ? "raw_text" : "none");
    if (transit === null || transit <= 0) alerts.push("Transit (OM facturé) non détecté sur la facture (ou non présent).");

    // Valeur marchandise attendue
    const totalHT = safeNum(inv.totalHT);
    const goodsLinesHT = safeNum(inv.goodsLinesHT);
    let goodsValue: number | null = null;
    let goodsValueSource: VerificationResult["goodsValueSource"] = "none";

    if (goodsLinesHT > 0) {
      goodsValue = goodsLinesHT;
      goodsValueSource = "total_lignes_ht";
    } else if (totalHT > 0 && transit !== null) {
      goodsValue = Math.max(0, totalHT - safeNum(transit));
      goodsValueSource = "totalht_minus_transit";
    }

    // Base détectée (somme lignes produit détectées)
    const items: any[] = (((inv as any).lineItems || []) as any[]) || [];
    const detectedGoodsBase = items
      .filter((it) => {
        const d = String(it?.description || "");
        return !isShippingLike(d) && !isTransitLike(d) && !isOmLike(d);
      })
      .reduce((s, it) => s + getLineHT(it), 0);

    // OM théorique (DROM uniquement)
    let omTheoreticalTotal: number | null = null;
    if (z === "DROM" && terr) {
      const computed = await buildOmLines(parsed, destination);
      const total = computed.reduce((s, l) => s + safeNum(l.omAmount), 0);
      omTheoreticalTotal = total >= 0 ? total : 0;
      if (!computed.length) alerts.push("Aucune ligne produit avec HS code exploitable pour calculer l’OM théorique.");
    } else {
      omTheoreticalTotal = 0;
    }

    // Couverture base : on attend que base détectée == valeur marchandise
    const baseCoverageOk = goodsValue !== null ? Math.abs(detectedGoodsBase - goodsValue) < 0.5 : true;
    if (goodsValue !== null && !baseCoverageOk) {
      alerts.push(
        `Certaines lignes marchandise ne sont pas détectées : base détectée ${formatCurrency(detectedGoodsBase)} vs base attendue ${formatCurrency(goodsValue)}.`,
      );
    }

    // Verdict : Transit (OM facturé) doit être >= OM théorique
    let verdictOm: Verdict = "na";
    if (omTheoreticalTotal !== null && transit !== null) {
      verdictOm = transit < omTheoreticalTotal ? "defavorable" : "favorable";
      if (verdictOm === "defavorable") {
        alerts.push(
          `Défavorable : OM facturé (Transit) (${formatCurrency(transit)}) < OM théorique (${formatCurrency(omTheoreticalTotal)}).`,
        );
      }
    }

    const vr: VerificationResult = {
      invoice: parsed,
      destination,
      zone: z,
      territory: terr,
      omBilled: transit,
      omBilledDetectionSource: transitSource,

      goodsValue,
      goodsValueSource,

      detectedGoodsBase,
      baseCoverageOk,

      omTheoreticalTotal,
      verdictOm,
      alerts,
    };

    setResult(vr);

    if (inv.invoiceNumber) {
      const marginAmount = totalHT - safeNum(transit);
      const marginPercent = totalHT > 0 ? (marginAmount / totalHT) * 100 : 0;

      upsert({
        invoiceNumber: inv.invoiceNumber,
        supplier: inv.supplier || "",
        date: inv.date || "",
        totalHT,
        totalTTC: safeNum(inv.totalTTC),
        transitFees: transit ?? null,
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
  }, [parsed, destination, destinationSource, buildOmLines, toast, upsert, currentFile]);

  useEffect(() => {
    setOmLines([]);
    setResult(null);
  }, [destination]);

  const verdictUi = useCallback((v: Verdict) => {
    if (v === "favorable") return { label: "Favorable", badge: "default" as const, border: "border-status-ok/50" };
    if (v === "defavorable") return { label: "Défavorable", badge: "destructive" as const, border: "border-status-risk/50" };
    return { label: "N/A", badge: "outline" as const, border: "border-border" };
  }, []);

  const omStats = useMemo(() => {
    const baseTotal = omLines.reduce((s, l) => s + safeNum(l.baseHT), 0);
    const omTotal = omLines.reduce((s, l) => s + safeNum(l.omAmount), 0);
    const avgRate = baseTotal > 0 ? omTotal / baseTotal : 0;
    return { baseTotal, omTotal, avgRate, count: omLines.length };
  }, [omLines]);

  const barData = useMemo(() => {
    if (!result) return [];
    return [
      { name: "OM facturé (Transit)", value: safeNum(result.omBilled) },
      { name: "OM théorique (marchandise)", value: safeNum(result.omTheoreticalTotal) },
    ];
  }, [result]);

  const omByHs4 = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of omLines) map.set(l.hs4, (map.get(l.hs4) || 0) + safeNum(l.omAmount));
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

  const hs4Count = hs4List.length;

  const destinationBadge = useMemo(() => {
    if (destinationSource === "auto") {
      return (
        <Badge variant="default" className="bg-status-ok text-white">
          Auto • {destinationConfidence}
        </Badge>
      );
    }
    if (destinationSource === "manual") {
      return <Badge variant="secondary">Manuel</Badge>;
    }
    return <Badge variant="outline">Par défaut • à confirmer</Badge>;
  }, [destinationSource, destinationConfidence]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Vérification facture (PDF / CSV)
          </h1>
          <p className="mt-1 text-muted-foreground">
            Détection lignes + HS • Valeur marchandise (Total lignes HT) • OM théorique vs OM facturé (Transit)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import facture (PDF ou CSV)
                </CardTitle>
                <CardDescription>Analyse automatique : lignes produits + montants + HS</CardDescription>
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
                  La valeur marchandise = Total lignes HT (si présent), sinon Total HT - transit. Les lignes “transport” (si présentes)
                  sont exclues de la base marchandise.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Destination utilisée pour le calcul OM
                  {destinationBadge}
                </CardTitle>
                <CardDescription>
                  L’OM théorique dépend de la destination. On n’affiche “Auto” que si on trouve une preuve.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Destination
                  </Label>

                  <Select
                    value={destination}
                    onValueChange={(v) => {
                      setDestination(v as Destination);
                      setDestinationSource("manual");
                    }}
                  >
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

                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={zone === "UE" ? "default" : zone === "DROM" ? "secondary" : "outline"}>Zone {zone}</Badge>
                    {territory && <Badge variant="outline">Territory {territory}</Badge>}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Preuve :</span> {destinationEvidence || "-"}
                  </div>
                </div>

                {zone === "DROM" && destinationSource === "default" && (
                  <div className="p-3 rounded-lg bg-status-warning/10 text-sm flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-status-warning mt-0.5" />
                    <div>
                      La destination n’a pas été prouvée dans la facture : le calcul OM peut être faux.
                      Choisis la bonne destination avant de lancer le contrôle.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Données détectées
                </CardTitle>
                <CardDescription>Lecture seule depuis le PDF/CSV</CardDescription>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                {!parsed ? (
                  <p className="text-muted-foreground">Analyse un fichier pour voir les champs détectés.</p>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Facture</span>
                      <span className="font-medium">{(parsed as any).invoiceNumber || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fournisseur</span>
                      <span className="font-medium">{(parsed as any).supplier || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{(parsed as any).date || "-"}</span>
                    </div>

                    <Separator className="my-2" />

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total HT (facture)</span>
                      <span className="font-medium">{formatCurrency(safeNum((parsed as any).totalHT))}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transit (= OM facturé)</span>
                      <span className="font-medium">{formatCurrency(safeNum((parsed as any).transitFees))}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valeur marchandise (Total lignes HT)</span>
                      <span className="font-medium">{formatCurrency(safeNum((parsed as any).goodsLinesHT))}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base détectée (somme lignes produits)</span>
                      <span className="font-medium">
                        {formatCurrency(
                          (((parsed as any).lineItems || []) as any[])
                            .filter((it: any) => {
                              const d = String(it?.description || "");
                              return !isShippingLike(d) && !isTransitLike(d) && !isOmLike(d);
                            })
                            .reduce((s: number, it: any) => s + getLineHT(it), 0),
                        )}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Source lignes :</span> {(parsed as any).lineScanSource || (parsed as any).itemsSource || "line_items"}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Lignes :</span> {(((parsed as any).lineItems || []) as any[]).length}
                      {hs4Count ? ` • HS4 distincts : ${hs4Count}` : ""}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT */}
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
                            <AlertTriangle className="h-4 w-4 text-status-warning mt-0.5 shrink-0" />
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Card className={verdictUi(result.verdictOm).border}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Scale className="h-5 w-5" />
                      OM facturé (Transit) vs OM théorique
                      <Badge variant={verdictUi(result.verdictOm).badge}>{verdictUi(result.verdictOm).label}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Destination {result.destination} • Zone {result.zone}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">OM facturé (Transit)</p>
                        <p className="text-xl font-bold">{result.omBilled === null ? "—" : formatCurrency(result.omBilled)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Source : {result.omBilledDetectionSource}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">OM théorique (marchandise)</p>
                        <p className="text-xl font-bold">{formatCurrency(safeNum(result.omTheoreticalTotal))}</p>
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-lg flex items-center justify-between ${
                        safeNum(result.omBilled) < safeNum(result.omTheoreticalTotal) ? "bg-status-warning/10" : "bg-status-ok/10"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {safeNum(result.omBilled) < safeNum(result.omTheoreticalTotal) ? (
                          <TrendingDown className="h-5 w-5 text-status-warning" />
                        ) : (
                          <TrendingUp className="h-5 w-5 text-status-ok" />
                        )}
                        <span className="font-medium">Écart (OM facturé - OM théorique)</span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {formatCurrency(safeNum(result.omBilled) - safeNum(result.omTheoreticalTotal))}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Base (somme lignes produits)</p>
                        <p className="text-base font-bold">{formatCurrency(result.detectedGoodsBase)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Taux moyen (sur base couverte)</p>
                        <p className="text-base font-bold">{(omStats.avgRate * 100).toFixed(2)}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Lignes prises en compte</p>
                        <p className="text-base font-bold">{omStats.count}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Euro className="h-5 w-5" />
                      Graphiques (réel vs théorique)
                    </CardTitle>
                    <CardDescription>Comparaison globale + répartition OM théorique par HS4</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="h-[220px]">
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
                          <Pie data={omByHs4} dataKey="value" nameKey="hs4" innerRadius={55} outerRadius={90} paddingAngle={2}>
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

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Détail du calcul OM théorique
                    </CardTitle>
                    <CardDescription>
                      Chaque ligne : Base HT × (OM+OMR selon HS4) = OM théorique. Les lignes “transport” et “transit” sont exclues.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {!omLines.length ? (
                      <p className="text-sm text-muted-foreground">Aucun détail OM (destination ≠ DROM, HS manquants, ou lignes produits non détectées).</p>
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
                                    {formatCurrency(l.baseHT)} × {formatRatePercent(l.omRateRaw)}
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
                            <p className="text-xs text-muted-foreground">OM théorique total</p>
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
