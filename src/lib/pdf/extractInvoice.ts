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

  /** ✅ transit HT détecté (frais port/transport) */
  transitFees: number | null;

  billingCountry: string | null;
  vatExemptionMention: string | null;

  lineItems: ParsedInvoiceLineItem[];
  rawText: string;

  /** debug */
  transitDetectionSource?: "line_items" | "lines_scan" | "text_fallback" | "none";
};

function normalizeSpaces(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function normalizeDigits(v: string) {
  return (v || "").replace(/[^\d]/g, "");
}

function parseEuroAmount(m: string): number | null {
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
  // 1 234,56 / 1234,56 / 1.234,56 / 1234.56
  const re = /-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2})/g;
  const matches = line.match(re) || [];
  const nums: number[] = [];
  for (const m of matches) {
    const n = parseEuroAmount(m);
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
    const n = parseEuroAmount(m[1]);
    if (n !== null) nums.push(n);
  }
  while ((m = reBefore.exec(line)) !== null) {
    const n = parseEuroAmount(m[1]);
    if (n !== null) nums.push(n);
  }
  return nums;
}

function pickBestLineAmount(line: string): number | null {
  const currencyNums = extractEuroAmountsWithCurrency(line).filter((n) => Math.abs(n) > 0.0001);
  if (currencyNums.length) return currencyNums[currencyNums.length - 1];

  const nums = extractEuroAmountsGeneric(line);
  const positive = nums.filter((n) => n > 0.0001);
  if (positive.length) return Math.max(...positive);
  if (nums.length) return nums[nums.length - 1];
  return null;
}

function isTotalsLine(line: string) {
  const low = line.toLowerCase();
  return [
    "total ht",
    "total ttc",
    "total général",
    "total general",
    "montant total",
    "net à payer",
    "net a payer",
    "à payer",
    "a payer",
    "apayer",
  ].some((k) => low.includes(k));
}

function isVatLine(line: string) {
  const low = line.toLowerCase();
  // TVA / VAT + taux ou base
  if (!/(tva|vat)\b/i.test(line)) return false;
  if (/(total ht|total ttc|net a payer|net à payer)/i.test(line)) return false;
  return true;
}

function findInvoiceNumber(text: string): string | null {
  const match = text.match(/(FA[CV]?[\s-]?\d{4,}|FV[\s-]?\d{4,}|PF[\s-]?\d{4,})/i);
  return match ? match[0].replace(/\s/g, "") : null;
}

function findDate(lines: string[]): string | null {
  // d’abord les lignes contenant "date"
  for (const l of lines.slice(0, 120)) {
    const low = l.toLowerCase();
    if (low.includes("date")) {
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
    for (const k of keywords) if (lower.includes(k)) score += 4;
    if (line.includes("€") || /EUR\b/i.test(line)) score += 2;
    if (isTotalsLine(line)) score += 3;

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

function looksLikeHeader(l: string) {
  const low = l.toLowerCase();
  const a = ["désignation", "designation", "description", "libellé", "libelle", "article", "produit"];
  const b = ["montant", "total", "ht", "ttc", "prix", "pu", "qté", "qte", "quantité", "qty"];
  return a.some((x) => low.includes(x)) && b.some((x) => low.includes(x));
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

  for (let i = start; i < Math.min(lines.length, start + 600); i++) {
    const line = normalizeSpaces(lines[i]);
    if (!line) continue;

    // stop si on arrive sur les totaux (si header trouvé)
    if (headerIdx >= 0 && isTotalsLine(line)) break;

    // ignore lignes de total même en mode fallback
    if (isTotalsLine(line)) continue;

    const amountHT = pickBestLineAmount(line);

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

    // description sans la partie "montant"
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

function computeGoodsSum(items: ParsedInvoiceLineItem[]) {
  const shipRe = /\b(transport|transit|livraison|exp[ée]dition|shipping|fret|affranchissement|port)\b/i;
  return items
    .filter((it) => {
      const desc = normalizeSpaces(it.description || "");
      if (!desc) return false;
      if (shipRe.test(desc)) return false;
      return true;
    })
    .reduce((s, it) => s + (Number.isFinite(Number(it.amountHT)) ? Number(it.amountHT) : 0), 0);
}

function computeTransitFromItems(items: ParsedInvoiceLineItem[]) {
  const shipRe = /\b(transport|transit|livraison|exp[ée]dition|shipping|fret|affranchissement|port)\b/i;

  return items
    .filter((it) => {
      const desc = normalizeSpaces(it.description || "");
      if (!desc) return false;
      if (isTotalsLine(desc)) return false;
      if (isVatLine(desc)) return false;
      return shipRe.test(desc);
    })
    .reduce((s, it) => s + (Number.isFinite(Number(it.amountHT)) ? Number(it.amountHT) : 0), 0);
}

/**
 * ✅ scan direct des "lines" PDF pour trouver les frais de transport
 * - exclut lignes TOTAL / TVA
 * - filtre les montants qui == totalHT/totalTTC/TVA
 */
function computeTransitFromLinesScan(lines: string[], totals: { ht: number | null; ttc: number | null; tva: number | null }) {
  const weights: Array<[RegExp, number]> = [
    [/\bfrais\s+de\s+port\b/i, 12],
    [/\bfrais\s+de\s+transit\b/i, 12],
    [/\btransit\b/i, 10],
    [/\btransport\b/i, 8],
    [/\blivraison\b/i, 8],
    [/\bexp[ée]dition\b/i, 8],
    [/\bfret\b/i, 8],
    [/\bshipping\b/i, 8],
    [/\bport\b/i, 6],
  ];

  const tol = 0.02;

  const isSame = (a: number, b: number | null) => b !== null && Math.abs(a - b) <= tol;
  const reject = (v: number) => isSame(v, totals.ht) || isSame(v, totals.ttc) || (totals.tva !== null && totals.tva > 0.01 && isSame(v, totals.tva));

  const candidates: Array<{ amount: number; score: number; line: string }> = [];

  for (const line of lines) {
    const l = normalizeSpaces(line);
    if (!l) continue;

    const low = l.toLowerCase();
    // exclure zones d'adresse etc.
    if (low.includes("adresse") && (low.includes("facturation") || low.includes("livraison"))) continue;

    if (isTotalsLine(l)) continue;
    if (isVatLine(l)) continue;

    let kwScore = 0;
    for (const [re, w] of weights) {
      if (re.test(l)) kwScore = Math.max(kwScore, w);
    }
    if (kwScore === 0) continue;

    const amounts = [
      ...extractEuroAmountsWithCurrency(l),
      ...extractEuroAmountsGeneric(l),
    ].filter((n) => n > 0.0001);

    if (!amounts.length) continue;

    // filtre montants "totaux"
    const filtered = amounts.filter((n) => !reject(n));
    if (!filtered.length) continue;

    // en général le coût est le plus grand montant restant sur la ligne
    const picked = Math.max(...filtered);

    let score = kwScore;
    if (l.includes("€") || /EUR\b/i.test(l)) score += 2;
    if (low.includes("total")) score -= 3;

    candidates.push({ amount: picked, score, line: l });
  }

  if (!candidates.length) return 0;

  // si plusieurs lignes de transport, on additionne celles "bonnes"
  candidates.sort((a, b) => b.score - a.score);

  // garde top N similaires
  const topScore = candidates[0].score;
  const kept = candidates.filter((c) => c.score >= topScore - 2);

  // somme en évitant doublons évidents
  const uniq = new Map<string, number>();
  kept.forEach((c) => {
    const key = `${c.amount.toFixed(2)}-${c.score}`;
    if (!uniq.has(key)) uniq.set(key, c.amount);
  });

  return Array.from(uniq.values()).reduce((s, v) => s + v, 0);
}

function sanitizeTransit(args: {
  transit: number;
  totalHT: number | null;
  totalTTC: number | null;
  totalTVA: number | null;
  goodsSum: number;
  itemsCount: number;
}) {
  const { transit, totalHT, totalTTC, totalTVA, goodsSum, itemsCount } = args;

  if (!Number.isFinite(transit) || transit <= 0.0001) return null;

  const tol = 0.02;
  const same = (a: number, b: number | null) => b !== null && Math.abs(a - b) <= tol;

  // si transit == total HT/TTC/TVA, c’est quasi toujours une confusion (sauf facture uniquement transport)
  const looksLikeGoodsInvoice = itemsCount >= 3 && goodsSum > 0.2 * Math.max(1, totalHT ?? goodsSum);

  if (looksLikeGoodsInvoice) {
    if (same(transit, totalHT) || same(transit, totalTTC) || (totalTVA !== null && totalTVA > 0.01 && same(transit, totalTVA))) {
      return null;
    }
  }

  return transit;
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

  // ✅ Totaux : éviter mots trop génériques ("ht" tout seul)
  const totalHT =
    findAmountInLines(lines, ["total ht", "total h.t", "total hors taxe", "total hors-taxe", "montant ht"]) ??
    null;

  const totalTTC =
    findAmountInLines(lines, ["total ttc", "net à payer", "net a payer", "montant ttc", "à payer", "a payer", "apayer"]) ??
    null;

  // ✅ TVA : calcul priorité (évite de confondre avec Total)
  let totalTVA: number | null = null;
  if (totalHT !== null && totalTTC !== null) {
    const diff = totalTTC - totalHT;
    totalTVA = diff >= -0.02 && diff <= Math.max(0.35 * totalHT, 20000) ? Math.max(0, diff) : null;
  }
  if (totalTVA === null) {
    // fallback "total tva" seulement (pas "tva" tout court)
    totalTVA = findAmountInLines(lines, ["total tva", "montant tva", "total vat"]) ?? null;
  }

  const billingCountry = extractBillingCountry(lines);
  const vatExemptionMention = extractVatExemptionMention(lines);

  const lineItems = detectLineItems(lines);

  const goodsSum = computeGoodsSum(lineItems);
  const transitFromItems = computeTransitFromItems(lineItems);

  // ✅ transit via scan des lignes (si pas de ligne item transport)
  const transitFromScan = transitFromItems > 0.0001
    ? transitFromItems
    : computeTransitFromLinesScan(lines, { ht: totalHT, ttc: totalTTC, tva: totalTVA });

  // ✅ fallback texte très léger si scan ne trouve rien
  let transitFallback = 0;
  if (transitFromScan <= 0.0001) {
    // on ne cherche que "frais de port/transit" (pas "transport" générique)
    const t1 = findAmountInLines(lines, ["frais de transit"]) ?? 0;
    const t2 = findAmountInLines(lines, ["frais de port"]) ?? 0;
    transitFallback = Math.max(t1, t2);
  }

  let transitFees = transitFromScan > 0.0001 ? transitFromScan : transitFallback;
  let transitDetectionSource: ParsedInvoice["transitDetectionSource"] = "none";
  if (transitFromItems > 0.0001) transitDetectionSource = "line_items";
  else if (transitFromScan > 0.0001) transitDetectionSource = "lines_scan";
  else if (transitFallback > 0.0001) transitDetectionSource = "text_fallback";

  // ✅ rejet si transit = total (et que la facture ressemble à une facture marchandises)
  const sanitized = sanitizeTransit({
    transit: transitFees,
    totalHT,
    totalTTC,
    totalTVA,
    goodsSum,
    itemsCount: lineItems.length,
  });

  transitFees = sanitized === null ? null : sanitized;

  // TTC fallback si pas détecté
  const computedTtc = totalTTC ?? (totalHT !== null && totalTVA !== null ? totalHT + totalTVA : null);

  return {
    invoiceNumber,
    supplier,
    date,
    totalHT,
    totalTVA,
    totalTTC: computedTtc,
    transitFees,
    billingCountry,
    vatExemptionMention,
    lineItems,
    rawText,
    transitDetectionSource,
  };
}
