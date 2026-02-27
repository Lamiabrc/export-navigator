
import * as React from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Sparkles } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, CURRENCIES, INCOTERMS } from "@/lib/constants";
import {
  assessInvoice,
  type CheckerItem,
  type InvoiceAssessment,
  type InvoiceData,
  type TransactionContext,
} from "@/lib/invoice";

type ExpressForm = {
  goodsOrServices: "" | "goods" | "services";
  sellerCountry: string;
  buyerCountry: string;
  buyerIsTaxable: "" | "yes" | "no";
  buyerVat: string;
};

type ProForm = {
  incoterm: string;
  incotermPlace: string;
  hs6: string;
  originCountry: string;
  proofOfTransport: boolean;
  netWeight: string;
  grossWeight: string;
  packageCount: string;
  freight: string;
  insurance: string;
  sellerVat: string;
  currency: string;
  exchangeRate: string;
  iban: string;
  bic: string;
  swift: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalHt: string;
  totalTtc: string;
  sellerName: string;
  buyerName: string;
  awb: string;
  bl: string;
  packingList: string;
};

type Detection = {
  invoiceNumber?: string;
  invoiceDate?: string;
  currency?: string;
  totalHt?: number;
  totalTtc?: number;
  incoterm?: string;
  vatRate?: number;
  sellerName?: string;
  buyerName?: string;
  sellerCountry?: string;
  buyerCountry?: string;
  goodsOrServices?: "goods" | "services";
  buyerVat?: string;
};

type EssentialAlert = {
  id: string;
  label: string;
  status: "OK" | "WARN";
  message: string;
};

type AnalysisOutput = {
  assessment: InvoiceAssessment;
  context: TransactionContext;
  invoice: InvoiceData;
  customsAlerts: EssentialAlert[];
  actionsToFix: string[];
  missingQuestions: string[];
};

function stripAccents(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseAmount(raw: string): number | null {
  const cleaned = String(raw || "").replace(/[^0-9,.-]/g, "").trim();
  if (!cleaned) return null;

  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: string): number | null {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalInteger(value: string): number {
  const parsed = Number(String(value || "").replace(/[^0-9-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function normalizeHs6(value: string) {
  return String(value || "").replace(/[^0-9]/g, "").slice(0, 6);
}

function normalizeIso2(value: string) {
  return String(value || "").trim().toUpperCase().slice(0, 2);
}

function mergeUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasDetectedData(detected: Detection | null) {
  if (!detected) return false;
  return Object.values(detected).some((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function extractReadableTextFromPdfBytes(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes);
  const parenthesisStrings = Array.from(raw.matchAll(/\(([^()]{2,180})\)/g))
    .map((match) => match[1])
    .join(" ");

  const coarseText = raw.replace(/[^A-Za-z0-9%.,:;\/\-\s]/g, " ");
  const merged = `${parenthesisStrings} ${coarseText}`.replace(/\s+/g, " ").trim();
  return merged.slice(0, 40000);
}

async function extractTextFromPdf(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    let text = "";

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const pageText = (content.items || [])
        .map((item: any) => ("str" in item ? String(item.str) : ""))
        .join(" ");
      text += `${pageText}\n`;
    }

    if (text.trim()) {
      return text.trim();
    }
  } catch {
    // fallback below
  }

  return extractReadableTextFromPdfBytes(bytes);
}

function detectCountryFromChunk(chunk: string, allowIso = false): string | null {
  const normalized = stripAccents(chunk).toLowerCase();

  for (const country of COUNTRIES) {
    const fr = stripAccents(country.label_fr).toLowerCase();
    const en = stripAccents(country.label_en).toLowerCase();
    if ((fr && normalized.includes(fr)) || (en && normalized.includes(en))) {
      return country.iso2;
    }
  }

  if (!allowIso) return null;

  const isoMatches = chunk.toUpperCase().match(/\b[A-Z]{2}\b/g) || [];
  for (const match of isoMatches) {
    if (COUNTRIES.some((country) => country.iso2 === match)) {
      return match;
    }
  }

  return null;
}

function detectCountryNearLabel(rawText: string, labels: RegExp[]) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (!labels.some((label) => label.test(line))) continue;
    const iso2 = detectCountryFromChunk(line, true);
    if (iso2) return iso2;
  }
  return null;
}

function detectCountriesByOrder(rawText: string) {
  const normalized = stripAccents(rawText).toLowerCase();
  const hits: Array<{ iso2: string; index: number }> = [];

  for (const country of COUNTRIES) {
    const fr = stripAccents(country.label_fr).toLowerCase();
    const en = stripAccents(country.label_en).toLowerCase();
    const idxFr = fr ? normalized.indexOf(fr) : -1;
    const idxEn = en ? normalized.indexOf(en) : -1;
    const idx = [idxFr, idxEn].filter((value) => value >= 0).sort((a, b) => a - b)[0];

    if (typeof idx === "number" && idx >= 0) {
      hits.push({ iso2: country.iso2, index: idx });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return mergeUnique(hits.map((hit) => hit.iso2));
}
function detectFromText(rawText: string): Detection | null {
  const compact = String(rawText || "").replace(/\u0000/g, " ");
  const oneLine = compact.replace(/\s+/g, " ").trim();
  if (oneLine.length < 20) return null;

  const detection: Detection = {};

  const invoiceMatch = oneLine.match(/(?:invoice|facture)\s*(?:n[o°]|number|numero)?\s*[:#-]?\s*([A-Z0-9\-/]{4,})/i);
  if (invoiceMatch) detection.invoiceNumber = invoiceMatch[1];

  const dateMatch = oneLine.match(/\b(20\d{2}[\/-]\d{2}[\/-]\d{2}|\d{2}[\/-]\d{2}[\/-]20\d{2})\b/);
  if (dateMatch) detection.invoiceDate = dateMatch[1];

  const currencyMatch = oneLine.match(/\b(EUR|USD|GBP|CHF|CAD|AUD|JPY|CNY|MAD|BRL)\b/i);
  if (currencyMatch) detection.currency = currencyMatch[1].toUpperCase();

  const htMatch = oneLine.match(/(?:total\s*ht|subtotal|net\s*amount)\s*[:\-]?\s*([0-9][0-9\s.,-]{1,20})/i);
  if (htMatch) {
    const parsed = parseAmount(htMatch[1]);
    if (parsed != null) detection.totalHt = parsed;
  }

  const ttcMatch = oneLine.match(/(?:total\s*(?:ttc|due)|grand\s*total|amount\s*due)\s*[:\-]?\s*([0-9][0-9\s.,-]{1,20})/i);
  if (ttcMatch) {
    const parsed = parseAmount(ttcMatch[1]);
    if (parsed != null) detection.totalTtc = parsed;
  }

  const incotermMatch = oneLine.match(/\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/i);
  if (incotermMatch) detection.incoterm = incotermMatch[1].toUpperCase();

  const vatRateMatch = oneLine.match(/(?:tva|vat)\s*[: ]?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i);
  if (vatRateMatch) {
    const parsed = parseOptionalNumber(vatRateMatch[1]);
    if (parsed != null) detection.vatRate = parsed;
  }

  const buyerVatMatch = oneLine.match(/\b([A-Z]{2}[A-Z0-9]{8,12})\b/);
  if (buyerVatMatch) detection.buyerVat = buyerVatMatch[1].toUpperCase();

  if (/\b(service|services|prestation|consulting)\b/i.test(oneLine)) {
    detection.goodsOrServices = "services";
  } else if (/\b(goods|marchandise|product|quantity|qty|hs\s*\d{4,6})\b/i.test(oneLine)) {
    detection.goodsOrServices = "goods";
  }

  const sellerNameMatch = compact.match(/(?:seller|vendeur|fournisseur)\s*[:\-]\s*([^\n\r]+)/i);
  if (sellerNameMatch) detection.sellerName = sellerNameMatch[1].trim();

  const buyerNameMatch = compact.match(/(?:buyer|acheteur|client|bill\s*to)\s*[:\-]\s*([^\n\r]+)/i);
  if (buyerNameMatch) detection.buyerName = buyerNameMatch[1].trim();

  const sellerCountry = detectCountryNearLabel(compact, [/(seller|vendeur|fournisseur|exporter|ship\s*from)/i, /(pays\s*vendeur)/i]);
  const buyerCountry = detectCountryNearLabel(compact, [/(buyer|acheteur|client|importer|ship\s*to)/i, /(pays\s*acheteur)/i]);

  if (sellerCountry) detection.sellerCountry = sellerCountry;
  if (buyerCountry) detection.buyerCountry = buyerCountry;

  if (!detection.sellerCountry || !detection.buyerCountry) {
    const ordered = detectCountriesByOrder(compact);
    if (!detection.sellerCountry && ordered[0]) detection.sellerCountry = ordered[0];
    if (!detection.buyerCountry && ordered[1]) detection.buyerCountry = ordered[1];
  }

  return hasDetectedData(detection) ? detection : null;
}

function createInitialExpress(): ExpressForm {
  return {
    goodsOrServices: "",
    sellerCountry: "",
    buyerCountry: "",
    buyerIsTaxable: "",
    buyerVat: "",
  };
}

function createInitialPro(): ProForm {
  return {
    incoterm: "",
    incotermPlace: "",
    hs6: "",
    originCountry: "",
    proofOfTransport: false,
    netWeight: "",
    grossWeight: "",
    packageCount: "",
    freight: "",
    insurance: "",
    sellerVat: "",
    currency: "EUR",
    exchangeRate: "",
    iban: "",
    bic: "",
    swift: "",
    invoiceNumber: "",
    invoiceDate: "",
    totalHt: "",
    totalTtc: "",
    sellerName: "",
    buyerName: "",
    awb: "",
    bl: "",
    packingList: "",
  };
}

function buildAssessmentInput(express: ExpressForm, pro: ProForm, detected: Detection | null) {
  const localQuestions: string[] = [];

  const goodsOrServices = express.goodsOrServices || detected?.goodsOrServices || "goods";
  if (!express.goodsOrServices && !detected?.goodsOrServices) {
    localQuestions.push("La facture concerne des biens ou des services ?");
  }

  const sellerCountry = normalizeIso2(express.sellerCountry || detected?.sellerCountry || "");
  if (!sellerCountry) localQuestions.push("Quel est le pays vendeur ?");

  const buyerCountry = normalizeIso2(express.buyerCountry || detected?.buyerCountry || "");
  if (!buyerCountry) localQuestions.push("Quel est le pays acheteur ?");

  const buyerIsTaxable = express.buyerIsTaxable === "yes" ? true : express.buyerIsTaxable === "no" ? false : true;
  if (!express.buyerIsTaxable) localQuestions.push("Acheteur professionnel assujetti TVA ?");

  const flowDirection: TransactionContext["flowDirection"] =
    sellerCountry && buyerCountry && sellerCountry !== buyerCountry
      ? buyerCountry === "FR"
        ? "import"
        : sellerCountry === "FR"
          ? "export"
          : "auto"
      : "auto";

  const currency = String(pro.currency || detected?.currency || "EUR").toUpperCase();
  const exchangeRate = parseOptionalNumber(pro.exchangeRate);

  const totalHt = parseAmount(pro.totalHt) ?? detected?.totalHt ?? 0;
  const totalTtcRaw = parseAmount(pro.totalTtc) ?? detected?.totalTtc ?? 0;
  const vatFromRate = detected?.vatRate ? round2(totalHt * detected.vatRate / 100) : 0;
  const vatAmount = totalTtcRaw > 0 && totalHt > 0 ? round2(Math.max(0, totalTtcRaw - totalHt)) : vatFromRate;
  const totalTtc = totalTtcRaw > 0 ? totalTtcRaw : round2(totalHt + vatAmount);

  const context: TransactionContext = {
    goodsOrServices,
    flowDirection,
    sellerCountry,
    buyerCountry,
    buyerIsTaxable,
    sellerVat: String(pro.sellerVat || "").toUpperCase().replace(/\s+/g, ""),
    buyerVat: String(express.buyerVat || detected?.buyerVat || "").toUpperCase().replace(/\s+/g, ""),
    currency,
    exchangeRate,
    incoterm: (pro.incoterm || detected?.incoterm || "").toUpperCase(),
    incotermPlace: pro.incotermPlace,
    proofOfTransport: pro.proofOfTransport,
  };

  const invoice: InvoiceData = {
    invoiceNumber: pro.invoiceNumber || detected?.invoiceNumber || "",
    issueDate: pro.invoiceDate || detected?.invoiceDate || "",
    poReference: "",
    contractReference: "",
    seller: {
      name: pro.sellerName || detected?.sellerName || "",
      address: "",
      identifier: "",
    },
    buyer: {
      name: pro.buyerName || detected?.buyerName || "",
      address: "",
      identifier: "",
    },
    lines: [
      {
        id: "line-1",
        description: goodsOrServices === "services" ? "Prestation" : "Marchandises",
        hs6: normalizeHs6(pro.hs6),
        originCountry: normalizeIso2(pro.originCountry),
        qty: 1,
        unit: goodsOrServices === "services" ? "service" : "lot",
        unitPrice: totalHt,
        discountPct: 0,
        lineValue: totalHt,
      },
    ],
    totals: {
      totalHt,
      vatAmount,
      totalTtc: totalTtc,
    },
    netWeight: parseOptionalNumber(pro.netWeight) || 0,
    grossWeight: parseOptionalNumber(pro.grossWeight) || 0,
    packageCount: parseOptionalInteger(pro.packageCount),
    marksNumbers: "",
    payment: {
      dueDate: "",
      iban: String(pro.iban || "").toUpperCase().replace(/\s+/g, ""),
      bic: String(pro.bic || "").toUpperCase().replace(/\s+/g, ""),
      swift: String(pro.swift || "").toUpperCase().replace(/\s+/g, ""),
    },
    charges: {
      freight: parseOptionalNumber(pro.freight) || 0,
      insurance: parseOptionalNumber(pro.insurance) || 0,
      other: 0,
    },
    documents: {
      awb: pro.awb,
      bl: pro.bl,
      packingList: pro.packingList,
    },
  };

  return {
    context,
    invoice,
    localQuestions: mergeUnique(localQuestions).slice(0, 3),
  };
}

function buildEssentialCustomsAlerts(context: TransactionContext, invoice: InvoiceData): EssentialAlert[] {
  return [
    {
      id: "incoterm",
      label: "Incoterm",
      status: context.incoterm && context.incotermPlace ? "OK" : "WARN",
      message: context.incoterm && context.incotermPlace
        ? `${context.incoterm} ${context.incotermPlace}`
        : "Incoterm ou lieu manquant",
    },
    {
      id: "hs6",
      label: "Code HS",
      status: invoice.lines[0]?.hs6?.length === 6 ? "OK" : "WARN",
      message: invoice.lines[0]?.hs6?.length === 6 ? invoice.lines[0].hs6 : "HS6 absent",
    },
    {
      id: "origin",
      label: "Origine",
      status: invoice.lines[0]?.originCountry ? "OK" : "WARN",
      message: invoice.lines[0]?.originCountry || "Pays d'origine absent",
    },
    {
      id: "value",
      label: "Valeur facture",
      status: invoice.totals.totalHt > 0 ? "OK" : "WARN",
      message: invoice.totals.totalHt > 0
        ? `${invoice.totals.totalHt.toFixed(2)} ${context.currency}`
        : "Valeur HT manquante",
    },
    {
      id: "freight_insurance",
      label: "Fret / Assurance",
      status: invoice.charges.freight > 0 || invoice.charges.insurance > 0 ? "OK" : "WARN",
      message: invoice.charges.freight > 0 || invoice.charges.insurance > 0
        ? `Fret ${invoice.charges.freight || 0} / Assurance ${invoice.charges.insurance || 0}`
        : "Fret et assurance non renseignes",
    },
  ];
}

function buildActions(checks: CheckerItem[]) {
  const fixes = mergeUnique(
    checks
      .filter((check) => check.status !== "OK")
      .map((check) => check.what_to_fix),
  );
  return fixes.slice(0, 5);
}

function statusPill(status: "OK" | "WARN" | "KO") {
  if (status === "OK") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>;
  }
  if (status === "WARN") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">WARN</Badge>;
  }
  return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">KO</Badge>;
}
export default function InvoiceCheck() {
  const { toast } = useToast();

  const [express, setExpress] = React.useState<ExpressForm>(() => createInitialExpress());
  const [pro, setPro] = React.useState<ProForm>(() => createInitialPro());
  const [pastedText, setPastedText] = React.useState("");
  const [pdfText, setPdfText] = React.useState("");
  const [pdfFileName, setPdfFileName] = React.useState("");
  const [isExtractingPdf, setIsExtractingPdf] = React.useState(false);
  const [extractError, setExtractError] = React.useState("");
  const [detected, setDetected] = React.useState<Detection | null>(null);
  const [detectedPending, setDetectedPending] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<1 | 2>(1);
  const [result, setResult] = React.useState<AnalysisOutput | null>(null);

  const mergedSourceText = React.useMemo(
    () => [pdfText, pastedText].filter(Boolean).join("\n"),
    [pdfText, pastedText],
  );

  const handlePdfSelected = React.useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({
          title: "Format non supporte",
          description: "Importez un fichier PDF.",
        });
        return;
      }

      setPdfFileName(file.name);
      setExtractError("");
      setIsExtractingPdf(true);

      try {
        const text = await extractTextFromPdf(file);
        setPdfText(text);

        const auto = detectFromText(text);
        setDetected(auto);
        setDetectedPending(Boolean(auto));

        toast({
          title: "PDF traite",
          description: auto
            ? "Champs detectes proposes. Confirmez ou corrigez."
            : "Extraction partielle: continuez en saisie express.",
        });
      } catch {
        setExtractError("Extraction PDF indisponible. Continuez en saisie manuelle.");
        setPdfText("");
      } finally {
        setIsExtractingPdf(false);
      }
    },
    [toast],
  );

  const applyDetectedValues = React.useCallback(() => {
    if (!detected) return;

    setExpress((prev) => ({
      goodsOrServices: prev.goodsOrServices || detected.goodsOrServices || "",
      sellerCountry: prev.sellerCountry || detected.sellerCountry || "",
      buyerCountry: prev.buyerCountry || detected.buyerCountry || "",
      buyerIsTaxable: prev.buyerIsTaxable,
      buyerVat: prev.buyerVat || detected.buyerVat || "",
    }));

    setPro((prev) => ({
      ...prev,
      currency: prev.currency || detected.currency || "EUR",
      incoterm: prev.incoterm || detected.incoterm || "",
      invoiceNumber: prev.invoiceNumber || detected.invoiceNumber || "",
      invoiceDate: prev.invoiceDate || detected.invoiceDate || "",
      totalHt: prev.totalHt || (detected.totalHt ? String(detected.totalHt) : ""),
      totalTtc: prev.totalTtc || (detected.totalTtc ? String(detected.totalTtc) : ""),
      sellerName: prev.sellerName || detected.sellerName || "",
      buyerName: prev.buyerName || detected.buyerName || "",
    }));

    setDetectedPending(false);
    toast({
      title: "Valeurs detectees appliquees",
      description: "Les champs express ont ete pre-remplis.",
    });
  }, [detected, toast]);

  const handleAnalyze = React.useCallback(() => {
    const freshDetected = mergedSourceText ? detectFromText(mergedSourceText) : null;
    const effectiveDetected = freshDetected || detected;

    if (freshDetected) {
      setDetected(freshDetected);
      if (!detectedPending) setDetectedPending(true);
    }

    const built = buildAssessmentInput(express, pro, effectiveDetected);
    const assessment = assessInvoice(built.context, built.invoice);

    const allChecks = [
      ...assessment.checks_by_tab.mentions,
      ...assessment.checks_by_tab.vat,
      ...assessment.checks_by_tab.customs,
      ...assessment.checks_by_tab.fx,
      ...assessment.checks_by_tab.calculs,
      ...assessment.checks_by_tab.risks,
    ];

    const actionsToFix = buildActions(allChecks);
    const missingQuestions = mergeUnique([
      ...assessment.vat_result.missing_questions,
      ...built.localQuestions,
    ]).slice(0, 4);

    const customsAlerts = buildEssentialCustomsAlerts(built.context, built.invoice);

    setResult({
      assessment,
      context: built.context,
      invoice: built.invoice,
      customsAlerts,
      actionsToFix,
      missingQuestions,
    });

    setCurrentStep(2);
  }, [detected, detectedPending, express, mergedSourceText, pro]);

  const globalStatus = result
    ? result.assessment.status === "OK"
      ? "OK"
      : result.assessment.status === "WARNING"
        ? "WARN"
        : "KO"
    : "WARN";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Verification de facture</h1>
          <p className="text-sm text-muted-foreground">
            Wizard 30 secondes: verif express puis resultat. Les champs Pro sont optionnels.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={currentStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}>
              Etape 1: Verif express
            </Badge>
            <Badge className={currentStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}>
              Etape 2: Resultat
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Etape 1 - Verif express</CardTitle>
            <CardDescription>
              5 champs maximum pour un verdict TVA rapide. Les donnees partielles restent analysees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Upload PDF (optionnel)</Label>
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    void handlePdfSelected(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                {pdfFileName ? <p className="text-xs text-muted-foreground">Fichier: {pdfFileName}</p> : null}
                {isExtractingPdf ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Extraction PDF en cours
                  </p>
                ) : null}
                {extractError ? <p className="text-xs text-amber-700">{extractError}</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Coller texte (optionnel)</Label>
                <Textarea
                  value={pastedText}
                  onChange={(event) => setPastedText(event.target.value)}
                  placeholder="Collez ici le texte de la facture ou du mail client"
                  className="min-h-[98px]"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label>Biens / Services</Label>
                <Select
                  value={express.goodsOrServices || undefined}
                  onValueChange={(value: "goods" | "services") =>
                    setExpress((prev) => ({ ...prev, goodsOrServices: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Si non detecte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goods">Biens</SelectItem>
                    <SelectItem value="services">Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Pays vendeur</Label>
                <Select
                  value={express.sellerCountry || undefined}
                  onValueChange={(value) => setExpress((prev) => ({ ...prev, sellerCountry: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Si non detecte" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={`seller-${country.iso2}`} value={country.iso2}>
                        {country.label_fr} ({country.iso2})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Pays acheteur</Label>
                <Select
                  value={express.buyerCountry || undefined}
                  onValueChange={(value) => setExpress((prev) => ({ ...prev, buyerCountry: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Si non detecte" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={`buyer-${country.iso2}`} value={country.iso2}>
                        {country.label_fr} ({country.iso2})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Acheteur pro assujetti ?</Label>
                <Select
                  value={express.buyerIsTaxable || undefined}
                  onValueChange={(value: "yes" | "no") =>
                    setExpress((prev) => ({ ...prev, buyerIsTaxable: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Obligatoire" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>N TVA acheteur (optionnel)</Label>
                <Input
                  value={express.buyerVat}
                  onChange={(event) =>
                    setExpress((prev) => ({
                      ...prev,
                      buyerVat: event.target.value.toUpperCase().replace(/\s+/g, ""),
                    }))
                  }
                  placeholder="IT123..."
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAnalyze}>Analyser</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setExpress(createInitialExpress());
                  setPro(createInitialPro());
                  setPastedText("");
                  setPdfText("");
                  setPdfFileName("");
                  setDetected(null);
                  setDetectedPending(false);
                  setResult(null);
                  setCurrentStep(1);
                }}
              >
                Reinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>
        {hasDetectedData(detected) ? (
          <Card className={detectedPending ? "border-primary/50" : undefined}>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Detecte
              </CardTitle>
              <CardDescription>Champs proposes depuis PDF/texte. Confirmez ou corrigez.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
                {detected?.goodsOrServices ? <p>Type: {detected.goodsOrServices === "goods" ? "Biens" : "Services"}</p> : null}
                {detected?.sellerCountry ? <p>Vendeur: {detected.sellerCountry}</p> : null}
                {detected?.buyerCountry ? <p>Acheteur: {detected.buyerCountry}</p> : null}
                {detected?.invoiceNumber ? <p>Facture: {detected.invoiceNumber}</p> : null}
                {detected?.invoiceDate ? <p>Date: {detected.invoiceDate}</p> : null}
                {detected?.currency ? <p>Devise: {detected.currency}</p> : null}
                {typeof detected?.totalHt === "number" ? <p>Total HT: {detected.totalHt}</p> : null}
                {typeof detected?.totalTtc === "number" ? <p>Total TTC: {detected.totalTtc}</p> : null}
                {detected?.incoterm ? <p>Incoterm: {detected.incoterm}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={applyDetectedValues}>Confirmer</Button>
                <Button size="sm" variant="outline" onClick={() => setDetectedPending(false)}>
                  Corriger
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Mode Pro (optionnel)</CardTitle>
            <CardDescription>
              Champs avances pour douane, paiement et coherence documentaire. Aucun de ces champs ne bloque le verdict TVA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="pro-customs">
                <AccordionTrigger>PRO Douane</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Incoterm</Label>
                      <Select value={pro.incoterm || undefined} onValueChange={(value) => setPro((prev) => ({ ...prev, incoterm: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Optionnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {INCOTERMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Lieu Incoterm</Label>
                      <Input value={pro.incotermPlace} onChange={(event) => setPro((prev) => ({ ...prev, incotermPlace: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>HS6</Label>
                      <Input value={pro.hs6} onChange={(event) => setPro((prev) => ({ ...prev, hs6: normalizeHs6(event.target.value) }))} placeholder="850760" />
                    </div>
                    <div className="space-y-1">
                      <Label>Origine</Label>
                      <Input value={pro.originCountry} onChange={(event) => setPro((prev) => ({ ...prev, originCountry: normalizeIso2(event.target.value) }))} placeholder="FR" />
                    </div>
                    <div className="space-y-1">
                      <Label>Poids net</Label>
                      <Input value={pro.netWeight} onChange={(event) => setPro((prev) => ({ ...prev, netWeight: event.target.value }))} placeholder="kg" />
                    </div>
                    <div className="space-y-1">
                      <Label>Poids brut</Label>
                      <Input value={pro.grossWeight} onChange={(event) => setPro((prev) => ({ ...prev, grossWeight: event.target.value }))} placeholder="kg" />
                    </div>
                    <div className="space-y-1">
                      <Label>Nombre colis</Label>
                      <Input value={pro.packageCount} onChange={(event) => setPro((prev) => ({ ...prev, packageCount: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Preuve transport UE</Label>
                      <Select
                        value={pro.proofOfTransport ? "yes" : "no"}
                        onValueChange={(value) => setPro((prev) => ({ ...prev, proofOfTransport: value === "yes" }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Oui</SelectItem>
                          <SelectItem value="no">Non</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Fret</Label>
                      <Input value={pro.freight} onChange={(event) => setPro((prev) => ({ ...prev, freight: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Assurance</Label>
                      <Input value={pro.insurance} onChange={(event) => setPro((prev) => ({ ...prev, insurance: event.target.value }))} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pro-payment">
                <AccordionTrigger>PRO Paiement / Fraude</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label>N TVA vendeur</Label>
                      <Input value={pro.sellerVat} onChange={(event) => setPro((prev) => ({ ...prev, sellerVat: event.target.value.toUpperCase().replace(/\s+/g, "") }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Devise</Label>
                      <Input value={pro.currency} onChange={(event) => setPro((prev) => ({ ...prev, currency: event.target.value.toUpperCase().slice(0, 3) }))} placeholder="EUR" />
                    </div>
                    <div className="space-y-1">
                      <Label>Taux de change</Label>
                      <Input value={pro.exchangeRate} onChange={(event) => setPro((prev) => ({ ...prev, exchangeRate: event.target.value }))} placeholder="si devise != EUR" />
                    </div>
                    <div className="space-y-1">
                      <Label>IBAN</Label>
                      <Input value={pro.iban} onChange={(event) => setPro((prev) => ({ ...prev, iban: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>BIC</Label>
                      <Input value={pro.bic} onChange={(event) => setPro((prev) => ({ ...prev, bic: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>SWIFT</Label>
                      <Input value={pro.swift} onChange={(event) => setPro((prev) => ({ ...prev, swift: event.target.value }))} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pro-docs">
                <AccordionTrigger>PRO Coherence docs</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Numero facture</Label>
                      <Input value={pro.invoiceNumber} onChange={(event) => setPro((prev) => ({ ...prev, invoiceNumber: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Date facture</Label>
                      <Input type="date" value={pro.invoiceDate} onChange={(event) => setPro((prev) => ({ ...prev, invoiceDate: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total HT</Label>
                      <Input value={pro.totalHt} onChange={(event) => setPro((prev) => ({ ...prev, totalHt: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total TTC</Label>
                      <Input value={pro.totalTtc} onChange={(event) => setPro((prev) => ({ ...prev, totalTtc: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nom vendeur</Label>
                      <Input value={pro.sellerName} onChange={(event) => setPro((prev) => ({ ...prev, sellerName: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nom acheteur</Label>
                      <Input value={pro.buyerName} onChange={(event) => setPro((prev) => ({ ...prev, buyerName: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>AWB</Label>
                      <Input value={pro.awb} onChange={(event) => setPro((prev) => ({ ...prev, awb: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>B/L</Label>
                      <Input value={pro.bl} onChange={(event) => setPro((prev) => ({ ...prev, bl: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Packing list</Label>
                      <Input value={pro.packingList} onChange={(event) => setPro((prev) => ({ ...prev, packingList: event.target.value }))} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
        {result ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Etape 2 - Resultat</CardTitle>
                  <CardDescription>Decision rapide avec priorites de correction.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-sm">Score {result.assessment.score}/100</Badge>
                  {statusPill(globalStatus)}
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(1)}>
                    Modifier la saisie
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">1) Decision TVA</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">{result.assessment.vat_result.status}</p>
                    <p className="text-muted-foreground">{result.assessment.vat_result.reason}</p>
                    {result.assessment.vat_result.required_invoice_mentions.length > 0 ? (
                      <div className="space-y-1">
                        {result.assessment.vat_result.required_invoice_mentions.map((mention) => (
                          <p key={mention}>- {mention}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Aucune mention specifique detectee.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">2) Douane essentiel</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.customsAlerts.map((alert) => (
                      <div key={alert.id} className="rounded-md border p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="font-medium">{alert.label}</p>
                          {statusPill(alert.status)}
                        </div>
                        <p className="text-muted-foreground">{alert.message}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">3) Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="mb-1 font-medium">Ce qu'il faut corriger</p>
                      {result.actionsToFix.length > 0 ? (
                        result.actionsToFix.map((action) => <p key={action}>- {action}</p>)
                      ) : (
                        <p className="text-muted-foreground">Aucune correction bloquante.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 font-medium">Questions manquantes</p>
                      {result.missingQuestions.length > 0 ? (
                        result.missingQuestions.map((question) => <p key={question}>- {question}</p>)
                      ) : (
                        <p className="text-muted-foreground">Aucune question prioritaire.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {result.assessment.status === "BLOCKING" ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Points bloquants detectes</AlertTitle>
                  <AlertDescription>
                    Completez les champs critiques, puis relancez l'analyse.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Analyse terminee</AlertTitle>
                  <AlertDescription>
                    Verdict disponible meme avec donnees partielles. Mode Pro pour affiner si necessaire.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Conseil: commencez en express, puis ouvrez seulement l'accordeon Pro utile au cas.
        </p>
      </div>
    </AppLayout>
  );
}
