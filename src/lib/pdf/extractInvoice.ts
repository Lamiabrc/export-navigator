import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PositionedText = { str: string; x: number; y: number };

export type ParsedInvoiceLineItem = {
  description?: string;
  quantity?: number | null;
  amountHT?: number | null;
  codeArticle?: string | null;
  ean13?: string | null;
  hsCode?: string | null;
};

export type ParsedInvoice = {
  invoiceNumber: string | null;
  supplier: string | null;
  date: string | null;

  totalHT: number | null;
  totalTVA: number | null;
  totalTTC: number | null;

  /** ✅ transit HT détecté (sum lignes transport) ou fallback texte */
  transitFees: number | null;

  billingCountry: string | null;
  vatExemptionMention: string | null;

  lineItems: ParsedInvoiceLineItem[];
  rawText: string;

  /** debug (optionnel) */
  transitDetectionSource?: "line_items" | "text_fallback" | "none";
};

function normalizeSpaces(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function normalizeDigits(v: string) {
  return (v || "").replace(/[^\d]/g, "");
}

function parseEuroAmountFromMatch(m: string): number | null {
  const cleaned = (m || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}([,]|$))/g, "")
    .replace(/,(?=\d{2}$)/g, ".")
    .replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractEuroAmountsGeneric(line: string): number[] {
  const re = /-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2})/g;
  const matches = line.match(re) || [];
  const nums: number[] = [];
  for (const m of matches) {
    const n = parseEuroAmountFromMatch(m);
    if (n !== null) nums.push(n);
  }
  return nums;
}

function extractEuroAmountsWithCurrency(line: string): number[] {
  const nums: number[] = [];
  const reAfter = /(-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2}))\s*(?:€|EUR)\b/gi;
  const reBefore = /(?:€|EUR)\s*(-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2}))/gi;

  let m: RegExpExecArray | null;
  while ((m = reAfter.exec(line)) !== null) {
    const n = parseEuroAmountFromMatch(m[1]);
    if (n !== null) nums.push(n);
  }
  while ((m = reBefore.exec(line)) !== null) {
    const n = parseEuroAmountFromMatch(m[1]);
    if (n !== null) nums.push(n);
  }
  return nums;
}

function pickBestLineAmount(line: string): number | null {
  const currencyNums = extractEuroAmountsWithCurrency(line).filter((n) => Math.abs(n) > 0.0001);
  if (currencyNums.length) return currencyNums[currencyNums.length - 1];

  const nums = extractEuroAmountsGeneric(line);
  const positive = nums.filter((n) => n > 0.0001);

  if (nums.length && Math.abs(nums[nums.length - 1]) < 0.0001 && positive.length) {
    return Math.max(...positive);
  }

  if (positive.length) return Math.max(...positive);
  if (nums.length) return nums[nums.length - 1];
  return null;
}

function isTotalsLine(line: string) {
  const low = line.toLowerCase();
  const stop = [
    "total ht",
    "total ttc",
    "total général",
    "total general",
    "net à payer",
    "net a payer",
    "à payer",
    "a payer",
    "apayer",
    "montant total",
    "total",
  ];
  // ⚠️ on garde "total" en dernier => très large
  return stop.some((k) => low.includes(k));
}

function findInvoiceNumber(text: string): string | null {
  const match = text.match(/(FA[CV]?[\s-]?\d{4,}|FV[\s-]?\d{4,}|PF[\s-]?\d{4,})/i);
  return match ? match[0].replace(/\s/g, "") : null;
}

function findDate(lines: string[]): string | null {
  for (const l of lines.slice(0, 120)) {
    const lower = l.toLowerCase();
    if (lower.includes("date")) {
      const m = l.match(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
      if (m) return m[0];
    }
  }
  const full = lines.join("\n");
  const m = full.match(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
  return m ? m[0] : null;
}

function findSupplier(lines: string[]): string | null {
  const legal = ["SARL", "SAS", "SASU", "SA", "EURL", "SOCIETE", "SOCIÉTÉ", "LTD", "GMBH", "BV", "INC"];
  const banned = ["FACTURE", "INVOICE", "DEVIS", "BON", "COMMANDE", "BORDEREAU"];

  for (const l of lines.slice(0, 30)) {
    const clean = normalizeSpaces(l);
    if (!clean) continue;
    const up = clean.toUpperCase();
    if (banned.some((b) => up.includes(b))) continue;

    if (legal.some((k) => up.includes(k))) return clean;

    const letters = up.replace(/[^A-Z]/g, "").length;
    const ratio = clean.length ? letters / clean.length : 0;
    if (clean.length >= 6 && ratio > 0.45) return clean;
  }

  const first = lines.find((l) => normalizeSpaces(l).length > 0);
  return first ? normalizeSpaces(first) : null;
}

function findAmountInLines(lines: string[], keywords: string[], opts?: { excludeTotals?: boolean }): number | null {
  let best: { score: number; value: number } | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!keywords.some((k) => lower.includes(k))) continue;

    // ✅ évite les fausses captures sur lignes TOTAL
    if (opts?.excludeTotals && isTotalsLine(line)) continue;

    const value = pickBestLineAmount(line);
    if (value === null) continue;

    let score = 0;
    for (const k of keywords) if (lower.includes(k)) score += 3;
    if (line.includes("€") || /EUR\b/i.test(line)) score += 2;

    // bonus si la ligne a l'air d'être un libellé de frais (pas un résumé)
    if (!lower.includes("total")) score += 2;

    if (!best || score > best.score) best = { score, value };
  }

  return best ? best.value : null;
}

function extractBillingCountry(lines: string[]): string | null {
  const startKeys = ["adresse de facturation", "facturé à", "facture à", "bill to", "billing address", "adresse facturation"];
  const stopKeys = ["adresse de livraison", "ship to", "livraison", "référence", "reference", "invoice", "facture"];

  let startIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 250); i++) {
    const l = lines[i].toLowerCase();
    if (startKeys.some((k) => l.includes(k))) {
      startIdx = i;
      break;
    }
  }

  const block: string[] = [];
  if (startIdx >= 0) {
    for (let i = startIdx; i < Math.min(lines.length, startIdx + 14); i++) {
      const low = lines[i].toLowerCase();
      if (i > startIdx && stopKeys.some((k) => low.includes(k))) break;
      block.push(lines[i]);
    }
  }

  const text = (block.length ? block.join(" ") : lines.join(" ")).toUpperCase();

  if (text.includes(" FRANCE") || text.includes("FRANCE ")) return "France";
  if (text.includes(" BELGIQUE") || text.includes("BELGIUM")) return "Belgique";
  if (text.includes(" ESPAGNE") || text.includes("SPAIN")) return "Espagne";
  if (text.includes(" LUXEMBOURG")) return "Luxembourg";
  if (text.includes(" SUISSE") || text.includes("SWITZERLAND")) return "Suisse";

  return null;
}

function extractVatExemptionMention(lines: string[]): string | null {
  const keys = [
    "exon",
    "exonération",
    "tva non applicable",
    "article 262",
    "262 ter",
    "autoliquidation",
    "reverse charge",
    "vat exempt",
    "tax exempt",
  ];
  for (const l of lines) {
    const low = l.toLowerCase();
    if (keys.some((k) => low.includes(k))) return normalizeSpaces(l);
  }
  return null;
}

function looksLikeHeader(l: string) {
  const low = l.toLowerCase();
  const a = ["désignation", "designation", "description", "libellé", "libelle", "article", "produit"];
  const b = ["montant", "total", "ht", "ttc", "prix", "pu", "qté", "qte", "quantité", "qty"];
  return a.some((x) => low.includes(x)) && b.some((x) => low.includes(x));
}

function isStopTotalsLine(l: string) {
  const low = l.toLowerCase();
  const stop = ["total ht", "total ttc", "total général", "total general", "net à payer", "net a payer", "à payer", "a payer", "apayer", "montant total"];
  return stop.some((k) => low.includes(k));
}

function extractEan13(line: string): string | null {
  const direct = (line.match(/\b\d{13}\b/) || [])[0];
  if (direct) return normalizeDigits(direct);

  const groups = line.match(/\d+/g) || [];
  for (let i = 0; i < groups.length; i++) {
    let acc = "";
    for (let j = i; j < groups.length; j++) {
      acc += groups[j];
      if (acc.length === 13) return acc;
      if (acc.length > 13) break;
    }
  }
  return null;
}

function detectLineItems(lines: string[]): ParsedInvoiceLineItem[] {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 300); i++) {
    if (looksLikeHeader(lines[i])) {
      headerIdx = i;
      break;
    }
  }

  const start = headerIdx >= 0 ? headerIdx + 1 : 0;
  const items: ParsedInvoiceLineItem[] = [];
  let pendingDesc: string | null = null;

  for (let i = start; i < Math.min(lines.length, start + 500); i++) {
    const line = normalizeSpaces(lines[i]);
    if (!line) continue;

    if (headerIdx >= 0 && isStopTotalsLine(line)) break;

    const amountHT = pickBestLineAmount(line);

    if (headerIdx < 0) {
      const low = line.toLowerCase();
      if (isStopTotalsLine(line)) continue;
      if (line.length < 12) continue;
      if (low.includes("facture") || low.includes("invoice") || low.includes("page")) continue;
      if (amountHT === null) continue;
    }

    if (amountHT === null) {
      if (items.length) {
        const prev = items[items.length - 1];
        prev.description = normalizeSpaces(`${prev.description || ""} ${line}`);
      } else {
        pendingDesc = normalizeSpaces(`${pendingDesc || ""} ${line}`);
      }
      continue;
    }

    const ean = extractEan13(line);

    const hsExplicit = (line.match(/(?:HS|NC|TARIC)\s*[:#]?\s*(\d{4,10})/i) || [])[1] || null;
    let hsCode: string | null = hsExplicit ? normalizeDigits(hsExplicit) : null;

    if (!hsCode) {
      const candidates = line.match(/\b\d{8,10}\b/g) || [];
      const found = candidates.find((c) => !!c && c.length >= 8);
      if (found) hsCode = normalizeDigits(found);
    }

    const tokens = line.split(" ").map((t) => t.trim()).filter(Boolean);
    const codeArticle =
      tokens.find((t) => {
        const cleaned = t.replace(/[^\w-]/g, "");
        if (!cleaned) return false;
        if (/^\d+$/.test(cleaned)) return false;
        if (ean && cleaned.includes(ean)) return false;
        if (hsCode && cleaned.includes(hsCode)) return false;
        const hasLetter = /[A-Za-z]/.test(cleaned);
        const hasDigit = /\d/.test(cleaned);
        if (!hasLetter || !hasDigit) return false;
        if (cleaned.length < 4 || cleaned.length > 24) return false;
        const up = cleaned.toUpperCase();
        if (up.includes("FACTURE") || up.includes("INVOICE")) return false;
        return true;
      }) || null;

    let quantity: number | null = null;
    for (const t of tokens) {
      const c = t.replace(",", ".").replace(/[^\d.]/g, "");
      if (!c) continue;
      if (c.length > 6) continue;
      const n = Number(c);
      if (!Number.isFinite(n)) continue;
      if (n <= 0) continue;
      if (Number.isInteger(n) && n <= 999) {
        quantity = n;
        break;
      }
    }

    let description = line;
    const moneyMatch =
      (line.match(/(-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2}))\s*(?:€|EUR)\b/i) || [])[0] ||
      (line.match(/-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2})/i) || [])[0];

    if (moneyMatch) {
      const idx = line.indexOf(moneyMatch);
      if (idx > 0) description = normalizeSpaces(line.slice(0, idx));
    }

    if (pendingDesc) {
      description = normalizeSpaces(`${pendingDesc} ${description}`);
      pendingDesc = null;
    }

    items.push({
      description: description || undefined,
      quantity,
      amountHT,
      codeArticle,
      ean13: ean ? normalizeDigits(ean) : null,
      hsCode,
    });
  }

  return items.filter((it) => (it.amountHT ?? 0) > 0.0001 || (it.description || "").length > 3);
}

/** ✅ transit = somme des lignes "transport/port/livraison/expédition/fret" (hors TOTAL) */
function computeTransitFromLineItems(items: ParsedInvoiceLineItem[]): number {
  const re = /\b(transport|transit|livraison|exp[ée]dition|shipping|fret|affranchissement)\b/i;
  const rePort = /\b(frais\s+de\s+port|port)\b/i;

  return items
    .filter((it) => {
      const desc = normalizeSpaces(it.description || "");
      if (!desc) return false;
      if (isTotalsLine(desc)) return false;

      const low = desc.toLowerCase();
      if (low.includes("assurance")) return false; // évite certaines confusions

      return re.test(desc) || rePort.test(desc);
    })
    .reduce((s, it) => s + (Number.isFinite(Number(it.amountHT)) ? Number(it.amountHT) : 0), 0);
}

async function extractStructuredTextFromPdf(file: File): Promise<{ rawText: string; lines: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const txt = await page.getTextContent({ normalizeWhitespace: true });

    const items = txt.items as TextItem[];
    const positioned: PositionedText[] = [];

    for (const it of items) {
      const str = (it as any).str as string;
      const tr = (it as any).transform as number[] | undefined;
      if (!str || !tr || tr.length < 6) continue;
      positioned.push({ str, x: tr[4], y: tr[5] });
    }

    positioned.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    // ✅ tolérance un peu plus large pour capter libellé + montant sur la même ligne
    const yTol = 5.0;

    let currentY: number | null = null;
    let current: PositionedText[] = [];

    const flush = () => {
      if (!current.length) return;
      current.sort((a, b) => a.x - b.x);
      let line = current.map((i) => i.str).join(" ");
      line = line
        .replace(/\s+([,.;:])/g, "$1")
        .replace(/([€$])\s+/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (line) allLines.push(line);
      current = [];
      currentY = null;
    };

    for (const it of positioned) {
      if (currentY === null) {
        currentY = it.y;
        current.push(it);
        continue;
      }
      if (Math.abs(it.y - currentY) <= yTol) current.push(it);
      else {
        flush();
        currentY = it.y;
        current.push(it);
      }
    }
    flush();
    allLines.push(" ");
  }

  const lines = allLines.map((l) => normalizeSpaces(l)).filter((l) => l.length > 0);
  return { rawText: lines.join("\n"), lines };
}

export async function extractInvoiceFromPdf(file: File): Promise<ParsedInvoice> {
  const { rawText, lines } = await extractStructuredTextFromPdf(file);

  const invoiceNumber = findInvoiceNumber(rawText);
  const supplier = findSupplier(lines);
  const date = findDate(lines);

  const totalHT = findAmountInLines(lines, ["total ht", "montant ht", "total hors taxe", "hors taxe", "ht"]);
  const totalTTC = findAmountInLines(lines, ["total ttc", "ttc", "net à payer", "net a payer", "à payer", "a payer", "apayer"]);
  const totalTVA = findAmountInLines(lines, ["total tva", "tva", "vat"]);

  const billingCountry = extractBillingCountry(lines);
  const vatExemptionMention = extractVatExemptionMention(lines);

  const lineItems = detectLineItems(lines);

  // ✅ 1) transit via lignes facture (meilleur)
  const transitFromLines = computeTransitFromLineItems(lineItems);

  // ✅ 2) fallback texte (mais on exclut lignes TOTAL)
  const transitFallback =
    findAmountInLines(lines, ["frais de transit"], { excludeTotals: true }) ??
    findAmountInLines(lines, ["transit"], { excludeTotals: true }) ??
    findAmountInLines(lines, ["frais de port"], { excludeTotals: true }) ??
    findAmountInLines(lines, ["transport", "livraison", "expédition", "expedition", "shipping", "fret"], { excludeTotals: true }) ??
    null;

  const computedTtc = totalTTC ?? (totalHT !== null && totalTVA !== null ? totalHT + totalTVA : null);

  let transitFees: number | null = null;
  let transitDetectionSource: ParsedInvoice["transitDetectionSource"] = "none";

  if (transitFromLines > 0.0001) {
    transitFees = transitFromLines;
    transitDetectionSource = "line_items";
  } else if (transitFallback !== null && transitFallback > 0.0001) {
    transitFees = transitFallback;
    transitDetectionSource = "text_fallback";
  }

  return {
    invoiceNumber,
    supplier,
    date,
    totalHT: totalHT ?? null,
    totalTVA: totalTVA ?? null,
    totalTTC: computedTtc ?? null,
    transitFees,
    billingCountry,
    vatExemptionMention,
    lineItems,
    rawText,
    transitDetectionSource,
  };
}
