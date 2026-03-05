import { randomUUID } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";
import type {
  CheckStatus,
  ControlsResult,
  ClassificationResult,
  CopilotCheck,
  DecisionStatus,
  Lang,
  PolicyContext,
  ResolvedContext,
  SourceLink,
} from "../src/lib/copilot/types.js";

type ChatRequest = {
  message?: string;
  thread_id?: string | null;
  lang?: string | null;
  overrides?: Record<string, unknown> | null;
};

type DetectedEntities = {
  origin: string | null;
  destination: string | null;
  hs6: string | null;
  incoterm: string | null;
  payment: string | null;
  transport: string | null;
  currency: string | null;
  contract_type: string | null;
};

const PAYMENT_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "LC", pattern: /\b(lc|l\/c|letter of credit|credit documentaire|credoc)\b/i },
  { code: "CAD", pattern: /\b(cad|documents against payment|remise documentaire)\b/i },
  { code: "OA", pattern: /\b(oa|open account|compte ouvert)\b/i },
  { code: "TT", pattern: /\b(tt|t\/t|wire transfer|virement)\b/i },
];

const CONTRACT_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "sales", pattern: /\b(vente internationale|contrat de vente|sales contract|sale of goods)\b/i },
  { code: "distribution", pattern: /\b(distribution|distributor)\b/i },
  { code: "agency", pattern: /\b(agent commercial|agency|commercial agent)\b/i },
  { code: "franchise", pattern: /\b(franchise)\b/i },
  { code: "licensing", pattern: /\b(licence|license|licensing)\b/i },
  { code: "oem", pattern: /\b(oem|sous[- ]traitance|subcontract|manufacturing agreement)\b/i },
];

const CheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["OK", "A_CONFIRMER", "MANQUANT", "KO"]),
  explanation: z.string(),
  what_to_fix: z.string(),
  example_mention: z.string().optional(),
  fieldPath: z.string().optional(),
  source_link: z.string().optional(),
});

const ChatResponseSchema = z.object({
  ok: z.literal(true),
  lang: z.enum(["fr", "en"]),
  decision: z.object({
    status: z.enum(["GO", "NO_GO", "SOUS_CONDITIONS"]),
    reason: z.string(),
  }),
  entities: z.object({
    origin: z.string().nullable(),
    destination: z.string().nullable(),
    hs6: z.string().nullable(),
    incoterm: z.string().nullable(),
    payment: z.string().nullable(),
    transport: z.string().nullable(),
    currency: z.string().nullable(),
    contract_type: z.string().nullable(),
  }),
  missing_questions: z.array(z.string()),
  dossier: z.object({
    summary: z.string(),
    documents: z.array(
      z.object({
        name: z.string(),
        required: z.boolean(),
        source_url: z.string().nullable(),
      })
    ),
    restrictions: z.array(z.string()),
    sanctions: z.array(z.string()),
    taxes: z.array(z.string()),
    logistics: z.array(z.string()),
    contract: z.object({
      clauses: z.array(z.string()),
    }),
    next_actions: z.array(z.string()),
  }),
  checks: z.array(CheckSchema),
  main_blocker: CheckSchema.nullable(),
  answer_markdown: z.string(),
  source_links: z.array(z.object({ title: z.string(), url: z.string() })),
  follow_up_questions: z.array(z.string()),
});

const CHECK_SEVERITY: Record<CheckStatus, number> = {
  KO: 4,
  MANQUANT: 3,
  A_CONFIRMER: 2,
  OK: 1,
};

type ResolveEntitiesFn = (params: {
  message: string;
  overrides?: Record<string, unknown> | null;
  lang: Lang;
}) => {
  context: ResolvedContext;
  detectedCountries: string[];
  normalizedMessage: string;
};

type BuildMissingQuestionsFn = (context: ResolvedContext, lang: Lang) => string[];
type ClassifyProductFn = (params: { context: ResolvedContext; aliases: PolicyContext["aliases"] }) => ClassificationResult;
type EvaluateControlsFn = (params: {
  context: ResolvedContext;
  classification: ClassificationResult;
  policy: PolicyContext;
}) => ControlsResult;
type DetectGlobalTradeIntentFn = (params: { question?: string | null; product?: string | null }) => boolean;
type RetrievePolicyContextFn = (params: { admin: SupabaseClient; context: ResolvedContext }) => Promise<PolicyContext>;

type CopilotRuntime = {
  resolveEntities: ResolveEntitiesFn;
  buildMissingQuestions: BuildMissingQuestionsFn;
  classifyProduct: ClassifyProductFn;
  evaluateControls: EvaluateControlsFn;
  detectGlobalTradeIntent: DetectGlobalTradeIntentFn;
  retrievePolicyContext: RetrievePolicyContextFn;
};

const FALLBACK_COUNTRY_ALIASES: Record<string, string> = {
  fr: "FR",
  france: "FR",
  uk: "GB",
  gb: "GB",
  "united kingdom": "GB",
  "royaume uni": "GB",
  angleterre: "GB",
  us: "US",
  usa: "US",
  "etats unis": "US",
  "united states": "US",
  canada: "CA",
  bresil: "BR",
  brazil: "BR",
  espagne: "ES",
  spain: "ES",
  italie: "IT",
  italy: "IT",
  allemagne: "DE",
  germany: "DE",
  chine: "CN",
  china: "CN",
  japon: "JP",
  japan: "JP",
  maroc: "MA",
  algerie: "DZ",
  tunisie: "TN",
  emirats: "AE",
  uae: "AE",
  "emirats arabes unis": "AE",
  arabie: "SA",
  russie: "RU",
  russia: "RU",
};

const FALLBACK_INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"] as const;
const FALLBACK_SANCTIONS_HARD_STOP = new Set(["RU", "IR", "KP", "SY"]);
const FALLBACK_SANCTIONS_WARN = new Set(["BY", "CU"]);
const DEFAULT_HOME_COUNTRY = "FR";

function normalizeFallback(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readOverrideText(overrides: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = String(overrides[key] ?? "").trim();
    if (raw) return raw;
  }
  return null;
}

function parseFallbackBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = normalizeFallback(String(value ?? ""));
  if (!normalized) return null;
  if (["true", "1", "yes", "oui", "pro", "taxable", "assujetti"].includes(normalized)) return true;
  if (["false", "0", "no", "non", "not taxable", "non assujetti"].includes(normalized)) return false;
  return null;
}

function resolveFallbackCountry(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) return iso;
  return FALLBACK_COUNTRY_ALIASES[normalizeFallback(raw)] || null;
}

function detectFallbackCountries(message: string): string[] {
  const normalized = normalizeFallback(message);
  if (!normalized) return [];
  const found: string[] = [];
  const pushIfNew = (iso: string | null) => {
    if (!iso || found.includes(iso)) return;
    found.push(iso);
  };

  const directional = message.match(
    /(?:from|depuis)\s+([a-zA-Z\u00C0-\u017F'\-\s]{2,50})\s+(?:to|vers)\s+([a-zA-Z\u00C0-\u017F'\-\s]{2,50})/i
  );
  if (directional) {
    pushIfNew(resolveFallbackCountry(directional[1]));
    pushIfNew(resolveFallbackCountry(directional[2]));
  }

  const toOnly = message.match(/(?:to|vers)\s+([a-zA-Z\u00C0-\u017F'\-\s]{2,50})/i);
  if (toOnly) pushIfNew(resolveFallbackCountry(toOnly[1]));

  for (const [alias, iso] of Object.entries(FALLBACK_COUNTRY_ALIASES)) {
    if (normalized.includes(alias)) pushIfNew(iso);
    if (found.length >= 3) break;
  }

  return found.slice(0, 3);
}

function fallbackResolveEntities(params: { message: string; overrides?: Record<string, unknown> | null }): {
  context: ResolvedContext;
  detectedCountries: string[];
  normalizedMessage: string;
} {
  const message = String(params.message || "").trim();
  const overrides = asObject(params.overrides);

  const detectedCountries = detectFallbackCountries(message);
  const originOverride = resolveFallbackCountry(readOverrideText(overrides, ["origin", "from", "seller_country", "sellerCountry"]));
  const destinationOverride = resolveFallbackCountry(
    readOverrideText(overrides, ["destination", "to", "buyer_country", "buyerCountry", "country"])
  );

  const flowOverride = normalizeFallback(String(overrides.flow ?? overrides.direction ?? ""));
  const goodsOverride = normalizeFallback(String(overrides.goods_or_services ?? overrides.goodsOrServices ?? overrides.kind ?? ""));
  const hsExplicit = String(overrides.hs6 ?? overrides.hs ?? overrides.hs_code ?? "").replace(/[^0-9]/g, "").slice(0, 6);
  const hsFromMessage = message.match(/\b([0-9]{6,10})\b/)?.[1]?.slice(0, 6) || null;
  const incotermExplicit = String(overrides.incoterm ?? "").trim().toUpperCase();
  const incotermFromMessage =
    FALLBACK_INCOTERMS.find((incoterm) => new RegExp(`\\b${incoterm}\\b`, "i").test(message)) || null;

  const product =
    readOverrideText(overrides, ["product", "product_text", "goods", "description", "item"]) ||
    message.match(/(?:j[\s']*exporte|j[\s']*importe|nous exportons|nous importons)\s+(?:des|de|du|d')\s+([^\n.;,]{2,120})/i)?.[1]?.trim() ||
    message.match(/(?:produit|product|marchandise)\s*[:=-]\s*([^\n.;,]{2,120})/i)?.[1]?.trim() ||
    null;

  const currencyExplicit = String(overrides.currency ?? "").trim().toUpperCase();
  const currencyFromMessage = message.match(/\b(EUR|USD|GBP|CHF|CNY|JPY|MAD|CAD)\b/i)?.[1]?.toUpperCase() || null;
  const transportExplicit = normalizeFallback(String(overrides.transport ?? overrides.transport_mode ?? ""));
  const transportFromMessage = /\b(sea|maritime|mer)\b/i.test(message)
    ? "sea"
    : /\b(air|aerien|avion)\b/i.test(message)
      ? "air"
      : /\b(road|route|camion|truck)\b/i.test(message)
        ? "road"
        : /\b(rail|train|ferroviaire)\b/i.test(message)
          ? "rail"
          : null;

  const explicitValue = String(overrides.value ?? overrides.amount ?? "").trim();
  const parsedExplicitValue = explicitValue ? Number(explicitValue.replace(/,/g, ".").replace(/[^0-9.]/g, "")) : NaN;
  const parsedMessageValue = Number(
    String(message.match(/\b([0-9]{1,3}(?:[\s.,][0-9]{3})*(?:[.,][0-9]{1,2})?)\s*(?:eur|usd|gbp|chf|mad|cad|cny|jpy)?\b/i)?.[1] || "")
      .replace(/\s/g, "")
      .replace(/,/g, ".")
  );

  let origin = originOverride || null;
  let destination = destinationOverride || null;

  const hasImport = /\b(import|importation|importer|importe)\b/i.test(message);
  const hasExport = /\b(export|exportation|exporter|exporte)\b/i.test(message);
  const flow =
    flowOverride === "import"
      ? "import"
      : flowOverride === "export"
        ? "export"
        : hasImport && !hasExport
          ? "import"
          : hasExport && !hasImport
            ? "export"
            : origin === "FR" && destination && destination !== "FR"
              ? "export"
              : destination === "FR" && origin && origin !== "FR"
                ? "import"
                : "unknown";

  if (!origin && !destination && detectedCountries.length === 1) {
    if (flow === "import") {
      origin = detectedCountries[0];
    } else {
      destination = detectedCountries[0];
    }
  } else {
    if (!origin && flow === "import" && detectedCountries.length >= 1) {
      origin = detectedCountries[0];
    }
    if (!destination && flow !== "import" && detectedCountries.length >= 1) {
      destination = detectedCountries[0];
    }
    if (!origin && detectedCountries.length >= 2) {
      origin = detectedCountries[0];
    }
    if (!destination && detectedCountries.length >= 2) {
      destination = detectedCountries[1];
    }
  }

  if (!origin && destination && flow === "export") {
    origin = DEFAULT_HOME_COUNTRY;
  }
  if (!destination && origin && flow === "import") {
    destination = DEFAULT_HOME_COUNTRY;
  }
  if (origin && destination && origin === destination && detectedCountries.length === 1) {
    if (flow === "export") {
      origin = DEFAULT_HOME_COUNTRY;
    } else if (flow === "import") {
      destination = DEFAULT_HOME_COUNTRY;
    }
  }

  const goodsOrServices =
    ["goods", "biens", "marchandise", "marchandises"].includes(goodsOverride)
      ? "goods"
      : ["services", "service"].includes(goodsOverride)
        ? "services"
        : /\b(service|services|prestation|saas|consulting)\b/i.test(message)
          ? "services"
          : /\b(produit|marchandise|shipment|cargo)\b/i.test(message)
            ? "goods"
            : flow === "export" || flow === "import"
              ? "goods"
              : "unknown";

  const context: ResolvedContext = {
    flow,
    goodsOrServices,
    origin,
    destination,
    product: product ? product.slice(0, 180) : null,
    hs6: hsExplicit.length === 6 ? hsExplicit : hsFromMessage,
    incoterm: FALLBACK_INCOTERMS.includes(incotermExplicit as (typeof FALLBACK_INCOTERMS)[number]) ? incotermExplicit : incotermFromMessage,
    value: Number.isFinite(parsedExplicitValue) && parsedExplicitValue > 0
      ? parsedExplicitValue
      : Number.isFinite(parsedMessageValue) && parsedMessageValue > 0
        ? parsedMessageValue
        : null,
    currency: /^[A-Z]{3}$/.test(currencyExplicit) ? currencyExplicit : currencyFromMessage,
    transport: transportExplicit || transportFromMessage,
    usage: readOverrideText(overrides, ["usage", "end_use", "use_case"]),
    buyer: readOverrideText(overrides, ["buyer", "buyer_name", "counterparty", "buyerName"]),
    seller: readOverrideText(overrides, ["seller", "seller_name", "shipper", "sellerName"]),
    buyerIsTaxable: parseFallbackBoolean(overrides.buyer_is_taxable ?? overrides.buyerIsTaxable),
    buyerVat: readOverrideText(overrides, ["buyer_vat", "buyerVat", "vat", "vat_number"]),
  };

  return {
    context,
    detectedCountries,
    normalizedMessage: normalizeFallback(message),
  };
}

function fallbackBuildMissingQuestions(context: ResolvedContext, lang: Lang): string[] {
  const destinationQuestion =
    lang === "en"
      ? "What is the destination country (ISO2 or country name)?"
      : "Quel est le pays de destination (ISO2 ou nom) ?";
  const originQuestion = lang === "en" ? "What is the origin country?" : "Quel est le pays d'origine ?";
  const productQuestion =
    lang === "en"
      ? "What is the product (commercial name + composition/use), and HS if known?"
      : "Quel est le produit (nom commercial + composition/usage), et le code HS si connu ?";
  const incotermQuestion =
    lang === "en"
      ? "Which Incoterm do you plan to use (EXW, FCA, FOB, CIF, DAP, DDP)?"
      : "Quel Incoterm est prevu (EXW, FCA, FOB, CIF, DAP, DDP) ?";
  const flowQuestion = lang === "en" ? "Is this an import or export flow?" : "S'agit-il d'un flux import ou export ?";
  const taxableQuestion =
    lang === "en"
      ? "Is the buyer VAT-taxable (professional taxable entity)?"
      : "L'acheteur est-il assujetti a la TVA (client professionnel) ?";

  const hasProduct = Boolean(context.product || context.hs6);
  const hasDestination = Boolean(context.destination);
  const hasOrigin = Boolean(context.origin);
  const ranked: Array<{ question: string; priority: number }> = [];

  if (hasDestination && !hasProduct) ranked.push({ question: productQuestion, priority: 1 });
  if (!hasDestination && hasProduct) ranked.push({ question: destinationQuestion, priority: 1 });
  if (!hasDestination && !hasProduct) {
    ranked.push({ question: destinationQuestion, priority: 1 });
    ranked.push({ question: productQuestion, priority: 2 });
  }
  if (!context.incoterm) ranked.push({ question: incotermQuestion, priority: 3 });
  if (!hasOrigin && hasDestination) ranked.push({ question: originQuestion, priority: 4 });
  if (context.flow === "unknown") ranked.push({ question: flowQuestion, priority: 5 });
  if (context.buyerIsTaxable === null) ranked.push({ question: taxableQuestion, priority: 6 });

  return ranked
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.question)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function fallbackClassifyProduct(params: { context: ResolvedContext }): ClassificationResult {
  const hs6 = String(params.context.hs6 || "").replace(/[^0-9]/g, "").slice(0, 6);
  if (hs6.length === 6) {
    return {
      primary: {
        hs6,
        label: "HS fourni",
        confidence: 0.99,
        reason: "code HS fourni",
      },
      alternatives: [],
      chips: [],
      confidence: 0.99,
      requiresRtcBti: false,
    };
  }

  const chips = params.context.product
    ? params.context.product
        .split(/[,\s]+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 4)
        .slice(0, 3)
    : ["produit fini", "matiere premiere", "piece technique"];

  return {
    primary: null,
    alternatives: [],
    chips,
    confidence: 0,
    requiresRtcBti: true,
  };
}

function fallbackEvaluateControls(params: {
  context: ResolvedContext;
  classification: ClassificationResult;
}): ControlsResult {
  const checks: CopilotCheck[] = [];
  const risks: string[] = [];
  const actions: string[] = [];
  const sanctions: string[] = [];
  const sourceLinks: SourceLink[] = [];
  let hardStop = false;

  if (!params.context.destination) {
    checks.push({
      id: "sanctions_country",
      label: "Screening pays",
      status: "MANQUANT",
      explanation: "Le pays destination manque, screening sanctions incomplet.",
      what_to_fix: "Renseigner le pays destination.",
      fieldPath: "context.destination",
    });
  } else if (FALLBACK_SANCTIONS_HARD_STOP.has(params.context.destination)) {
    hardStop = true;
    sanctions.push("Pays destination sous sanctions fortes.");
    sourceLinks.push({ title: "EU Sanctions Map", url: "https://www.sanctionsmap.eu/" });
    checks.push({
      id: "sanctions_country",
      label: "Screening pays",
      status: "KO",
      explanation: "Pays destination sous sanctions fortes.",
      what_to_fix: "Stopper la transaction et valider avec la compliance.",
      fieldPath: "context.destination",
      source_link: "https://www.sanctionsmap.eu/",
    });
  } else if (FALLBACK_SANCTIONS_WARN.has(params.context.destination)) {
    sanctions.push("Pays destination avec restrictions sectorielles.");
    sourceLinks.push({ title: "EU Sanctions Map", url: "https://www.sanctionsmap.eu/" });
    checks.push({
      id: "sanctions_country",
      label: "Screening pays",
      status: "A_CONFIRMER",
      explanation: "Pays destination avec restrictions sectorielles.",
      what_to_fix: "Completer le screening parties + paiement + transit.",
      fieldPath: "context.destination",
      source_link: "https://www.sanctionsmap.eu/",
    });
  } else {
    checks.push({
      id: "sanctions_country",
      label: "Screening pays",
      status: "OK",
      explanation: "Pas de blocage pays critique detecte par le fallback.",
      what_to_fix: "Conserver la preuve de screening.",
    });
  }

  if (!params.classification.primary) {
    checks.push({
      id: "hs_classification",
      label: "Classification HS",
      status: "MANQUANT",
      explanation: "Code HS absent.",
      what_to_fix: "Renseigner le produit puis confirmer un HS6.",
      fieldPath: "context.product",
      source_link: "https://trade.ec.europa.eu/access-to-markets/en/home",
    });
  } else {
    checks.push({
      id: "hs_classification",
      label: "Classification HS",
      status: "OK",
      explanation: `HS retenu: ${params.classification.primary.hs6}.`,
      what_to_fix: "Conserver la justification de classification.",
      source_link: "https://trade.ec.europa.eu/access-to-markets/en/home",
    });
  }

  if (!params.context.incoterm) {
    checks.push({
      id: "incoterm_presence",
      label: "Incoterm",
      status: "A_CONFIRMER",
      explanation: "Incoterm absent.",
      what_to_fix: "Ajouter un Incoterm avec lieu.",
      fieldPath: "context.incoterm",
      source_link: "https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/",
    });
  } else {
    checks.push({
      id: "incoterm_presence",
      label: "Incoterm",
      status: "OK",
      explanation: `Incoterm declare: ${params.context.incoterm}.`,
      what_to_fix: "Ajouter le lieu exact.",
      source_link: "https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/",
    });
  }

  if (checks.some((item) => item.status !== "OK")) {
    risks.push("Certains points de conformite restent a confirmer.");
  }
  if (!params.context.destination) {
    risks.push("Sans pays destination, la decision reste provisoire.");
  }
  if (!params.context.product && !params.context.hs6) {
    risks.push("Sans produit/HS, droits et restrictions ne sont pas fiabilises.");
  }

  actions.push(
    "Confirmer pays destination et screening sanctions.",
    "Valider HS6 et documents douane.",
    "Confirmer Incoterm + lieu et mode transport."
  );

  return {
    checks,
    risks: Array.from(new Set(risks)).slice(0, 3),
    actions: Array.from(new Set(actions)).slice(0, 3),
    sanctions: Array.from(new Set(sanctions)).slice(0, 5),
    sourceLinks: Array.from(new Map(sourceLinks.map((item) => [item.url, item])).values()),
    dualUseQuestions: [],
    hardStop,
  };
}

function fallbackDetectGlobalTradeIntent(params: { question?: string | null; product?: string | null }) {
  const text = `${String(params.question || "")} ${String(params.product || "")}`.trim();
  return /\b(mondial|monde|global|world|commodity|bourse|trade flow|rss|who)\b/i.test(text);
}

async function fallbackRetrievePolicyContext(_: { admin: SupabaseClient; context: ResolvedContext }): Promise<PolicyContext> {
  return fallbackPolicyContext();
}

const FALLBACK_RUNTIME: CopilotRuntime = {
  resolveEntities: ({ message, overrides }) => ({
    ...fallbackResolveEntities({ message, overrides }),
    normalizedMessage: normalizeFallback(message),
  }),
  buildMissingQuestions: fallbackBuildMissingQuestions,
  classifyProduct: ({ context }) => fallbackClassifyProduct({ context }),
  evaluateControls: ({ context, classification }) => fallbackEvaluateControls({ context, classification }),
  detectGlobalTradeIntent: fallbackDetectGlobalTradeIntent,
  retrievePolicyContext: fallbackRetrievePolicyContext,
};

let copilotRuntimePromise: Promise<CopilotRuntime> | null = null;

async function getCopilotRuntime(): Promise<CopilotRuntime> {
  if (copilotRuntimePromise) return copilotRuntimePromise;

  copilotRuntimePromise = (async () => {
    try {
      const [entityResolverModule, classifierModule, controlsModule, officialLinksModule, policyModule] = await Promise.all([
        import("../src/lib/copilot/entityResolver.js"),
        import("../src/lib/copilot/classifier.js"),
        import("../src/lib/copilot/controlsEngine.js"),
        import("../src/lib/copilot/officialLinks.js"),
        import("../src/lib/copilot/policyRetriever.js"),
      ]);

      if (
        typeof entityResolverModule.resolveEntities !== "function" ||
        typeof entityResolverModule.buildMissingQuestions !== "function" ||
        typeof classifierModule.classifyProduct !== "function" ||
        typeof controlsModule.evaluateControls !== "function" ||
        typeof officialLinksModule.detectGlobalTradeIntent !== "function" ||
        typeof policyModule.retrievePolicyContext !== "function"
      ) {
        throw new Error("copilot_runtime_incomplete");
      }

      return {
        resolveEntities: entityResolverModule.resolveEntities as ResolveEntitiesFn,
        buildMissingQuestions: entityResolverModule.buildMissingQuestions as BuildMissingQuestionsFn,
        classifyProduct: classifierModule.classifyProduct as ClassifyProductFn,
        evaluateControls: controlsModule.evaluateControls as EvaluateControlsFn,
        detectGlobalTradeIntent: officialLinksModule.detectGlobalTradeIntent as DetectGlobalTradeIntentFn,
        retrievePolicyContext: policyModule.retrievePolicyContext as RetrievePolicyContextFn,
      };
    } catch (err) {
      console.error("[chat] failed to load copilot runtime; using fallback mode", err);
      return FALLBACK_RUNTIME;
    }
  })();

  return copilotRuntimePromise;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeLang(input: unknown): Lang {
  const value = String(input || "").trim().toLowerCase();
  return value === "en" ? "en" : "fr";
}

function inferLangFromMessage(message: string): Lang {
  return /\b(the|what|which|export|import|invoice|incoterm|payment|screening)\b/i.test(message) ? "en" : "fr";
}

function cleanMessage(message: unknown) {
  return String(message || "").trim().slice(0, 8000);
}

function queryParam(req: VercelRequest, key: string) {
  const value = req.query?.[key];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function detectByPatterns(message: string, patterns: Array<{ code: string; pattern: RegExp }>) {
  for (const entry of patterns) {
    if (entry.pattern.test(message)) return entry.code;
  }
  return null;
}

function toEntities(context: ResolvedContext, message: string): DetectedEntities {
  return {
    origin: context.origin,
    destination: context.destination,
    hs6: context.hs6,
    incoterm: context.incoterm,
    payment: detectByPatterns(message, PAYMENT_PATTERNS),
    transport: context.transport,
    currency: context.currency,
    contract_type: detectByPatterns(message, CONTRACT_PATTERNS),
  };
}

function mergeChecks(checks: CopilotCheck[]) {
  const merged = new Map<string, CopilotCheck>();
  for (const check of checks) {
    const previous = merged.get(check.id);
    if (!previous || CHECK_SEVERITY[check.status] > CHECK_SEVERITY[previous.status]) {
      merged.set(check.id, check);
    }
  }
  return Array.from(merged.values());
}

function checkPriority(id: string) {
  const order = [
    "sanctions_country",
    "sanctions_parties",
    "flow_scope",
    "destination_presence",
    "origin_presence",
    "product_presence",
    "hs_classification",
    "dual_use_signal",
    "incoterm_presence",
    "goods_or_services",
  ];
  const index = order.indexOf(id);
  return index === -1 ? order.length + 1 : index;
}

function sortChecks(checks: CopilotCheck[]) {
  return [...checks].sort((a, b) => {
    const deltaSeverity = CHECK_SEVERITY[b.status] - CHECK_SEVERITY[a.status];
    if (deltaSeverity !== 0) return deltaSeverity;
    return checkPriority(a.id) - checkPriority(b.id);
  });
}

function findMainBlocker(checks: CopilotCheck[]) {
  const sorted = sortChecks(checks);
  return sorted.find((check) => check.status === "KO") || sorted.find((check) => check.status === "MANQUANT") || null;
}

function buildBaseChecks(context: ResolvedContext, classification: ClassificationResult, lang: Lang): CopilotCheck[] {
  const checks: CopilotCheck[] = [];

  checks.push({
    id: "flow_scope",
    label: lang === "en" ? "Operation flow" : "Flux operation",
    status: context.flow === "unknown" ? "MANQUANT" : "OK",
    explanation:
      context.flow === "unknown"
        ? lang === "en"
          ? "Import/export direction is missing."
          : "Le sens import/export est manquant."
        : lang === "en"
          ? `Detected flow: ${context.flow}.`
          : `Flux detecte: ${context.flow}.`,
    what_to_fix:
      lang === "en"
        ? "Specify whether this is import or export."
        : "Preciser s'il s'agit d'un import ou d'un export.",
    fieldPath: "context.flow",
  });

  checks.push({
    id: "origin_presence",
    label: lang === "en" ? "Origin country" : "Pays d'origine",
    status: context.origin ? "OK" : "MANQUANT",
    explanation:
      context.origin
        ? lang === "en"
          ? `Origin detected: ${context.origin}.`
          : `Origine detectee: ${context.origin}.`
        : lang === "en"
          ? "Origin country missing."
          : "Pays d'origine manquant.",
    what_to_fix:
      lang === "en"
        ? "Provide origin country (ISO2 or full name)."
        : "Renseigner le pays d'origine (ISO2 ou nom complet).",
    fieldPath: "context.origin",
  });

  checks.push({
    id: "destination_presence",
    label: lang === "en" ? "Destination country" : "Pays de destination",
    status: context.destination ? "OK" : "MANQUANT",
    explanation:
      context.destination
        ? lang === "en"
          ? `Destination detected: ${context.destination}.`
          : `Destination detectee: ${context.destination}.`
        : lang === "en"
          ? "Destination country missing."
          : "Pays de destination manquant.",
    what_to_fix:
      lang === "en"
        ? "Provide destination country (ISO2 or full name)."
        : "Renseigner le pays de destination (ISO2 ou nom complet).",
    fieldPath: "context.destination",
  });

  checks.push({
    id: "goods_or_services",
    label: lang === "en" ? "Goods or services" : "Biens ou services",
    status: context.goodsOrServices === "unknown" ? "A_CONFIRMER" : context.goodsOrServices === "goods" ? "A_CONFIRMER" : "OK",
    explanation:
      context.goodsOrServices === "unknown"
        ? lang === "en"
          ? "Goods/services nature not explicitly stated; goods assumed by default."
          : "Nature biens/services non explicite; biens supposes par defaut."
        : context.goodsOrServices === "goods"
          ? lang === "en"
            ? "Goods inferred from import/export wording."
            : "Biens infere via le wording import/export."
        : lang === "en"
          ? `Detected: ${context.goodsOrServices}.`
          : `Detecte: ${context.goodsOrServices}.`,
    what_to_fix:
      lang === "en"
        ? "Specify goods or services."
        : "Preciser si la transaction porte sur des biens ou des services.",
    fieldPath: "context.goodsOrServices",
  });

  checks.push({
    id: "buyer_taxable",
    label: lang === "en" ? "Buyer VAT status" : "Statut TVA acheteur",
    status: context.buyerIsTaxable === null ? "A_CONFIRMER" : "OK",
    explanation:
      context.buyerIsTaxable === null
        ? lang === "en"
          ? "Buyer taxable status not confirmed."
          : "Le statut assujetti TVA de l'acheteur n'est pas confirme."
        : context.buyerIsTaxable
          ? lang === "en"
            ? "Buyer declared as taxable."
            : "Acheteur declare assujetti."
          : lang === "en"
            ? "Buyer declared as non-taxable."
            : "Acheteur declare non assujetti.",
    what_to_fix:
      lang === "en"
        ? "Confirm taxable status (B2B/B2C impact)."
        : "Confirmer le statut assujetti (impact TVA B2B/B2C).",
    fieldPath: "context.buyerIsTaxable",
  });

  checks.push({
    id: "product_presence",
    label: lang === "en" ? "Product description" : "Description produit",
    status: context.product || context.hs6 ? "OK" : "MANQUANT",
    explanation:
      context.product || context.hs6
        ? lang === "en"
          ? "Product or HS information available."
          : "Produit ou HS disponible."
        : lang === "en"
          ? "Product description missing."
          : "Description produit manquante.",
    what_to_fix:
      lang === "en"
        ? "Add product commercial name and use; HS if known."
        : "Ajouter nom commercial + usage du produit; HS si connu.",
    fieldPath: "context.product",
  });

  if (classification.requiresRtcBti) {
    checks.push({
      id: "rtc_bti_recommendation",
      label: "RTC/BTI",
      status: "A_CONFIRMER",
      explanation:
        lang === "en"
          ? "HS confidence is low; binding tariff information is recommended."
          : "Confiance HS limitee; RTC/BTI recommande.",
      what_to_fix:
        lang === "en"
          ? "Prepare technical specs and request RTC/BTI when tariff exposure is material."
          : "Preparer la fiche technique et demander un RTC/BTI si enjeu tarifaire eleve.",
      fieldPath: "context.product",
      source_link: "https://trade.ec.europa.eu/access-to-markets/en/home",
    });
  }

  return checks;
}

function dedupeSources(links: SourceLink[]) {
  const map = new Map<string, SourceLink>();
  for (const link of links) {
    if (!/^(https?:\/\/|\/)/i.test(link.url)) continue;
    map.set(link.url, link);
  }
  return Array.from(map.values()).slice(0, 12);
}

function fallbackPolicyContext(): PolicyContext {
  return {
    aliases: [
      { term: "banane", hs_chapters: ["08"], examples: ["banane", "banana"] },
      { term: "ferraille", hs_chapters: ["72", "73"], examples: ["ferraille", "steel scrap"] },
      { term: "drone", hs_chapters: ["88", "85"], examples: ["drone", "uav"] },
      { term: "logiciel chiffrement", hs_chapters: ["85", "90"], examples: ["encryption software", "cryptography"] },
      { term: "service logiciel", hs_chapters: ["85"], examples: ["saas", "licence"] },
    ],
    hsRules: [],
    countryRules: [],
    sanctionsMatches: [],
    officialLinks: [],
    retrievalAt: new Date().toISOString(),
  };
}

function buildWatchLinks(params: { isAuthenticated: boolean; lang: Lang }): SourceLink[] {
  if (params.isAuthenticated) {
    return [
      {
        title: params.lang === "en" ? "Open watch center" : "Ouvrir la veille",
        url: "/app/centre-veille/reglementation",
      },
      {
        title: params.lang === "en" ? "Choose a country (list)" : "Choisir un pays (liste)",
        url: "/app/centre-veille/reglementation",
      },
      {
        title: params.lang === "en" ? "Choose a country (map)" : "Choisir un pays (carte)",
        url: "/app/control-tower",
      },
    ];
  }

  return [
    {
      title: params.lang === "en" ? "Open watch page" : "Ouvrir la page veille",
      url: "/veille",
    },
    {
      title: params.lang === "en" ? "Sign up for watch" : "S'inscrire pour la veille",
      url: "/register?next=%2Fapp%2Fcentre-veille%2Freglementation",
    },
    {
      title: params.lang === "en" ? "View pricing" : "Voir les tarifs",
      url: "/pricing#plans",
    },
  ];
}

const EU_ISO2 = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

const OECD_ISO2 = new Set([
  "AU",
  "AT",
  "BE",
  "CA",
  "CL",
  "CO",
  "CR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IL",
  "IT",
  "JP",
  "KR",
  "LV",
  "LT",
  "LU",
  "MX",
  "NL",
  "NZ",
  "NO",
  "PL",
  "PT",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
  "TR",
  "GB",
  "US",
]);

function inferPackTierForCountry(iso2: string | null): "base" | "free_oecd" | "paid_non_oecd" {
  const code = String(iso2 || "").trim().toUpperCase();
  if (!code) return "base";
  if (code === "FR" || EU_ISO2.has(code)) return "base";
  if (OECD_ISO2.has(code)) return "free_oecd";
  return "paid_non_oecd";
}

async function shouldShowCountryPackUpsell(params: {
  adminClient: SupabaseClient | null;
  userId: string | null;
  destination: string | null;
}): Promise<{ show: boolean; iso2: string | null; priceMonthly: number | null }> {
  const iso2 = String(params.destination || "").trim().toUpperCase();
  if (!iso2 || !/^[A-Z]{2}$/.test(iso2)) {
    return { show: false, iso2: null, priceMonthly: null };
  }

  const fallbackTier = inferPackTierForCountry(iso2);
  if (fallbackTier !== "paid_non_oecd") {
    return { show: false, iso2, priceMonthly: null };
  }

  let tier: "base" | "free_oecd" | "paid_non_oecd" = fallbackTier;
  let priceMonthly: number | null = 1900;

  if (params.adminClient) {
    try {
      const { data } = await params.adminClient
        .from("territories")
        .select("pack_tier,pack_price_monthly")
        .eq("iso2", iso2)
        .maybeSingle();

      const candidate = String(data?.pack_tier || "").trim();
      if (candidate === "base" || candidate === "free_oecd" || candidate === "paid_non_oecd") {
        tier = candidate;
      }
      if (typeof data?.pack_price_monthly === "number") {
        priceMonthly = data.pack_price_monthly;
      }
    } catch {
      // keep fallback tier and price
    }
  }

  if (tier !== "paid_non_oecd") {
    return { show: false, iso2, priceMonthly: null };
  }

  if (!params.userId || !params.adminClient) {
    return { show: true, iso2, priceMonthly };
  }

  try {
    const nowIso = new Date().toISOString();
    const { data } = await params.adminClient
      .from("user_entitlements")
      .select("id")
      .eq("user_id", params.userId)
      .eq("country_iso2", iso2)
      .eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return { show: false, iso2, priceMonthly };
    }
  } catch {
    // keep non-blocking behavior; fallback to upsell
  }

  return { show: true, iso2, priceMonthly };
}

function buildPackUpsellAction(params: { lang: Lang; iso2: string | null; priceMonthly: number | null }) {
  const country = params.iso2 || "pays cible";
  if (params.lang === "en") {
    if (typeof params.priceMonthly === "number") {
      return `Unlock country pack (${country}) for detailed rules: ${(params.priceMonthly / 100).toFixed(2)} EUR/month via /pricing#country-packs.`;
    }
    return `Unlock country pack (${country}) for detailed rules via /pricing#country-packs.`;
  }

  if (typeof params.priceMonthly === "number") {
    return `Activer le Pack pays (${country}) pour les details reglementaires: ${(params.priceMonthly / 100).toFixed(2)} EUR/mois via /pricing#country-packs.`;
  }
  return `Activer le Pack pays (${country}) pour les details reglementaires via /pricing#country-packs.`;
}

function decisionFromChecks(params: { checks: CopilotCheck[]; hardStop: boolean; lang: Lang }): { status: DecisionStatus; reason: string } {
  const hasKo = params.checks.some((check) => check.status === "KO");
  const hasMissing = params.checks.some((check) => check.status === "MANQUANT");
  const hasConfirm = params.checks.some((check) => check.status === "A_CONFIRMER");

  if (params.hardStop || hasKo) {
    const blocker = findMainBlocker(params.checks);
    return {
      status: "NO_GO",
      reason:
        blocker?.explanation ||
        (params.lang === "en"
          ? "A blocking compliance risk has been identified."
          : "Un risque de conformite bloquant a ete identifie."),
    };
  }

  if (hasMissing || hasConfirm) {
    const blocker = findMainBlocker(params.checks);
    return {
      status: "SOUS_CONDITIONS",
      reason:
        blocker?.explanation ||
        (params.lang === "en"
          ? "Operation can proceed only after completing critical checks."
          : "Operation possible sous conditions, apres completion des verifications critiques."),
    };
  }

  return {
    status: "GO",
    reason:
      params.lang === "en"
        ? "No blocking signal detected with current data."
        : "Aucun blocage majeur detecte avec les donnees disponibles.",
  };
}

function buildDocuments(context: ResolvedContext, policy: PolicyContext) {
  const docs = new Map<string, { name: string; required: boolean; source_url: string | null }>();

  const add = (name: string, required: boolean, sourceUrl: string | null) => {
    const key = name.toLowerCase();
    if (!docs.has(key)) docs.set(key, { name, required, source_url: sourceUrl });
  };

  if (context.flow === "export") {
    add("Facture commerciale", true, "https://www.douane.gouv.fr");
    add("Packing list", true, "https://www.douane.gouv.fr");
    add("Declaration export", true, "https://www.douane.gouv.fr/service-en-ligne/rita-encyclopedie-tarifaire");
  }

  if (context.flow === "import") {
    add("Facture fournisseur", true, "https://www.douane.gouv.fr");
    add("Declaration en douane import", true, "https://www.douane.gouv.fr/service-en-ligne/rita-encyclopedie-tarifaire");
    add("Justificatif origine", true, "https://trade.ec.europa.eu/access-to-markets/en/home");
  }

  for (const rule of [...policy.hsRules, ...policy.countryRules]) {
    for (const doc of rule.docs) {
      add(doc.name, doc.required, doc.source_url || null);
    }
  }

  return Array.from(docs.values()).slice(0, 10);
}

function buildDossier(params: {
  lang: Lang;
  context: ResolvedContext;
  decision: { status: DecisionStatus; reason: string };
  checks: CopilotCheck[];
  classification: ClassificationResult;
  policy: PolicyContext;
  controls: ControlsResult;
  missingQuestions: string[];
}) {
  const summaryLines = [
    `Decision: ${params.decision.status} - ${params.decision.reason}`,
    `Flux: ${params.context.flow} | Origine: ${params.context.origin || "?"} -> Destination: ${params.context.destination || "?"}`,
    `HS: ${params.context.hs6 || params.classification.primary?.hs6 || "a confirmer"} | Produit: ${params.context.product || "a preciser"}`,
  ];

  const restrictions = sortChecks(params.checks)
    .filter((check) => check.status === "KO" || check.status === "A_CONFIRMER")
    .map((check) => `${check.label}: ${check.explanation}`)
    .slice(0, 8);

  const taxes = [...params.policy.hsRules, ...params.policy.countryRules]
    .filter((rule) => /tax|tva|vat|duty|tarif|douane/i.test(rule.topic + " " + rule.rule_text))
    .map((rule) => rule.rule_text)
    .slice(0, 6);

  const logistics = [
    params.context.incoterm ? `Incoterm: ${params.context.incoterm}` : "Incoterm a confirmer",
    params.context.transport ? `Transport: ${params.context.transport}` : "Transport a confirmer",
    params.context.currency ? `Devise: ${params.context.currency}` : "Devise a confirmer",
  ];

  const contractClauses = [
    "Clause de conformite sanctions/export-control",
    "Clause Incoterm 2020 + transfert des risques",
    "Clause paiement securise et preuve documentaire",
  ];

  const nextActions = Array.from(
    new Set([
      ...params.controls.actions,
      ...(params.missingQuestions[0] ? [params.missingQuestions[0]] : []),
    ])
  ).slice(0, 6);

  return {
    summary: summaryLines.join("\n"),
    documents: buildDocuments(params.context, params.policy),
    restrictions,
    sanctions: params.controls.sanctions.slice(0, 8),
    taxes,
    logistics,
    contract: { clauses: contractClauses },
    next_actions: nextActions,
  };
}

function checklistLineForCheck(status: CheckStatus, label: string) {
  const marker = status === "OK" ? "[OK]" : status === "A_CONFIRMER" ? "[À confirmer]" : status === "MANQUANT" ? "[Manquant]" : "[KO]";
  return `- ${marker} ${label}`;
}

function questionFromFieldPath(fieldPath: string | undefined, lang: Lang): string | null {
  if (!fieldPath) return null;
  const fr = lang !== "en";
  if (fieldPath === "context.flow") {
    return fr
      ? "Confirmez-vous un flux export ou import ?"
      : "Can you confirm whether this is an export or import flow?";
  }
  if (fieldPath === "context.destination") {
    return fr
      ? "Quel est le pays de destination exact (ISO2 ou nom complet) ?"
      : "What is the exact destination country (ISO2 or full name)?";
  }
  if (fieldPath === "context.origin") {
    return fr
      ? "Quel est le pays d'origine exact (ISO2 ou nom complet) ?"
      : "What is the exact origin country (ISO2 or full name)?";
  }
  if (fieldPath === "context.product" || fieldPath === "context.hs6") {
    return fr
      ? "Quel est le produit exact (nom commercial + composition/usage), et le code HS si vous l'avez ?"
      : "What is the exact product (commercial name + composition/use), and HS code if available?";
  }
  if (fieldPath === "context.incoterm") {
    return fr
      ? "Quel Incoterm est prevu (EXW, FCA, FOB, CIF, DAP, DDP...) ?"
      : "Which Incoterm is planned (EXW, FCA, FOB, CIF, DAP, DDP...)?";
  }
  if (fieldPath === "context.buyerIsTaxable") {
    return fr
      ? "Le client est-il assujetti a la TVA (oui/non) ?"
      : "Is the buyer VAT-taxable (yes/no)?";
  }
  return null;
}

function buildAnswerMarkdown(params: {
  lang: Lang;
  decision: { status: DecisionStatus; reason: string };
  checks: CopilotCheck[];
  dossier: ReturnType<typeof buildDossier>;
  missingQuestions: string[];
  sourceLinks: SourceLink[];
  globalTradeIntent: boolean;
  isAuthenticated: boolean;
  packUpsellAction?: string | null;
}) {
  const sorted = sortChecks(params.checks);
  const missingChecks = sorted.filter(
    (check) => check.status === "KO" || check.status === "MANQUANT" || check.status === "A_CONFIRMER"
  );
  const primaryMissing = missingChecks[0] || null;
  const fr = params.lang !== "en";

  const fallbackPriorityQuestion =
    params.missingQuestions[0] ||
    (params.lang === "en"
      ? "What is the destination country?"
      : "Quel est le pays de destination ?");

  const blockerQuestion = questionFromFieldPath(primaryMissing?.fieldPath, params.lang);
  const priorityQuestion = blockerQuestion || fallbackPriorityQuestion;

  const risks = Array.from(
    new Set(
      sorted
        .filter((check) => check.status === "KO" || check.status === "A_CONFIRMER")
        .map((check) => check.explanation)
        .filter(Boolean)
    )
  )
    .slice(0, 3)
    .map((item) => `- ${item}`);

  const actions = Array.from(
    new Set([
      ...params.dossier.next_actions,
      ...(params.packUpsellAction ? [params.packUpsellAction] : []),
    ].filter(Boolean))
  )
    .slice(0, 3)
    .map((item) => `- ${item}`);

  const hasPendingInput = Boolean(primaryMissing || params.missingQuestions.length);

  if (hasPendingInput) {
    return [
      fr
        ? "Merci pour votre message."
        : "Thank you for your message.",
      "",
      fr
        ? "Pour avancer clairement, j'ai besoin d'une seule precision:"
        : "To move forward clearly, I need one detail:",
      priorityQuestion,
      "",
      fr
        ? "Des que vous me repondez, je vous donne la suite precise."
        : "As soon as you reply, I will give you the precise next step.",
    ].join("\n");
  }

  const decisionNatural =
    params.decision.status === "GO"
      ? fr
        ? "favorable (GO provisoire)"
        : "favorable (provisional GO)"
      : params.decision.status === "SOUS_CONDITIONS"
        ? fr
          ? "favorable sous conditions"
          : "favorable with conditions"
        : fr
          ? "non favorable en l'etat (NO GO provisoire)"
          : "not favorable at this stage (provisional NO GO)";

  const summaryLines = String(params.dossier.summary || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const flowContext = summaryLines[1] || "";
  const productContext = summaryLines[2] || "";

  return [
    fr
      ? "Merci, j'ai maintenant les informations essentielles."
      : "Thanks, I now have the essential information.",
    fr ? `Avis provisoire: ${decisionNatural}.` : `Provisional assessment: ${decisionNatural}.`,
    "",
    fr ? "Contexte confirme:" : "Confirmed context:",
    `- ${flowContext || (fr ? "Flux non precise" : "Flow not specified")}`,
    `- ${productContext || (fr ? "Produit/HS non precise" : "Product/HS not specified")}`,
    "",
    fr ? "Points de vigilance:" : "Watch-outs:",
    ...(risks.length
      ? risks
      : [fr ? "- Aucun risque majeur detecte a ce stade." : "- No major risk detected at this stage."]),
    "",
    fr ? "Actions recommandees maintenant:" : "Recommended actions now:",
    ...(actions.length
      ? actions
      : [fr ? "- Poursuivre avec la validation operationnelle et documentaire." : "- Continue with operational and documentary validation."]),
  ].join("\n");
}
function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function resolveUserIdFromToken(token: string | null, adminClient: SupabaseClient | null) {
  if (!token) return null;
  if (!adminClient) return null;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return String(data.user.id);
}

async function ensureThreadId(
  userId: string | null,
  requestedThreadId: string | null,
  message: string,
  adminClient: SupabaseClient | null
) {
  if (!userId) return requestedThreadId || null;
  if (!adminClient) return requestedThreadId || null;

  const requested = String(requestedThreadId || "").trim();
  if (requested) {
    const { data } = await adminClient
      .from("chat_sessions")
      .select("id")
      .eq("id", requested)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  const { data: created } = await adminClient
    .from("chat_sessions")
    .insert({ user_id: userId, title: message.slice(0, 120) })
    .select("id")
    .single();
  return String(created?.id || "") || randomUUID();
}

async function persistExchange(params: {
  adminClient: SupabaseClient | null;
  userId: string | null;
  threadId: string | null;
  message: string;
  answer: string;
  entities: DetectedEntities;
  dossier: ReturnType<typeof buildDossier>;
}) {
  if (!params.userId || !params.threadId || !params.adminClient) return;

  await params.adminClient
    .from("chat_messages")
    .insert([
      {
        session_id: params.threadId,
        thread_id: params.threadId,
        user_id: params.userId,
        role: "user",
        content: params.message,
        entities: params.entities,
        dossier: {},
      },
      {
        session_id: params.threadId,
        thread_id: params.threadId,
        user_id: params.userId,
        role: "assistant",
        content: params.answer,
        entities: params.entities,
        dossier: params.dossier,
      },
    ])
    .throwOnError();
}

export async function chatHandler(req: VercelRequest, res: VercelResponse) {
  const method = String(req.method || "").toUpperCase();
  if (method !== "POST" && method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const runtime = await getCopilotRuntime();
    const body: ChatRequest =
      method === "GET"
        ? {
            message: queryParam(req, "message") || queryParam(req, "q"),
            thread_id: queryParam(req, "thread_id") || queryParam(req, "session_id") || null,
            lang: queryParam(req, "lang") || null,
          }
        : await readJson<ChatRequest>(req);

    if (method === "GET" && !String(body?.message || "").trim()) {
      return json(res, 200, {
        ok: true,
        endpoint: "/api/chat",
        methods: ["POST", "GET"],
        usage: "POST JSON { message, thread_id?, lang?, overrides? } or GET ?message=...",
      });
    }

    const message = cleanMessage(body?.message);
    if (!message) {
      return json(res, 400, { ok: false, error: "message_required" });
    }

    const preferredLang = normalizeLang(body?.lang) || inferLangFromMessage(message);
    let adminClient: SupabaseClient | null = null;
    try {
      adminClient = supabaseAdmin();
    } catch {
      adminClient = null;
    }
    const token = getBearerToken(req);
    const userId = await resolveUserIdFromToken(token, adminClient);
    const threadId = await ensureThreadId(userId, body?.thread_id || null, message, adminClient);
    const resolver = runtime.resolveEntities({
      message,
      overrides: asObject(body?.overrides),
      lang: preferredLang,
    });

    const phaseOnePolicy = adminClient
      ? await runtime.retrievePolicyContext({ admin: adminClient, context: resolver.context }).catch(() => fallbackPolicyContext())
      : fallbackPolicyContext();

    const classification = runtime.classifyProduct({
      context: resolver.context,
      aliases: phaseOnePolicy.aliases,
    });

    const finalContext: ResolvedContext = {
      ...resolver.context,
      hs6: resolver.context.hs6 || classification.primary?.hs6 || null,
    };

    const policy =
      finalContext.hs6 !== resolver.context.hs6
        ? adminClient
          ? await runtime.retrievePolicyContext({ admin: adminClient, context: finalContext }).catch(() => phaseOnePolicy)
          : phaseOnePolicy
        : phaseOnePolicy;

    const controls = runtime.evaluateControls({
      context: finalContext,
      classification,
      policy,
    });

    const baseChecks = buildBaseChecks(finalContext, classification, preferredLang);
    const checks = sortChecks(mergeChecks([...baseChecks, ...controls.checks]));
    const decision = decisionFromChecks({ checks, hardStop: controls.hardStop, lang: preferredLang });

    const allMissingQuestions = runtime.buildMissingQuestions(finalContext, preferredLang).slice(0, 5);
    const missingQuestions = allMissingQuestions.slice(0, 1);
    const globalTradeIntent = runtime.detectGlobalTradeIntent({
      question: message,
      product: finalContext.product,
    });
    const watchLinks = buildWatchLinks({
      isAuthenticated: Boolean(userId),
      lang: preferredLang,
    });
    const packUpsell = await shouldShowCountryPackUpsell({
      adminClient,
      userId,
      destination: finalContext.destination,
    });

    const sourceLinks = dedupeSources([
      ...watchLinks,
      ...(packUpsell.show
        ? [
            {
              title: preferredLang === "en" ? "Country packs" : "Packs pays",
              url: "/pricing#country-packs",
            },
          ]
        : []),
    ]);

    const dossier = buildDossier({
      lang: preferredLang,
      context: finalContext,
      decision,
      checks,
      classification,
      policy,
      controls,
      missingQuestions: allMissingQuestions,
    });

    const answerMarkdown = buildAnswerMarkdown({
      lang: preferredLang,
      decision,
      checks,
      dossier,
      missingQuestions: allMissingQuestions,
      sourceLinks,
      globalTradeIntent,
      isAuthenticated: Boolean(userId),
      packUpsellAction: packUpsell.show
        ? buildPackUpsellAction({
            lang: preferredLang,
            iso2: packUpsell.iso2,
            priceMonthly: packUpsell.priceMonthly,
          })
        : null,
    });

    const entities = toEntities(finalContext, message);
    const mainBlocker = findMainBlocker(checks);
    const followUpQuestions = [
      questionFromFieldPath(mainBlocker?.fieldPath, preferredLang) || missingQuestions[0] || null,
    ].filter((item): item is string => Boolean(item));

    const payload = ChatResponseSchema.parse({
      ok: true,
      lang: preferredLang,
      decision,
      entities,
      missing_questions: missingQuestions,
      dossier,
      checks,
      main_blocker: mainBlocker,
      answer_markdown: answerMarkdown,
      source_links: sourceLinks,
      follow_up_questions: followUpQuestions,
    });

    await persistExchange({
      adminClient,
      userId,
      threadId,
      message,
      answer: payload.answer_markdown,
      entities,
      dossier,
    }).catch(() => undefined);

    return json(res, 200, {
      ...payload,
      thread_id: threadId,
      session_id: threadId,
      answer: payload.answer_markdown,
      mode: payload.missing_questions.length ? "needs_input" : "brief_ready",
      in_scope: true,
      intent: "export_expert",
      assistant_message: payload.answer_markdown,
      assistant_mode: payload.missing_questions.length ? "needs_input" : "brief_ready",
      detected_context: {
        countryIso2: payload.entities.destination,
        product: finalContext.product,
        hs6: payload.entities.hs6,
      },
      decision_status: payload.decision.status,
      retrieval_at: policy.retrievalAt,
    });
  } catch (err: any) {
    return json(res, 500, {
      ok: false,
      error: String(err?.message || "chat_failed"),
    });
  }
}

export default allowCors(chatHandler);

