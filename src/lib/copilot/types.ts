export type Lang = "fr" | "en";

export type TradeFlow = "import" | "export" | "unknown";

export type GoodsKind = "goods" | "services" | "unknown";

export type DecisionStatus = "GO" | "NO_GO" | "SOUS_CONDITIONS";

export type CheckStatus = "OK" | "A_CONFIRMER" | "MANQUANT" | "KO";

export type SourceLink = {
  title: string;
  url: string;
};

export type CopilotCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  explanation: string;
  what_to_fix: string;
  example_mention?: string;
  fieldPath?: string;
  source_link?: string;
};

export type ResolvedContext = {
  flow: TradeFlow;
  goodsOrServices: GoodsKind;
  origin: string | null;
  destination: string | null;
  product: string | null;
  hs6: string | null;
  incoterm: string | null;
  value: number | null;
  currency: string | null;
  transport: string | null;
  usage: string | null;
  buyer: string | null;
  seller: string | null;
  buyerIsTaxable: boolean | null;
  buyerVat: string | null;
};

export type ProductAliasRecord = {
  term: string;
  hs_chapters: string[];
  examples: string[];
};

export type HsCandidate = {
  hs6: string;
  label: string;
  confidence: number;
  reason: string;
};

export type ClassificationResult = {
  primary: HsCandidate | null;
  alternatives: HsCandidate[];
  chips: string[];
  confidence: number;
  requiresRtcBti: boolean;
};

export type PolicyRule = {
  topic: string;
  rule_text: string;
  docs: Array<{ name: string; required: boolean; source_url: string | null }>;
  sources: SourceLink[];
};

export type SanctionsMatch = {
  entity_name: string;
  source_name: string | null;
  program: string | null;
};

export type PolicyContext = {
  aliases: ProductAliasRecord[];
  hsRules: PolicyRule[];
  countryRules: PolicyRule[];
  sanctionsMatches: SanctionsMatch[];
  officialLinks: SourceLink[];
  retrievalAt: string;
};

export type ControlsResult = {
  checks: CopilotCheck[];
  risks: string[];
  actions: string[];
  sanctions: string[];
  sourceLinks: SourceLink[];
  dualUseQuestions: string[];
  hardStop: boolean;
};
