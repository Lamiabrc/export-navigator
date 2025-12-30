export type Nullable<T> = T | null | undefined;

export type BreakdownFilters = {
  startDate?: string;
  endDate?: string;
  zone?: string;
  destination?: string;
  incoterm?: string;
  clientId?: string;
  productId?: string;
};

export type SalesLine = {
  id: string;
  date: Nullable<string>;
  client_id: Nullable<string>;
  product_id: Nullable<string>;
  qty: Nullable<number>;
  unit_price_ht?: Nullable<number>;
  net_sales_ht: Nullable<number>;
  currency: Nullable<string>;
  market_zone: Nullable<string>;
  incoterm: Nullable<string>;
  destination?: Nullable<string>;
};

export type CostLine = {
  id: string;
  date: Nullable<string>;
  cost_type: Nullable<string>;
  amount: Nullable<number>;
  currency: Nullable<string>;
  market_zone: Nullable<string>;
  incoterm: Nullable<string>;
  client_id: Nullable<string>;
  product_id?: Nullable<string>;
  destination?: Nullable<string>;
};

export type VatRateRow = {
  id?: string;
  territory_code: Nullable<string>;
  rate_percent: Nullable<number>;
  start_date?: Nullable<string>;
  end_date?: Nullable<string>;
};

export type OmRateRow = {
  id?: string;
  territory_code: Nullable<string>;
  hs_code: Nullable<string>;
  om_rate: Nullable<number>;
  omr_rate: Nullable<number>;
  start_date?: Nullable<string>;
  end_date?: Nullable<string>;
};

export type BreakdownMetric = {
  caHt: number;
  qty: number;
  costs: number;
  vat: number;
  om: number;
  margin: number;
};

export type ExportBreakdown = {
  totals: BreakdownMetric & { avgPrice: number; marginRate: number };
  byZone: Record<string, BreakdownMetric>;
  byDestination: Record<string, BreakdownMetric>;
  byIncoterm: Record<string, BreakdownMetric>;
  warnings: string[];
};
