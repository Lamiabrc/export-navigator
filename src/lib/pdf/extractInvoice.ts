import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api";
// Vite-friendly worker import (legacy bundle)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// Configure worker source (resolved at build time)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PositionedText = {
  str: string;
  x: number;
  y: number;
};

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
  transitFees: number | null;

  billingCountry: string | null;
  vatExemptionMention: string | null;

  lineItems: ParsedInvoiceLineItem[];
  rawText: string;
};

function normalizeSpaces(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function normalizeDigits(v: string) {
  return (v || "").replace(/[^\d]/g, "");
}

function parseEuroAmountFromMatch(m: string): number | null {
  // "1 234,56" / "1.234,56" / "1234,56" / "1234.56"
  const cleaned = (m || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}([,]|$))/g, "") // thousands
    .replace(/,(?=\d{2}$)/g, ".")
    .replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractEuroAmountsGeneric(line: string): number[] {
  // Montants avec 2 décimales (on évite de capturer des codes produits)
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
  // Montants proches de € ou EUR (beaucoup plus fiables)
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
  // 1) prioritaire : montants associés à € / EUR
  const currencyNums = extractEuroAmountsWithCurrency(line).filter((n) => Math.abs(n) > 0.0001);
  if (currencyNums.length) {
    // souvent le dernier montant "€" est le total de ligne
    return currencyNums[currencyNums.length - 1];
  }

  // 2) fallback : montants génériques
  const nums = extractEuroAmountsGeneric(line);
  const positive = nums.filter((n) => n > 0.0001);

  // si le dernier est 0.00 mais qu'il existe un autre montant >0, on évite le 0
  if (nums.length && Math.abs(nums[nums.length - 1]) < 0.0001 && positive.length) {
    return Math.max(...positive);
  }

  if (positive.length) return Math.max(...positive);
  if (nums.length) return nums[nums.length - 1];

  return null;
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

function findAmountInLines(lines: string[], keywords: string[]): number | null {
  let best: { score: number; value: number } | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!keywords.some((k) => lower.includes(k))) continue;

    const value = pickBestLineAmount(line);
    if (value === null) continue;

    let score = 0;
    if (lower.includes("total")) score += 5;
    for (const k of keywords) if (lower.includes(k)) score += 2;
    if (line.includes("€") || /EUR\b/i.test(line)) score += 3;

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
  ];
  return stop.some((k) => low.includes(k));
}

function extractEan13(line: string): string | null {
  // 1) cas simple: 13 chiffres contigus
  const direct = (line.match(/\b\d{13}\b/) || [])[0];
  if (direct) return normalizeDigits(direct);

  // 2) cas PDF cassé: groupes de chiffres séparés
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

    const amountHT = pickBestLineAmount(line); // ✅ FIX ICI

    // si pas d'entête, on filtre plus fort
    if (headerIdx < 0) {
      const low = line.toLowerCase();
      if (isStopTotalsLine(line)) continue;
      if (line.length < 12) continue;
      if (low.includes("facture") || low.includes("invoice") || low.includes("page")) continue;
      if (amountHT === null) continue;
    }

    // continuation (ligne description sans montant)
    if (amountHT === null) {
      if (items.length) {
        const prev = items[items.length - 1];
        prev.description = normalizeSpaces(`${prev.description || ""} ${line}`);
      } else {
        pendingDesc = normalizeSpaces(`${pendingDesc || ""} ${line}`);
      }
      continue;
    }

    // EAN13 (robuste)
    const ean = extractEan13(line);

    // HS code explicite
    const hsExplicit = (line.match(/(?:HS|NC|TARIC)\s*[:#]?\s*(\d{4,10})/i) || [])[1] || null;
    let hsCode: string | null = hsExplicit ? normalizeDigits(hsExplicit) : null;

    // HS "nu"
    if (!hsCode) {
      const candidates = line.match(/\b\d{8,10}\b/g) || [];
      const found = candidates.find((c) => !!c && c.length >= 8);
      if (found) hsCode = normalizeDigits(found);
    }

    // code article plausible
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

    // quantité (best effort)
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

    // description = avant le premier montant monétaire (si possible)
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
      const x = tr[4];
      const y = tr[5];
      positioned.push({ str, x, y });
    }

    positioned.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const yTol = 3.0; // un peu plus permissif
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
      if (Math.abs(it.y - currentY) <= yTol) {
        current.push(it);
      } else {
        flush();
        currentY = it.y;
        current.push(it);
      }
    }
    flush();

    allLines.push(" "); // séparation pages
  }

  const lines = allLines.map((l) => normalizeSpaces(l)).filter((l) => l.length > 0);
  const rawText = lines.join("\n");
  return { rawText, lines };
}

export async function extractInvoiceFromPdf(file: File): Promise<ParsedInvoice> {
  const { rawText, lines } = await extractStructuredTextFromPdf(file);

  const invoiceNumber = findInvoiceNumber(rawText);
  const supplier = findSupplier(lines);
  const date = findDate(lines);

  const totalHT = findAmountInLines(lines, ["total ht", "montant ht", "total hors taxe", "hors taxe", "ht"]);
  const totalTTC = findAmountInLines(lines, ["total ttc", "ttc", "net à payer", "net a payer", "à payer", "a payer", "apayer"]);
  const totalTVA = findAmountInLines(lines, ["total tva", "tva", "vat"]);

  const transitFees =
    findAmountInLines(lines, ["frais de transit"]) ??
    findAmountInLines(lines, ["transit"]) ??
    findAmountInLines(lines, ["transport", "port", "expédition", "expedition", "shipping"]);

  const billingCountry = extractBillingCountry(lines);
  const vatExemptionMention = extractVatExemptionMention(lines);

  const lineItems = detectLineItems(lines);

  const computedTtc =
    totalTTC ??
    (totalHT !== null && totalTVA !== null ? totalHT + totalTVA : null);

  return {
    invoiceNumber,
    supplier,
    date,
    totalHT: totalHT ?? null,
    totalTVA: totalTVA ?? null,
    totalTTC: computedTtc ?? null,
    transitFees: transitFees ?? null,
    billingCountry,
    vatExemptionMention,
    lineItems,
    rawText,
  };
}
