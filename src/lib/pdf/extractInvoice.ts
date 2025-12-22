import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type TextItem } from 'pdfjs-dist';

// Utilise le worker UMD classique résolu comme asset statique par Vite
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

const numberFromText = (text: string): number | null => {
  const normalized = text.replace(/\s/g, '').replace(',', '.').replace(/\u00a0/g, '');
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const findAmount = (text: string, keywords: string[]): number | null => {
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      const nums = line.match(/-?\d+[.,]?\d*/g);
      if (nums && nums.length) {
        const parsed = numberFromText(nums[nums.length - 1]);
        if (parsed !== null) return parsed;
      }
    }
  }
  return null;
};

const findInvoiceNumber = (text: string): string | null => {
  const match = text.match(/(FA[CV]?[\s-]?\d{4,}|FV\d{4,}|PF\d{4,})/i);
  return match ? match[0].replace(/\s/g, '') : null;
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await getDocument({ data: arrayBuffer }).promise;
  const content: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const txt = await page.getTextContent();
    const items = txt.items as TextItem[];
    content.push(items.map((i) => i.str).join(' '));
  }
  return content.join('\n');
};

export type ParsedInvoice = {
  invoiceNumber: string | null;
  supplier: string | null;
  date: string | null;
  totalHT: number | null;
  totalTTC: number | null;
  transitFees: number | null;
  rawText: string;
};

export async function extractInvoiceFromPdf(file: File): Promise<ParsedInvoice> {
  const text = await extractTextFromPdf(file);
  const ht = findAmount(text, ['total ht', 'montant ht', 'ht']);
  const ttc = findAmount(text, ['total ttc', 'ttc', 'à payer', 'apayer']);
  const transit = findAmount(text, ['transit', 'frais de transit', 'transport', 'port', 'expédition', 'shipping']);

  // Supplier: take first line with uppercase word before "SA", "SARL" etc. or fallback to first line
  const firstLine = text.split('\n').find((l) => l.trim().length > 0) || '';
  const supplierMatch = text.match(/([A-Z0-9][A-Z0-9\s]{3,})(SARL|SA|SAS|SASU|EURL|SOCIETE)?/);

  // Date: simple regex DD/MM/YYYY or YYYY-MM-DD
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);

  const invoiceNumber = findInvoiceNumber(text);

  // Fallback TTC if HT + transit available
  const computedTtc = ttc ?? (ht !== null ? ht + (transit ?? 0) * 1.2 : null);

  return {
    invoiceNumber,
    supplier: supplierMatch ? supplierMatch[1].trim() : firstLine.trim(),
    date: dateMatch ? dateMatch[0] : null,
    totalHT: ht,
    totalTTC: computedTtc,
    transitFees: transit,
    rawText: text,
  };
}
