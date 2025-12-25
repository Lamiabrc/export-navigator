export type Competitor = {
  id: string;
  name: string;
  group?: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  markets: string[];
  notes?: string;
};

export type PriceObservation = {
  id: string;
  competitorId: string;
  category: string;
  productName?: string;
  market: string;
  currency: string;
  price: number;
  date: string;
  sourceLabel: string;
  sourceUrl?: string;
};

export type LppReference = {
  id: string;
  code: string;
  label: string;
  tariff?: number;
  notes?: string;
  lastUpdated?: string;
};

export type ScenarioInput = {
  market: string;
  channel: string;
  incoterm?: string;
  logisticsCost: number;
  productCost: number;
  targetPrice?: number;
  strategy: "premium" | "match" | "penetration";
};

export type ScenarioResult = {
  recommendedPrice: number;
  margin: number;
  riskLevel: "low" | "medium" | "high";
  rationale: string[];
};

export type DecisionBrief = {
  id: string;
  title: string;
  context: string;
  assumptions: string[];
  options: string[];
  recommendation: string;
  risks: string[];
  nextActions: string[];
};
