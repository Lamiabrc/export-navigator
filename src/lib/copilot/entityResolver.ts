import type { Lang, GoodsKind, ResolvedContext, TradeFlow } from "./types.js";
import { extractCountriesFromText as extractCountriesFromAnyText, resolveCountryIso2 } from "./officialLinks.js";

type ResolveParams = {
  message: string;
  overrides?: Record<string, unknown> | null;
  lang: Lang;
};

type ResolveResult = {
  context: ResolvedContext;
  detectedCountries: string[];
  normalizedMessage: string;
};

const DEFAULT_HOME_COUNTRY = "FR";

const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"] as const;

const TRANSPORT_PATTERNS: Array<{ mode: string; pattern: RegExp }> = [
  { mode: "sea", pattern: /\b(sea|ocean|maritime|mer|fret maritime)\b/i },
  { mode: "air", pattern: /\b(air|aerien|airfreight|avion)\b/i },
  { mode: "road", pattern: /\b(road|route|camion|truck)\b/i },
  { mode: "rail", pattern: /\b(rail|ferroviaire|train)\b/i },
  { mode: "courier", pattern: /\b(courier|express|colis|parcel)\b/i },
];

const CURRENCY_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "EUR", pattern: /\b(eur|euro)\b/i },
  { code: "USD", pattern: /\b(usd|\$|dollar)\b/i },
  { code: "GBP", pattern: /\b(gbp|pound|livre sterling)\b/i },
  { code: "CHF", pattern: /\b(chf|franc suisse)\b/i },
  { code: "CNY", pattern: /\b(cny|rmb|yuan)\b/i },
  { code: "JPY", pattern: /\b(jpy|yen)\b/i },
  { code: "MAD", pattern: /\b(mad|dirham)\b/i },
];

const PRODUCT_HINT_PATTERNS: RegExp[] = [
  /(?:produit|product|marchandise)\s*[:=-]\s*([^\n.;]{3,120})/i,
  /(?:j[\s']*exporte|nous exportons|j[\s']*importe|nous importons)\s+(?:des|de|du|d')\s+([^\n.;]{3,120})/i,
  /(?:export|import)\s+of\s+([^\n.;]{3,120})/i,
];

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstText(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = String(input[key] ?? "").trim();
    if (candidate) return candidate;
  }
  return null;
}

function normalizeIso2(value: string | null): string | null {
  const trimmed = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return null;
}

function lookupCountry(value: string | null): string | null {
  if (!value) return null;
  const iso = normalizeIso2(value);
  if (iso) return resolveCountryIso2(iso);
  return resolveCountryIso2(value);
}

function extractCountriesFromText(message: string): string[] {
  return extractCountriesFromAnyText(message, 3);
}

function extractCountryByPattern(message: string, pattern: RegExp): string | null {
  const m = message.match(pattern);
  if (!m) return null;
  return lookupCountry(m[1] || null);
}

function detectFlowHint(message: string, overrides: Record<string, unknown>): TradeFlow {
  const explicit = normalizeText(String(overrides.flow ?? overrides.direction ?? ""));
  if (explicit === "import") return "import";
  if (explicit === "export") return "export";

  const normalized = normalizeText(message);
  const hasImport = /\b(import|importation|importer|importe|importe)\b/i.test(normalized);
  const hasExport = /\b(export|exportation|exporter|exporte|expedier)\b/i.test(normalized);

  if (hasImport && !hasExport) return "import";
  if (hasExport && !hasImport) return "export";

  return "unknown";
}

function detectFlow(
  message: string,
  overrides: Record<string, unknown>,
  origin: string | null,
  destination: string | null
): TradeFlow {
  const hint = detectFlowHint(message, overrides);
  if (hint !== "unknown") return hint;

  if (origin === "FR" && destination && destination !== "FR") return "export";
  if (destination === "FR" && origin && origin !== "FR") return "import";

  return "unknown";
}

function detectGoodsOrServices(message: string, overrides: Record<string, unknown>, flowHint: TradeFlow): GoodsKind {
  const explicit = normalizeText(String(overrides.goods_or_services ?? overrides.goodsOrServices ?? overrides.kind ?? ""));
  if (["goods", "biens", "marchandise", "marchandises"].includes(explicit)) return "goods";
  if (["services", "service"].includes(explicit)) return "services";

  const normalized = normalizeText(message);
  if (/\b(service|services|prestation|consulting|saas|software service)\b/.test(normalized)) return "services";
  if (/\b(produit|produits|marchandise|marchandises|shipment|cargo)\b/.test(normalized)) return "goods";
  if (flowHint === "export" || flowHint === "import") return "goods";
  return "unknown";
}

function detectIncoterm(message: string, overrides: Record<string, unknown>): string | null {
  const explicit = String(overrides.incoterm ?? "").trim().toUpperCase();
  if (INCOTERMS.includes(explicit as (typeof INCOTERMS)[number])) return explicit;

  for (const incoterm of INCOTERMS) {
    if (new RegExp(`\\b${incoterm}\\b`, "i").test(message)) return incoterm;
  }
  return null;
}

function detectHs6(message: string, overrides: Record<string, unknown>): string | null {
  const explicit = String(overrides.hs6 ?? overrides.hs ?? overrides.hs_code ?? "").replace(/[^0-9]/g, "");
  if (explicit.length >= 6) return explicit.slice(0, 6);

  const m = message.match(/\b([0-9]{6,10})\b/);
  if (!m) return null;
  return m[1].slice(0, 6);
}

function detectTransport(message: string, overrides: Record<string, unknown>): string | null {
  const explicit = normalizeText(String(overrides.transport ?? overrides.transport_mode ?? ""));
  if (explicit) {
    for (const entry of TRANSPORT_PATTERNS) {
      if (entry.pattern.test(explicit)) return entry.mode;
    }
  }

  for (const entry of TRANSPORT_PATTERNS) {
    if (entry.pattern.test(message)) return entry.mode;
  }
  return null;
}

function detectCurrency(message: string, overrides: Record<string, unknown>): string | null {
  const explicit = String(overrides.currency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(explicit)) return explicit;

  for (const entry of CURRENCY_PATTERNS) {
    if (entry.pattern.test(message)) return entry.code;
  }
  return null;
}

function detectValue(message: string, overrides: Record<string, unknown>): number | null {
  const explicitRaw = String(overrides.value ?? overrides.amount ?? "").trim();
  if (explicitRaw) {
    const parsed = Number(explicitRaw.replace(/,/g, ".").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const m = message.match(/\b([0-9]{1,3}(?:[\s.,][0-9]{3})*(?:[.,][0-9]{1,2})?)\s*(eur|usd|gbp|chf|mad|cny|jpy|\$)?\b/i);
  if (!m) return null;
  const parsed = Number(String(m[1]).replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function detectProduct(message: string, overrides: Record<string, unknown>): string | null {
  const explicit = firstText(overrides, ["product", "product_text", "goods", "description", "item"]);
  if (explicit) return explicit.slice(0, 180);

  for (const pattern of PRODUCT_HINT_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 180);
  }

  return null;
}

function detectUsage(message: string, overrides: Record<string, unknown>): string | null {
  const explicit = firstText(overrides, ["usage", "end_use", "use_case"]);
  if (explicit) return explicit.slice(0, 180);

  const normalized = normalizeText(message);
  if (/\b(military|militaire|defense|arme|weapon)\b/.test(normalized)) return "military";
  if (/\b(civil|consumer|retail)\b/.test(normalized)) return "civil";
  if (/\b(research|laboratoire|lab|r&d)\b/.test(normalized)) return "research";

  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(String(value ?? ""));
  if (!normalized) return null;
  if (["yes", "oui", "true", "1", "pro", "taxable", "assujetti"].includes(normalized)) return true;
  if (["no", "non", "false", "0", "not taxable", "non assujetti"].includes(normalized)) return false;
  return null;
}

function deduceCountries(
  message: string,
  overrides: Record<string, unknown>,
  fallbackDetected: string[],
  flowHint: TradeFlow
): { origin: string | null; destination: string | null; detected: string[] } {
  const originOverride = lookupCountry(firstText(overrides, ["origin", "from", "seller_country", "sellerCountry"]));
  const destinationOverride = lookupCountry(firstText(overrides, ["destination", "to", "buyer_country", "buyerCountry", "country"]));

  const directionalPattern = message.match(
    /(?:from|depuis)\s+([a-zA-Z\u00C0-\u017F\s\-']{2,40})\s+(?:to|vers|en)\s+([a-zA-Z\u00C0-\u017F\s\-']{2,40})/i
  );

  const sellerPattern = extractCountryByPattern(message, /vendeur\s*[:=-]\s*([a-zA-Z\u00C0-\u017F\s\-']{2,40})/i);
  const buyerPattern = extractCountryByPattern(message, /acheteur\s*[:=-]\s*([a-zA-Z\u00C0-\u017F\s\-']{2,40})/i);
  const exportToPattern = extractCountryByPattern(
    message,
    /(?:export(?:er|e|ons|ation)?|exped(?:ier|ie|ions)?|vendre)\s+(?:en|vers|to)\s+([a-zA-Z\u00C0-\u017F\s\-']{2,40})/i
  );
  const importFromPattern = extractCountryByPattern(
    message,
    /(?:import(?:er|e|ons|ation)?|acheter)\s+(?:de|depuis|from)\s+([a-zA-Z\u00C0-\u017F\s\-']{2,40})/i
  );

  const fromPattern = lookupCountry(directionalPattern?.[1] || null) || sellerPattern || importFromPattern;
  const toPattern = lookupCountry(directionalPattern?.[2] || null) || buyerPattern || exportToPattern;

  const detected = Array.from(
    new Set([...(originOverride ? [originOverride] : []), ...(destinationOverride ? [destinationOverride] : []), ...fallbackDetected])
  );

  let origin = originOverride || fromPattern || null;
  let destination = destinationOverride || toPattern || null;

  if (!origin && !destination && detected.length === 1) {
    if (flowHint === "import") {
      origin = detected[0];
    } else {
      destination = detected[0];
    }
  } else {
    if (!origin && detected.length >= 1 && flowHint === "import") {
      origin = detected[0];
    }
    if (!destination && detected.length >= 1 && flowHint !== "import") {
      destination = detected[0];
    }
    if (!origin && detected.length >= 2) {
      origin = detected[0];
    }
    if (!destination && detected.length >= 2) {
      destination = detected[1];
    }
  }

  if (!origin && destination && flowHint === "export") {
    origin = DEFAULT_HOME_COUNTRY;
  }
  if (!destination && origin && flowHint === "import") {
    destination = DEFAULT_HOME_COUNTRY;
  }

  if (origin && destination && origin === destination && detected.length === 1) {
    if (flowHint === "export") {
      origin = DEFAULT_HOME_COUNTRY;
    } else if (flowHint === "import") {
      destination = DEFAULT_HOME_COUNTRY;
    }
  }

  return { origin, destination, detected };
}

export function resolveEntities(params: ResolveParams): ResolveResult {
  const message = String(params.message || "").trim();
  const overrides = asObject(params.overrides);
  const flowHint = detectFlowHint(message, overrides);
  const detectedCountries = extractCountriesFromText(message);
  const countries = deduceCountries(message, overrides, detectedCountries, flowHint);

  const context: ResolvedContext = {
    flow: "unknown",
    goodsOrServices: detectGoodsOrServices(message, overrides, flowHint),
    origin: countries.origin,
    destination: countries.destination,
    product: detectProduct(message, overrides),
    hs6: detectHs6(message, overrides),
    incoterm: detectIncoterm(message, overrides),
    value: detectValue(message, overrides),
    currency: detectCurrency(message, overrides),
    transport: detectTransport(message, overrides),
    usage: detectUsage(message, overrides),
    buyer: firstText(overrides, ["buyer", "buyer_name", "counterparty", "buyerName"]),
    seller: firstText(overrides, ["seller", "seller_name", "shipper", "sellerName"]),
    buyerIsTaxable: parseBoolean(overrides.buyer_is_taxable ?? overrides.buyerIsTaxable),
    buyerVat: firstText(overrides, ["buyer_vat", "buyerVat", "vat", "vat_number"]),
  };

  context.flow = detectFlow(message, overrides, context.origin, context.destination);

  return {
    context,
    detectedCountries: countries.detected,
    normalizedMessage: normalizeText(message),
  };
}

export function buildMissingQuestions(context: ResolvedContext, lang: Lang): string[] {
  const destinationQuestion =
    lang === "en"
      ? "What is the destination country (ISO2 or country name)?"
      : "Quel est le pays de destination (ISO2 ou nom) ?";
  const originQuestion =
    lang === "en"
      ? "What is the origin country?"
      : "Quel est le pays d'origine ?";
  const flowQuestion =
    lang === "en"
      ? "Is this an import or an export operation?"
      : "S'agit-il d'une operation d'import ou d'export ?";
  const taxableQuestion =
    lang === "en"
      ? "Is the buyer VAT-taxable (professional taxable entity)?"
      : "L'acheteur est-il assujetti a la TVA (client professionnel) ?";
  const productQuestion =
    lang === "en"
      ? "What is the product (commercial name + composition/use), and HS if known?"
      : "Quel est le produit (nom commercial + composition/usage), et le code HS si connu ?";
  const incotermQuestion =
    lang === "en"
      ? "Which Incoterm do you plan to use (EXW, FCA, FOB, CIF, DAP, DDP)?"
      : "Quel Incoterm est prevu (EXW, FCA, FOB, CIF, DAP, DDP) ?";

  const hasProduct = Boolean(context.product || context.hs6);
  const hasDestination = Boolean(context.destination);
  const hasOrigin = Boolean(context.origin);

  const ranked: Array<{ question: string; priority: number }> = [];

  if (hasDestination && !hasProduct) {
    ranked.push({ question: productQuestion, priority: 1 });
  }
  if (!hasDestination && hasProduct) {
    ranked.push({ question: destinationQuestion, priority: 1 });
  }
  if (!hasDestination && !hasProduct) {
    ranked.push({ question: destinationQuestion, priority: 1 });
    ranked.push({ question: productQuestion, priority: 2 });
  }
  if (!context.incoterm) {
    ranked.push({ question: incotermQuestion, priority: 3 });
  }
  if (!hasOrigin && hasDestination) {
    ranked.push({ question: originQuestion, priority: 4 });
  }
  if (context.flow === "unknown") {
    ranked.push({ question: flowQuestion, priority: 5 });
  }
  if (context.buyerIsTaxable === null) {
    ranked.push({ question: taxableQuestion, priority: 6 });
  }

  const ordered = ranked
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.question)
    .filter((item, index, array) => array.indexOf(item) === index);

  return ordered;
}
