export type Competitor = {
  id: string;
  name: string;
  brand_code: "ORLIMAN" | "THUASNE" | "DONJOY_ENOVIS" | "GIBAUD" | "AUTRE";
  notes?: string;
};

export type Product = {
  product_id: string;
  sku: string;
  product_name: string;
  category: string;
  height_cm?: number;
  unit?: string;
  notes?: string;
  // Compat legacy
  id?: string;
  name?: string;
};

export type PricePoint = {
  price_id: string;
  product_id: string;
  brand: "ORLIMAN" | "THUASNE" | "DONJOY_ENOVIS" | "GIBAUD";
  market: string;
  channel: string;
  currency: string;
  price: number;
  price_type: "HT" | "TTC";
  date: string; // YYYY-MM-DD
  confidence: number; // 0..100
  source_label: string;
  lppr_reimbursement_ttc?: number;
  vat_rate?: number;
  // Compat legacy
  id?: string;
  productId?: string;
};

export type PricingConfig = {
  premiumThreshold: number;
  alignLow: number;
  alignHigh: number;
  minConfidence: number;
};

export type Positioning = "premium" | "aligned" | "underpriced" | "no_data";

export type PositionRow = {
  product: Product;
  market: string;
  channel: string;
  orlimanPrice?: number;
  bestCompetitor?: { brand: PricePoint["brand"]; price: number };
  avgCompetitorPrice?: number;
  gapBestPct?: number;
  gapAvgPct?: number;
  positioning: Positioning;
  recommendation: string;
  recommendationHint: string;
  confidenceCoverage: number;
};
