export type ExportFilters = {
  from?: string;
  to?: string;
  territory?: string;
  clientId?: string;
  invoiceNumber?: string;
  search?: string;
};

export type Pagination = {
  page?: number;
  pageSize?: number;
};

export type ExportCostComponents = {
  vat: number;
  om: number;
  octroi: number;
  extraRules: number;
  total: number;
  sources: string[];
  estimated: boolean;
};

export type Invoice = {
  id?: string;
  invoice_number: string;
  invoice_date?: string | null;
  client_id?: string | null;
  client_label?: string | null;
  client_name?: string | null;
  territory_code?: string | null;
  ile?: string | null;
  nb_colis?: number | null;
  currency?: string | null;
  invoice_ht_eur: number;
  products_ht_eur: number;
  products_estimated: boolean;
  transit_fee_eur: number;
  transport_cost_eur: number;
  estimated_export_costs: ExportCostComponents;
  marge_estimee: number;
  status?: string | null;
  source: string;
  warning?: string;
};

export type InvoiceLine = {
  id?: string;
  invoice_number?: string | null;
  sale_id?: string | null;
  product_id?: string | null;
  product_label?: string | null;
  quantity?: number | null;
  unit_price_ht?: number | null;
  total_ht?: number | null;
  weight_kg?: number | null;
  territory_code?: string | null;
};

export type SaleLine = {
  id: string;
  sale_date: string | null;
  client_id: string | null;
  product_id: string | null;
  territory_code: string | null;
  destination_id?: string | null;
  quantity?: number | null;
  unit_price_ht?: number | null;
  amount_ht?: number | null;
  vat_amount?: number | null;
  amount_ttc?: number | null;
};

export type KPIResult = {
  caHt: number;
  totalProducts: number;
  totalTransit: number;
  totalTransport: number;
  estimatedExportCosts: ExportCostComponents;
  estimatedMargin: number;
  invoiceCount: number;
  parcelCount: number;
  source: string;
  warning?: string;
};

export type Alert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description?: string;
};

export type TopClient = {
  client_id: string | null;
  client_name?: string | null;
  client_label?: string | null;
  ca_ht: number;
  products_ht: number;
  margin_estimee: number;
  territory_code?: string | null;
};

export type CompetitorPrice = {
  source: string;
  sku: string;
  label?: string | null;
  territory_code?: string | null;
  price?: number | null;
  competitor?: string | null;
};

export type InvoiceDetail = Invoice & {
  lines?: InvoiceLine[];
  linesWarning?: string;
  competitors?: CompetitorPrice[];
  competitorWarning?: string;
};

export type FetchResult<T> = {
  data: T[];
  total?: number;
  warning?: string;
  source?: string;
};

export type RatesContext = {
  vatRates: any[];
  omRates: any[];
  octroiRates: any[];
  taxRules: any[];
};
