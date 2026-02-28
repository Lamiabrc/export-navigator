export type CountrySuggestion = {
  iso2: string;
  label: string;
  zone?: string | null;
  confidence?: number | null;
};

export type CountryFunnelResult = {
  suggestions: CountrySuggestion[];
  needsClarification: boolean;
  raw: unknown;
};

export type CountryFunnelAnalysisSuggestion = CountrySuggestion & {
  code_iso2: string;
};

export type CountryFunnelAnalysisResult = {
  status: string;
  suggestions: CountryFunnelAnalysisSuggestion[];
  question: string | null;
  raw: unknown;
};

export type HsSuggestion = {
  hs_code: string;
  label: string;
  chapter?: string | null;
  confidence?: number | null;
};

export type HsFunnelResult = {
  suggestions: HsSuggestion[];
  needsClarification: boolean;
  raw: unknown;
};

export type ExportAnswerResult = {
  destination?: {
    iso2?: string;
    name?: string;
    zone?: string | null;
  };
  country_rules?: Record<string, unknown>;
  product_rules?: Array<Record<string, unknown>>;
  update_sources?: Array<{ label?: string; url?: string; source_key?: string }>;
  raw: unknown;
};

export type TradePartnerLine = {
  hs6?: string;
  hs_code?: string;
  value?: number;
  value_usd?: number;
  label?: string;
};

export type TradeBilateralResult = {
  total?: number;
  total_value_usd?: number;
  currency?: string;
  flow?: string;
  year?: number;
  reporter?: string;
  partner?: string;
  topHs6: TradePartnerLine[];
  top_hs6?: TradePartnerLine[];
  raw: unknown;
};

export type ScreeningHit = {
  name: string;
  entity_type?: string | null;
  source_key?: string | null;
  source_url?: string | null;
  score?: number | null;
};

export type ScreeningResult = {
  hits: ScreeningHit[];
  raw: unknown;
};
