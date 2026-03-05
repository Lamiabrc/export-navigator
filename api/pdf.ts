import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { allowCors, json, readJson } from "../src/server/supabaseAdmin.js";

type PdfExtractLine = {
  description?: string | null;
  product_text?: string | null;
  hsCode?: string | null;
  hs6?: string | null;
  quantity?: number | string | null;
  amountHT?: number | string | null;
  unit_price?: number | string | null;
  total_value?: number | string | null;
};

type PdfExtractParsed = {
  invoiceNumber?: string | null;
  supplier?: string | null;
  date?: string | null;
  totalHT?: number | string | null;
  totalTTC?: number | string | null;
  billingCountry?: string | null;
  rawText?: string | null;
  lineItems?: PdfExtractLine[];
};

type PdfExtractPayload = {
  mode?: string | null;
  parsed?: PdfExtractParsed | null;
  to_country?: string | null;
  product_desc?: string | null;
  currency?: string | null;
};

function toText(v: any) {
  return String(v ?? "").trim();
}

function toNumberOrNull(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toCurrencyCode(v: unknown) {
  const code = String(v || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

function detectCurrency(rawText: string) {
  const text = String(rawText || "").toUpperCase();
  if (/\bUSD\b|\$/i.test(text)) return "USD";
  if (/\bGBP\b|£/.test(text)) return "GBP";
  if (/\bCHF\b/.test(text)) return "CHF";
  if (/\bCAD\b/.test(text)) return "CAD";
  if (/\bJPY\b|¥/.test(text)) return "JPY";
  if (/\bCNY\b|RMB/.test(text)) return "CNY";
  return "EUR";
}

function normalizeCountryIso2(input: unknown) {
  const raw = String(input || "").trim().toUpperCase();
  if (!raw) return null;
  if (/^[A-Z]{2}$/.test(raw)) return raw;

  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "");

  const map: Record<string, string> = {
    FRANCE: "FR",
    FRENCH: "FR",
    ALLEMAGNE: "DE",
    GERMANY: "DE",
    ESPAGNE: "ES",
    SPAIN: "ES",
    ITALIE: "IT",
    ITALY: "IT",
    BELGIQUE: "BE",
    BELGIUM: "BE",
    PAYSBAS: "NL",
    NETHERLANDS: "NL",
    SUISSE: "CH",
    SWITZERLAND: "CH",
    ROYAUMEUNI: "GB",
    UNITEDKINGDOM: "GB",
    ETATSUNIS: "US",
    UNITEDSTATES: "US",
    USA: "US",
    CANADA: "CA",
    CHINE: "CN",
    CHINA: "CN",
    JAPON: "JP",
    JAPAN: "JP",
    MAROC: "MA",
    MOROCCO: "MA",
  };
  return map[key] || null;
}

function normalizeHs6(input: unknown) {
  const digits = String(input || "").replace(/[^0-9]/g, "");
  if (digits.length < 4) return null;
  return digits.slice(0, 6);
}

function extractFromParsed(payload: PdfExtractPayload) {
  const parsed = (payload.parsed || {}) as PdfExtractParsed;
  const linesRaw = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
  const inferredCurrency =
    toCurrencyCode(payload.currency) ||
    detectCurrency(String(parsed.rawText || ""));

  const items = linesRaw
    .map((line, idx) => {
      const quantity = toNumberOrNull(line.quantity);
      const totalValue =
        toNumberOrNull(line.total_value) ??
        toNumberOrNull(line.amountHT);

      let unitPrice = toNumberOrNull(line.unit_price);
      if (unitPrice === null && totalValue !== null && quantity !== null && quantity > 0) {
        unitPrice = Number((totalValue / quantity).toFixed(4));
      }

      const productText =
        toText(line.description) ||
        toText(line.product_text) ||
        `Ligne ${idx + 1}`;

      return {
        line_no: idx + 1,
        product_text: productText,
        hs6: normalizeHs6(line.hs6 || line.hsCode),
        quantity,
        unit_price: unitPrice,
        total_value: totalValue,
        currency: inferredCurrency,
      };
    })
    .filter((line) => line.product_text || line.total_value !== null);

  const summedAmount = Number(
    items.reduce((acc, line) => acc + Number(line.total_value || 0), 0).toFixed(2)
  );

  const valueAmount =
    toNumberOrNull(parsed.totalHT) ??
    toNumberOrNull(parsed.totalTTC) ??
    (summedAmount > 0 ? summedAmount : null);

  const firstProduct = items.find((line) => toText(line.product_text));
  const productDesc = toText(payload.product_desc) || firstProduct?.product_text || null;

  const toCountry =
    normalizeCountryIso2(payload.to_country) ||
    normalizeCountryIso2(parsed.billingCountry);

  return {
    source_type: "invoice_pdf",
    to_country: toCountry,
    currency: inferredCurrency,
    value_amount: valueAmount,
    product_desc: productDesc,
    items,
    metadata: {
      invoice_number: toText(parsed.invoiceNumber) || null,
      supplier: toText(parsed.supplier) || null,
      invoice_date: toText(parsed.date) || null,
    },
    title_suggestion:
      toText(parsed.invoiceNumber)
        ? `Dossier ${toText(parsed.invoiceNumber)}`
        : productDesc
          ? `Dossier ${productDesc}`
          : "Nouveau dossier export",
  };
}

export default allowCors(async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  try {
    const payload = await readJson<any>(req);
    const mode = toText(payload?.mode).toLowerCase();

    if (mode === "extract") {
      const extracted = extractFromParsed(payload as PdfExtractPayload);
      json(res, 200, { ok: true, mode: "extract", extracted });
      return;
    }

    const title = toText(payload?.title) || "Rapport de controle export";
    const email = toText(payload?.email);
    const destination = toText(payload?.destination);
    const incoterm = toText(payload?.incoterm);
    const value = payload?.value;
    const currency = toText(payload?.currency) || "EUR";
    const landed = payload?.result?.landedCost;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const { height } = page.getSize();
    let y = height - 60;
    const x = 50;

    page.drawText("MPL Export Conseil", { x, y, size: 12, font: bold, color: rgb(0.1, 0.2, 0.4) });
    y -= 18;
    page.drawText(title, { x, y, size: 16, font: bold, color: rgb(0.05, 0.1, 0.2) });

    y -= 22;
    page.drawText(`Date : ${new Date().toLocaleString("fr-FR")}`, { x, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

    y -= 22;
    const lines = [
      email ? `Email : ${email}` : null,
      destination ? `Destination : ${destination}` : null,
      incoterm ? `Incoterm : ${incoterm}` : null,
      value != null ? `Valeur : ${value} ${currency}` : null,
    ].filter(Boolean) as string[];

    for (const l of lines) {
      page.drawText(l, { x, y, size: 11, font });
      y -= 16;
    }

    y -= 10;
    page.drawText("Synthese estimation (indicative)", { x, y, size: 12, font: bold });
    y -= 18;

    if (landed) {
      page.drawText(`Droits : ${Number(landed.duty || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Taxes : ${Number(landed.taxes || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Total : ${Number(landed.total || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 12, font: bold });
      y -= 18;
    } else {
      page.drawText("Aucune donnee de cout fournie.", { x, y, size: 11, font });
      y -= 16;
    }

    page.drawText("Note : ce rapport est informatif. Validation humaine recommandee.", {
      x,
      y: 60,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="mpl-rapport-export.pdf"');
    res.statusCode = 200;
    res.end(Buffer.from(bytes));
  } catch (e: any) {
    res.statusCode = 500;
    res.end(e?.message || "pdf failed");
  }
});
