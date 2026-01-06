import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";
import {
  Alert,
  CompetitorPrice,
  ExportCostComponents,
  ExportFilters,
  FetchResult,
  Invoice,
  InvoiceDetail,
  InvoiceLine,
  KPIResult,
  Pagination,
  RatesContext,
  SaleLine,
  TopClient,
} from "./types";

const INVOICE_SOURCES = ["v_sales_invoices_enriched", "sales_invoices"] as const;
const DATE_COLUMNS = ["invoice_date", "date", "created_at"] as const;
const MAX_ROWS = 2000;
const DEFAULT_PAGE_SIZE = 50;
const TRANSIT_ALERT_PCT = 0.35; // alert when transit fee represents more than 35% of invoice HT

let cachedRates: RatesContext | null = null;
let cachedRatesWarning: string | undefined;

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value ?? NaN);
  if (Number.isFinite(n)) return n;
  return fallback;
}

function combineWarnings(...parts: Array<string | undefined>): string | undefined {
  const items = parts.filter(Boolean) as string[];
  if (!items.length) return undefined;
  return Array.from(new Set(items)).join(" | ");
}

function pickRateForTerritory(rows: any[], territory?: string | null) {
  if (!rows || !rows.length) return undefined;
  if (!territory) return rows[0];
  const normalized = territory.toUpperCase();
  return rows.find((r) => (r?.territory_code || "").toUpperCase() === normalized) || rows[0];
}

function percentFromRow(row: any, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row?.[key];
    const parsed = num(value, NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function estimateExportCosts(base: number, territory: string | null | undefined, ctx: RatesContext): ExportCostComponents {
  const vatRow = pickRateForTerritory(ctx.vatRates, territory);
  const omRow = pickRateForTerritory(ctx.omRates, territory);
  const octroiRow = pickRateForTerritory(ctx.octroiRates, territory);
  const extraRule = pickRateForTerritory(ctx.taxRules, territory);

  const vatRate = percentFromRow(vatRow, ["rate_percent", "rate", "vat_rate"]) ?? 0;
  const omRate = percentFromRow(omRow, ["om_rate", "rate"]) ?? 0;
  const omrRate = percentFromRow(omRow, ["omr_rate"]) ?? 0;
  const octroiRate = percentFromRow(octroiRow, ["rate_percent", "rate", "octroi_rate"]) ?? 0;
  const extraPercent = percentFromRow(extraRule, ["rate_percent", "rate"]) ?? 0;
  const extraFlat = num(extraRule?.flat_eur, 0);

  const vat = (base * vatRate) / 100;
  const om = (base * (omRate + omrRate)) / 100;
  const octroi = (base * octroiRate) / 100;
  const extraRules = (base * extraPercent) / 100 + extraFlat;

  const sources: string[] = [];
  if (vatRow) sources.push("vat_rates");
  if (omRow) sources.push("om_rates");
  if (octroiRow) sources.push("octroi_rates");
  if (extraRule) sources.push("tax_rules_extra");

  const total = vat + om + octroi + extraRules;

  return {
    vat,
    om,
    octroi,
    extraRules,
    total,
    sources,
    estimated: !(vatRow || omRow || octroiRow || extraRule),
  };
}

function shouldFallbackToNextSource(error: any): boolean {
  if (!error) return false;
  if (isMissingTableError(error) || isMissingColumnError(error)) return true;
  const status = (error as any)?.status;
  // PostgREST returns status 400 on unknown column filters or bad casts; treat as recoverable to allow fallback.
  if (status === 400) return true;
  return false;
}

async function loadRatesContext(): Promise<{ context: RatesContext; warning?: string }> {
  if (cachedRates) return { context: cachedRates, warning: cachedRatesWarning };

  if (!SUPABASE_ENV_OK) {
    const context: RatesContext = { vatRates: [], omRates: [], octroiRates: [], taxRules: [] };
    cachedRates = context;
    cachedRatesWarning = "Supabase non configure: estimations a 0%";
    return { context, warning: cachedRatesWarning };
  }

  const missing: string[] = [];

  const [vatRes, omRes, octroiRes, taxRes] = await Promise.all([
    supabase.from("vat_rates").select("*").limit(5000),
    supabase.from("om_rates").select("*").limit(5000),
    supabase.from("octroi_rates").select("*").limit(5000),
    supabase.from("tax_rules_extra").select("*").limit(5000),
  ]);

  if (vatRes.error) {
    if (isMissingTableError(vatRes.error)) missing.push("vat_rates");
    else throw vatRes.error;
  }
  if (omRes.error) {
    if (isMissingTableError(omRes.error)) missing.push("om_rates");
    else throw omRes.error;
  }
  if (octroiRes.error) {
    if (isMissingTableError(octroiRes.error)) missing.push("octroi_rates");
    else throw octroiRes.error;
  }
  if (taxRes.error) {
    if (isMissingTableError(taxRes.error)) missing.push("tax_rules_extra");
    else throw taxRes.error;
  }

  const context: RatesContext = {
    vatRates: vatRes.data ?? [],
    omRates: omRes.data ?? [],
    octroiRates: octroiRes.data ?? [],
    taxRules: taxRes.data ?? [],
  };

  cachedRates = context;
  cachedRatesWarning = missing.length ? `Tables manquantes: ${missing.join(", ")}` : undefined;

  return { context, warning: cachedRatesWarning };
}

function mapInvoiceRow(row: any, source: string, ctx: RatesContext): Invoice {
  const invoiceNumber = row?.invoice_number || row?.number || row?.invoice_no || row?.id || "N/A";
  const invoiceDate = row?.invoice_date || row?.date || null;
  const invoiceHt = num(row?.invoice_ht_eur ?? row?.amount_ht ?? row?.total_ht);
  const transitFee = num(row?.transit_fee_eur ?? row?.transit_fee);
  const providedProducts = row?.products_ht_eur ?? row?.products_amount_ht;
  const productsHt = providedProducts !== undefined && providedProducts !== null ? num(providedProducts) : num(invoiceHt - transitFee);
  const transportCost = num(row?.transport_cost_eur ?? row?.transport_cost ?? row?.transport_fee_eur);
  const territory = row?.territory_code ?? row?.market_zone ?? row?.ile ?? row?.island ?? null;

  const estimatedCosts = estimateExportCosts(productsHt, territory, ctx);
  const margin = productsHt - (transitFee + estimatedCosts.total + transportCost);

  return {
    id: row?.id || undefined,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    client_id: row?.client_id ?? null,
    client_name: row?.client_name ?? row?.client_label ?? null,
    territory_code: row?.territory_code ?? null,
    ile: row?.ile ?? row?.island ?? null,
    nb_colis: row?.nb_colis ?? row?.parcel_count ?? row?.nb_parcels ?? null,
    currency: row?.currency ?? "EUR",
    invoice_ht_eur: invoiceHt,
    products_ht_eur: productsHt,
    products_estimated: providedProducts === undefined || providedProducts === null,
    transit_fee_eur: transitFee,
    transport_cost_eur: transportCost,
    estimated_export_costs: estimatedCosts,
    marge_estimee: margin,
    status: row?.status ?? null,
    source,
  };
}

function buildInvoiceQuery(source: string, filters: ExportFilters, pagination: Pagination | undefined, dateColumn: string) {
  const query = supabase.from(source).select("*", { count: "exact" });

  if (filters.from) query.gte(dateColumn, filters.from);
  if (filters.to) query.lte(dateColumn, filters.to);
  if (filters.territory) query.ilike("territory_code", `%${filters.territory}%`);
  if (filters.clientId) query.ilike("client_id", `%${filters.clientId}%`);
  if (filters.invoiceNumber) query.ilike("invoice_number", `%${filters.invoiceNumber}%`);
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query.or(`invoice_number.ilike.${pattern},client_id.ilike.${pattern},territory_code.ilike.${pattern}`);
  }

  query.order(dateColumn, { ascending: false });
  const size = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, pagination?.page ?? 1);
  const fromIdx = (page - 1) * size;
  const toIdx = fromIdx + size - 1;
  query.range(fromIdx, toIdx);
  return query;
}

export async function fetchInvoices(filters: ExportFilters = {}, pagination: Pagination = {}): Promise<FetchResult<Invoice>> {
  if (!SUPABASE_ENV_OK) {
    return {
      data: [],
      total: 0,
      warning: "Supabase non configure: aucune facture chargee",
    };
  }

  const { context, warning: rateWarning } = await loadRatesContext();

  let lastError: any;
  const missingSources: string[] = [];

  for (const source of INVOICE_SOURCES) {
    let usedDateColumn = "invoice_date";
    let attemptError: any = null;
    for (const dateCol of DATE_COLUMNS) {
      usedDateColumn = dateCol;
      const query = buildInvoiceQuery(source, filters, pagination, dateCol);
      const { data, error, count } = await query;

      if (error) {
        attemptError = error;
        if (shouldFallbackToNextSource(error)) {
          continue; // try next date column or next source
        }
        lastError = error;
        break;
      }

      const mapped = (data || []).map((row: any) => mapInvoiceRow(row, source, context));
      return {
        data: mapped,
        total: count ?? mapped.length,
        warning: combineWarnings(
          rateWarning,
          missingSources.length ? `Fallback sur ${source} (vue manquante)` : undefined,
        ),
        source,
      };
    }

    if (attemptError && shouldFallbackToNextSource(attemptError)) {
      missingSources.push(source);
      continue;
    }
  }

  if (missingSources.length === INVOICE_SOURCES.length) {
    return { data: [], total: 0, warning: "Aucune source invoice disponible (v_sales_invoices_enriched ou sales_invoices)" };
  }

  if (lastError) throw lastError;
  return { data: [], total: 0, warning: "Factures introuvables" };
}

export async function fetchInvoiceByNumber(invoiceNumber: string): Promise<InvoiceDetail> {
  if (!invoiceNumber) throw new Error("invoice_number requis");
  if (!SUPABASE_ENV_OK) throw new Error("Supabase non configure pour les factures");

  const { context, warning: rateWarning } = await loadRatesContext();
  let invoice: Invoice | null = null;
  const missingSources: string[] = [];

  for (const source of INVOICE_SOURCES) {
    const { data, error } = await supabase.from(source).select("*").eq("invoice_number", invoiceNumber).limit(1);

    if (error) {
      if (shouldFallbackToNextSource(error)) {
        missingSources.push(source);
        continue;
      }
      throw error;
    }

    if (data && data.length) {
      invoice = mapInvoiceRow(data[0], source, context);
      break;
    }
  }

  if (!invoice) {
    throw new Error(`Facture ${invoiceNumber} introuvable`);
  }

  const linesRes = await fetchInvoiceLines(invoiceNumber);
  const competitorRes = await fetchCompetitorPrices(invoice.territory_code ?? invoice.ile ?? null, (linesRes.data || [])
    .map((l) => l.product_id)
    .filter(Boolean) as string[]);

  return {
    ...invoice,
    warning: combineWarnings(
      rateWarning,
      missingSources.length ? `Vue invoices manquante (${missingSources.join(", ")})` : undefined,
    ),
    lines: linesRes.data,
    linesWarning: linesRes.warning,
    competitors: competitorRes.data,
    competitorWarning: competitorRes.warning,
  };
}

export async function fetchKpis(filters: ExportFilters = {}): Promise<KPIResult> {
  const invoicesRes = await fetchInvoices(filters, { page: 1, pageSize: MAX_ROWS });
  const invoices = invoicesRes.data;

  const caHt = invoices.reduce((s, inv) => s + num(inv.invoice_ht_eur), 0);
  const totalProducts = invoices.reduce((s, inv) => s + num(inv.products_ht_eur), 0);
  const totalTransit = invoices.reduce((s, inv) => s + num(inv.transit_fee_eur), 0);
  const totalTransport = invoices.reduce((s, inv) => s + num(inv.transport_cost_eur), 0);
  const estimatedCosts = invoices.reduce(
    (acc, inv) => {
      acc.vat += num(inv.estimated_export_costs.vat);
      acc.om += num(inv.estimated_export_costs.om);
      acc.octroi += num(inv.estimated_export_costs.octroi);
      acc.extraRules += num(inv.estimated_export_costs.extraRules);
      return acc;
    },
    { vat: 0, om: 0, octroi: 0, extraRules: 0 },
  );
  const estimatedExportCosts: ExportCostComponents = {
    ...estimatedCosts,
    total: estimatedCosts.vat + estimatedCosts.om + estimatedCosts.octroi + estimatedCosts.extraRules,
    sources: ["vat_rates", "om_rates", "octroi_rates", "tax_rules_extra"],
    estimated: false,
  };

  const estimatedMargin = totalProducts - (totalTransit + estimatedExportCosts.total + totalTransport);
  const parcelCount = invoices.reduce((s, inv) => s + num(inv.nb_colis), 0);

  return {
    caHt,
    totalProducts,
    totalTransit,
    totalTransport,
    estimatedExportCosts,
    estimatedMargin,
    invoiceCount: invoices.length,
    parcelCount,
    source: invoicesRes.source || "sales_invoices",
    warning: invoicesRes.warning,
  };
}

export async function fetchTopClients(filters: ExportFilters = {}): Promise<TopClient[]> {
  const invoicesRes = await fetchInvoices(filters, { page: 1, pageSize: MAX_ROWS });
  const invoices = invoicesRes.data;
  const map = new Map<string, TopClient>();

  invoices.forEach((inv) => {
    const key = inv.client_id || "NC";
    const cur = map.get(key) || {
      client_id: inv.client_id ?? null,
      client_name: inv.client_name ?? inv.client_id ?? "Sans client",
      ca_ht: 0,
      products_ht: 0,
      margin_estimee: 0,
      territory_code: inv.territory_code ?? null,
    };
    cur.ca_ht += num(inv.invoice_ht_eur);
    cur.products_ht += num(inv.products_ht_eur);
    cur.margin_estimee += num(inv.marge_estimee);
    map.set(key, cur);
  });

  return Array.from(map.values()).sort((a, b) => b.margin_estimee - a.margin_estimee).slice(0, 12);
}

export async function fetchAlerts(filters: ExportFilters = {}): Promise<Alert[]> {
  const invoicesRes = await fetchInvoices(filters, { page: 1, pageSize: MAX_ROWS });
  const invoices = invoicesRes.data;
  const alerts: Alert[] = [];

  const missingClient = invoices.filter((i) => !i.client_id).length;
  if (missingClient) {
    alerts.push({
      id: "missing-client",
      severity: "warning",
      title: `${missingClient} facture(s) sans client_id`,
      description: "Verifier le mapping clients.",
    });
  }

  const missingTerritory = invoices.filter((i) => !i.territory_code && !i.ile).length;
  if (missingTerritory) {
    alerts.push({
      id: "missing-territory",
      severity: "warning",
      title: `${missingTerritory} facture(s) sans territoire`,
      description: "Completer territory_code / ile.",
    });
  }

  const estimatedProducts = invoices.filter((i) => i.products_estimated).length;
  if (estimatedProducts) {
    alerts.push({
      id: "products-estimated",
      severity: "info",
      title: `${estimatedProducts} facture(s) avec products_ht estime`,
      description: "Calcul = invoice_ht - transit_fee.",
    });
  }

  const transitHeavy = invoices.filter((i) => {
    const invoiceHt = num(i.invoice_ht_eur);
    const transit = num(i.transit_fee_eur);
    return invoiceHt > 0 && transit / invoiceHt > TRANSIT_ALERT_PCT;
  }).length;
  if (transitHeavy) {
    alerts.push({
      id: "transit-high",
      severity: "critical",
      title: `Transit fee > ${Math.round(TRANSIT_ALERT_PCT * 100)}% sur ${transitHeavy} facture(s)`,
      description: "Verifier la ventilation prix / transit.",
    });
  }

  const missingTransport = invoices.filter((i) => !i.transport_cost_eur).length;
  if (missingTransport) {
    alerts.push({
      id: "missing-transport",
      severity: "info",
      title: `${missingTransport} facture(s) sans cout transport renseigne`,
      description: "Transport reste informatif mais utile pour le drilldown.",
    });
  }

  if (invoicesRes.warning) {
    alerts.push({
      id: "invoice-warning",
      severity: "info",
      title: invoicesRes.warning,
    });
  }

  return alerts;
}

function isMissingColumnError(error: any): boolean {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

export async function fetchSalesLines(filters: ExportFilters = {}, pagination: Pagination = {}): Promise<FetchResult<SaleLine>> {
  if (!SUPABASE_ENV_OK) return { data: [], total: 0, warning: "Supabase non configure" };

  const query = supabase.from("sales").select("id,sale_date,client_id,product_id,territory_code,destination_id,quantity,unit_price_ht,amount_ht,vat_amount,amount_ttc,invoice_number", { count: "exact" });

  if (filters.from) query.gte("sale_date", filters.from);
  if (filters.to) query.lte("sale_date", filters.to);
  if (filters.territory) query.ilike("territory_code", `%${filters.territory}%`);
  if (filters.clientId) query.ilike("client_id", `%${filters.clientId}%`);
  if (filters.invoiceNumber) query.ilike("invoice_number", `%${filters.invoiceNumber}%`);

  query.order("sale_date", { ascending: false });
  const size = pagination.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, pagination.page ?? 1);
  const fromIdx = (page - 1) * size;
  const toIdx = fromIdx + size - 1;
  query.range(fromIdx, toIdx);

  const { data, error, count } = await query;
  if (error) {
    if (isMissingTableError(error)) return { data: [], total: 0, warning: "Table sales manquante" };
    throw error;
  }

  const mapped: SaleLine[] = (data || []).map((row: any) => ({
    id: row.id,
    sale_date: row.sale_date ?? null,
    client_id: row.client_id ?? null,
    product_id: row.product_id ?? null,
    territory_code: row.territory_code ?? null,
    destination_id: row.destination_id ?? null,
    quantity: row.quantity ?? null,
    unit_price_ht: row.unit_price_ht ?? null,
    amount_ht: row.amount_ht ?? null,
    vat_amount: row.vat_amount ?? null,
    amount_ttc: row.amount_ttc ?? null,
  }));

  return { data: mapped, total: count ?? mapped.length };
}

export async function fetchInvoiceLines(invoiceNumber: string): Promise<FetchResult<InvoiceLine>> {
  if (!SUPABASE_ENV_OK) return { data: [], total: 0, warning: "Supabase non configure" };

  const possibleFilters = ["invoice_number", "invoice_no", "order_id"];
  for (const column of possibleFilters) {
    const query = supabase.from("sales").select("id,invoice_number,product_id,quantity,unit_price_ht,amount_ht,total_ht,weight_kg,territory_code,product_label", { count: "exact" }).eq(column, invoiceNumber).limit(500);
    const { data, error, count } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        return { data: [], total: 0, warning: "Table sales manquante" };
      }
      if (isMissingColumnError(error)) {
        continue;
      }
      throw error;
    }

    if (data && data.length) {
      const mapped: InvoiceLine[] = data.map((row: any) => ({
        id: row.id,
        invoice_number: row.invoice_number ?? invoiceNumber,
        product_id: row.product_id ?? null,
        product_label: row.product_label ?? null,
        quantity: row.quantity ?? null,
        unit_price_ht: row.unit_price_ht ?? null,
        total_ht: row.amount_ht ?? row.total_ht ?? null,
        weight_kg: row.weight_kg ?? null,
        territory_code: row.territory_code ?? null,
      }));
      return { data: mapped, total: count ?? mapped.length, source: "sales" };
    }
  }

  return { data: [], total: 0, warning: "Aucune ligne trouvee pour cette facture" };
}

export async function fetchCompetitorPrices(
  territory: string | null | undefined,
  skus: string[],
): Promise<FetchResult<CompetitorPrice>> {
  if (!SUPABASE_ENV_OK) return { data: [], total: 0, warning: "Supabase non configure" };
  if (!skus.length) return { data: [], total: 0 };

  const trimmedSkus = Array.from(new Set(skus.filter(Boolean)));

  const { data, error } = await supabase
    .from("v_export_pricing")
    .select("sku,label,territory_code,thuasne_price_ttc,donjoy_price_ttc,gibaud_price_ttc,competitor_price")
    .in("sku", trimmedSkus)
    .limit(2000);

  if (error) {
    if (isMissingTableError(error)) return { data: [], total: 0, warning: "v_export_pricing manquante pour la concurrence" };
    throw error;
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];

  const mapped: CompetitorPrice[] = [];
  rows
    .filter((r) => !territory || !r?.territory_code || String(r.territory_code).toUpperCase() === String(territory).toUpperCase())
    .forEach((r: any) => {
      const base: CompetitorPrice = {
        source: "v_export_pricing",
        sku: r.sku,
        label: r.label ?? null,
        territory_code: r.territory_code ?? territory ?? null,
      };

      const competitors: Array<{ competitor: string; price: number | null }> = [
        { competitor: "Thuasne", price: num(r.thuasne_price_ttc, NaN) },
        { competitor: "Donjoy", price: num(r.donjoy_price_ttc, NaN) },
        { competitor: "Gibaud", price: num(r.gibaud_price_ttc, NaN) },
        { competitor: "Autre", price: num(r.competitor_price, NaN) },
      ];

      competitors
        .filter((c) => Number.isFinite(c.price))
        .forEach((c) => mapped.push({ ...base, price: c.price as number, competitor: c.competitor }));
    });

  return { data: mapped, total: mapped.length, source: "v_export_pricing" };
}
