export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  lppCode?: string;
  cost?: number;
};

export type Brand = "ORLIMAN" | "THUASNE" | "DONJOY_ENOVIS" | "GIBAUD";

export type PricePoint = {
  id: string;
  productId: string;
  brand: Brand;
  market: string;
  channel: string;
  currency: string;
  price: number;
  priceType: "HT" | "TTC";
  date: string;
  sourceLabel: string;
  confidence: number;
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
  bestCompetitor?: { brand: Brand; price: number };
  avgCompetitorPrice?: number;
  gapBestPct?: number;
  gapAvgPct?: number;
  positioning: Positioning;
  recommendation: string;
  recommendationHint: string;
  confidenceCoverage: number;
};
