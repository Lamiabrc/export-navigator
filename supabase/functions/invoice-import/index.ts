import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

type Body = {
  bucket?: string;
  path?: string;
  fileName?: string;
  fileType?: string;
  size?: number;
  destination?: string;
  incoterm?: string;
  currency?: string;
  parsed?: any;
};

type ParsedLine = {
  description?: string | null;
  quantity?: number | null;
  amountHT?: number | null;
  hsCode?: string | null;
  codeArticle?: string | null;
};

function normalizeHeader(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  let s = raw.replace(/\s+/g, "").replace(/[^0-9,.-]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const ALIASES = {
  description: [
    "description",
    "libelle",
    "designation",
    "product",
    "item",
    "article",
    "produit",
  ],
  quantity: ["qty", "quantity", "quantite", "qte", "nb"],
  unitPrice: ["unit_price", "price", "prix", "pu", "unitprice", "price_unit"],
  amount: [
    "amount",
    "total",
    "total_ht",
    "montant",
    "line_total",
    "amount_ht",
    "ht",
  ],
  hs: ["hs", "hscode", "hs_code", "code_hs", "taric", "nc8"],
  codeArticle: ["sku", "code", "code_article", "item_code"],
  vat: ["tva", "vat", "tax", "taxe"],
};

const ALIASES_NORM = Object.fromEntries(
  Object.entries(ALIASES).map(([k, v]) => [k, v.map(normalizeHeader)])
) as Record<string, string[]>;

function pickValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return null;
}

function buildLineItems(rows: Array<Record<string, unknown>>) {
  const items: ParsedLine[] = [];
  let totalVat = 0;
  let hasVat = false;

  for (const row of rows) {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[normalizeHeader(k)] = v;
    }

    const description = pickValue(normalized, ALIASES_NORM.description);
    const hs = pickValue(normalized, ALIASES_NORM.hs);
    const codeArticle = pickValue(normalized, ALIASES_NORM.codeArticle);

    const qty = parseNumber(pickValue(normalized, ALIASES_NORM.quantity));
    const unitPrice = parseNumber(pickValue(normalized, ALIASES_NORM.unitPrice));
    const amount = parseNumber(pickValue(normalized, ALIASES_NORM.amount));

    const vat = parseNumber(pickValue(normalized, ALIASES_NORM.vat));
    if (vat !== null) {
      hasVat = true;
      totalVat += vat;
    }

    const quantity = qty ?? 1;
    const amountHT = amount !== null ? amount : unitPrice !== null ? unitPrice * quantity : null;

    if (!description && !hs && amountHT === null && !codeArticle) continue;

    items.push({
      description: description ? String(description) : null,
      quantity: Number.isFinite(quantity) ? quantity : null,
      amountHT,
      hsCode: hs ? String(hs).replace(/[^0-9]/g, "") : null,
      codeArticle: codeArticle ? String(codeArticle) : null,
    });
  }

  return { items, totalVat: hasVat ? totalVat : null };
}

function sumLineItems(items: ParsedLine[]) {
  return items.reduce((sum, it) => sum + (Number.isFinite(Number(it.amountHT)) ? Number(it.amountHT) : 0), 0);
}

function finalizeParsed(raw: any) {
  const lineItems = Array.isArray(raw?.lineItems) ? raw.lineItems : [];
  const totalHT =
    parseNumber(raw?.totalHT ?? raw?.total_ht) ??
    (lineItems.length ? sumLineItems(lineItems as ParsedLine[]) : null);
  const totalTVA = parseNumber(raw?.totalTVA ?? raw?.total_tva);
  const totalTTC =
    parseNumber(raw?.totalTTC ?? raw?.total_ttc) ??
    (totalHT !== null && totalTVA !== null ? totalHT + totalTVA : null);

  return {
    invoiceNumber: raw?.invoiceNumber ?? raw?.invoice_number ?? null,
    supplier: raw?.supplier ?? null,
    date: raw?.date ?? null,
    totalHT,
    totalTVA,
    totalTTC,
    transitFees: parseNumber(raw?.transitFees ?? raw?.transit_fees) ?? null,
    billingCountry: raw?.billingCountry ?? raw?.billing_country ?? null,
    vatExemptionMention: raw?.vatExemptionMention ?? null,
    lineItems,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json(500, { ok: false, error: "Missing supabase env" });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const bucket = String(body?.bucket || "");
  const path = String(body?.path || "");
  const fileName = String(body?.fileName || "");
  const fileType = String(body?.fileType || "");
  const size = Number(body?.size) || null;

  if (!bucket || !path || !fileName) {
    return json(400, { ok: false, error: "bucket, path and fileName are required" });
  }

  if (bucket !== "invoice_files") {
    return json(400, { ok: false, error: "Invalid bucket" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let parsed = body.parsed ?? null;

  if (!parsed) {
    const { data: fileData, error: fileError } = await admin.storage.from(bucket).download(path);
    if (fileError || !fileData) {
      return json(400, { ok: false, error: fileError?.message || "File download failed" });
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const lowerName = fileName.toLowerCase();
    const isCsv = fileType.includes("csv") || lowerName.endsWith(".csv");

    const workbook = isCsv
      ? XLSX.read(new TextDecoder().decode(bytes), { type: "string" })
      : XLSX.read(bytes, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return json(400, { ok: false, error: "No sheet found" });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const { items, totalVat } = buildLineItems(rows);
    const totalHT = sumLineItems(items);
    const totalTVA = totalVat;
    const totalTTC = totalTVA !== null ? totalHT + totalTVA : null;

    parsed = {
      invoiceNumber: null,
      supplier: null,
      date: null,
      totalHT,
      totalTVA,
      totalTTC,
      transitFees: null,
      billingCountry: null,
      vatExemptionMention: null,
      lineItems: items,
    };
  }

  const finalParsed = finalizeParsed(parsed);

  const { data: inserted, error: insertError } = await admin
    .from("invoice_uploads")
    .insert({
      user_id: user.id,
      file_name: fileName,
      file_path: path,
      file_type: fileType || null,
      size_bytes: size,
      destination: body?.destination || null,
      incoterm: body?.incoterm || null,
      currency: body?.currency || null,
      total_ht: finalParsed.totalHT,
      total_tva: finalParsed.totalTVA,
      total_ttc: finalParsed.totalTTC,
      parsed: finalParsed,
    })
    .select("id")
    .single();

  if (insertError) {
    return json(500, { ok: false, error: insertError.message });
  }

  return json(200, { ok: true, id: inserted?.id, parsed: finalParsed });
});
