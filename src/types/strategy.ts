// Types pour les données de stratégie mock

export interface Competitor {
  id: string;
  name: string;
  group?: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  markets: string[];
  notes?: string;
}

export interface PriceObservation {
  id: string;
  competitorId: string;
  category: string;
  productName: string;
  market: string;
  currency: string;
  price: number;
  date: string;
  sourceLabel: string;
}

export interface LppReference {
  id: string;
  code: string;
  label: string;
  notes?: string;
}

export interface DecisionBrief {
  id: string;
  title: string;
  context: string;
  assumptions: string[];
  options: string[];
  recommendation: string;
  risks: string[];
  nextActions: string[];
}

export interface StrategyData {
  id: string;
  name: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "active" | "pending" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface StrategyMetric {
  label: string;
  value: number;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
}

export interface StrategyInsight {
  id: string;
  title: string;
  description: string;
  category: string;
  actionable: boolean;
}
