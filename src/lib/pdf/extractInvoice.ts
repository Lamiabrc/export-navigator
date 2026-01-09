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

function normalizeHsOrDigits(v: string) {
  return (v || "").replace(/[^\d]/g, "");
}

function hs4FromHs(v: string) {
  const s = normalizeHsOrDigits(v);
  return s.length >= 4 ? s.slice(0, 4) : "";
}

function parseEuroAmountFromMatch(m: string): number | null {
  // ex: "1 234,56" / "1234,56" / "1234.56" / "1.234,56"
  const cleaned = (m || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    // remove thousands separators like 1.234,56 -> 1234,56
    .replace(/\.(?=\d{3}([,]|$))/g, "")
    .replace(/,(?=\d{2}$)/g, ".")
    .replace(/,/g, "."); // fallback
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractEuroAmounts(line: string): number[] {
  const re = /-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2})/g;
  const matches = line.match(re) || [];
  const nums: number[] = [];
  for (const m of matches) {
    const n = parseEuroAmountFromMatch(m);
    if (n !== null) nums.push(n);
  }
  return nums;
}

function findInvoiceNumber(text: string): string | null {
  // adapte à tes formats FV / PF / FAC…
  const match = text.match(/(FA[CV]?[\s-]?\d{4,}|FV[\s-]?\d{4,}|PF[\s-]?\d{4,})/i);
  return match ? match[0].replace(/\s/g, "") : null;
}

function findDate(lines: string[]): string | null {
  // priorité aux lignes avec "date"
  for (const l of lines.slice(0, 80)) {
    const lower = l.toLowerCase();
    if (lower.includes("date")) {
      const m = l.match(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
      if (m) return m[0];
    }
  }
  // fallback global
  const full = lines.join("\n");
  const m = full.match(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
  return m ? m[0] : null;
}

function findSupplier(lines: string[]): string | null {
  const legal = ["SARL", "SAS", "SASU", "SA", "EURL", "SOCIETE", "SOCIÉTÉ", "LTD", "GMBH", "BV", "INC"];
  const banned = ["FACTURE", "INVOICE", "DEVIS", "BON", "COMMANDE", "BL", "BORDEREAU"];

  // cherche dans les 30 premières lignes
  for (const l of lines.slice(0, 30)) {
    const clean = normalizeSpaces(l);
    if (!clean) continue;
    const up = clean.toUpperCase();
    if (banned.some((b) => up.includes(b))) continue;

    if (legal.some((k) => up.includes(k))) return clean;
    // sinon: ligne "plutôt entreprise" (beaucoup de majuscules)
    const letters = up.replace(/[^A-Z]/g, "").length;
    const ratio = clean.length ? letters / clean.length : 0;
    if (clean.length >= 6 && ratio > 0.45) return clean;
  }

  // fallback première ligne non vide
  const first = lines.find((l) => normalizeSpaces(l).length > 0);
  return first ? normalizeSpaces(first) : null;
}

function scoreLine(lower: string, keywords: string[]) {
  let s = 0;
  for (const k of keywords) if (lower.includes(k)) s += 2;
  if (lower.includes("total")) s += 3;
  if (lower.includes("ht")) s += 2;
  if (lower.includes("ttc")) s += 2;
  if (lower.includes("tva") || lower.includes("vat")) s += 2;
  if (lower.includes("net")) s += 1;
  if (lower.includes("à payer") || lower.includes("a payer") || lower.includes("apayer")) s += 2;
  return s;
}

function findAmountInLines(lines: string[], keywords: string[]): number | null {
  let best: { score: number; value: number } | null = null;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!keywords.some((k) => lower.includes(k))) continue;
    const nums = extractEuroAmounts(line);
    if (!nums.length) continue;
    const value = nums[nums.length - 1]; // souvent le dernier montant est le bon
    const s = scoreLine(lower, keywords);
    if (!best || s > best.score) best = { score: s, value };
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
    for (let i = startIdx; i < Math.min(lines.length, startIdx + 12); i++) {
      const low = lines[i].toLowerCase();
      if (i > startIdx && stopKeys.some((k) => low.includes(k))) break;
      block.push(lines[i]);
    }
  }

  const text = (block.length ? block.join(" ") : lines.join(" ")).toUpperCase();

  // détecte pays principaux
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
    "tva",
    "vat",
    "montant total",
  ];
  return stop.some((k) => low.includes(k));
}

function looksLikeHeader(l: string) {
  const low = l.toLowerCase();
  const a = ["désignation", "designation", "description", "libellé", "libelle", "article", "produit"];
  const b = ["montant", "total", "ht", "ttc", "prix", "pu", "qté", "qte", "quantité", "qty"];
  return a.some((x) => low.includes(x)) && b.some((x) => low.includes(x));
}

function detectLineItems(lines: string[]): ParsedInvoiceLineItem[] {
  // 1) trouver l’en-tête de tableau si possible
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 300); i++) {
    if (looksLikeHeader(lines[i])) {
      headerIdx = i;
      break;
    }
  }

  const start = headerIdx >= 0 ? headerIdx + 1 : 0;

  const items: ParsedInvoiceLineItem[] = [];
  let currentDescContinuation: string | null = null;

  for (let i = start; i < Math.min(lines.length, start + 400); i++) {
    const line = normalizeSpaces(lines[i]);
    if (!line) continue;

    // stop : on arrive dans la zone totals
    if (headerIdx >= 0 && isStopTotalsLine(line)) break;

    // si pas d'entête trouvé, on ne garde que des lignes qui ressemblent à des lignes produit
    const euroNums = extractEuroAmounts(line);
    const hasEuro = euroNums.length > 0;

    // Heuristique anti-bruit (si pas header)
    if (headerIdx < 0) {
      const low = line.toLowerCase();
      if (isStopTotalsLine(line)) continue;
      // ignore lignes trop courtes ou meta
      if (line.length < 12) continue;
      if (low.includes("facture") || low.includes("invoice") || low.includes("page")) continue;
      // nécessite un montant
      if (!hasEuro) continue;
    }

    // Continuation de description (ligne sans montant)
    if (!hasEuro) {
      if (items.length) {
        const prev = items[items.length - 1];
        prev.description = normalizeSpaces(`${prev.description || ""} ${line}`);
      } else {
        currentDescContinuation = normalizeSpaces(`${currentDescContinuation || ""} ${line}`);
      }
      continue;
    }

    const amountHT = euroNums[euroNums.length - 1];

    // EAN13
    const ean = (line.match(/\b\d{13}\b/) || [])[0] || null;

    // HS code explicite
    const hsExplicit = (line.match(/(?:HS|NC|TARIC)\s*[:#]?\s*(\d{4,10})/i) || [])[1] || null;
    let hsCode: string | null = hsExplicit ? normalizeHsOrDigits(hsExplicit) : null;

    // HS code "nu" (8-10 chiffres) si présent et différent d’EAN
    if (!hsCode) {
      const candidates = line.match(/\b\d{8,10}\b/g) || [];
      const found = candidates.find((c) => (!ean || c !== ean) && hs4FromHs(c));
      if (found) hsCode = normalizeHsOrDigits(found);
    }

    // code article plausible
    const tokens = line.split(" ").map((t) => t.trim()).filter(Boolean);
    const codeArticle =
      tokens.find((t) => {
        const cleaned = t.replace(/[^\w-]/g, "");
        if (!cleaned) return false;
        if (/^\d+$/.test(cleaned)) return false; // tout chiffre
        if (ean && cleaned.includes(ean)) return false;
        if (hsCode && cleaned.includes(hsCode)) return false;
        // doit contenir lettres + chiffres
        const hasLetter = /[A-Za-z]/.test(cleaned);
        const hasDigit = /\d/.test(cleaned);
        if (!hasLetter || !hasDigit) return false;
        if (cleaned.length < 4 || cleaned.length > 24) return false;
        // évite des mots “FACTURE…”
        const up = cleaned.toUpperCase();
        if (up.includes("FACTURE") || up.includes("INVOICE")) return false;
        return true;
      }) || null;

    // quantité (best effort) : cherche un petit nombre "isolé" avant les montants
    // (on ne bloque pas si on ne trouve pas)
    let quantity: number | null = null;
    for (const t of tokens) {
      const c = t.replace(",", ".").replace(/[^\d.]/g, "");
      if (!c) continue;
      if (c.length > 6) continue;
      const n = Number(c);
      if (!Number.isFinite(n)) continue;
      if (n <= 0) continue;
      // évite de prendre les montants (souvent >= 1.00 mais on filtre sur "petit" et entier)
      if (Number.isInteger(n) && n <= 999) {
        quantity = n;
        break;
      }
    }

    // description = tout ce qui est avant le 1er montant détecté (approx)
    const firstAmountMatch = (lines[i].match(/-?\d{1,3}(?:[ \u00a0.]?\d{3})*(?:[.,]\d{2})/) || [])[0];
    let description = line;
    if (firstAmountMatch) {
      const idx = line.indexOf(firstAmountMatch);
      if (idx > 0) description = normalizeSpaces(line.slice(0, idx));
    }
    if (currentDescContinuation) {
      description = normalizeSpaces(`${currentDescContinuation} ${description}`);
      currentDescContinuation = null;
    }

    items.push({
      description: description || undefined,
      quantity,
      amountHT,
      codeArticle,
      ean13: ean ? normalizeHsOrDigits(ean) : null,
      hsCode,
    });
  }

  // nettoie items “vides”
  return items.filter((it) => (it.amountHT ?? 0) > 0 || (it.description || "").length > 3);
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

    // tri par lignes (y desc) puis x asc
    positioned.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const yTol = 2.5;
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

    // séparation pages
    allLines.push(" "); // ligne vide
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

  // transit: on privilégie "frais de transit" puis "transit", puis "transport"
  const transitFees =
    findAmountInLines(lines, ["frais de transit"]) ??
    findAmountInLines(lines, ["transit"]) ??
    findAmountInLines(lines, ["transport", "port", "expédition", "expedition", "shipping"]);

  const billingCountry = extractBillingCountry(lines);
  const vatExemptionMention = extractVatExemptionMention(lines);

  const lineItems = detectLineItems(lines);

  // fallback TTC si absent mais HT + TVA dispo
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
