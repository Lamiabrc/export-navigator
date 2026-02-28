import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type Payload = {
  product_name?: string;
  destination?: string;
  hs_hint?: string;
};

type InvoiceAnalyzePayload = {
  file_name?: string;
  file_base64?: string;
  destination?: string;
  incoterm?: string;
  currency?: string;
  payment_term?: string;
  operation_type?: string;
  product_code?: string;
  optional_comment?: string;
};

function norm(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parsePercent(v: unknown) {
  if (typeof v === "string") {
    const cleaned = v.replace("%", "").replace(",", ".").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseMoneyFromText(value: string | null | undefined) {
  const raw = String(value || "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!raw) return null;

  const normalized = raw
    .replace(/\.(?=\d{3}([,]|$))/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/,/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function extractAmountByLabel(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!labels.some((label) => lower.includes(label))) continue;
    const amounts = line.match(/-?\d[\d\s.,]{1,20}/g) || [];
    const parsed = amounts
      .map((amount) => parseMoneyFromText(amount))
      .filter((value): value is number => value !== null && value > 0);
    if (!parsed.length) continue;
    return parsed[parsed.length - 1];
  }
  return null;
}

function detectCurrency(text: string, fallback: string | null) {
  const upper = text.toUpperCase();
  if (/\bEUR\b|€/.test(upper)) return "EUR";
  if (/\bUSD\b|\$/.test(upper)) return "USD";
  if (/\bGBP\b|£/.test(upper)) return "GBP";
  if (/\bCHF\b/.test(upper)) return "CHF";
  if (/\bCNY\b|\bRMB\b/.test(upper)) return "CNY";
  return fallback ? String(fallback).toUpperCase() : null;
}

function detectIncoterm(text: string, fallback: string | null) {
  const upper = text.toUpperCase();
  const match = upper.match(/\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/);
  if (match?.[1]) return match[1];
  return fallback ? String(fallback).toUpperCase() : null;
}

function detectCountryIso2(text: string, fallback: string | null) {
  const upper = text.toUpperCase();
  const isoMatch = upper.match(/\b([A-Z]{2})\b/g);
  const allowlist = new Set([
    "FR",
    "DE",
    "ES",
    "IT",
    "GB",
    "US",
    "CA",
    "MA",
    "DZ",
    "TN",
    "CN",
    "JP",
    "AE",
    "BR",
    "MX",
    "CH",
    "BE",
    "NL",
    "PT",
    "TR",
    "CL",
    "UY",
    "AR",
    "PL",
    "SE",
    "NO",
  ]);
  if (isoMatch) {
    const first = isoMatch.find((code) => allowlist.has(code));
    if (first) return first;
  }
  return fallback ? String(fallback).toUpperCase() : null;
}

async function extractTextFromPdfBase64(base64: string) {
  const clean = String(base64 || "").replace(/^data:application\/pdf;base64,/i, "").trim();
  if (!clean) throw new Error("missing_pdf_payload");

  const bytes = Buffer.from(clean, "base64");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = (pdfjs as any).getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const lines: string[] = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const p = await pdf.getPage(page);
    const content = await p.getTextContent();
    const items = Array.isArray(content.items) ? content.items : [];
    const line = items
      .map((item: any) => String(item?.str || "").trim())
      .filter(Boolean)
      .join(" ");
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

function buildInvoiceAnalyzeResult(text: string, payload: InvoiceAnalyzePayload) {
  const invoiceNumber =
    text.match(/\b(?:FACTURE|INVOICE)\s*(?:N[°O.]*)?\s*[:#-]?\s*([A-Z0-9-]{4,30})/i)?.[1] ||
    text.match(/\b([A-Z]{1,3}-\d{4,12})\b/)?.[1] ||
    null;
  const date =
    text.match(/\b(\d{2}[/.-]\d{2}[/.-]\d{4})\b/)?.[1] ||
    text.match(/\b(\d{4}[/.-]\d{2}[/.-]\d{2})\b/)?.[1] ||
    null;
  const seller =
    text.match(/\b(?:vendeur|seller|supplier)\s*[:-]\s*([^\n]{3,120})/i)?.[1]?.trim() ||
    null;
  const buyer =
    text.match(/\b(?:acheteur|buyer|bill to|ship to)\s*[:-]\s*([^\n]{3,120})/i)?.[1]?.trim() ||
    null;

  const totalHt = extractAmountByLabel(text, ["total ht", "total h.t", "subtotal", "montant ht"]) || null;
  const totalTtc =
    extractAmountByLabel(text, ["total ttc", "net a payer", "net à payer", "amount due", "total due"]) || null;
  const lineCount = (text.match(/\b(?:qty|quantite|qte|description|article)\b/gi) || []).length || null;

  const incoterm = detectIncoterm(text, payload.incoterm || null);
  const currency = detectCurrency(text, payload.currency || null);
  const destination = detectCountryIso2(text, payload.destination || null);

  const checks: Array<{ level: "ok" | "warning" | "risk"; label: string; detail: string }> = [];
  checks.push(
    invoiceNumber
      ? { level: "ok", label: "Numero facture", detail: "Numero facture detecte." }
      : { level: "warning", label: "Numero facture", detail: "Numero facture non detecte automatiquement." }
  );
  checks.push(
    incoterm
      ? { level: "ok", label: "Incoterm", detail: `Incoterm detecte/selectionne: ${incoterm}.` }
      : { level: "risk", label: "Incoterm", detail: "Incoterm absent. Repartition des risques non claire." }
  );
  checks.push(
    currency
      ? { level: "ok", label: "Devise", detail: `Devise detectee/selectionnee: ${currency}.` }
      : { level: "warning", label: "Devise", detail: "Devise non detectee." }
  );
  checks.push(
    destination
      ? { level: "ok", label: "Destination", detail: `Destination detectee/selectionnee: ${destination}.` }
      : { level: "warning", label: "Destination", detail: "Destination non detectee." }
  );

  if (totalHt !== null && totalTtc !== null && totalTtc < totalHt) {
    checks.push({
      level: "risk",
      label: "Coherence totaux",
      detail: "Incoherence detectee: TTC inferieur au HT.",
    });
  } else if (totalHt !== null || totalTtc !== null) {
    checks.push({
      level: "ok",
      label: "Coherence totaux",
      detail: "Totaux detectes. Controle arithmetic a confirmer.",
    });
  } else {
    checks.push({
      level: "warning",
      label: "Totaux",
      detail: "Totaux HT/TTC non detectes clairement.",
    });
  }

  checks.push(
    payload.payment_term
      ? { level: "ok", label: "Paiement", detail: `Mode de paiement selectionne: ${payload.payment_term}.` }
      : { level: "warning", label: "Paiement", detail: "Mode de paiement non precise." }
  );

  const status = checks.some((item) => item.level === "risk")
    ? "risk"
    : checks.some((item) => item.level === "warning")
      ? "review"
      : "ok";

  return {
    ok: true,
    analysis_source: "api_pdf_parser",
    status,
    extracted: {
      invoice_number: invoiceNumber,
      date,
      seller,
      buyer,
      destination,
      incoterm,
      currency,
      total_ht: totalHt,
      total_ttc: totalTtc,
      line_count: lineCount,
    },
    checks,
    recommendations: [
      "Verifier facture, packing list et document transport (BL/AWB/CMR).",
      "Confirmer Incoterm, devise et mode de paiement dans le contrat.",
      "Controler le code HS et les obligations documentaires du pays destination.",
      "Realiser un screening sanctions avant expedition.",
    ],
    checklist: [
      "Numero/date facture",
      "Identite vendeur/acheteur",
      "Incoterm contractuel",
      "Devise et paiement",
      "Totaux HT/TVA/TTC",
      "Documents export/import associes",
    ],
  };
}

async function openaiSuggestHs(product: string, options: string[]) {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key || !options.length) return null;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu fais une classification produit vers code HS. Réponds uniquement en JSON: {hs_code: string, confidence: number}. Prends exclusivement un HS de la liste fournie.",
        },
        {
          role: "user",
          content: `Produit: ${product}\nHS possibles: ${options.join(", ")}`,
        },
      ],
    }),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const raw = String(data?.choices?.[0]?.message?.content || "");
  try {
    const parsed = JSON.parse(raw);
    const hs = String(parsed?.hs_code || "").replace(/[^0-9]/g, "");
    if (hs && options.some((o) => o.startsWith(hs) || hs.startsWith(o))) return hs;
  } catch {
    // ignore
  }
  return null;
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });
  const query = (req.query || {}) as Record<string, string | string[] | undefined>;
  const mode = String(Array.isArray(query.mode) ? query.mode[0] : query.mode || "").trim().toLowerCase();

  try {
    if (mode === "invoice-analyze") {
      const invoicePayload = await readJson<InvoiceAnalyzePayload>(req);
      const text = await extractTextFromPdfBase64(invoicePayload.file_base64 || "");
      return json(res, 200, buildInvoiceAnalyzeResult(text, invoicePayload));
    }

    const body = await readJson<Payload>(req);
    const product = String(body?.product_name || "").trim();
    const destination = String(body?.destination || "").trim();
    const hsHint = String(body?.hs_hint || "").replace(/[^0-9]/g, "");

    if (!product && !hsHint) {
      return json(res, 400, { ok: false, error: "product_or_hs_required" });
    }

    const admin = supabaseAdmin();

    const { data: hsRows } = await admin
      .from("export_hs_catalog")
      .select("hs_code,destination,om_rate,omr_rate,notes,source")
      .limit(40);

    const rows = Array.isArray(hsRows) ? hsRows : [];
    const destNorm = norm(destination);

    let selected = rows.find((r: any) => {
      const hs = String(r?.hs_code || "").replace(/[^0-9]/g, "");
      if (!hsHint || !hs) return false;
      return hs.startsWith(hsHint) || hsHint.startsWith(hs);
    });

    if (!selected && product) {
      const n = norm(product);
      selected = rows.find((r: any) => {
        const hay = norm(`${r?.notes || ""} ${r?.hs_code || ""}`);
        const haySeed = hay.slice(0, 24).trim();
        const destOk = !destNorm || norm(String(r?.destination || "")).includes(destNorm);
        return destOk && (hay.includes(n) || (haySeed.length > 2 && n.includes(haySeed)));
      });
    }

    if (!selected && product) {
      const hsOptions = rows
        .map((r: any) => String(r?.hs_code || "").replace(/[^0-9]/g, ""))
        .filter(Boolean)
        .slice(0, 30);
      const aiHs = await openaiSuggestHs(product, hsOptions);
      if (aiHs) {
        selected = rows.find((r: any) => {
          const hs = String(r?.hs_code || "").replace(/[^0-9]/g, "");
          const destOk = !destNorm || norm(String(r?.destination || "")).includes(destNorm);
          return destOk && (hs.startsWith(aiHs) || aiHs.startsWith(hs));
        }) || rows.find((r: any) => String(r?.hs_code || "").replace(/[^0-9]/g, "").startsWith(aiHs));
      }
    }

    const hsCode = String(selected?.hs_code || hsHint || "").replace(/[^0-9]/g, "");

    return json(res, 200, {
      ok: true,
      hs_code: hsCode || null,
      destination: destination || selected?.destination || null,
      om_rate: parsePercent((selected as any)?.om_rate),
      omr_rate: parsePercent((selected as any)?.omr_rate),
      taxes_rate: parsePercent((selected as any)?.om_rate) + parsePercent((selected as any)?.omr_rate),
      source: selected?.source || null,
      note: selected?.notes || null,
      openai_enabled: Boolean((process.env.OPENAI_API_KEY || "").trim()),
    });
  } catch (e: any) {
    if (mode === "invoice-analyze") {
      return json(res, 400, { ok: false, error: String(e?.message || "invoice_analyze_failed") });
    }
    return json(res, 500, { ok: false, error: String(e?.message || "taxes_product_failed") });
  }
});
