import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { extractInvoiceFromPdfBytes, type ParsedInvoice } from "../_shared/invoicePdf.ts";

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

type ComparisonLine = {
  index: number;
  description?: string | null;
  hs: string | null;
  matchLevel: "exact" | "hs6" | "hs4" | "none";
  reference?: {
    hs_code: string;
    destination: string;
    category?: string | null;
    om_rate?: number | null;
    omr_rate?: number | null;
    notes?: string | null;
    source?: string | null;
  } | null;
  issues: string[];
};

type ComparisonSummary = {
  inputDestination: string | null;
  destination: string | null;
  coverage: { total: number; withHs: number; matched: number; missingHs: number; unmatched: number };
  lines: ComparisonLine[];
  issues: string[];
  warning?: string;
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

function normalizeHsCode(hs?: string | null) {
  return String(hs || "").replace(/[^0-9]/g, "");
}

function buildHsCandidates(hs: string) {
  const cleaned = normalizeHsCode(hs);
  if (!cleaned) return [];
  const out = new Set<string>();
  out.add(cleaned);
  if (cleaned.length >= 6) out.add(cleaned.slice(0, 6));
  if (cleaned.length >= 4) out.add(cleaned.slice(0, 4));
  return Array.from(out);
}

function isMissingTableError(err: any) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("unknown table");
}

async function resolveDestinationCode(admin: any, input?: string | null) {
  const raw = String(input || "").trim();
  if (!raw) return { resolved: null as string | null };
  const codeCandidate = raw.toUpperCase();

  try {
    const byCode = await admin
      .from("export_destinations")
      .select("code,name")
      .ilike("code", codeCandidate)
      .maybeSingle();
    if (!byCode.error && byCode.data?.code) return { resolved: byCode.data.code as string };
    if (byCode.error && isMissingTableError(byCode.error)) return { resolved: raw };

    const byName = await admin
      .from("export_destinations")
      .select("code,name")
      .ilike("name", raw)
      .maybeSingle();
    if (!byName.error && byName.data?.code) return { resolved: byName.data.code as string };
    if (byName.error && isMissingTableError(byName.error)) return { resolved: raw };
  } catch {
    return { resolved: raw };
  }

  return { resolved: raw };
}

async function buildComparison(admin: any, parsed: ReturnType<typeof finalizeParsed>, destinationInput?: string | null) {
  const inputDestination = String(destinationInput || "").trim() || null;
  const { resolved: destination } = await resolveDestinationCode(admin, inputDestination);

  const issues: string[] = [];
  if (!destination) issues.push("Destination manquante (pays).");

  const rawLines = Array.isArray(parsed?.lineItems) ? parsed.lineItems : [];
  const lines: ComparisonLine[] = [];
  let withHs = 0;
  let matched = 0;
  let missingHs = 0;
  let unmatched = 0;

  const hsCandidates = new Set<string>();
  rawLines.forEach((line: any, idx: number) => {
    const hsRaw = normalizeHsCode(line?.hsCode ?? line?.hs_code ?? line?.hs ?? "");
    if (!hsRaw || hsRaw.length < 4) {
      missingHs += 1;
      lines.push({
        index: idx,
        description: line?.description ?? null,
        hs: hsRaw || null,
        matchLevel: "none",
        reference: null,
        issues: ["HS manquant ou incomplet"],
      });
      return;
    }
    withHs += 1;
    buildHsCandidates(hsRaw).forEach((c) => hsCandidates.add(c));
    lines.push({
      index: idx,
      description: line?.description ?? null,
      hs: hsRaw,
      matchLevel: "none",
      reference: null,
      issues: [],
    });
  });

  let catalogRows: any[] = [];
  if (destination && hsCandidates.size) {
    const { data, error } = await admin
      .from("export_hs_catalog")
      .select("hs_code,destination,category,om_rate,omr_rate,notes,source")
      .eq("destination", destination)
      .in("hs_code", Array.from(hsCandidates));

    if (error) {
      if (isMissingTableError(error)) {
        issues.push("Table export_hs_catalog manquante.");
      } else {
        issues.push("Echec lecture referentiel HS.");
      }
    } else {
      catalogRows = data || [];
    }
  }

  const byHs = new Map<string, any>();
  for (const row of catalogRows) {
    const key = normalizeHsCode(row?.hs_code);
    if (key) byHs.set(key, row);
  }

  const coverage = { total: rawLines.length, withHs, matched: 0, missingHs, unmatched: 0 };

  lines.forEach((line) => {
    if (!line.hs || line.hs.length < 4) return;
    const candidates = buildHsCandidates(line.hs);
    let hit: any = null;
    let level: ComparisonLine["matchLevel"] = "none";

    if (candidates.length) {
      if (byHs.has(candidates[0])) {
        hit = byHs.get(candidates[0]);
        level = "exact";
      } else {
        const hs6 = candidates.find((c) => c.length === 6 && byHs.has(c));
        const hs4 = candidates.find((c) => c.length === 4 && byHs.has(c));
        if (hs6) {
          hit = byHs.get(hs6);
          level = "hs6";
        } else if (hs4) {
          hit = byHs.get(hs4);
          level = "hs4";
        }
      }
    }

    if (hit) {
      matched += 1;
      line.matchLevel = level;
      line.reference = {
        hs_code: String(hit.hs_code || ""),
        destination: String(hit.destination || destination || ""),
        category: hit.category ?? null,
        om_rate: hit.om_rate ?? null,
        omr_rate: hit.omr_rate ?? null,
        notes: hit.notes ?? null,
        source: hit.source ?? null,
      };
    } else {
      unmatched += 1;
      line.issues.push("Aucun match HS pour la destination");
    }
  });

  coverage.matched = matched;
  coverage.unmatched = unmatched;

  if (!destination && withHs) issues.push("Impossible de comparer sans destination.");
  if (withHs && !matched && destination) issues.push("Aucune reference HS trouvee pour cette destination.");

  return {
    inputDestination,
    destination,
    coverage,
    lines,
    issues,
  } satisfies ComparisonSummary;
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

  let parsed: ParsedInvoice | any = body.parsed ?? null;

  if (!parsed) {
    const { data: fileData, error: fileError } = await admin.storage.from(bucket).download(path);
    if (fileError || !fileData) {
      return json(400, { ok: false, error: fileError?.message || "File download failed" });
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const lowerName = fileName.toLowerCase();
    const isPdf = fileType.includes("pdf") || lowerName.endsWith(".pdf");
    const isCsv = fileType.includes("csv") || lowerName.endsWith(".csv");

    if (isPdf) {
      try {
        parsed = await extractInvoiceFromPdfBytes(bytes);
      } catch (err: any) {
        return json(400, { ok: false, error: err?.message || "PDF parse failed" });
      }
    } else {
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
  }

  const finalParsed = finalizeParsed(parsed);
  let comparison: ComparisonSummary | null = null;
  try {
    comparison = await buildComparison(admin, finalParsed, body?.destination || finalParsed?.billingCountry || null);
  } catch (err: any) {
    comparison = {
      inputDestination: body?.destination || null,
      destination: null,
      coverage: { total: finalParsed?.lineItems?.length || 0, withHs: 0, matched: 0, missingHs: 0, unmatched: 0 },
      lines: [],
      issues: [err?.message || "Comparison failed"],
    };
  }

  const storedParsed = { ...finalParsed, comparison };

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
      parsed: storedParsed,
    })
    .select("id")
    .single();

  if (insertError) {
    return json(500, { ok: false, error: insertError.message });
  }

  return json(200, { ok: true, id: inserted?.id, parsed: finalParsed, comparison });
});
