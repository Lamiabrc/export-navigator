
import * as React from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, Sparkles } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, CURRENCIES, INCOTERMS } from "@/lib/constants";
import {
  assessInvoice,
  evaluateCustomsAdvanced,
  summarizeChecks,
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

type CoreContext = {
  goodsOrServices: "goods" | "services";
  goodsKnown: boolean;
  sellerCountry: string;
  buyerCountry: string;
  buyerIsTaxable: boolean;
  buyerIsTaxableKnown: boolean;
};

type AnalysisOutput = {
  assessment: InvoiceAssessment;
  context: TransactionContext;
  invoice: InvoiceData;
  allChecks: CheckerItem[];
  summary: ReturnType<typeof summarizeChecks>;
  customsAlerts: EssentialAlert[];
  missingQuestions: string[];
  coreContextReady: boolean;
};

const COUNTRY_ALIASES: Array<{ alias: string; iso2: string }> = [
  { alias: "uk", iso2: "GB" },
  { alias: "gb", iso2: "GB" },
  { alias: "united kingdom", iso2: "GB" },
  { alias: "great britain", iso2: "GB" },
  { alias: "angleterre", iso2: "GB" },
  { alias: "royaume uni", iso2: "GB" },
  { alias: "usa", iso2: "US" },
  { alias: "united states", iso2: "US" },
  { alias: "etats unis", iso2: "US" },
  { alias: "uae", iso2: "AE" },
  { alias: "united arab emirates", iso2: "AE" },
  { alias: "emirats arabes unis", iso2: "AE" },
  { alias: "emirats", iso2: "AE" },
  { alias: "holland", iso2: "NL" },
  { alias: "netherlands", iso2: "NL" },
  { alias: "pays bas", iso2: "NL" },
  { alias: "coree du sud", iso2: "KR" },
  { alias: "south korea", iso2: "KR" },
];

const FIELD_DOM_IDS: Record<string, string> = {
  "context.goodsOrServices": "field-goods-or-services",
  "context.sellerCountry": "field-seller-country",
  "context.buyerCountry": "field-buyer-country",
  "context.buyerIsTaxable": "field-buyer-taxable",
  "context.buyerVat": "field-buyer-vat",
  "context.sellerVat": "field-seller-vat",
  "context.currency": "field-currency",
  "context.exchangeRate": "field-exchange-rate",
  "context.incoterm": "field-incoterm",
  "context.incotermPlace": "field-incoterm-place",
  "context.proofOfTransport": "field-proof-transport",
  "invoice.invoiceNumber": "field-invoice-number",
  "invoice.issueDate": "field-invoice-date",
  "invoice.seller": "field-seller-name",
  "invoice.buyer": "field-buyer-name",
  "invoice.lines": "field-product-query",
  "invoice.lines.0.description": "field-product-query",
  "invoice.lines.0.hs6": "field-hs6",
  "invoice.lines.0.originCountry": "field-origin-country",
  "invoice.lines.0.lineValue": "field-total-ht",
  "invoice.totals.totalHt": "field-total-ht",
  "invoice.totals.totalTtc": "field-total-ttc",
  "invoice.payment.iban": "field-iban",
  "invoice.payment.bic": "field-bic",
  "invoice.documents": "field-awb",
  "invoice.grossWeight": "field-gross-weight",
  "invoice.packageCount": "field-package-count",
  "invoice.charges.freight": "field-freight",
};

const CHECK_FIELDPATH_FALLBACK: Record<string, string> = {
  mentions_invoice_number: "invoice.invoiceNumber",
  mentions_issue_date: "invoice.issueDate",
  mentions_seller_identity: "invoice.seller",
  mentions_buyer_identity: "invoice.buyer",
  mentions_lines: "invoice.lines",
  mentions_incoterm: "context.incoterm",
  pay_iban_format: "invoice.payment.iban",
  pay_bic_swift: "invoice.payment.bic",
  pay_country_consistency: "invoice.payment.iban",
  docs_cross_consistency: "invoice.documents",
  calc_subtotal: "invoice.totals.totalHt",
  calc_ttc: "invoice.totals.totalTtc",
  calc_line_values: "invoice.lines.0.lineValue",
  risk_weights: "invoice.grossWeight",
  risk_packages: "invoice.packageCount",
  vat_status: "context.buyerIsTaxable",
  vat_vies_format: "context.buyerVat",
  customs_line_description: "invoice.lines.0.description",
  customs_hs6: "invoice.lines.0.hs6",
  customs_origin: "invoice.lines.0.originCountry",
  customs_incoterm_place: "context.incoterm",
  customs_value_currency: "invoice.totals.totalHt",
  customs_value_breakdown: "invoice.charges.freight",
  customs_ddp_consistency: "context.incoterm",
  fx_iso4217: "context.currency",
  fx_rate_presence: "context.exchangeRate",
  fx_conversion: "context.exchangeRate",
};

function stripAccents(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function formatCountry(iso2: string) {
  const normalized = normalizeIso2(iso2);
  if (!normalized) return "";
  const found = COUNTRIES.find((country) => country.iso2 === normalized);
  if (!found) return normalized;
  return `${found.label_fr} (${normalized})`;
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

function findCountriesByAlias(rawText: string) {
  const normalized = ` ${normalizeText(rawText)} `;
  const hits: Array<{ iso2: string; index: number }> = [];

  for (const item of COUNTRY_ALIASES) {
    const alias = normalizeText(item.alias);
    if (!alias) continue;
    const pattern = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
    const match = pattern.exec(normalized);
    if (match) {
      hits.push({ iso2: item.iso2, index: match.index });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return mergeUnique(hits.map((hit) => hit.iso2));
}

function detectCountryFromChunk(chunk: string, allowIso = false): string | null {
  const normalized = normalizeText(chunk);

  const aliasMatch = findCountriesByAlias(normalized)[0];
  if (aliasMatch) return aliasMatch;

  for (const country of COUNTRIES) {
    const fr = normalizeText(country.label_fr);
    const en = normalizeText(country.label_en);
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
    if (!labels.some((label) => label.test(normalizeText(line)))) continue;
    const iso2 = detectCountryFromChunk(line, true);
    if (iso2) return iso2;
  }
  return null;
}

function detectCountriesByOrder(rawText: string) {
  const normalized = normalizeText(rawText);
  const hits: Array<{ iso2: string; index: number }> = [];

  for (const country of COUNTRIES) {
    const fr = normalizeText(country.label_fr);
    const en = normalizeText(country.label_en);
    const idxFr = fr ? normalized.indexOf(fr) : -1;
    const idxEn = en ? normalized.indexOf(en) : -1;
    const idx = [idxFr, idxEn].filter((value) => value >= 0).sort((a, b) => a - b)[0];

    if (typeof idx === "number" && idx >= 0) {
      hits.push({ iso2: country.iso2, index: idx });
    }
  }

  findCountriesByAlias(rawText).forEach((aliasCountry, idx) => {
    hits.push({ iso2: aliasCountry, index: 90000 + idx });
  });

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

function ensureCheckFieldPath(check: CheckerItem): CheckerItem {
  if (check.fieldPath) return check;
  const fallback = CHECK_FIELDPATH_FALLBACK[check.id];
  return fallback ? { ...check, fieldPath: fallback } : check;
}

function resolveCoreContext(
  express: ExpressForm,
  detectedState: Detection | null,
  detectedFromText: Detection | null,
  sourceText: string,
): CoreContext {
  const orderedCountries = detectCountriesByOrder(sourceText);

  const sellerCountry = normalizeIso2(
    express.sellerCountry
      || detectedState?.sellerCountry
      || detectedFromText?.sellerCountry
      || orderedCountries[0]
      || "",
  );

  const buyerCountry = normalizeIso2(
    express.buyerCountry
      || detectedState?.buyerCountry
      || detectedFromText?.buyerCountry
      || orderedCountries.find((iso) => iso !== sellerCountry)
      || orderedCountries[1]
      || "",
  );

  const goodsCandidate =
    express.goodsOrServices
    || detectedState?.goodsOrServices
    || detectedFromText?.goodsOrServices
    || "";

  const buyerIsTaxableKnown = express.buyerIsTaxable === "yes" || express.buyerIsTaxable === "no";
  const buyerIsTaxable = express.buyerIsTaxable === "yes";

  return {
    goodsOrServices: goodsCandidate || "goods",
    goodsKnown: Boolean(goodsCandidate),
    sellerCountry,
    buyerCountry,
    buyerIsTaxable,
    buyerIsTaxableKnown,
  };
}

function buildExpectedDocs(context: TransactionContext) {
  if (!context.sellerCountry || !context.buyerCountry) return [];
  if (context.sellerCountry === "FR" && context.buyerCountry !== "FR") {
    return [
      "Facture commerciale",
      "Packing list",
      "Preuve de sortie export (MRN/DAU)",
      "Document de transport",
    ];
  }
  if (context.buyerCountry === "FR" && context.sellerCountry !== "FR") {
    return [
      "Facture commerciale",
      "Document de transport (BL/AWB/CMR)",
      "Justificatifs valeur en douane",
      "Preuve origine produit",
    ];
  }
  return [
    "Facture avec mention TVA adaptee",
    "Preuve transport intra-UE",
    "Numero TVA valide du client",
  ];
}

function fieldDomId(fieldPath?: string) {
  if (!fieldPath) return "";
  return FIELD_DOM_IDS[fieldPath] || "";
}

function buildAssessmentInput(
  express: ExpressForm,
  pro: ProForm,
  detected: Detection | null,
  resolved: CoreContext,
) {
  const localQuestions: string[] = [];

  const goodsOrServices = resolved.goodsOrServices;
  if (!resolved.goodsKnown) {
    localQuestions.push("La facture concerne des biens ou des services ?");
  }

  const sellerCountry = normalizeIso2(resolved.sellerCountry);
  if (!sellerCountry) localQuestions.push("Quel est le pays vendeur ?");

  const buyerCountry = normalizeIso2(resolved.buyerCountry);
  if (!buyerCountry) localQuestions.push("Quel est le pays acheteur ?");

  const buyerIsTaxable = resolved.buyerIsTaxable;
  if (!resolved.buyerIsTaxableKnown) localQuestions.push("Acheteur professionnel assujetti TVA ?");

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
    coreContextReady: Boolean(
      sellerCountry
      && buyerCountry
      && resolved.goodsKnown
      && resolved.buyerIsTaxableKnown,
    ),
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

function statusPill(status: "OK" | "WARN" | "KO") {
  if (status === "OK") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>;
  }
  if (status === "WARN") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">WARN</Badge>;
  }
  return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">KO</Badge>;
}

function statusPillFromAssessment(status: "OK" | "WARNING" | "BLOCKING") {
  return statusPill(status === "OK" ? "OK" : status === "WARNING" ? "WARN" : "KO");
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
  const [productQuery, setProductQuery] = React.useState("");
  const [productChecks, setProductChecks] = React.useState<CheckerItem[]>([]);

  const mergedSourceText = React.useMemo(
    () => [pdfText, pastedText].filter(Boolean).join("\n"),
    [pdfText, pastedText],
  );

  const hasExpressCoreInput = React.useMemo(
    () =>
      Boolean(
        express.goodsOrServices
        && express.sellerCountry
        && express.buyerCountry
        && express.buyerIsTaxable,
      ),
    [express.buyerCountry, express.buyerIsTaxable, express.goodsOrServices, express.sellerCountry],
  );

  const detectedOverrides = React.useMemo(() => {
    if (!detected) return [];
    const overrides: string[] = [];

    const detectedType = detected.goodsOrServices || "";
    if (express.goodsOrServices && detectedType && express.goodsOrServices !== detectedType) {
      overrides.push("type biens/services");
    }

    const detectedSeller = normalizeIso2(detected.sellerCountry || "");
    const detectedBuyer = normalizeIso2(detected.buyerCountry || "");
    const expressSeller = normalizeIso2(express.sellerCountry);
    const expressBuyer = normalizeIso2(express.buyerCountry);

    if (expressSeller && detectedSeller && expressSeller !== detectedSeller) {
      overrides.push("pays vendeur");
    }
    if (expressBuyer && detectedBuyer && expressBuyer !== detectedBuyer) {
      overrides.push("pays acheteur");
    }

    return overrides;
  }, [detected, express.buyerCountry, express.goodsOrServices, express.sellerCountry]);

  React.useEffect(() => {
    if (detectedPending && hasExpressCoreInput) {
      setDetectedPending(false);
    }
  }, [detectedPending, hasExpressCoreInput]);

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

  const runAnalysis = React.useCallback((params: {
    expressInput: ExpressForm;
    proInput: ProForm;
    sourceText: string;
    detectedInput: Detection | null;
    preferFreshDetection?: boolean;
    allowDetectedPrompt?: boolean;
  }) => {
    const shouldUseFreshDetection = params.preferFreshDetection !== false;
    const freshDetected = shouldUseFreshDetection && params.sourceText
      ? detectFromText(params.sourceText)
      : null;
    const effectiveDetected = params.detectedInput || freshDetected;

    if (freshDetected) {
      setDetected(freshDetected);
      const expressCoreFilled = Boolean(
        params.expressInput.goodsOrServices
        && params.expressInput.sellerCountry
        && params.expressInput.buyerCountry
        && params.expressInput.buyerIsTaxable,
      );
      if (params.allowDetectedPrompt !== false && !expressCoreFilled && !detectedPending) {
        setDetectedPending(true);
      }
    }

    const resolvedCore = resolveCoreContext(
      params.expressInput,
      effectiveDetected,
      freshDetected,
      params.sourceText,
    );
    const built = buildAssessmentInput(params.expressInput, params.proInput, effectiveDetected, resolvedCore);
    const assessment = assessInvoice(built.context, built.invoice);

    const rawChecks = [
      ...assessment.checks_by_tab.mentions,
      ...assessment.checks_by_tab.vat,
      ...assessment.checks_by_tab.customs,
      ...assessment.checks_by_tab.fx,
      ...assessment.checks_by_tab.calculs,
      ...assessment.checks_by_tab.risks,
    ];
    const allChecks = rawChecks.map(ensureCheckFieldPath);
    const summary = summarizeChecks(allChecks);
    const missingQuestions = mergeUnique([
      ...assessment.vat_result.missing_questions,
      ...built.localQuestions,
    ]).slice(0, 4);
    const customsAlerts = buildEssentialCustomsAlerts(built.context, built.invoice);

    setResult({
      assessment,
      context: built.context,
      invoice: built.invoice,
      allChecks,
      summary,
      customsAlerts,
      missingQuestions,
      coreContextReady: built.coreContextReady,
    });

    setProductChecks([]);
    setCurrentStep(2);
  }, [detectedPending]);

  const applyDetectedValues = React.useCallback(() => {
    if (!detected) return;

    const nextExpress: ExpressForm = {
      goodsOrServices: express.goodsOrServices || detected.goodsOrServices || "",
      sellerCountry: express.sellerCountry || detected.sellerCountry || "",
      buyerCountry: express.buyerCountry || detected.buyerCountry || "",
      buyerIsTaxable: express.buyerIsTaxable,
      buyerVat: express.buyerVat || detected.buyerVat || "",
    };

    const nextPro: ProForm = {
      ...pro,
      currency: pro.currency || detected.currency || "EUR",
      incoterm: pro.incoterm || detected.incoterm || "",
      invoiceNumber: pro.invoiceNumber || detected.invoiceNumber || "",
      invoiceDate: pro.invoiceDate || detected.invoiceDate || "",
      totalHt: pro.totalHt || (detected.totalHt ? String(detected.totalHt) : ""),
      totalTtc: pro.totalTtc || (detected.totalTtc ? String(detected.totalTtc) : ""),
      sellerName: pro.sellerName || detected.sellerName || "",
      buyerName: pro.buyerName || detected.buyerName || "",
    };

    setExpress(nextExpress);
    setPro(nextPro);

    setDetectedPending(false);
    runAnalysis({
      expressInput: nextExpress,
      proInput: nextPro,
      sourceText: mergedSourceText,
      detectedInput: detected,
      preferFreshDetection: false,
      allowDetectedPrompt: false,
    });
    toast({
      title: "Valeurs detectees appliquees",
      description: "Les champs ont ete pre-remplis et l'analyse a ete lancee.",
    });
  }, [detected, express, mergedSourceText, pro, runAnalysis, toast]);

  const focusFieldPath = React.useCallback((fieldPath?: string) => {
    const domId = fieldDomId(fieldPath);
    setCurrentStep(1);
    if (!domId) return;

    window.setTimeout(() => {
      const node = document.getElementById(domId);
      if (!node) return;
      node.scrollIntoView({ behavior: "smooth", block: "center" });

      const focusable = node as HTMLElement;
      if (typeof focusable.focus === "function") {
        focusable.focus();
        return;
      }

      const nestedFocusable = node.querySelector<HTMLElement>(
        "input, textarea, button, select, [tabindex]:not([tabindex='-1'])",
      );
      nestedFocusable?.focus();
    }, 120);
  }, []);

  const handleAnalyze = React.useCallback(() => {
    runAnalysis({
      expressInput: express,
      proInput: pro,
      sourceText: mergedSourceText,
      detectedInput: detected,
      preferFreshDetection: true,
      allowDetectedPrompt: true,
    });
  }, [detected, express, mergedSourceText, pro, runAnalysis]);

  const handleProductRefine = React.useCallback(() => {
    if (!result) return;

    const hsFromQuery = normalizeHs6(productQuery);
    const line = result.invoice.lines[0];
    const refinedInvoice: InvoiceData = {
      ...result.invoice,
      lines: [
        {
          ...line,
          description: productQuery.trim() || line.description,
          hs6: line.hs6 || hsFromQuery,
        },
      ],
    };

    const checks = evaluateCustomsAdvanced({
      productQuery,
      context: result.context,
      invoice: refinedInvoice,
    }).map(ensureCheckFieldPath);

    setProductChecks(checks);
  }, [productQuery, result]);

  const expectedDocs = React.useMemo(() => {
    if (!result) return [];
    return buildExpectedDocs(result.context);
  }, [result]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Verification de facture internationale</CardTitle>
            <CardDescription>
              Controle rapide pour decisionner paiement, TVA et douane sans attendre toutes les donnees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <ul className="list-disc space-y-1 pl-5">
              <li>Paiement: verification format IBAN/BIC/SWIFT et signaux de risque.</li>
              <li>TVA + douane: regles generales selon vos pays et votre flux.</li>
              <li>4 infos suffisent pour demarrer, puis produit demande ensuite pour affiner.</li>
            </ul>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-sm">
                  Voir ce que l&apos;outil controle
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] text-sm" align="start">
                <div className="space-y-2">
                  <p className="font-medium">Perimetre de controle</p>
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>Mentions facture: identites, numero, date, lignes, totaux.</li>
                    <li>TVA: regle applicable, mention a inscrire, format VIES.</li>
                    <li>Devise: code ISO, taux et contre-valeur EUR si necessaire.</li>
                    <li>Douane: incoterm, HS, origine, valeur et pieces attendues.</li>
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

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
                  id="field-upload-pdf"
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
                  id="field-pasted-text"
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
                  <SelectTrigger id="field-goods-or-services">
                    <SelectValue placeholder="Selectionner" />
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
                  <SelectTrigger id="field-seller-country">
                    <SelectValue placeholder="Selectionner un pays" />
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
                  <SelectTrigger id="field-buyer-country">
                    <SelectValue placeholder="Selectionner un pays" />
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
                  <SelectTrigger id="field-buyer-taxable">
                    <SelectValue placeholder="Selectionner" />
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
                  id="field-buyer-vat"
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
                  setProductQuery("");
                  setProductChecks([]);
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
              <CardDescription>Champs proposes depuis PDF/texte. Confirmez pour appliquer puis lancer l'analyse.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detectedOverrides.length > 0 ? (
                <Alert>
                  <CircleHelp className="h-4 w-4" />
                  <AlertTitle>Priorite aux champs du formulaire</AlertTitle>
                  <AlertDescription>
                    Les valeurs detectees restent indicatives. Vos saisies manuelles sont utilisees pour:{" "}
                    {detectedOverrides.join(", ")}.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
                {detected?.goodsOrServices ? <p>Type: {detected.goodsOrServices === "goods" ? "Biens" : "Services"}</p> : null}
                {detected?.sellerCountry ? (
                  <p>
                    Vendeur detecte: {formatCountry(detected.sellerCountry)}
                    {express.sellerCountry && normalizeIso2(express.sellerCountry) !== normalizeIso2(detected.sellerCountry) ? (
                      <span className="text-muted-foreground"> (utilise: {formatCountry(express.sellerCountry)})</span>
                    ) : null}
                  </p>
                ) : null}
                {detected?.buyerCountry ? (
                  <p>
                    Acheteur detecte: {formatCountry(detected.buyerCountry)}
                    {express.buyerCountry && normalizeIso2(express.buyerCountry) !== normalizeIso2(detected.buyerCountry) ? (
                      <span className="text-muted-foreground"> (utilise: {formatCountry(express.buyerCountry)})</span>
                    ) : null}
                  </p>
                ) : null}
                {detected?.invoiceNumber ? <p>Facture: {detected.invoiceNumber}</p> : null}
                {detected?.invoiceDate ? <p>Date: {detected.invoiceDate}</p> : null}
                {detected?.currency ? <p>Devise: {detected.currency}</p> : null}
                {typeof detected?.totalHt === "number" ? <p>Total HT: {detected.totalHt}</p> : null}
                {typeof detected?.totalTtc === "number" ? <p>Total TTC: {detected.totalTtc}</p> : null}
                {detected?.incoterm ? <p>Incoterm: {detected.incoterm}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={applyDetectedValues}>Confirmer et analyser</Button>
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
                        <SelectTrigger id="field-incoterm">
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
                      <Input id="field-incoterm-place" value={pro.incotermPlace} onChange={(event) => setPro((prev) => ({ ...prev, incotermPlace: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>HS6</Label>
                      <Input id="field-hs6" value={pro.hs6} onChange={(event) => setPro((prev) => ({ ...prev, hs6: normalizeHs6(event.target.value) }))} placeholder="850760" />
                    </div>
                    <div className="space-y-1">
                      <Label>Origine</Label>
                      <Input id="field-origin-country" value={pro.originCountry} onChange={(event) => setPro((prev) => ({ ...prev, originCountry: normalizeIso2(event.target.value) }))} placeholder="FR" />
                    </div>
                    <div className="space-y-1">
                      <Label>Poids net</Label>
                      <Input value={pro.netWeight} onChange={(event) => setPro((prev) => ({ ...prev, netWeight: event.target.value }))} placeholder="kg" />
                    </div>
                    <div className="space-y-1">
                      <Label>Poids brut</Label>
                      <Input id="field-gross-weight" value={pro.grossWeight} onChange={(event) => setPro((prev) => ({ ...prev, grossWeight: event.target.value }))} placeholder="kg" />
                    </div>
                    <div className="space-y-1">
                      <Label>Nombre colis</Label>
                      <Input id="field-package-count" value={pro.packageCount} onChange={(event) => setPro((prev) => ({ ...prev, packageCount: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Preuve transport UE</Label>
                      <Select
                        value={pro.proofOfTransport ? "yes" : "no"}
                        onValueChange={(value) => setPro((prev) => ({ ...prev, proofOfTransport: value === "yes" }))}
                      >
                        <SelectTrigger id="field-proof-transport"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Oui</SelectItem>
                          <SelectItem value="no">Non</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Fret</Label>
                      <Input id="field-freight" value={pro.freight} onChange={(event) => setPro((prev) => ({ ...prev, freight: event.target.value }))} />
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
                      <Input id="field-seller-vat" value={pro.sellerVat} onChange={(event) => setPro((prev) => ({ ...prev, sellerVat: event.target.value.toUpperCase().replace(/\s+/g, "") }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Devise</Label>
                      <Select
                        value={pro.currency}
                        onValueChange={(value) =>
                          setPro((prev) => ({ ...prev, currency: value.toUpperCase().slice(0, 3) }))
                        }
                      >
                        <SelectTrigger id="field-currency">
                          <SelectValue placeholder="EUR" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Taux de change</Label>
                      <Input id="field-exchange-rate" value={pro.exchangeRate} onChange={(event) => setPro((prev) => ({ ...prev, exchangeRate: event.target.value }))} placeholder="si devise != EUR" />
                    </div>
                    <div className="space-y-1">
                      <Label>IBAN</Label>
                      <Input id="field-iban" value={pro.iban} onChange={(event) => setPro((prev) => ({ ...prev, iban: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>BIC</Label>
                      <Input id="field-bic" value={pro.bic} onChange={(event) => setPro((prev) => ({ ...prev, bic: event.target.value }))} />
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
                      <Input id="field-invoice-number" value={pro.invoiceNumber} onChange={(event) => setPro((prev) => ({ ...prev, invoiceNumber: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Date facture</Label>
                      <Input id="field-invoice-date" type="date" value={pro.invoiceDate} onChange={(event) => setPro((prev) => ({ ...prev, invoiceDate: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total HT</Label>
                      <Input id="field-total-ht" value={pro.totalHt} onChange={(event) => setPro((prev) => ({ ...prev, totalHt: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total TTC</Label>
                      <Input id="field-total-ttc" value={pro.totalTtc} onChange={(event) => setPro((prev) => ({ ...prev, totalTtc: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nom vendeur</Label>
                      <Input id="field-seller-name" value={pro.sellerName} onChange={(event) => setPro((prev) => ({ ...prev, sellerName: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nom acheteur</Label>
                      <Input id="field-buyer-name" value={pro.buyerName} onChange={(event) => setPro((prev) => ({ ...prev, buyerName: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>AWB</Label>
                      <Input id="field-awb" value={pro.awb} onChange={(event) => setPro((prev) => ({ ...prev, awb: event.target.value }))} />
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
                  <CardDescription>
                    Point bloquant principal en tete, puis navigation par priorite.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-sm">Score {result.summary.score}/100</Badge>
                  {statusPillFromAssessment(result.summary.status)}
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(1)}>
                    Modifier la saisie
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">1) Point bloquant principal</CardTitle>
                  <CardDescription>Maximum 1 a 2 KO prioritaires.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {result.summary.mainBlockers.length > 0 ? (
                    result.summary.mainBlockers.map((check) => (
                      <div key={check.id} className="rounded-md border border-rose-200 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="font-medium text-rose-900">{check.label}</p>
                          {statusPill(check.status)}
                        </div>
                        <p className="text-muted-foreground">{check.explanation}</p>
                        <p className="mt-1">
                          <span className="font-medium">Action:</span> {check.what_to_fix}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => focusFieldPath(check.fieldPath)}
                        >
                          Corriger
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Aucun blocage KO detecte.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">2) Autres bloquants</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {result.summary.blockers.length > 0 ? (
                    result.summary.blockers.map((check) => (
                      <div key={check.id} className="rounded-md border p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="font-medium">{check.label}</p>
                          {statusPill(check.status)}
                        </div>
                        <p className="text-muted-foreground">{check.what_to_fix}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Aucun autre KO.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3) Avertissements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {result.summary.warnings.length > 0 ? (
                    result.summary.warnings.map((check) => (
                      <div key={check.id} className="rounded-md border p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="font-medium">{check.label}</p>
                          {statusPill(check.status)}
                        </div>
                        <p className="text-muted-foreground">{check.what_to_fix}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Aucun avertissement.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">4) OK</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {result.summary.ok.length} controle(s) deja conformes.
                  </p>
                  {result.summary.ok.slice(0, 6).map((check) => (
                    <div key={check.id} className="rounded-md border p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="font-medium">{check.label}</p>
                        {statusPill(check.status)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Regles generales (selon votre flux)</CardTitle>
                  <CardDescription>
                    Affiche des que pays vendeur + pays acheteur + type + statut client sont connus.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {result.coreContextReady ? (
                    <>
                      <div className="rounded-md border p-3">
                        <p className="font-medium">Decision TVA</p>
                        <p className="mt-1 text-muted-foreground">{result.assessment.vat_result.status}</p>
                        <p className="text-muted-foreground">{result.assessment.vat_result.reason}</p>
                        {result.assessment.vat_result.required_invoice_mentions[0] ? (
                          <p className="mt-1">
                            <span className="font-medium">Mention:</span>{" "}
                            {result.assessment.vat_result.required_invoice_mentions[0]}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="font-medium">Devise</p>
                        {result.context.currency !== "EUR" ? (
                          <p className="text-muted-foreground">
                            {result.context.exchangeRate
                              ? `Devise ${result.context.currency} avec taux ${result.context.exchangeRate}.`
                              : `Devise ${result.context.currency}: taux requis pour une contre-valeur EUR fiable.`}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">Devise EUR: pas de taux requis.</p>
                        )}
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="font-medium">Douane essentiel</p>
                        <div className="mt-1 space-y-1 text-muted-foreground">
                          {result.customsAlerts.map((alert) => (
                            <p key={alert.id}>
                              {alert.label}: {alert.message}
                            </p>
                          ))}
                        </div>
                        {expectedDocs.length > 0 ? (
                          <div className="mt-2">
                            <p className="font-medium">Documents attendus</p>
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {expectedDocs.map((doc) => (
                                <li key={doc}>{doc}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <CircleHelp className="h-4 w-4" />
                      <AlertTitle>Regles generales en attente</AlertTitle>
                      <AlertDescription>
                        Renseignez type + pays vendeur + pays acheteur + statut client pour afficher les regles generales.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pour affiner (produit)</CardTitle>
                  <CardDescription>
                    Produit non requis pour le verdict initial. Ajoutez-le ensuite pour affiner la douane.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="space-y-1">
                    <Label htmlFor="field-product-query">Produit (description) + HS si connu</Label>
                    <Input
                      id="field-product-query"
                      value={productQuery}
                      onChange={(event) => setProductQuery(event.target.value)}
                      placeholder="Ex: Batteries lithium-ion HS850760"
                    />
                  </div>
                  <Button variant="outline" onClick={handleProductRefine}>Affiner maintenant</Button>

                  {productChecks.length > 0 ? (
                    <div className="space-y-2">
                      {productChecks.map((check) => (
                        <div key={check.id} className="rounded-md border p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="font-medium">{check.label}</p>
                            {statusPill(check.status)}
                          </div>
                          <p className="text-muted-foreground">{check.explanation}</p>
                          {check.status !== "OK" ? <p className="mt-1">Action: {check.what_to_fix}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Aucun affinage produit lance pour le moment.</p>
                  )}
                </CardContent>
              </Card>

              {result.missingQuestions.length > 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Questions manquantes prioritaires</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-1">
                      {result.missingQuestions.map((question) => (
                        <p key={question}>- {question}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}

              {result.summary.status === "BLOCKING" ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Points bloquants detectes</AlertTitle>
                  <AlertDescription>
                    Corrigez le point principal puis relancez l&apos;analyse.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Analyse terminee</AlertTitle>
                  <AlertDescription>
                    Verdict initial disponible. Ajoutez le produit uniquement pour affiner la douane.
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
