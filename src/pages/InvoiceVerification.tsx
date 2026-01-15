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
type DetectionSource = "line_items" | "raw_text" | "none";
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
  hsCode: string | null;
  hs4: string | null;
  baseHT: number;

  omRateRaw: number;
  omrRateRaw: number;
  totalRateFraction: number;

  omAmount: number;
  omrAmount: number;
  totalAmount: number;

  hasHs: boolean;
  rateFound: boolean;
};

type VerificationResult = {
  invoice: ParsedInvoice;
  destination: Destination;
  zone: string;
  territory: TerritoryCode | null;

  // Dans ton contexte : transitFees = OM facturé (ta facturation OM)
  omBilled: number | null;
  omBilledDetectionSource: DetectionSource;

  // Théorique = OM + OMR, sur la valeur marchandise uniquement
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

function parseEuroAmount(s: string): number {
  // "1 061,90" => 1061.90
  const cleaned = (s || "").replace(/\s/g, "").replace(",", ".");
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : 0;
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

function isShippingLike(desc: string) {
  const d = (desc || "").toLowerCase();
  return /(transport|transit|livraison|exp[ée]dition|shipping|fret|affranchissement|port)\b/.test(d);
}

function isVatLine(desc: string) {
  const d = (desc || "").toLowerCase();
  return /\b(tva|vat)\b/.test(d) || /taxe\s+sur\s+la\s+valeur\s+ajout/.test(d);
}

function isOmLike(desc: string) {
  const d = (desc || "").toLowerCase();
  if (isVatLine(d)) return false;
  return /octroi\s+de\s+mer|octroi|\bomr\b|\b(o\.?m\.?)\b|d[ée]bours?|douane|d[ée]douan/.test(d);
}

function extractOrlimanTotalsFromRawText(rawText: string) {
  const t = rawText || "";
  const mLines = t.match(/Total\s+lignes\s+HT\s+([\d\s]+,\d{2})/i);
  const mTransit = t.match(/\bTransit\s+([\d\s]+,\d{2})/i);
  const mTotalHT = t.match(/\bTotal\s+HT\s+([\d\s]+,\d{2})/i);

  const totalLinesHT = mLines ? parseEuroAmount(mLines[1]) : null;
  const transit = mTransit ? parseEuroAmount(mTransit[1]) : null;
  const totalHT = mTotalHT ? parseEuroAmount(mTotalHT[1]) : null;

  return { totalLinesHT, transit, totalHT };
}

function parseOrlimanLineItemsFromRawText(rawText: string) {
  // Parse table rows like:
  // CP06132UL 08435025907843 64069090 UN ... 0,007,74
  const lines = (rawText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const headerIdx = lines.findIndex((l) =>
    /Article\s+HS\s+code\s+Quantit[ée]\s+Tarif\s+catalogue\s+Remise\s+Prix\s+unitaire\s+HT\s+Total\s+HT\s+Taxe/i.test(l),
  );
  if (headerIdx < 0) return [];

  const items: any[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    if (/Base\s+taxe|Total\s+lignes\s+HT|Montant\s+TVA|TOTAL\s+TTC/i.test(line)) break;

    // ligne produit: code + EAN13 + HS8 + UN ...
    const m = line.match(/^([A-Z0-9]{6,})\s+(\d{13})\s+(\d{8})\s+UN\b(.*)$/);
    if (!m) continue;

    const codeArticle = m[1];
    const ean = m[2];
    const hsCode = m[3];
    const tail = m[4] || "";

    // total HT en fin, souvent collé après "0,00"
    let totalHT = 0;
    const mEnd1 = tail.match(/0,00\s*([\d\s]+,\d{2})\s*$/);
    const mEnd2 = tail.match(/0,00([\d\s]+,\d{2})\s*$/);
    if (mEnd1) totalHT = parseEuroAmount(mEnd1[1]);
    else if (mEnd2) totalHT = parseEuroAmount(mEnd2[1]);
    else {
      // fallback: dernier montant xx,xx sur la ligne
      const all = tail.match(/(\d+,\d{2})/g);
      if (all && all.length) totalHT = parseEuroAmount(all[all.length - 1]);
    }

    // description = prochaine ligne non "table"
    let description = codeArticle;
    const next = lines[i + 1] || "";
    if (next && !/^[A-Z0-9]{6,}\s+\d{13}\s+\d{8}\s+UN\b/.test(next) && !/Base\s+taxe|Total\s+lignes\s+HT/i.test(next)) {
      // ex: "BANDAGE IMMO EPAULE T4"
      description = `${codeArticle} • ${next}`.trim();
      i += 1;
    }

    if (totalHT > 0) {
      items.push({
        description,
        hsCode,
        quantity: null,
        amountHT: totalHT,
        ean,
        codeArticle,
      });
    }
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
  const iHt = idx(["total ht", "montant ht", "ht"]);

  const items: any[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(delimiter);
    const desc = iDesc >= 0 ? (cols[iDesc] || "").trim() : "";
    const hs = iHs >= 0 ? String(cols[iHs] || "").trim().replace(/[^\d]/g, "") : "";
    const ht = iHt >= 0 ? Number(String(cols[iHt] || "").replace(/\s/g, "").replace(",", ".")) : null;
    if (!desc && !hs) continue;

    items.push({
      description: desc || undefined,
      hsCode: hs || null,
      amountHT: Number.isFinite(ht as number) ? (ht as number) : null,
    });
  }

  const goodsSum = items
    .filter((it) => !isShippingLike(it.description || "") && !isOmLike(it.description || ""))
    .reduce((s, it) => s + safeNum(it.amountHT), 0);

  const transit = items.filter((it) => isShippingLike(it.description || "")).reduce((s, it) => s + safeNum(it.amountHT), 0);

  return {
    invoiceNumber: null,
    supplier: null,
    date: null,
    totalHT: goodsSum > 0 ? goodsSum : null,
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

      // ✅ NORMALISATION ORLIMAN (via rawText)
      const rawText = String((invoice as any).rawText || "");
      if (rawText) {
        const totals = extractOrlimanTotalsFromRawText(rawText);
        const fallbackItems = parseOrlimanLineItemsFromRawText(rawText);

        // Totaux (si trouvés)
        if (totals.totalLinesHT && totals.totalLinesHT > 0) (invoice as any).goodsLinesHT = totals.totalLinesHT;
        if (totals.transit && totals.transit > 0) (invoice as any).transitFees = totals.transit;
        if (totals.totalHT && totals.totalHT > 0) (invoice as any).totalHT = totals.totalHT;

        // lineItems : si extractInvoice a raté des lignes, on remplace par le fallback
        const currentItems: any[] = (((invoice as any).lineItems || []) as any[]) || [];
        if (fallbackItems.length && currentItems.length < fallbackItems.length) {
          (invoice as any).lineItems = fallbackItems;
        }
      }

      setParsed(invoice);

      // Destination auto
      const hint = detectDestinationHint(String((invoice as any).rawText || ""));
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

      toast({ title: "Analyse terminée", description: "Données détectées. Vérifie la destination de calcul OM puis lance le contrôle." });
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
      const base = safeNum(li.amountHT);
      if (base <= 0) continue;

      // On exclut les lignes non-marchandise (transport/transit/…)
      if (isShippingLike(desc)) continue;
      // On exclut aussi toute ligne explicitement "taxe/OM" si un jour elle apparait
      if (isOmLike(desc)) continue;

      const hs = String(li.hsCode || "").replace(/[^\d]/g, "");
      const hasHs = hs.length >= 4;
      const hs4 = hasHs ? hs.slice(0, 4) : null;

      const rateRow = hs4 ? ratesByHs4.get(hs4) : undefined;

      const omRateRaw = safeNum(rateRow?.om_rate ?? 0);
      const omrRateRaw = safeNum(rateRow?.omr_rate ?? 0);

      const omFrac = normalizeRateToFraction(omRateRaw);
      const omrFrac = normalizeRateToFraction(omrRateRaw);
      const totalFrac = omFrac + omrFrac;

      const rateFound = !!rateRow && totalFrac > 0;

      const omAmount = base * omFrac;
      const omrAmount = base * omrFrac;
      const totalAmount = base * totalFrac;

      computed.push({
        key: `${hs || "NOHS"}-${desc}-${base}`,
        description: desc || "(ligne produit)",
        hsCode: hasHs ? hs : null,
        hs4,
        baseHT: base,
        omRateRaw,
        omrRateRaw,
        totalRateFraction: totalFrac,
        omAmount,
        omrAmount,
        totalAmount,
        hasHs,
        rateFound,
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

    // OM facturé = transitFees
    const transit: number | null = inv.transitFees ?? null;
    const transitSource: DetectionSource = (inv.transitDetectionSource as DetectionSource) || (transit ? "raw_text" : "none");
    if (!transit || transit <= 0) alerts.push("OM facturé (Transit) non détecté sur la facture.");

    // Base marchandise attendue :
    // 1) "Total lignes HT" si présent (Orliman)
    // 2) sinon Total HT - Transit (si on a les 2)
    const goodsLinesHT = safeNum(inv.goodsLinesHT);
    const totalHT = safeNum(inv.totalHT);
    const expectedGoods =
      goodsLinesHT > 0 ? goodsLinesHT :
      (totalHT > 0 && safeNum(inv.transitFees) > 0 ? Math.max(0, totalHT - safeNum(inv.transitFees)) : 0);

    let omTheoreticalTotal: number | null = null;

    if (z === "DROM" && terr) {
      const computed = await buildOmLines(parsed, destination);

      const baseDetected = computed.reduce((s, l) => s + safeNum(l.baseHT), 0);
      if (expectedGoods > 0 && Math.abs(baseDetected - expectedGoods) > 0.5) {
        alerts.push(
          `Certaines lignes marchandise ne sont pas détectées : base détectée ${formatCurrency(baseDetected)} vs base attendue ${formatCurrency(expectedGoods)}.`,
        );
      }

      const missingHs = computed.filter((l) => !l.hasHs).length;
      if (missingHs > 0) alerts.push(`HS manquant sur ${missingHs} ligne(s) produit.`);

      const missingRates = computed.filter((l) => l.hasHs && !l.rateFound).length;
      if (missingRates > 0) alerts.push(`Taux OM/OMR introuvable pour ${missingRates} ligne(s) (HS4 absent de om_rates).`);

      // Théorique = somme OM+OMR sur les lignes où on a un taux
      const total = computed.filter((l) => l.rateFound).reduce((s, l) => s + safeNum(l.totalAmount), 0);
      omTheoreticalTotal = total >= 0 ? total : 0;

      if (!computed.length) alerts.push("Aucune ligne produit détectée pour calculer l’OM théorique.");
    } else {
      omTheoreticalTotal = 0;
    }

    const omBilled = transit;
    const omBilledDetectionSource = transitSource;

    let verdictOm: Verdict = "na";
    if (omTheoreticalTotal !== null && omBilled !== null) {
      verdictOm = omBilled < omTheoreticalTotal ? "defavorable" : "favorable";
      if (verdictOm === "defavorable") {
        alerts.push(
          `Défavorable : OM facturé (${formatCurrency(omBilled)}) < OM théorique (${formatCurrency(omTheoreticalTotal)}).`,
        );
      }
    }

    const vr: VerificationResult = {
      invoice: parsed,
      destination,
      zone: z,
      territory: terr,
      omBilled,
      omBilledDetectionSource,
      omTheoreticalTotal,
      verdictOm,
      alerts,
    };

    setResult(vr);

    if (inv.invoiceNumber) {
      const marginAmount = expectedGoods - safeNum(transit);
      const marginPercent = expectedGoods > 0 ? (marginAmount / expectedGoods) * 100 : 0;

      upsert({
        invoiceNumber: inv.invoiceNumber,
        supplier: inv.supplier || "",
        date: inv.date || "",
        totalHT: expectedGoods, // valeur marchandise
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
      description: alerts.length ? `${alerts.length} message(s)` : "Aucune anomalie détectée",
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

  const computedBaseDetected = useMemo(() => omLines.reduce((s, l) => s + safeNum(l.baseHT), 0), [omLines]);

  const goodsValue = useMemo(() => {
    const inv: any = parsed;
    if (!inv) return 0;
    const goodsLinesHT = safeNum(inv.goodsLinesHT);
    if (goodsLinesHT > 0) return goodsLinesHT;
    const totalHT = safeNum(inv.totalHT);
    const transit = safeNum(inv.transitFees);
    if (totalHT > 0 && transit > 0) return Math.max(0, totalHT - transit);
    return 0;
  }, [parsed]);

  const omStats = useMemo(() => {
    const covered = omLines.filter((l) => l.rateFound);
    const baseCovered = covered.reduce((s, l) => s + safeNum(l.baseHT), 0);
    const baseAll = computedBaseDetected;
    const baseUncovered = Math.max(0, baseAll - baseCovered);

    const omTotal = covered.reduce((s, l) => s + safeNum(l.totalAmount), 0);
    const avgRate = baseCovered > 0 ? omTotal / baseCovered : 0;

    return { baseAll, baseCovered, baseUncovered, omTotal, avgRate, count: omLines.length };
  }, [omLines, computedBaseDetected]);

  const barData = useMemo(() => {
    if (!result) return [];
    return [
      { name: "OM facturé (Transit)", value: safeNum(result.omBilled) },
      { name: "OM théorique (marchandise)", value: safeNum(result.omTheoreticalTotal) },
    ];
  }, [result]);

  const omByHs4 = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of omLines) {
      if (!l.rateFound || !l.hs4) continue;
      map.set(l.hs4, (map.get(l.hs4) || 0) + safeNum(l.totalAmount));
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

  const hs4Count = hs4List.length;

  const destinationBadge = useMemo(() => {
    if (destinationSource === "auto") {
      return (
        <Badge variant="default" className="bg-status-ok text-white">
          Auto • {destinationConfidence}
        </Badge>
      );
    }
    if (destinationSource === "manual") return <Badge variant="secondary">Manuel</Badge>;
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
                  La valeur marchandise est calculée = Total lignes HT (si présent), sinon Total HT - transit.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Destination utilisée pour le calcul OM {destinationBadge}
                </CardTitle>
                <CardDescription>Le calcul OM dépend de la destination DOM (GP/MQ/GF/RE/YT).</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
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
                      <span className="text-muted-foreground">Total HT (facture)</span>
                      <span className="font-medium">{formatCurrency(safeNum((parsed as any).totalHT))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transit (= OM facturé)</span>
                      <span className="font-medium">{formatCurrency(safeNum((parsed as any).transitFees))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valeur marchandise (Total lignes HT)</span>
                      <span className="font-medium">{formatCurrency(goodsValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base détectée (somme lignes produits)</span>
                      <span className="font-medium">{formatCurrency(computedBaseDetected)}</span>
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
                    <CardDescription>Destination {result.destination} • Zone {result.zone}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">OM facturé (Transit)</p>
                        <p className="text-xl font-bold">
                          {result.omBilled === null ? "—" : formatCurrency(result.omBilled)}
                        </p>
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
                      <p className="text-lg font-bold">
                        {formatCurrency(safeNum(result.omBilled) - safeNum(result.omTheoreticalTotal))}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Base détectée</p>
                        <p className="text-base font-bold">{formatCurrency(omStats.baseAll)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Taux moyen</p>
                        <p className="text-base font-bold">{(omStats.avgRate * 100).toFixed(2)}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Lignes</p>
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
                <p className="text-sm text-muted-foreground">Marge moyenne (marchandise - OM facturé)</p>
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
                <p className="text-sm text-muted-foreground">OM facturé moyen (Transit)</p>
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
