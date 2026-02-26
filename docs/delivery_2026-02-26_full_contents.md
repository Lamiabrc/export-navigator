# Delivery Full File Contents

Generated: 2026-02-26

## .vercelignore
`$ext
node_modules
dist
coverage
.git
.github
.vscode
*.log

```

## api/ask.ts
`$ext
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { allowCors, json, readJson } from "../src/server/supabaseAdmin.js";
import { chatHandler } from "./chat.js";

type AskPayload = {
  question?: string;
  message?: string;
  lang?: string | null;
  session_id?: string | null;
  thread_id?: string | null;
  context?: Record<string, unknown> | null;
  overrides?: Record<string, unknown> | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function buildOverrides(payload: AskPayload) {
  const context = asObject(payload.context);
  const explicit = asObject(payload.overrides);

  return {
    origin: asOptionalText(explicit.origin ?? context.origin),
    destination: asOptionalText(explicit.destination ?? context.destination),
    hs6: asOptionalText(explicit.hs6 ?? context.hs6 ?? context.hs_code ?? context.product_hs),
    incoterm: asOptionalText(explicit.incoterm ?? context.incoterm),
    payment: asOptionalText(explicit.payment ?? explicit.payment_term ?? context.payment ?? context.payment_term),
    transport: asOptionalText(explicit.transport ?? explicit.transport_mode ?? context.transport ?? context.transport_mode),
    currency: asOptionalText(explicit.currency ?? context.currency),
    contract_type: asOptionalText(explicit.contract_type ?? context.contract_type),
  };
}

export async function askHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const body = await readJson<AskPayload>(req);
  const message = String(body?.question ?? body?.message ?? "").trim();
  if (!message) {
    return json(res, 400, { ok: false, error: "question_required" });
  }

  const mappedBody = {
    message,
    lang: asOptionalText(body?.lang),
    thread_id: asOptionalText(body?.thread_id ?? body?.session_id ?? asObject(body?.context).session_id),
    overrides: buildOverrides(body),
  };

  (req as unknown as { body: unknown }).body = mappedBody;
  return chatHandler(req, res);
}

export default allowCors(askHandler);

```

## api/chat.ts
`$ext
import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type Lang = "fr" | "en";

type ChatRequest = {
  message?: string;
  thread_id?: string | null;
  lang?: string | null;
  overrides?: Partial<DetectedEntities> | null;
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

const COUNTRY_ALIASES: Array<{ iso2: string; patterns: RegExp[] }> = [
  { iso2: "FR", patterns: [/\bfrance\b/i] },
  { iso2: "DE", patterns: [/\ballemagne\b/i, /\bgermany\b/i] },
  { iso2: "ES", patterns: [/\bespagne\b/i, /\bspain\b/i] },
  { iso2: "IT", patterns: [/\bitalie\b/i, /\bitaly\b/i] },
  { iso2: "PT", patterns: [/\bportugal\b/i] },
  { iso2: "BE", patterns: [/\bbelgique\b/i, /\bbelgium\b/i] },
  { iso2: "NL", patterns: [/\bpays[\s-]?bas\b/i, /\bnetherlands\b/i, /\bhollande\b/i] },
  { iso2: "GB", patterns: [/\broyaume[\s-]?uni\b/i, /\buk\b/i, /\bunited kingdom\b/i] },
  { iso2: "US", patterns: [/\busa\b/i, /\betats?[\s-]?unis\b/i, /\bunited states\b/i] },
  { iso2: "CA", patterns: [/\bcanada\b/i] },
  { iso2: "CN", patterns: [/\bchine\b/i, /\bchina\b/i] },
  { iso2: "JP", patterns: [/\bjapon\b/i, /\bjapan\b/i] },
  { iso2: "MA", patterns: [/\bmaroc\b/i, /\bmorocco\b/i] },
  { iso2: "TR", patterns: [/\bturquie\b/i, /\bturkey\b/i] },
  { iso2: "CH", patterns: [/\bsuisse\b/i, /\bswitzerland\b/i] },
  { iso2: "BR", patterns: [/\bbresil\b/i, /\bbrazil\b/i] },
  { iso2: "MX", patterns: [/\bmexique\b/i, /\bmexico\b/i] },
  { iso2: "IN", patterns: [/\binde\b/i, /\bindia\b/i] },
  { iso2: "AE", patterns: [/\bemirats\b/i, /\buae\b/i, /\bunited arab emirates\b/i] },
];

const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"] as const;
const PAYMENT_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "LC", pattern: /\b(lc|l\/c|letter of credit|credit documentaire|credoc)\b/i },
  { code: "CAD", pattern: /\b(cad|documents against payment|remise documentaire)\b/i },
  { code: "OA", pattern: /\b(oa|open account|compte ouvert)\b/i },
  { code: "TT", pattern: /\b(tt|t\/t|wire transfer|virement)\b/i },
];
const TRANSPORT_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "air", pattern: /\b(air|airfreight|aerien|aerienne)\b/i },
  { code: "sea", pattern: /\b(sea|ocean|maritime|mer)\b/i },
  { code: "road", pattern: /\b(road|truck|route|camion)\b/i },
  { code: "rail", pattern: /\b(rail|train|ferroviaire)\b/i },
  { code: "courier", pattern: /\b(courier|express|parcel|colis)\b/i },
];
const CONTRACT_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "sales", pattern: /\b(vente internationale|contrat de vente|sales contract|sale of goods)\b/i },
  { code: "distribution", pattern: /\b(distribution|distributor)\b/i },
  { code: "agency", pattern: /\b(agent commercial|agency|commercial agent)\b/i },
  { code: "franchise", pattern: /\b(franchise)\b/i },
  { code: "licensing", pattern: /\b(licence|license|licensing)\b/i },
  { code: "oem", pattern: /\b(oem|sous[- ]traitance|subcontract|manufacturing agreement)\b/i },
];
const CURRENCY_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "EUR", pattern: /\b(eur|euro)\b/i },
  { code: "USD", pattern: /\b(usd|\$|dollar)\b/i },
  { code: "GBP", pattern: /\b(gbp|pound)\b/i },
  { code: "CHF", pattern: /\b(chf|franc suisse)\b/i },
  { code: "CNY", pattern: /\b(cny|rmb|yuan)\b/i },
  { code: "JPY", pattern: /\b(jpy|yen)\b/i },
  { code: "CAD", pattern: /\b(cad|canadian dollar)\b/i },
];

const ChatResponseSchema = z.object({
  ok: z.literal(true),
  lang: z.enum(["fr", "en"]),
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
  answer_markdown: z.string(),
  source_links: z.array(z.object({ title: z.string(), url: z.string() })),
  follow_up_questions: z.array(z.string()),
});

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function normalizeLang(input: unknown): Lang {
  const value = String(input || "").trim().toLowerCase();
  if (value === "en") return "en";
  return "fr";
}

function inferLangFromMessage(message: string): Lang {
  if (/\b(the|what|which|export|import|invoice|incoterm|payment)\b/i.test(message)) return "en";
  return "fr";
}

function cleanMessage(message: unknown) {
  return String(message || "").trim().slice(0, 8000);
}

function normalizeIso2(value: unknown) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function normalizeHs6(value: unknown) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (digits.length < 6) return null;
  return digits.slice(0, 6);
}

function detectIncoterm(message: string) {
  const up = message.toUpperCase();
  for (const code of INCOTERMS) {
    if (new RegExp(`\\b${code}\\b`, "i").test(up)) return code;
  }
  return null;
}

function detectByPatterns(message: string, patterns: Array<{ code: string; pattern: RegExp }>) {
  for (const entry of patterns) {
    if (entry.pattern.test(message)) return entry.code;
  }
  return null;
}

function detectCountries(message: string) {
  const detected: string[] = [];
  for (const entry of COUNTRY_ALIASES) {
    if (entry.patterns.some((pattern) => pattern.test(message))) {
      detected.push(entry.iso2);
    }
  }
  return Array.from(new Set(detected));
}

function isValidUrl(url: string | null | undefined) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value);
}

function defaultEntities(): DetectedEntities {
  return {
    origin: null,
    destination: null,
    hs6: null,
    incoterm: null,
    payment: null,
    transport: null,
    currency: null,
    contract_type: null,
  };
}

function mergeEntities(base: DetectedEntities, updates: Partial<DetectedEntities>): DetectedEntities {
  return {
    origin: updates.origin ?? base.origin ?? null,
    destination: updates.destination ?? base.destination ?? null,
    hs6: updates.hs6 ?? base.hs6 ?? null,
    incoterm: updates.incoterm ?? base.incoterm ?? null,
    payment: updates.payment ?? base.payment ?? null,
    transport: updates.transport ?? base.transport ?? null,
    currency: updates.currency ?? base.currency ?? null,
    contract_type: updates.contract_type ?? base.contract_type ?? null,
  };
}

function defaultQuestionBySlot(lang: Lang, slot: keyof DetectedEntities) {
  if (lang === "en") {
    switch (slot) {
      case "destination":
        return "What is your destination country (ISO2 or country name)?";
      case "hs6":
        return "What is the product or HS code (6 digits)?";
      case "incoterm":
        return "Which Incoterm do you target (EXW, FCA, CIF, DDP...)?";
      case "payment":
        return "Which payment method do you plan to use (LC, CAD, OA, TT)?";
      case "transport":
        return "Which transport mode do you plan to use (air, sea, road, rail, courier)?";
      case "origin":
        return "What is your origin country?";
      case "currency":
        return "What is your invoicing currency?";
      case "contract_type":
        return "Which contract type do you need (sales, distribution, agency, franchise, licensing, OEM)?";
      default:
        return "What is the missing information?";
    }
  }

  switch (slot) {
    case "destination":
      return "Quel est le pays de destination (code ISO2 ou nom du pays) ?";
    case "hs6":
      return "Quel est le produit ou le code HS (6 chiffres) ?";
    case "incoterm":
      return "Quel Incoterm ciblez-vous (EXW, FCA, CIF, DDP...) ?";
    case "payment":
      return "Quel mode de paiement prevoyez-vous (LC, CAD, OA, TT) ?";
    case "transport":
      return "Quel mode de transport prevoyez-vous (air, sea, road, rail, courier) ?";
    case "origin":
      return "Quel est le pays d'origine ?";
    case "currency":
      return "Quelle est la devise de facturation ?";
    case "contract_type":
      return "Quel type de contrat visez-vous (vente, distribution, agence, franchise, licence, OEM) ?";
    default:
      return "Quelle information manque ?";
  }
}

function missingSlots(entities: DetectedEntities) {
  const missing: Array<keyof DetectedEntities> = [];
  if (!entities.destination) missing.push("destination");
  if (!entities.hs6) missing.push("hs6");
  if (!entities.incoterm) missing.push("incoterm");
  if (!entities.payment) missing.push("payment");
  if (!entities.transport) missing.push("transport");
  if (!entities.origin) missing.push("origin");
  if (!entities.currency) missing.push("currency");
  if (!entities.contract_type) missing.push("contract_type");
  return missing;
}

function buildSummaryLines(entities: DetectedEntities) {
  return [
    `Destination: ${entities.destination || "-"}`,
    `HS6: ${entities.hs6 || "-"}`,
    `Incoterm: ${entities.incoterm || "-"}`,
  ];
}

function normalizeDossier(dossierRaw: Record<string, any>, entities: DetectedEntities, lang: Lang) {
  const docsRaw = Array.isArray(dossierRaw.documents) ? dossierRaw.documents : [];
  const restrictionsRaw = Array.isArray(dossierRaw.restrictions) ? dossierRaw.restrictions : [];
  const contractClausesRaw = Array.isArray(dossierRaw?.contracts?.clauses) ? dossierRaw.contracts.clauses : [];
  const nextActionsRaw = Array.isArray(dossierRaw.next_actions) ? dossierRaw.next_actions : [];

  const documents = docsRaw
    .map((item: any) => ({
      name: String(item?.name || item?.code || "Document").trim(),
      required: item?.required !== false,
      source_url: isValidUrl(item?.source_url || item?.source || item?.legal_ref)
        ? String(item.source_url || item.source || item.legal_ref)
        : null,
    }))
    .filter((item: { name: string }) => Boolean(item.name));

  const restrictions = restrictionsRaw
    .map((item: any) => String(item?.summary || item?.notes || item?.legal_ref || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const sanctionsLists = asObject(dossierRaw.sanctions).lists;
  const sanctionsEntities = asObject(dossierRaw.sanctions).entities_hint;
  const sanctions = [
    ...(Array.isArray(sanctionsLists)
      ? sanctionsLists
          .map((item: any) => String(item?.list_name || item?.authority || "").trim())
          .filter(Boolean)
      : []),
    ...(Array.isArray(sanctionsEntities)
      ? sanctionsEntities
          .map((item: any) => String(item?.name || "").trim())
          .filter(Boolean)
      : []),
  ].slice(0, 8);

  const taxAndCustoms = asObject(dossierRaw.tax_and_customs);
  const vat = asObject(taxAndCustoms.vat);
  const duties = Array.isArray(taxAndCustoms.duties_concept) ? taxAndCustoms.duties_concept : [];
  const procedures = Array.isArray(taxAndCustoms.procedures) ? taxAndCustoms.procedures : [];

  const taxes = [
    vat.standard_rate != null
      ? lang === "en"
        ? `Standard VAT rate: ${vat.standard_rate}`
        : `Taux de TVA standard: ${vat.standard_rate}`
      : null,
    ...duties
      .map((item: any) => String(item?.name || item?.code || "").trim())
      .filter(Boolean)
      .slice(0, 4),
    ...procedures
      .map((item: any) => String(item?.name || item?.code || "").trim())
      .filter(Boolean)
      .slice(0, 4),
  ].filter(Boolean) as string[];

  const logistics = [
    entities.incoterm ? `Incoterm: ${entities.incoterm}` : null,
    entities.transport ? `Transport: ${entities.transport}` : null,
    entities.payment ? `Payment: ${entities.payment}` : null,
    entities.currency ? `Currency: ${entities.currency}` : null,
  ].filter(Boolean) as string[];

  const contractClauses = contractClausesRaw
    .map((item: any) => String(item?.title || item?.code || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const nextActions = nextActionsRaw.map((item: any) => String(item || "").trim()).filter(Boolean).slice(0, 8);
  if (!nextActions.length) {
    nextActions.push(
      lang === "en"
        ? "Validate assumptions with legal/tax advisor before execution."
        : "Valider les hypotheses avec un conseil juridique/fiscal avant execution."
    );
  }

  const summary = buildSummaryLines(entities).join("\n");

  return {
    summary,
    documents,
    restrictions,
    sanctions,
    taxes,
    logistics,
    contract: { clauses: contractClauses },
    next_actions: nextActions,
  };
}

function buildSourceLinks(dossier: ReturnType<typeof normalizeDossier>) {
  const links = new Map<string, { title: string; url: string }>();
  for (const doc of dossier.documents) {
    if (doc.source_url && isValidUrl(doc.source_url)) {
      links.set(doc.source_url, { title: doc.name, url: doc.source_url });
    }
  }
  return Array.from(links.values()).slice(0, 8);
}

function buildAnswerMarkdown(params: {
  lang: Lang;
  dossier: ReturnType<typeof normalizeDossier>;
  missingQuestions: string[];
  sourceLinks: Array<{ title: string; url: string }>;
}) {
  const { lang, dossier, missingQuestions, sourceLinks } = params;
  const summaryLines = dossier.summary.split("\n").filter(Boolean).slice(0, 3);

  const checklist = dossier.documents.length
    ? dossier.documents.map((item) => `- ${item.required ? "[x]" : "[ ]"} ${item.name}`)
    : [lang === "en" ? "- [ ] No specific document matched yet." : "- [ ] Aucun document specifique detecte pour le moment."];

  const risks = dossier.restrictions.length
    ? dossier.restrictions.map((item) => `- ${item}`)
    : [lang === "en" ? "- No explicit restriction detected with current inputs." : "- Aucune restriction explicite detectee avec les informations actuelles."];

  const docs = dossier.documents.length
    ? dossier.documents.map((item) => `- ${item.name}${item.source_url ? ` (${item.source_url})` : ""}`)
    : [lang === "en" ? "- Document list will be refined after missing fields are filled." : "- La liste documentaire sera precisee apres completion des champs manquants."];

  const actions = dossier.next_actions.map((item) => `- ${item}`);
  const links = sourceLinks.length
    ? sourceLinks.map((item) => `- [${item.title}](${item.url})`)
    : [lang === "en" ? "- No official link available yet." : "- Aucun lien officiel disponible pour le moment."];

  const questionsBlock = missingQuestions.length
    ? `\n## ${lang === "en" ? "Missing questions" : "Questions manquantes"}\n${missingQuestions
        .slice(0, 3)
        .map((question) => `- ${question}`)
        .join("\n")}\n`
    : "";

  return [
    `## ${lang === "en" ? "Summary" : "Resume"}`,
    ...summaryLines.map((line) => `- ${line}`),
    "",
    `## ${lang === "en" ? "Checklist" : "Checklist"}`,
    ...checklist,
    "",
    `## ${lang === "en" ? "Risks" : "Risques"}`,
    ...risks,
    "",
    `## ${lang === "en" ? "Documents" : "Documents"}`,
    ...docs,
    "",
    `## ${lang === "en" ? "Next actions" : "Actions"}`,
    ...actions,
    "",
    `## ${lang === "en" ? "Sources" : "Liens"}`,
    ...links,
    questionsBlock,
  ]
    .flat()
    .join("\n")
    .trim();
}

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function resolveUserIdFromToken(token: string | null) {
  if (!token) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return String(data.user.id);
}

async function ensureThreadId(userId: string | null, requestedThreadId: string | null, message: string) {
  if (!userId) return requestedThreadId || null;

  const admin = supabaseAdmin();
  const requested = String(requestedThreadId || "").trim();
  if (requested) {
    const { data } = await admin
      .from("chat_sessions")
      .select("id")
      .eq("id", requested)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  const { data: created } = await admin
    .from("chat_sessions")
    .insert({ user_id: userId, title: message.slice(0, 120) })
    .select("id")
    .single();
  return String(created?.id || "") || crypto.randomUUID();
}

async function persistExchange(params: {
  userId: string | null;
  threadId: string | null;
  message: string;
  answer: string;
  entities: DetectedEntities;
  dossier: ReturnType<typeof normalizeDossier>;
}) {
  if (!params.userId || !params.threadId) return;

  const admin = supabaseAdmin();
  await admin
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
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson<ChatRequest>(req);
    const message = cleanMessage(body?.message);
    if (!message) {
      return json(res, 400, { ok: false, error: "message_required" });
    }

    const preferredLang = normalizeLang(body?.lang) || inferLangFromMessage(message);
    const token = getBearerToken(req);
    const userId = await resolveUserIdFromToken(token);
    const threadId = await ensureThreadId(userId, body?.thread_id || null, message);

    const admin = supabaseAdmin();

    let detectRpc: Record<string, any> = {};
    try {
      const { data } = await admin.rpc("rpc_detect_entities", {
        q: message,
        ui_lang: preferredLang,
      });
      detectRpc = asObject(data);
    } catch {
      detectRpc = {};
    }

    const rpcCountries = Array.isArray(detectRpc.countries)
      ? detectRpc.countries
          .map((item: any) => normalizeIso2(item?.iso2))
          .filter((item: string | null): item is string => Boolean(item))
      : [];

    const countryFromText = detectCountries(message);
    const combinedCountries = Array.from(new Set([...rpcCountries, ...countryFromText]));

    const rpcHs = Array.isArray(detectRpc.hs)
      ? detectRpc.hs
          .map((item: any) => normalizeHs6(item?.hs6))
          .filter((item: string | null): item is string => Boolean(item))
      : [];

    const detectedFromMessage: Partial<DetectedEntities> = {
      destination: combinedCountries[0] || null,
      origin: combinedCountries[1] || null,
      hs6: rpcHs[0] || normalizeHs6(message),
      incoterm: detectIncoterm(message),
      payment: detectByPatterns(message, PAYMENT_PATTERNS),
      transport: detectByPatterns(message, TRANSPORT_PATTERNS),
      currency: detectByPatterns(message, CURRENCY_PATTERNS),
      contract_type: detectByPatterns(message, CONTRACT_PATTERNS),
    };

    const overrides = asObject(body?.overrides);
    const overrideEntities: Partial<DetectedEntities> = {
      origin: normalizeIso2(overrides.origin),
      destination: normalizeIso2(overrides.destination),
      hs6: normalizeHs6(overrides.hs6),
      incoterm: String(overrides.incoterm || "").toUpperCase() || null,
      payment: String(overrides.payment || "").toUpperCase() || null,
      transport: String(overrides.transport || "").toLowerCase() || null,
      currency: String(overrides.currency || "").toUpperCase() || null,
      contract_type: String(overrides.contract_type || "").toLowerCase() || null,
    };

    const entities = mergeEntities(mergeEntities(defaultEntities(), detectedFromMessage), overrideEntities);

    const inScope = typeof detectRpc.in_scope === "boolean"
      ? Boolean(detectRpc.in_scope)
      : /\b(export|import|incoterm|douane|customs|hs|sanction|logistique|transport|facture|invoice|tva|vat)\b/i.test(message);

    let dossierRaw: Record<string, any> = {};
    if (inScope) {
      try {
        const { data } = await admin.rpc("rpc_build_export_dossier", {
          input: {
            lang: preferredLang,
            origin: entities.origin,
            destination: entities.destination,
            hs6: entities.hs6,
            incoterm: entities.incoterm,
            payment: entities.payment,
            transport: entities.transport,
            currency: entities.currency,
            contract_type: entities.contract_type,
          },
        });
        dossierRaw = asObject(data);
      } catch {
        dossierRaw = {};
      }
    }

    const dossier = normalizeDossier(dossierRaw, entities, preferredLang);
    const missingQuestions = inScope ? missingSlots(entities).map((slot) => defaultQuestionBySlot(preferredLang, slot)) : [];
    const followUpQuestions = missingQuestions.slice(0, 3);
    const sourceLinks = buildSourceLinks(dossier);

    const answerMarkdown = inScope
      ? buildAnswerMarkdown({
          lang: preferredLang,
          dossier,
          missingQuestions,
          sourceLinks,
        })
      : preferredLang === "en"
      ? "I focus on import/export operations. Please ask an international trade question."
      : "Je suis specialise sur les operations import/export. Posez une question de commerce international.";

    const payload = ChatResponseSchema.parse({
      ok: true,
      lang: preferredLang,
      entities,
      missing_questions: missingQuestions,
      dossier,
      answer_markdown: answerMarkdown,
      source_links: sourceLinks,
      follow_up_questions: followUpQuestions,
    });

    await persistExchange({
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
      in_scope: inScope,
      intent: String(detectRpc.intent || "export_expert"),
      assistant_message: payload.answer_markdown,
      assistant_mode: payload.missing_questions.length ? "needs_input" : "brief_ready",
    });
  } catch (err: any) {
    return json(res, 500, {
      ok: false,
      error: String(err?.message || "chat_failed"),
    });
  }
}

export default allowCors(chatHandler);



```

## api/ingest/feeds.ts
`$ext
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

import { supabaseAdmin } from "../../src/server/supabaseAdmin.js";

type ParsedItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
};

type FeedRow = {
  id: string;
  name: string | null;
  source_name: string | null;
  source_url: string | null;
  kind: string | null;
  enabled: boolean | null;
  is_public: boolean | null;
  logo_url: string | null;
  category: string | null;
  territory: string | null;
  tags: string[] | null;
};

type FeedResult = {
  feedId: string;
  name: string;
  status: "ok" | "skipped" | "failed";
  httpStatus: number | null;
  fetched: number;
  inserted: number;
  deduped: number;
  error?: string;
};

const TOPIC_SYNONYMS: Record<string, string[]> = {
  sanctions: ["sanction", "embargo", "ofac", "restricted"],
  douane: ["douane", "customs", "tariff", "duty"],
  taxes: ["tax", "vat", "tva", "cbam"],
  documents: ["document", "certificate", "invoice", "packing list", "origin"],
  logistics: ["transport", "shipping", "maritime", "freight", "logistics"],
  health: ["who", "health", "pandemic"],
};

function toIso(value?: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function stripHtml(html: string) {
  return (html || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text: string) {
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function truncate(s: string, n: number) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}...`;
}

function extractTag(block: string, tag: string) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractAttr(block: string, tag: string, attr: string) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*\\/?>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractFirstImgSrc(html: string) {
  const m = (html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.trim() || "";
}

function normalizeLink(link: string) {
  const l = (link || "").trim();
  if (!l) return "";
  return l.replace(/\s+/g, "");
}

function normalizeTag(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => normalizeTag(String(v || ""))).filter(Boolean);
  }
  const one = normalizeTag(String(value || ""));
  return one ? [one] : [];
}

function inferTopicTags(item: ParsedItem) {
  const haystack = `${item.title} ${item.summary || ""}`.toLowerCase();
  const topics: string[] = [];

  for (const [topic, synonyms] of Object.entries(TOPIC_SYNONYMS)) {
    if (synonyms.some((synonym) => haystack.includes(synonym))) {
      topics.push(normalizeTag(topic));
    }
  }

  return Array.from(new Set(topics));
}

function inferTerritoryFromText(item: ParsedItem, fallbackTerritory: string | null) {
  if (fallbackTerritory) return fallbackTerritory;
  const haystack = `${item.title} ${item.summary || ""}`.toLowerCase();
  const known = ["FR", "DE", "ES", "IT", "BE", "NL", "US", "CA", "GB", "CH", "CN", "JP"];
  for (const code of known) {
    if (new RegExp(`\\b${code.toLowerCase()}\\b`, "i").test(haystack)) return code;
  }
  return "WORLD";
}

function itemFingerprint(item: ParsedItem) {
  const key = `${item.link}|${item.title}|${item.publishedAt ? item.publishedAt.slice(0, 10) : ""}`;
  return crypto.createHash("md5").update(key).digest("hex");
}

async function fetchTextWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "export-navigator-ingest/1.0",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

function parseRssItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const block of blocks.slice(0, 80)) {
    const titleRaw = extractTag(block, "title");
    const linkRaw = extractTag(block, "link") || extractTag(block, "guid");
    const descRaw = extractTag(block, "description") || extractTag(block, "content:encoded");
    const pubRaw = extractTag(block, "pubDate") || extractTag(block, "dc:date");

    const mediaImg =
      extractAttr(block, "media:content", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "enclosure", "url");

    const title = decodeEntities(stripHtml(titleRaw)) || "Sans titre";
    const link = normalizeLink(stripHtml(linkRaw));
    if (!link) continue;

    const summary = descRaw ? truncate(decodeEntities(stripHtml(descRaw)), 500) : null;
    const publishedAt = toIso(decodeEntities(stripHtml(pubRaw))) || null;

    items.push({
      title,
      link,
      summary,
      publishedAt,
      imageUrl: mediaImg || extractFirstImgSrc(descRaw) || null,
    });
  }

  return items;
}

function parseAtomItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const block of blocks.slice(0, 80)) {
    const titleRaw = extractTag(block, "title");
    const summaryRaw = extractTag(block, "summary") || extractTag(block, "content");
    const pubRaw = extractTag(block, "updated") || extractTag(block, "published");

    const link = normalizeLink(extractAttr(block, "link", "href"));
    if (!link) continue;

    const mediaImg =
      extractAttr(block, "media:content", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "enclosure", "url");

    const title = decodeEntities(stripHtml(titleRaw)) || "Sans titre";
    const summary = summaryRaw ? truncate(decodeEntities(stripHtml(summaryRaw)), 500) : null;
    const publishedAt = toIso(decodeEntities(stripHtml(pubRaw))) || null;

    items.push({
      title,
      link,
      summary,
      publishedAt,
      imageUrl: mediaImg || extractFirstImgSrc(summaryRaw) || null,
    });
  }

  return items;
}

function isAtom(xml: string) {
  return /<feed[\s>]/i.test(xml) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml);
}

async function createFetchLog(admin: ReturnType<typeof supabaseAdmin>, feedId: string, territory: string | null) {
  try {
    const { data } = await admin
      .from("feed_fetch_logs")
      .insert({ feed_id: feedId, status: "started", territory })
      .select("id")
      .single();
    return String(data?.id || "") || null;
  } catch {
    return null;
  }
}

async function finalizeFetchLog(
  admin: ReturnType<typeof supabaseAdmin>,
  logId: string | null,
  payload: {
    status: "ok" | "failed" | "skipped";
    httpStatus: number | null;
    fetched: number;
    inserted: number;
    deduped: number;
    error: string | null;
  },
) {
  if (!logId) return;
  try {
    await admin
      .from("feed_fetch_logs")
      .update({
        finished_at: new Date().toISOString(),
        status: payload.status,
        http_status: payload.httpStatus,
        fetched_count: payload.fetched,
        inserted_count: payload.inserted,
        deduped_count: payload.deduped,
        error: payload.error,
      })
      .eq("id", logId);
  } catch {
    // no-op
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const expected = String(process.env.CRON_SECRET || "").trim();
    if (!expected) {
      res.status(500).json({ ok: false, error: "missing_env", missing: ["CRON_SECRET"] });
      return;
    }

    const provided = String(req.headers["x-cron-secret"] || req.query?.key || "").trim();
    if (!provided || provided !== expected) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const admin = supabaseAdmin();
    const { data: feeds, error: feedError } = await admin
      .from("regulatory_feeds")
      .select("id,name,source_name,source_url,kind,enabled,is_public,logo_url,category,territory,tags")
      .eq("enabled", true)
      .neq("is_public", false)
      .order("created_at", { ascending: true });

    if (feedError) {
      res.status(500).json({ ok: false, error: "feeds_select_failed", detail: feedError.message });
      return;
    }

    const enabledFeeds = (feeds || []) as FeedRow[];
    const results: FeedResult[] = [];

    for (const feed of enabledFeeds) {
      const feedId = String(feed.id || "");
      const feedName = String(feed.source_name || feed.name || feedId);
      const feedUrl = String(feed.source_url || "").trim();
      const kind = String(feed.kind || "rss").toLowerCase();
      const feedTerritory = String(feed.territory || "").trim().toUpperCase() || null;
      const feedTags = normalizeTags(feed.tags);
      const logId = await createFetchLog(admin, feedId, feedTerritory);

      if (!feedUrl) {
        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: "missing_source_url",
        };
        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: result.error || null,
        });
        continue;
      }

      if (!(kind.includes("rss") || kind.includes("atom"))) {
        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: `kind_${kind}_not_supported`,
        };
        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "skipped",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: result.error || null,
        });
        continue;
      }

      try {
        const response = await fetchTextWithTimeout(feedUrl, 15000);
        if (!response.ok || !response.text) {
          const result: FeedResult = {
            feedId,
            name: feedName,
            status: "failed",
            httpStatus: response.status,
            fetched: 0,
            inserted: 0,
            deduped: 0,
            error: `fetch_${response.status}`,
          };
          results.push(result);
          await finalizeFetchLog(admin, logId, {
            status: "failed",
            httpStatus: result.httpStatus,
            fetched: 0,
            inserted: 0,
            deduped: 0,
            error: result.error || null,
          });
          continue;
        }

        const parsed = isAtom(response.text) ? parseAtomItems(response.text) : parseRssItems(response.text);
        if (!parsed.length) {
          await admin.from("regulatory_feeds").update({ last_fetched_at: new Date().toISOString() }).eq("id", feedId);
          const result: FeedResult = {
            feedId,
            name: feedName,
            status: "ok",
            httpStatus: response.status,
            fetched: 0,
            inserted: 0,
            deduped: 0,
          };
          results.push(result);
          await finalizeFetchLog(admin, logId, {
            status: "ok",
            httpStatus: response.status,
            fetched: 0,
            inserted: 0,
            deduped: 0,
            error: null,
          });
          continue;
        }

        const dedupInput = new Map<string, ParsedItem>();
        for (const item of parsed) {
          const fp = itemFingerprint(item);
          if (!dedupInput.has(fp)) dedupInput.set(fp, item);
        }
        const uniqueItems = Array.from(dedupInput.values());

        const rows = uniqueItems.map((item) => {
          const inferredTags = inferTopicTags(item);
          const tags = Array.from(new Set([...feedTags, ...inferredTags])).slice(0, 12);
          return {
            source_id: feedId,
            title: item.title,
            link: item.link,
            summary: item.summary,
            published_at: item.publishedAt,
            category: feed.category,
            territory: inferTerritoryFromText(item, feedTerritory),
            tags,
            image_url: item.imageUrl || feed.logo_url || null,
            fingerprint: itemFingerprint(item),
          };
        });

        const { data: insertedRows, error: upsertError } = await admin
          .from("regulatory_items")
          .upsert(rows, { onConflict: "source_id,fingerprint", ignoreDuplicates: true })
          .select("id");

        if (upsertError) {
          const result: FeedResult = {
            feedId,
            name: feedName,
            status: "failed",
            httpStatus: response.status,
            fetched: uniqueItems.length,
            inserted: 0,
            deduped: uniqueItems.length,
            error: upsertError.message,
          };
          results.push(result);
          await finalizeFetchLog(admin, logId, {
            status: "failed",
            httpStatus: response.status,
            fetched: result.fetched,
            inserted: 0,
            deduped: result.deduped,
            error: result.error || null,
          });
          continue;
        }

        const insertedCount = Array.isArray(insertedRows) ? insertedRows.length : 0;
        const dedupedCount = Math.max(0, uniqueItems.length - insertedCount);

        await admin.from("regulatory_feeds").update({ last_fetched_at: new Date().toISOString() }).eq("id", feedId);

        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "ok",
          httpStatus: response.status,
          fetched: uniqueItems.length,
          inserted: insertedCount,
          deduped: dedupedCount,
        };

        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "ok",
          httpStatus: result.httpStatus,
          fetched: result.fetched,
          inserted: result.inserted,
          deduped: result.deduped,
          error: null,
        });
      } catch (err: any) {
        const result: FeedResult = {
          feedId,
          name: feedName,
          status: "failed",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: String(err?.message || "ingest_failed"),
        };
        results.push(result);
        await finalizeFetchLog(admin, logId, {
          status: "failed",
          httpStatus: null,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          error: result.error || null,
        });
      }
    }

    res.status(200).json({ ok: true, feeds: enabledFeeds.length, results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "server_error", detail: String(err?.message || err) });
  }
}

export const config = { runtime: "nodejs" };

```

## api/rss.ts
`$ext
import type { VercelRequest, VercelResponse } from "@vercel/node";

type ApiItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  source: string | null;
  zone: string | null; // output compatibility for legacy UIs
  category: string | null;
  tags: string[];
  territory: string | null;
  official: boolean;
  importance: number;
  imageUrl: string | null;
};

type FeedItem = {
  title: string;
  link: string;
  description?: string | null;
  pubDate?: string | null;
  source?: string | null;
  imageUrl?: string | null;
};

type RssSource = { name: string; url: string };

type FeedFilter = {
  territory: string;
  topic: string | null;
  from: string | null;
  to: string | null;
  officialOnly: boolean;
};

const PERMANENT_SOURCES: RssSource[] = [
  { name: "Le Moci", url: "https://www.lemoci.com/feed/" },
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml" },
  { name: "Douane francaise", url: "https://www.douane.gouv.fr/meteo/prodouane/pages/rss" },
  { name: "UE DG Trade", url: "https://policy.trade.ec.europa.eu/node/2/rss_en" },
];

const WORLD_SOURCES: RssSource[] = [
  { name: "OMC (WTO)", url: "https://www.wto.org/library/rss/latest_news_e.xml" },
];

const COUNTRY_SOURCES: Record<string, RssSource[]> = {
  FR: [
    { name: "Economie.gouv.fr", url: "https://www.economie.gouv.fr/rss/toutesactualites" },
    { name: "Service-Public Pro", url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss" },
    { name: "France Diplomatie", url: "https://www.diplomatie.gouv.fr/en/backend-fd.php3" },
  ],
  DE: [{ name: "BMWK", url: "https://www.bmwk.de/SiteGlobals/Functions/RSSFeed/RSSFeed-Pressemitteilung.xml" }],
  BE: [{ name: "Belgium News", url: "https://news.belgium.be/en/feeds/all" }],
  NL: [{ name: "Government.nl", url: "https://feeds.government.nl/news.rss" }],
  CH: [
    { name: "FINMA sanctions", url: "https://www.finma.ch/en/rss/rss-internationale-sanktionen.xml" },
    { name: "FINMA news", url: "https://www.finma.ch/en/rss/rss-finma-news.xml" },
  ],
  US: [
    { name: "USTR press releases", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_press_releases_10475.xml" },
    { name: "USTR recent news", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_recent_news_10495.xml" },
  ],
  CA: [
    {
      name: "Global Affairs Canada",
      url: "https://api.io.canada.ca/io-server/gc/news/en/v2?atomtitle=Global+Affairs+Canada+news+releases&dept=departmentofforeignaffairstradeanddevelopment&format=atom&orderBy=desc&pick=1000&publishedDate%3E=2015-01-01&sort=publishedDate&type=newsreleases",
    },
  ],
};

const PROXY_ALLOWED_HOSTS = new Set([
  "news.google.com",
  "www.lemoci.com",
  "lemoci.com",
  "www.who.int",
  "who.int",
  "www.douane.gouv.fr",
  "douane.gouv.fr",
  "www.tresor.economie.gouv.fr",
  "finance.ec.europa.eu",
  "ofsi.blog.gov.uk",
  "www.ecb.europa.eu",
  "policy.trade.ec.europa.eu",
  "www.wto.org",
  "www.economie.gouv.fr",
  "www.service-public.gouv.fr",
  "www.diplomatie.gouv.fr",
  "www.bmwk.de",
  "news.belgium.be",
  "feeds.government.nl",
  "www.finma.ch",
  "api.io.canada.ca",
  "ustr.gov",
]);

const RSS_USER_AGENT =
  "Mozilla/5.0 (compatible; ExportNavigatorBot/1.0; +https://www.exportfrancefacile.com)";

function isAllowedProxyUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return PROXY_ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function allowCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

function createAbortController() {
  try {
    return typeof AbortController !== "undefined" ? new AbortController() : null;
  } catch {
    return null;
  }
}

function escapeXml(input: string) {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildBaseUrl(req: VercelRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function truncate(s: string, n: number) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}...`;
}

function toIsoDate(value: any): string | null {
  if (!value) return null;
  try {
    const dt = new Date(value);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString();
  } catch {
    return null;
  }
}

function normalizeTerritory(value: string) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "WORLD" || raw === "GLOBAL" || raw === "ALL" || raw === "MONDE" || raw === "EU") {
    return "WORLD";
  }
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return "WORLD";
}

function territoryLabel(code: string) {
  if (code === "WORLD") return "Monde";
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

const TOPIC_SYNONYMS: Record<string, string[]> = {
  sanctions: ["sanction", "embargo", "ofac", "asset freeze", "restrictive measure"],
  douane: ["douane", "customs", "tariff", "duty", "import control"],
  taxes: ["vat", "tva", "tax", "fiscal", "cbam"],
  documents: ["document", "certificate", "origin", "packing list", "invoice"],
  logistics: ["transport", "shipping", "maritime", "air freight", "logistics"],
  sante: ["who", "health", "pandemic", "disease", "vaccin"],
  trade: ["trade", "commerce", "wto", "market access", "fta"],
};

const OFFICIAL_SOURCE_HINTS = [
  "gouv",
  ".gov",
  "europa.eu",
  "wto.org",
  "who.int",
  "finma",
  "ustr",
  "service-public",
];

function parseBoolLike(value: unknown, fallback: boolean) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on", "official", "officiel"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function parseIsoDateOrNull(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function parseTopic(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw || null;
}

function normalizeTag(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategoryAndTags(text: string, sourceName: string | null, fallbackCategory: string | null) {
  const haystack = `${text || ""} ${sourceName || ""}`.toLowerCase();
  const found: string[] = [];
  for (const [topic, synonyms] of Object.entries(TOPIC_SYNONYMS)) {
    if (synonyms.some((synonym) => haystack.includes(synonym))) {
      found.push(topic);
    }
  }

  const fallback = fallbackCategory ? [normalizeTag(fallbackCategory)] : [];
  const tags = Array.from(
    new Set(
      [...found, ...fallback]
        .map((tag) => normalizeTag(tag))
        .filter(Boolean)
    )
  );

  return {
    category: fallbackCategory || found[0] || null,
    tags,
  };
}

function isOfficialSource(sourceName: string | null, sourceUrl: string | null) {
  const haystack = `${sourceName || ""} ${sourceUrl || ""}`.toLowerCase();
  return OFFICIAL_SOURCE_HINTS.some((hint) => haystack.includes(hint));
}

function computeImportance(item: Pick<ApiItem, "title" | "summary" | "publishedAt" | "source" | "official" | "category">) {
  let score = 10;
  const text = `${item.title} ${item.summary || ""}`.toLowerCase();

  if (item.official) score += 25;
  if (/(sanction|embargo|ban|urgent|alerte|critical|warning)/i.test(text)) score += 30;
  if (/(douane|customs|tariff|duty|tax|cbam|vat|tva)/i.test(text)) score += 15;
  if (item.category && ["sanctions", "douane", "taxes"].includes(normalizeTag(item.category))) score += 10;

  const publishedAt = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  if (publishedAt > 0) {
    const ageDays = Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60 * 24));
    if (ageDays <= 2) score += 15;
    else if (ageDays <= 7) score += 8;
    else if (ageDays <= 30) score += 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function applyItemFilters(items: ApiItem[], filter: FeedFilter) {
  const fromTs = filter.from ? new Date(filter.from).getTime() : null;
  const toTs = filter.to ? new Date(filter.to).getTime() : null;
  const topic = filter.topic ? normalizeTag(filter.topic) : null;

  return items.filter((item) => {
    if (filter.territory !== "WORLD") {
      const itemTerritory = normalizeTerritory(item.territory || item.zone || "");
      if (itemTerritory !== filter.territory) return false;
    }

    if (filter.officialOnly && !item.official) return false;

    if (topic) {
      const categoryTag = item.category ? normalizeTag(item.category) : "";
      const tags = item.tags.map(normalizeTag);
      const inTags = tags.includes(topic) || categoryTag === topic;
      if (!inTags) return false;
    }

    if (fromTs || toTs) {
      const publishedTs = item.publishedAt ? new Date(item.publishedAt).getTime() : null;
      if (!publishedTs || Number.isNaN(publishedTs)) return false;
      if (fromTs && publishedTs < fromTs) return false;
      if (toTs && publishedTs > toTs) return false;
    }

    return true;
  });
}

function dedupeSources(sources: RssSource[]) {
  const map = new Map<string, RssSource>();
  for (const source of sources) {
    if (!source?.url) continue;
    const key = source.url.trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, source);
  }
  return Array.from(map.values());
}

function countryNewsSource(territory: string): RssSource | null {
  if (!territory || territory === "WORLD") return null;
  const label = territoryLabel(territory);
  const query = `${label} export douane commerce international`;
  return {
    name: `Google News ${label}`,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`,
  };
}

function buildSourcesForTerritory(territory: string) {
  const countrySource = countryNewsSource(territory);
  const countrySpecific = territory === "WORLD" ? [] : (COUNTRY_SOURCES[territory] || []);
  const worldExtras = territory === "WORLD" ? WORLD_SOURCES : [];
  const combined = [
    ...PERMANENT_SOURCES,
    ...(countrySource ? [countrySource] : []),
    ...countrySpecific,
    ...worldExtras,
  ];
  return dedupeSources(combined);
}

function toUtcDate(value?: string | null) {
  try {
    if (!value) return new Date().toUTCString();
    const dt = new Date(value);
    if (isNaN(dt.getTime())) return new Date().toUTCString();
    return dt.toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

function stripHtml(html: string) {
  return (html || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractAttr(block: string, tag: string, attr: string) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*\\/?>(?:<\\/${tag}>)?`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() || "";
}

function extractFirstImgSrc(html: string) {
  const m = (html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.trim() || "";
}

function normalizeLink(link: string) {
  const l = (link || "").trim();
  if (!l) return "";
  return l.replace(/\s+/g, "");
}

function isAtom(xml: string) {
  return /<feed[\s>]/i.test(xml) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml);
}

function parseRssItems(xml: string) {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const b of blocks.slice(0, 50)) {
    const titleRaw = extractTag(b, "title");
    const linkRaw = extractTag(b, "link") || extractTag(b, "guid");
    const descRaw = extractTag(b, "description") || extractTag(b, "content:encoded");
    const pubRaw = extractTag(b, "pubDate") || extractTag(b, "dc:date");

    const mediaImg =
      extractAttr(b, "media:content", "url") ||
      extractAttr(b, "media:thumbnail", "url") ||
      extractAttr(b, "enclosure", "url");

    const imgFromDesc = extractFirstImgSrc(descRaw);

    const title = stripHtml(titleRaw) || "Sans titre";
    const link = normalizeLink(stripHtml(linkRaw)) || "";
    if (!link) continue;

    const summary = descRaw ? truncate(stripHtml(descRaw), 320) : null;
    const publishedAt = toIsoDate(stripHtml(pubRaw)) || null;

    items.push({
      title,
      link,
      description: summary,
      pubDate: publishedAt,
      imageUrl: mediaImg || imgFromDesc || null,
    });
  }

  return items;
}

function parseAtomItems(xml: string) {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const b of blocks.slice(0, 50)) {
    const titleRaw = extractTag(b, "title");
    const summaryRaw = extractTag(b, "summary") || extractTag(b, "content");
    const pubRaw = extractTag(b, "updated") || extractTag(b, "published");
    const linkHref = extractAttr(b, "link", "href");

    const mediaImg =
      extractAttr(b, "media:content", "url") ||
      extractAttr(b, "media:thumbnail", "url") ||
      extractAttr(b, "enclosure", "url");

    const imgFromSummary = extractFirstImgSrc(summaryRaw);

    const title = stripHtml(titleRaw) || "Sans titre";
    const link = normalizeLink(linkHref) || "";
    if (!link) continue;

    const summary = summaryRaw ? truncate(stripHtml(summaryRaw), 320) : null;
    const publishedAt = toIsoDate(stripHtml(pubRaw)) || null;

    items.push({
      title,
      link,
      description: summary,
      pubDate: publishedAt,
      imageUrl: mediaImg || imgFromSummary || null,
    });
  }

  return items;
}

function sortByPublishedDesc(items: ApiItem[]) {
  items.sort((a, b) => {
    const ad = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bd = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bd - ad;
  });
  return items;
}

async function fetchExternalItems(sources: RssSource[], limit: number, territory: string) {
  const controller = createAbortController();
  const timeout = setTimeout(() => controller?.abort?.(), 12_000);

  try {
    const fetched = await Promise.all(
      sources.map(async (src) => {
        try {
          const res = await fetch(src.url, {
            method: "GET",
            headers: {
              Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
              "User-Agent": RSS_USER_AGENT,
              "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            },
            signal: controller?.signal,
            redirect: "follow",
          });
          const text = await res.text();
          if (!res.ok || !text) return { items: [] as ApiItem[], failed: true };
          const parsed = isAtom(text) ? parseAtomItems(text) : parseRssItems(text);
          const zoneValue = territory === "WORLD" ? null : territory;
          const official = isOfficialSource(src.name, src.url);
          return {
            failed: false,
            items: parsed.map((it) => ({
              ...(inferCategoryAndTags(`${it.title} ${it.description || ""}`, src.name, null)),
              title: it.title,
              link: it.link,
              summary: it.description ?? null,
              publishedAt: it.pubDate ?? null,
              source: src.name,
              zone: zoneValue,
              territory: zoneValue,
              official,
              importance: 0,
              imageUrl: it.imageUrl ?? null,
            })) as ApiItem[],
          };
        } catch {
          return { items: [] as ApiItem[], failed: true };
        }
      })
    );

    const flat = fetched.flatMap((result) => result.items);
    const dedup = new Map<string, ApiItem>();
    for (const it of flat) if (!dedup.has(it.link)) dedup.set(it.link, it);

    const items = sortByPublishedDesc(Array.from(dedup.values())).slice(0, limit);
    const failedCount = fetched.reduce((acc, result) => acc + (result.failed ? 1 : 0), 0);
    return { items, failedCount };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRssXml(params: { title: string; link: string; description: string; items: FeedItem[] }) {
  const now = new Date().toUTCString();
  const itemsXml = params.items
    .map((it) => {
      const pubDate = toUtcDate(it.pubDate || null);
      const enclosure = it.imageUrl ? `<enclosure url="${escapeXml(it.imageUrl)}" type="image/jpeg" />` : "";
      return `
      <item>
        <title>${escapeXml(it.title)}</title>
        <link>${escapeXml(it.link)}</link>
        <guid isPermaLink="true">${escapeXml(it.link)}</guid>
        <pubDate>${escapeXml(pubDate)}</pubDate>
        ${it.source ? `<source>${escapeXml(it.source)}</source>` : ""}
        ${enclosure}
        ${it.description ? `<description>${escapeXml(it.description)}</description>` : ""}
      </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(params.title)}</title>
    <link>${escapeXml(params.link)}</link>
    <description>${escapeXml(params.description)}</description>
    <language>fr-FR</language>
    <lastBuildDate>${escapeXml(now)}</lastBuildDate>
    <pubDate>${escapeXml(now)}</pubDate>
    ${itemsXml}
  </channel>
</rss>`;
}

function mapRowToItem(row: any): ApiItem | null {
  if (!row) return null;

  const feed = Array.isArray(row.regulatory_feeds) ? row.regulatory_feeds[0] : row.regulatory_feeds;
  const feedEnabled = feed?.enabled ?? feed?.is_enabled;
  const feedPublic = feed?.is_public;
  if (feedEnabled === false || feedPublic === false) return null;

  const link = String(row.link || "").trim();
  if (!link) return null;

  const title = String(row.title || "").trim() || "Sans titre";
  const summary = row.summary ? truncate(String(row.summary), 320) : null;
  const publishedAt = toIsoDate(row.published_at) || toIsoDate(row.created_at);

  const source = (feed?.source_name || feed?.name || row.source || null) as string | null;
  const zone = (row.territory || feed?.territory || null) as string | null;
  const territory = zone;
  const category = (row.category || feed?.category || null) as string | null;
  const tags = Array.isArray(row.tags) ? row.tags : Array.isArray(feed?.tags) ? feed.tags : [];
  const official = isOfficialSource(source, feed?.source_url || null);

  const imageUrl = (row.image_url || row.imageUrl || feed?.logo_url || null) as string | null;
  return {
    title,
    link,
    summary,
    publishedAt,
    source,
    zone,
    territory,
    category,
    tags: tags.map((tag: unknown) => String(tag || "").trim()).filter(Boolean),
    official,
    importance: 0,
    imageUrl,
  };
}

function parseLimit(req: VercelRequest) {
  const n = Number(req.query?.limit);
  if (!Number.isFinite(n)) return 12;
  return Math.min(Math.max(Math.trunc(n), 1), 50);
}

function parseFilters(req: VercelRequest): FeedFilter {
  const territory = normalizeTerritory(String(req.query?.territory || req.query?.zone || "").trim());
  const topic = parseTopic(req.query?.topic || req.query?.category);
  const from = parseIsoDateOrNull(req.query?.from || req.query?.date_from);
  const to = parseIsoDateOrNull(req.query?.to || req.query?.date_to);
  const officialOnly = parseBoolLike(req.query?.official, true);

  return { territory, topic, from, to, officialOnly };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return;

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    // Proxy mode to bypass CORS for known RSS sources
    const proxyUrl = String(req.query?.url || "").trim();
    if (proxyUrl) {
      if (!isAllowedProxyUrl(proxyUrl)) {
        res.status(400).json({ ok: false, error: "URL not allowed" });
        return;
      }

      const controller = createAbortController();
      const timeout = setTimeout(() => controller?.abort?.(), 12_000);
      try {
        const upstream = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            "User-Agent": RSS_USER_AGENT,
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          },
          signal: controller?.signal,
          redirect: "follow",
        });
        const text = await upstream.text();
        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.status(upstream.ok ? 200 : 502).send(text);
        return;
      } catch (err: any) {
        res.status(502).json({ ok: false, error: err?.message || "fetch failed" });
        return;
      } finally {
        clearTimeout(timeout);
      }
    }

    const baseUrl = buildBaseUrl(req);
    const format = String(req.query?.format || "").toLowerCase();
    const accept = String(req.headers.accept || "").toLowerCase();
    const wantsXml = format === "xml" || accept.includes("application/rss+xml") || accept.includes("application/xml");

    const limit = parseLimit(req);
    const queryLimit = Math.min(limit * 4, 120);
    const filters = parseFilters(req);
    const sourcePlan = buildSourcesForTerritory(filters.territory);

    let dbItems: ApiItem[] = [];
    let items: ApiItem[] = [];
    let updatedAt: string | null = null;
    let degraded = false;

    try {
      const { supabaseAdmin } = await import("../src/server/supabaseAdmin.js");
      const admin = supabaseAdmin();

      let q = admin
        .from("regulatory_items")
        .select("id,title,summary,link,published_at,category,territory,tags,image_url,created_at, regulatory_feeds(name,source_name,source_url,logo_url,enabled,is_public,territory,category,tags)")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(queryLimit);

      if (filters.territory !== "WORLD") q = q.eq("territory", filters.territory);

      const { data, error } = await q;

      if (error) {
        console.error("[api/rss] supabase error:", error.message);
      }

      const mapped = (data || []).map(mapRowToItem).filter(Boolean) as ApiItem[];

      const dedup = new Map<string, ApiItem>();
      for (const it of mapped) if (!dedup.has(it.link)) dedup.set(it.link, it);

      dbItems = sortByPublishedDesc(Array.from(dedup.values())).slice(0, queryLimit);
    } catch (err: any) {
      degraded = true;
      console.error("[api/rss] supabase init error:", err?.message || String(err));
    }

    let external = await fetchExternalItems(sourcePlan, queryLimit, filters.territory);
    if (!external.items.length && filters.territory !== "WORLD") {
      const worldFallback = await fetchExternalItems(buildSourcesForTerritory("WORLD"), queryLimit, "WORLD");
      if (worldFallback.items.length) {
        external = worldFallback;
        degraded = true;
      }
    }

    if (external.failedCount > 0) {
      degraded = true;
    }

    const merged = new Map<string, ApiItem>();
    for (const it of dbItems) {
      if (!merged.has(it.link)) merged.set(it.link, it);
    }
    for (const it of external.items) {
      if (!merged.has(it.link)) merged.set(it.link, it);
    }

    const enriched = Array.from(merged.values()).map((item) => {
      const inferred = inferCategoryAndTags(`${item.title} ${item.summary || ""}`, item.source, item.category);
      const territory = item.territory || item.zone || null;
      const official = item.official || isOfficialSource(item.source, item.link);
      const mergedItem: ApiItem = {
        ...item,
        category: item.category || inferred.category,
        tags: Array.from(new Set([...(item.tags || []), ...inferred.tags])).slice(0, 10),
        territory,
        zone: territory,
        official,
        importance: 0,
      };
      return {
        ...mergedItem,
        importance: computeImportance(mergedItem),
      };
    });

    let filteredItems = applyItemFilters(sortByPublishedDesc(enriched), filters);
    let officialFallbackUsed = false;
    if (!filteredItems.length && filters.territory !== "WORLD" && filters.officialOnly) {
      filteredItems = applyItemFilters(sortByPublishedDesc(enriched), {
        ...filters,
        officialOnly: false,
      });
      officialFallbackUsed = true;
      degraded = true;
    }

    items = filteredItems.slice(0, limit);
    updatedAt = items[0]?.publishedAt || null;

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    if (wantsXml) {
      const xml = buildRssXml({
        title: "ExportFranceFacile - Veille Export (RSS)",
        link: `${baseUrl}/veille`,
        description: "Mises a jour, signaux faibles, conformite et points de vigilance export.",
        items: items.map((it) => ({
          title: it.title,
          link: it.link,
          description: it.summary,
          pubDate: it.publishedAt,
          source: it.source,
          imageUrl: it.imageUrl,
        })),
      });

      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.status(200).send(xml);
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({
      ok: true,
      degraded,
      territory: filters.territory,
      topic: filters.topic,
      from: filters.from,
      to: filters.to,
      official_only: filters.officialOnly,
      official_fallback_used: officialFallbackUsed,
      updatedAt,
      items,
      sources: sourcePlan.map((source) => source.name),
      pinned: PERMANENT_SOURCES.map((source) => source.name),
    });
  } catch (err: any) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({
      ok: true,
      degraded: true,
      updatedAt: null,
      items: [],
    });
  }
}

export const config = { runtime: "nodejs" };


```

## package.json
`$ext
{
  "name": "vite_react_shadcn_ts",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "test:smoke": "node scripts/smoke-routing.mjs",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.app.json --noEmit",
    "seed:export-expert": "node scripts/seed-export-expert.mjs",
    "preview": "vite preview",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron electron/main.js\"",
    "electron:build": "vite build --mode electron && npx electron-builder --win --config electron-builder.config.js"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-aspect-ratio": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.2",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-context-menu": "^2.2.15",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-hover-card": "^1.1.14",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-menubar": "^1.1.15",
    "@radix-ui/react-navigation-menu": "^1.2.13",
    "@radix-ui/react-popover": "^1.1.14",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.7",
    "@radix-ui/react-scroll-area": "^1.2.9",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.5",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/react-toggle": "^1.1.9",
    "@radix-ui/react-toggle-group": "^1.1.10",
    "@radix-ui/react-tooltip": "^1.2.7",
    "@supabase/supabase-js": "^2.88.0",
    "@tanstack/react-query": "^5.83.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "concurrently": "^9.2.1",
    "d3-geo": "^3.1.0",
    "date-fns": "^3.6.0",
    "electron": "^39.2.7",
    "electron-builder": "^26.0.12",
    "electron-squirrel-startup": "^1.0.1",
    "embla-carousel-react": "^8.6.0",
    "framer-motion": "^11.11.17",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.462.0",
    "next-themes": "^0.3.0",
    "nodemailer": "^6.9.13",
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^4.10.38",
    "react": "^18.3.1",
    "react-d3-tree": "^3.6.2",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.61.1",
    "react-resizable-panels": "^2.1.9",
    "react-router-dom": "^6.30.1",
    "recharts": "^2.15.4",
    "sonner": "^1.7.4",
    "stripe": "^15.12.0",
    "svg-pan-zoom": "^3.6.2",
    "svgmap": "^2.18.1",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "vaul": "^0.9.9",
    "wait-on": "^9.0.3",
    "xlsx": "^0.18.5",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@tailwindcss/typography": "^0.5.16",
    "@types/node": "^22.16.5",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vercel/node": "^3.2.17",
    "@vitejs/plugin-react-swc": "^3.11.0",
    "autoprefixer": "^10.4.21",
    "eslint": "^9.32.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^15.15.0",
    "lovable-tagger": "^1.1.13",
    "postcss": "^8.5.6",
    "supabase": "^2.76.7",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.38.0",
    "vite": "^5.4.19"
  }
}

```

## scripts/smoke-routing.mjs
`$ext
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertIncludes(content, needle, context) {
  if (!content.includes(needle)) {
    throw new Error(`Missing "${needle}" in ${context}`);
  }
}

function main() {
  const app = read("src/App.tsx");
  const controlTower = read("src/pages/ControlTower.tsx");
  const copilote = read("src/pages/Copilote.tsx");

  const requiredRoutes = [
    '/app/control-tower',
    '/app/centre-veille/reglementation',
    '/app/simulator',
    '/app/invoice-check',
    '/app/assistant',
  ];

  for (const route of requiredRoutes) {
    assertIncludes(app, route, "src/App.tsx");
  }

  assertIncludes(controlTower, "PanoramicControlTowerMap", "src/pages/ControlTower.tsx");
  assertIncludes(controlTower, "RssFooter", "src/pages/ControlTower.tsx");

  assertIncludes(copilote, 'fetch("/api/chat"', "src/pages/Copilote.tsx");
  assertIncludes(copilote, "buildAssistantBlocks", "src/pages/Copilote.tsx");

  console.log("smoke-routing: ok");
}

try {
  main();
} catch (error) {
  console.error("smoke-routing: failed");
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}

```

## src/App.tsx
`$ext
import * as React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";
import { PlanProvider } from "@/auth/PlanContext";
import { RequirePlan } from "@/components/RequirePlan";
import { CompanyProfileGuard } from "@/components/CompanyProfileGuard";
import { CookieConsent } from "@/components/CookieConsent";
import { LanguageChooser } from "@/components/LanguageChooser";
import { EnvMissingBanner } from "@/components/EnvMissingBanner";

import Home from "@/pages/Home";
import ServicesPage from "@/pages/Services";
import AboutPage from "@/pages/About";
import ShareDecision from "@/pages/ShareDecision";
import Methodologie from "@/pages/Methodologie";
import Guide from "@/pages/Guide";
import Incoterms from "@/pages/Incoterms";
import IncotermDetail from "@/pages/IncotermDetail";
import InfoParameter from "@/pages/InfoParameter";
import WatchCenter from "@/pages/WatchCenter";
import WatchRegulatory from "@/pages/WatchRegulatory";
import WatchCommercial from "@/pages/WatchCommercial";
import InvoiceCheck from "@/pages/InvoiceCheck";
import Newsletter from "@/pages/Newsletter";
import HeroVideoPreview from "@/pages/HeroVideoPreview";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Welcome from "@/pages/Welcome";
import SetPassword from "@/pages/SetPassword";
import ControlTower from "@/pages/ControlTower";
import ExportSimulator from "@/pages/ExportSimulator";
import Simulator from "@/pages/Simulator";
import Sales from "@/pages/Sales";
import InvoiceDetail from "@/pages/InvoiceDetail";
import Admin from "@/pages/Admin";
import Assistant from "@/pages/Assistant";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Solutions from "@/pages/Solutions";
import Resources from "@/pages/Resources";
import Contact from "@/pages/Contact";
import AuditInterne from "@/pages/Compliance";
import InternalResources from "@/pages/InternalResources";
import ExportToFrance from "@/pages/ExportToFrance";
import BillingSuccess from "@/pages/BillingSuccess";
import Account from "@/pages/Account";
import Pricing from "@/pages/Pricing";
import HistoryPage from "@/pages/History";
import ImportCheckInvoice from "@/pages/ImportCheckInvoice";
import PublicAppGate from "@/pages/PublicAppGate";
import VipRentability from "@/pages/VipRentability";
import Legal from "@/pages/Legal";
import AdminKbDocs from "@/pages/AdminKbDocs";
import AdminData from "@/pages/AdminData";
import TaxesOm from "@/pages/TaxesOm";
import Prospection from "@/pages/Prospection";
import Copilote from "@/pages/Copilote";
import TourDeControle from "@/pages/TourDeControle";
import ControlTowerWizard from "@/pages/ControlTowerWizard";

const queryClient = new QueryClient();
const LazyFallback = () => <div className="p-6 text-sm text-muted-foreground">Chargementâ€¦</div>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ThemeProvider defaultTheme="light" storageKey="mpl-ui-theme">
            <Toaster />
            <Sonner />

            <PlanProvider>
              <LanguageProvider persist="local">
                <CookieConsent />
                <BrowserRouter>
                  <EnvMissingBanner />
                  <LanguageChooser />
                  <CompanyProfileGuard />
                  <GlobalFiltersProvider>
                    <React.Suspense fallback={<LazyFallback />}>
                      <Routes>
                        {/* ===================== Marketing / Public ===================== */}
                        <Route path="/" element={<Home />} />
                        <Route path="/copilote" element={<Copilote />} />
                        <Route path="/control-tower" element={<ControlTowerWizard />} />

                        {/* âœ… Outils publics => accÃ¨s app uniquement */}
                        <Route path="/verifier-facture" element={<PublicAppGate mode="invoice-check" />} />
                        <Route path="/tool" element={<Navigate to="/verifier-facture" replace />} />

                        <Route path="/services" element={<ServicesPage />} />
                        <Route path="/conseil-audit-export" element={<Navigate to="/services" replace />} />

                        {/* âœ… EN/legacy marketing (Watch supprimÃ©e => redirect) */}
                        <Route path="/watch" element={<Navigate to="/veille" replace />} />
                        {/* âœ… FR canonique */}
                        <Route path="/veille" element={<PublicAppGate mode="watch" />} />

                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/prospection" element={<Prospection />} />

                        {/* âœ… pages publiques */}
                        <Route path="/analyse" element={<PublicAppGate mode="analyse" />} />
                        <Route path="/share/:id" element={<ShareDecision />} />
                        <Route path="/methodologie" element={<Methodologie />} />

                        {/* âœ… guides */}
                        <Route path="/guides" element={<Navigate to="/resources" replace />} />
                        <Route path="/guides/incoterms" element={<Incoterms />} />
                        <Route path="/guides/incoterms-:code" element={<IncotermDetail />} />
                        <Route path="/guides/:slug" element={<Guide />} />
                        <Route path="/infos/:slug" element={<InfoParameter />} />

                        <Route path="/solutions" element={<Solutions />} />
                        <Route path="/resources" element={<Resources />} />
                        <Route path="/tarifs" element={<Navigate to="/pricing" replace />} />

                        <Route path="/contact" element={<Contact />} />
                        <Route path="/billing/success" element={<BillingSuccess />} />
                        <Route path="/export-to-france" element={<ExportToFrance />} />
                        <Route path="/newsletter" element={<Newsletter />} />
                        <Route path="/debug/hero-video" element={<HeroVideoPreview />} />

                        {/* âœ… outil gratuit (public) */}
                        <Route path="/export/costing" element={<PublicAppGate mode="costing" />} />

                        {/* ===================== PRO/VIP (derriÃ¨re login) ===================== */}
                        <Route
                          path="/history"
                          element={
                            <ProtectedRoute>
                              <RequirePlan minPlan="PRO_ONLINE">
                                <HistoryPage />
                              </RequirePlan>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/import/check-invoice"
                          element={
                            <ProtectedRoute>
                              <RequirePlan minPlan="PRO_VISIO">
                                <ImportCheckInvoice />
                              </RequirePlan>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/vip/rentability"
                          element={
                            <ProtectedRoute>
                              <RequirePlan minPlan="PILOTAGE_HEBDO">
                                <VipRentability />
                              </RequirePlan>
                            </ProtectedRoute>
                          }
                        />

                        {/* ===================== Legal ===================== */}
                        <Route path="/legal/:slug" element={<Legal />} />
                        <Route path="/mentions-legales" element={<Navigate to="/legal/mentions-legales" replace />} />
                        <Route path="/confidentialite" element={<Navigate to="/legal/confidentialite" replace />} />
                        <Route path="/cookies" element={<Navigate to="/legal/cookies" replace />} />
                        <Route path="/cgu" element={<Navigate to="/legal/cgu" replace />} />
                        <Route path="/cgv" element={<Navigate to="/legal/cgv" replace />} />

                        {/* ===================== Auth ===================== */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/set-password" element={<SetPassword />} />

                        <Route
                          path="/account"
                          element={
                            <ProtectedRoute>
                              <Account />
                            </ProtectedRoute>
                          }
                        />

                        {/* ===================== App (privÃ©) ===================== */}
                        <Route
                          path="/tour-de-controle"
                          element={
                            <ProtectedRoute>
                              <TourDeControle />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/control-tower"
                          element={
                            <ProtectedRoute>
                              <ControlTower />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/app/command-center" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/app" element={<Navigate to="/app/control-tower" replace />} />

                        <Route
                          path="/app/explore"
                          element={
                            <ProtectedRoute>
                              <Sales />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/invoices/:invoiceNumber"
                          element={
                            <ProtectedRoute>
                              <InvoiceDetail />
                            </ProtectedRoute>
                          }
                        />

                        {/* âœ… Anciennes routes taxes (legacy) => redirection */}
                        <Route
                          path="/app/droits-taxes"
                          element={
                            <ProtectedRoute>
                              <TaxesOm />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/taxes-om"
                          element={
                            <ProtectedRoute>
                              <TaxesOm />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/taxes"
                          element={
                            <ProtectedRoute>
                              <Navigate to="/app/taxes-om" replace />
                            </ProtectedRoute>
                          }
                        />

                        {/* âœ… simulateur */}
                        <Route
                          path="/app/simulator"
                          element={
                            <ProtectedRoute>
                              <ExportSimulator />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/simulator-legacy"
                          element={
                            <ProtectedRoute>
                              <Simulator />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/centre-veille"
                          element={
                            <ProtectedRoute>
                              <WatchCenter />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/centre-veille/reglementation"
                          element={
                            <ProtectedRoute>
                              <WatchRegulatory />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/centre-veille/secteurs"
                          element={
                            <ProtectedRoute>
                              <WatchCommercial />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/app/centre-veille/concurrence" element={<Navigate to="/app/centre-veille/secteurs" replace />} />

                        <Route
                          path="/app/produits"
                          element={
                            <ProtectedRoute>
                              <Navigate to="/app/taxes-om" replace />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/assistant"
                          element={
                            <ProtectedRoute>
                              <Assistant />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/expert"
                          element={
                            <ProtectedRoute>
                              <Assistant />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/invoice-check"
                          element={
                            <ProtectedRoute>
                              <InvoiceCheck />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/audit-interne"
                          element={
                            <ProtectedRoute>
                              <AuditInterne />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/compliance"
                          element={
                            <ProtectedRoute>
                              <Navigate to="/app/audit-interne" replace />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/admin"
                          element={
                            <ProtectedRoute>
                              <Admin />
                            </ProtectedRoute>
                          }
                        />

                        {/* âœ… NOUVEAU : gestion PDFs (privÃ©) */}
                        <Route
                          path="/app/admin/data"
                          element={
                            <ProtectedRoute>
                              <AdminData />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/admin/kb-docs"
                          element={
                            <ProtectedRoute>
                              <AdminKbDocs />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/settings"
                          element={
                            <ProtectedRoute>
                              <Settings />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/internal/resources"
                          element={
                            <ProtectedRoute>
                              <InternalResources />
                            </ProtectedRoute>
                          }
                        />

                        {/* ===================== Aliases / Legacy ===================== */}
                        <Route path="/welcome" element={<Welcome />} />
                        <Route path="/ressources" element={<Navigate to="/resources" replace />} />

                        <Route path="/hub" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/command-center" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/dashboard" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/explore" element={<Navigate to="/app/explore" replace />} />
                        <Route path="/sales" element={<Navigate to="/app/explore" replace />} />

                        <Route path="/taxes-om" element={<Navigate to="/app/taxes-om" replace />} />
                        <Route path="/taxes" element={<Navigate to="/app/taxes-om" replace />} />

                        <Route path="/simulator" element={<Navigate to="/app/simulator" replace />} />
                        <Route path="/watch/regulatory" element={<Navigate to="/app/centre-veille/reglementation" replace />} />

                        <Route path="/watch/commercial" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                        <Route path="/watch/competitive" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                        <Route path="/competition" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                        <Route path="/concurrence" element={<Navigate to="/app/centre-veille/secteurs" replace />} />

                        <Route path="/products" element={<Navigate to="/app/produits" replace />} />
                        <Route path="/invoice-check" element={<Navigate to="/app/invoice-check" replace />} />
                        <Route path="/assistant" element={<Navigate to="/app/assistant" replace />} />
                        <Route path="/expert" element={<Navigate to="/app/expert" replace />} />
                        <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
                        <Route path="/app/centre-conformite" element={<Navigate to="/app/audit-interne" replace />} />
                        <Route path="/app/controls" element={<Navigate to="/app/audit-interne" replace />} />
                        <Route path="/app/sanctions" element={<Navigate to="/app/audit-interne" replace />} />
                        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </React.Suspense>
                  </GlobalFiltersProvider>
                </BrowserRouter>
              </LanguageProvider>
            </PlanProvider>
          </ThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

```

## src/components/controlTower/PanoramicControlTowerMap.tsx
`$ext
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MapStats = {
  alerts?: number;
  updates?: number;
  total?: number;
};

type CountryStats = MapStats & {
  label?: string;
};

type SvgCountry = {
  iso: string;
  name: string;
  d: string;
};

type Props = {
  /** ISO2 (ex: "FR") */
  selectedCountry?: string | null;
  /** LibellÃ© affichÃ© dans le badge (si tu veux forcer un nom) */
  selectedLabel?: string;

  /**
   * Stats agrÃ©gÃ©es pour la sÃ©lection courante (optionnel).
   * Si tu filtres dÃ©jÃ  cÃ´tÃ© parent, tu peux continuer Ã  passer ce props.
   */
  stats?: MapStats;

  /**
   * Stats par pays (optionnel) :
   * - active un rendu "choroplÃ¨the" (intensitÃ©)
   * - enrichit le tooltip (alertes / updates / total)
   */
  countryStats?: Record<string, CountryStats>;

  /**
   * URL du SVG Ã  charger.
   * âš ï¸ Place `world-map.svg` dans `/public/world-map.svg` pour garder la valeur par dÃ©faut.
   */
  svgUrl?: string;

  onCountrySelect: (iso: string) => void;
  onReset?: () => void;
};

function safeNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function statValue(s?: MapStats) {
  if (!s) return 0;
  const total = safeNumber(s.total);
  if (total > 0) return total;
  return safeNumber(s.alerts) + safeNumber(s.updates);
}

function isIso2(id: string) {
  return /^[A-Z]{2}$/.test(id);
}

export function PanoramicControlTowerMap({
  selectedCountry,
  selectedLabel,
  stats,
  countryStats,
  svgUrl = "/world-map.svg",
  onCountrySelect,
  onReset,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [countries, setCountries] = React.useState<SvgCountry[]>([]);
  const [viewBox, setViewBox] = React.useState<string>("0 0 1000 360");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [tooltip, setTooltip] = React.useState<{
    iso: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);

  const [hoverIso, setHoverIso] = React.useState<string | null>(null);

  // --- Load & parse SVG (dynamic map)
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(svgUrl, { cache: "force-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        if (cancelled) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");

        const widthAttr = svg?.getAttribute("width") ?? "1000";
        const heightAttr = svg?.getAttribute("height") ?? "360";
        const width = Number.parseFloat(widthAttr) || 1000;
        const height = Number.parseFloat(heightAttr) || 360;

        const vb = svg?.getAttribute("viewBox") ?? `0 0 ${width} ${height}`;
        setViewBox(vb);

        const pathNodes = Array.from(doc.querySelectorAll("path[id]"));
        const parsed = pathNodes
          .map((p) => {
            const iso = (p.getAttribute("id") ?? "").trim().toUpperCase();
            const d = (p.getAttribute("d") ?? "").trim();
            const name =
              (p.getAttribute("title") ??
                p.getAttribute("name") ??
                iso ??
                "Pays")?.trim() || iso;

            return { iso, name, d };
          })
          .filter((c) => c.iso && c.d && isIso2(c.iso));

        // petit tri pour stabilitÃ© (utile au diff / rendu)
        parsed.sort((a, b) => a.iso.localeCompare(b.iso));

        setCountries(parsed);
      } catch (e) {
        if (cancelled) return;
        setError(
          `Impossible de charger la carte (${svgUrl}). VÃ©rifie que world-map.svg est bien dans /public (ou passe svgUrl).`
        );
        setCountries([]);
        setViewBox("0 0 1000 360");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [svgUrl]);

  // --- Resolve label & stats (badge header)
  const resolvedLabel = React.useMemo(() => {
    if (selectedLabel) return selectedLabel;
    if (!selectedCountry) return "Tous";
    const fromList = countries.find((c) => c.iso === selectedCountry)?.name;
    const fromStats = countryStats?.[selectedCountry]?.label;
    return fromList || fromStats || selectedCountry;
  }, [selectedLabel, selectedCountry, countries, countryStats]);

  const resolvedStats = React.useMemo<MapStats>(() => {
    if (stats) return stats;
    if (selectedCountry && countryStats?.[selectedCountry]) return countryStats[selectedCountry];
    return { alerts: 0, updates: 0, total: 0 };
  }, [stats, selectedCountry, countryStats]);

  const alerts = safeNumber(resolvedStats.alerts);
  const updates = safeNumber(resolvedStats.updates);
  const total = safeNumber(resolvedStats.total) || alerts + updates;

  // --- Choropleth scale (optional)
  const maxValue = React.useMemo(() => {
    if (!countryStats) return 0;
    let m = 0;
    for (const v of Object.values(countryStats)) m = Math.max(m, statValue(v));
    return m;
  }, [countryStats]);

  const getFill = React.useCallback(
    (iso: string, active: boolean, hovered: boolean) => {
      // PrioritÃ© : actif > hover > intensitÃ© > dÃ©faut
      if (active) return "rgba(56,189,248,0.85)"; // sky
      if (hovered) return "rgba(56,189,248,0.55)";

      if (countryStats && maxValue > 0) {
        const v = statValue(countryStats[iso]);
        if (v <= 0) return "rgba(148,163,184,0.28)";

        // alpha entre 0.28 et 0.72 selon l'intensitÃ©
        const t = Math.min(1, Math.max(0, v / maxValue));
        const alpha = 0.28 + t * 0.44;
        return `rgba(56,189,248,${alpha.toFixed(3)})`;
      }

      return "rgba(148,163,184,0.35)";
    },
    [countryStats, maxValue]
  );

  // --- Tooltip positioning helpers
  const getPoint = (evt: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const handleEnter = (
    evt: React.MouseEvent<SVGPathElement, MouseEvent>,
    country: SvgCountry
  ) => {
    const point = getPoint(evt);
    setHoverIso(country.iso);
    setTooltip({ iso: country.iso, name: country.name, x: point.x, y: point.y });
  };

  const handleMove = (evt: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    setTooltip((prev) => {
      if (!prev) return prev;
      const point = getPoint(evt);
      return { ...prev, x: point.x, y: point.y };
    });
  };

  const handleLeave = () => {
    setHoverIso(null);
    setTooltip(null);
  };

  const handleFocus = (evt: React.FocusEvent<SVGPathElement>, country: SvgCountry) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = evt.currentTarget.getBoundingClientRect();
    const x = target.left - rect.left + target.width / 2;
    const y = target.top - rect.top;
    setHoverIso(country.iso);
    setTooltip({ iso: country.iso, name: country.name, x, y });
  };

  const tipStats = tooltip ? countryStats?.[tooltip.iso] : undefined;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Carte export</h2>
          <p className="text-sm text-slate-600">
            Survolez pour voir le dÃ©tail, cliquez un pays pour filtrer la veille.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Pays sÃ©lectionnÃ© : {resolvedLabel}</Badge>
          <Badge variant="secondary">Alertes : {alerts}</Badge>
          <Badge variant="secondary">Mises Ã  jour : {updates}</Badge>
          <Badge variant="secondary">Total : {total}</Badge>

          {onReset ? (
            <Button size="sm" variant="outline" onClick={onReset}>
              RÃ©initialiser filtre
            </Button>
          ) : null}
        </div>
      </div>

      <div className="svgMap-container">
        <div
          ref={containerRef}
          className="relative svgMap-map-wrapper svgMap-panorama overflow-hidden border border-slate-800/30 shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
        >
          {/* Fallback / loading */}
          {loading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow">
                Chargement de la carteâ€¦
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/60 backdrop-blur-sm">
              <div className="max-w-[560px] rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700 shadow">
                {error}
              </div>
            </div>
          ) : null}

          <svg
            className="svgMap-map-image h-auto w-full"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Carte monde interactive"
            onClick={(evt) => {
              // clic "dans le vide" => reset (si dispo)
              if (!onReset) return;
              if (evt.target === evt.currentTarget) onReset();
            }}
            style={{
              // fallback si ton CSS svgMap utilise la variable
              ["--svg-map-country-fill" as string]: "rgba(148,163,184,0.35)",
            }}
          >
            {/* fond transparent */}
            <rect x="0" y="0" width="100%" height="100%" fill="transparent" pointerEvents="none" />

            {/* Pays (chargÃ©s dynamiquement depuis world-map.svg) */}
            <g aria-label="Pays">
              {countries.map((country) => {
                const active = !!selectedCountry && selectedCountry === country.iso;
                const hovered = hoverIso === country.iso;
                const fill = getFill(country.iso, active, hovered);

                return (
                  <path
                    key={country.iso}
                    d={country.d}
                    data-iso={country.iso}
                    aria-label={country.name}
                    role="button"
                    aria-pressed={active}
                    tabIndex={0}
                    className={`svgMap-country${active ? " svgMap-active" : ""}`}
                    style={{
                      fill,
                      stroke: "rgba(15,23,42,0.28)",
                      strokeWidth: 0.6,
                      vectorEffect: "non-scaling-stroke",
                      cursor: "pointer",
                      outline: "none",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCountrySelect(country.iso);
                    }}
                    onMouseEnter={(evt) => handleEnter(evt, country)}
                    onMouseMove={handleMove}
                    onMouseLeave={handleLeave}
                    onFocus={(evt) => handleFocus(evt, country)}
                    onBlur={handleLeave}
                    onKeyDown={(evt) => {
                      if (evt.key === "Enter" || evt.key === " ") {
                        evt.preventDefault();
                        onCountrySelect(country.iso);
                      }
                      if (evt.key === "Escape") {
                        onReset?.();
                      }
                    }}
                  />
                );
              })}
            </g>
          </svg>

          {/* halo/gradient overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(244,63,94,0.12),transparent_40%)]" />

          {/* Tooltip */}
          {tooltip ? (
            <div
              className="svgMap-tooltip svgMap-active pointer-events-none absolute z-20"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: "translate(10px, -10px)",
              }}
            >
              <div className="svgMap-tooltip-content-container rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow">
                <div className="svgMap-tooltip-title text-sm font-semibold text-slate-900">
                  {tooltip.name}
                </div>

                <div className="svgMap-tooltip-content mt-1 text-slate-700">
                  Code : <span className="font-mono">{tooltip.iso}</span>
                </div>

                {tipStats ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-slate-50 px-2 py-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Alertes</div>
                      <div className="font-semibold text-slate-900">
                        {safeNumber(tipStats.alerts)}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Updates</div>
                      <div className="font-semibold text-slate-900">
                        {safeNumber(tipStats.updates)}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Total</div>
                      <div className="font-semibold text-slate-900">
                        {safeNumber(tipStats.total) || safeNumber(tipStats.alerts) + safeNumber(tipStats.updates)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* petit triangle */}
              <div
                className="svgMap-tooltip-pointer"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                  borderTop: "10px solid rgba(255,255,255,0.95)",
                  marginLeft: 12,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}


```

## src/components/EnvMissingBanner.tsx
`$ext
import { AlertTriangle } from "lucide-react";

import { DEMO_MODE } from "@/integrations/supabase/client";

export function EnvMissingBanner() {
  if (!DEMO_MODE) return null;

  return (
    <div className="sticky top-0 z-[120] border-b border-amber-300 bg-amber-100/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[90rem] items-center gap-2 px-4 py-2 text-xs text-amber-900 md:px-6">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Mode DEMO actif: variables Supabase manquantes. Certaines fonctions serveur peuvent etre indisponibles.
        </span>
      </div>
    </div>
  );
}

```

## src/components/layout/MainLayout.tsx
`$ext
import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, FileCheck2, Bot, LogOut, Newspaper, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/auth/PlanContext";
import { isAdminUser } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "../BrandLogo";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import { TricolorBanner } from "@/components/layout/TricolorBanner";
import { getBannerContent } from "@/config/bannerContent";
import SupportChatWidget from "@/components/support/SupportChatWidget";
import { matchAppNavItem } from "@/config/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/LanguageContext";

interface MainLayoutProps {
  children: React.ReactNode;
  contentClassName?: string;
  wrapperClassName?: string;
  variant?: "default" | "bare";
  backdropVariant?: "public" | "app";
}

export function MainLayout({
  children,
  contentClassName,
  wrapperClassName,
  variant = "default",
  backdropVariant = "public",
}: MainLayoutProps) {
  const { signOut, user } = useAuth();
  const { lang } = useI18n();
  const { plan } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const banner = getBannerContent(location.pathname);
  const activeNavItem = matchAppNavItem(location.pathname);
  const showAutoPageHeader = variant !== "bare" && location.pathname.startsWith("/app/") && Boolean(activeNavItem);
  const [supportReady, setSupportReady] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);

  // Search UX: tu pourras le brancher a un contexte global plus tard (GlobalFiltersContext)
  const [q, setQ] = React.useState("");

  const showSidebar = variant !== "bare";
  const displayName =
    (user?.user_metadata?.company_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Compte";
  const planLabel = plan === "FREE" ? "Free" : plan.replace(/_/g, " ");
  const isAdmin = isAdminUser(user);

  React.useEffect(() => {
    const handler = () => {
      setSupportReady(true);
      setSupportOpen(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("support-widget:open", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("support-widget:open", handler as EventListener);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "min-h-screen bg-[hsl(var(--background))] text-foreground relative overflow-hidden",
        wrapperClassName
      )}
    >
      <CinematicBackdrop
        variant={backdropVariant}
        className={cn("z-0", backdropVariant === "app" ? "opacity-45" : "opacity-20")}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-0",
          backdropVariant === "app"
            ? "bg-gradient-to-br from-[#f8efe2]/70 via-[#f6edde]/80 to-[#f3e7d6]/78"
            : "bg-gradient-to-b from-white/85 via-white/90 to-white"
        )}
      />

      {showSidebar ? <Sidebar /> : null}

      <main className={cn("relative z-10", showSidebar ? "pl-64" : "")}>
        <header className="sticky top-0 z-20 border-b border-[#d6c8b2] bg-[#eadfce]/92 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
            {/* Row 1 */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <BrandLogo
                  size="md"
                  href="/app/control-tower"
                  className="hidden sm:flex min-w-0"
                  textClassName="min-w-0"
                  titleClassName="text-foreground"
                  subtitleClassName="text-muted-foreground"
                  locationClassName="text-muted-foreground/90"
                />
                <BrandLogo
                  size="sm"
                  href="/app/control-tower"
                  className="sm:hidden min-w-0"
                  textClassName="min-w-0"
                  imageClassName="drop-shadow-sm"
                  titleClassName="text-foreground"
                  subtitleClassName="text-muted-foreground"
                  locationClassName="text-muted-foreground/90"
                />

                {/* Search */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // simple: on redirige vers l'analyse avec la query
                        // adapte si tu as deja une page /search
                        navigate(`/app/simulator?q=${encodeURIComponent(q.trim())}`);
                      }
                    }}
                    placeholder="Rechercher client, facture, HS code, pays..."
                    className="pl-9 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground rounded-xl shadow-inner"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                <div className="flex items-center gap-2 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm">
                  <span className="truncate max-w-[150px]">{displayName}</span>
                  <Badge variant="outline" className="border-[#cdbda4] text-slate-900 text-[10px]">
                    Plan {planLabel}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Row 2: CTA actions */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Link
                to="/app/centre-veille/reglementation"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                title="Veille reglementaire et marches (RSS & sources)"
              >
                <Newspaper className="h-4 w-4" />
                Veille
              </Link>

              <Link
                to="/app/simulator"
                className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground border border-border hover:shadow-md hover:-translate-y-0.5 transition shrink-0"
                title="Calcul du prix de revient et aide a la decision"
              >
                <Calculator className="h-4 w-4" />
                Analyse couts
              </Link>

              <Link
                to="/app/assistant"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                title="Assistant IA export (conformite, docs, incoterms)"
              >
                <Bot className="h-4 w-4" />
                IA Export
              </Link>

              <Link
                to="/app/invoice-check"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 border border-primary/40 hover:shadow-primary/40 hover:-translate-y-0.5 transition shrink-0"
                title="Controle coherence facture (Incoterm, TVA, OM si applicable, etc.)"
              >
                <FileCheck2 className="h-4 w-4" />
                Controler une facture
              </Link>

              {isAdmin ? (
                <Link
                  to="/app/admin"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                  title="Administration"
                >
                  Admin
                </Link>
              ) : null}

              <button
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition shrink-0"
                title="Se deconnecter"
              >
                <LogOut className="h-4 w-4" />
                Deconnexion
              </button>
            </div>
          </div>

          <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
        </header>

        <div className={cn("p-4 md:p-10", contentClassName)}>
          <div className="mb-4">
            <TricolorBanner title={banner.title} question={banner.question} />
          </div>
          {showAutoPageHeader && activeNavItem ? (
            <PageHeader
              className="mb-4"
              title={activeNavItem.labels[lang]}
              subtitle={activeNavItem.descriptions?.[lang]}
            />
          ) : null}
          {variant === "bare" ? (
            <div className="space-y-4">{children}</div>
          ) : (
            <div className="rounded-2xl bg-card/95 border border-border shadow-xl shadow-black/10">
              <div className="p-4 md:p-8 space-y-4">{children}</div>
            </div>
          )}
        </div>
      </main>

      {supportReady ? (
        <SupportChatWidget open={supportOpen} onOpenChange={setSupportOpen} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setSupportReady(true);
            setSupportOpen(true);
          }}
          className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a]"
          aria-label="Ouvrir ton conseiller export"
        >
          Ton conseiller export
        </button>
      )}
    </div>
  );
}


```

## src/components/layout/PageHeader.tsx
`$ext
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <section className={className}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

```

## src/components/layout/PublicLayout.tsx
`$ext
import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import { TricolorBanner } from "@/components/layout/TricolorBanner";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { LanguageCode } from "@/i18n/translations";
import { footerNav, isPathActive, publicNav } from "@/config/navigation";
import { getBannerContent } from "@/config/bannerContent";
import SupportChatWidget from "@/components/support/SupportChatWidget";

type PublicLayoutProps = {
  children?: React.ReactNode;
  hideBanner?: boolean;
  hideFooter?: boolean;
};

const flags: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7),
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7),
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function FooterSocial() {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const links = [
    { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61587254986176", icon: "/facebook.svg" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UCxRRjAnotPJahv9SzaPJsAw", icon: "/youtube.svg" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/mpl-conseil-export/?viewAsMember=true", icon: "/linkedin.svg" },
  ];

  return (
    <div className="rounded-3xl border border-slate-700/70 bg-[#081225]/78 p-6 shadow-xl shadow-black/25">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white">
        {isFr ? "Reseaux sociaux" : "Social networks"}
      </div>
      <div className="mt-2 text-sm text-white">
        {isFr
          ? "Suivez MPL Export Conseil pour les actualites et contenus export."
          : "Follow MPL Export Conseil for export updates and insights."}
      </div>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 text-sm font-medium text-white hover:text-white hover:underline"
            >
              <img src={link.icon} alt={link.label} className="h-5 w-5" />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Button asChild className="bg-[#DC2626] text-white hover:bg-[#B0231D]">
          <Link to="/contact?offer=diagnostic">{isFr ? "Nous contacter" : "Contact us"}</Link>
        </Button>
      </div>
    </div>
  );
}

export function PublicLayout({ children, hideBanner = false, hideFooter = false }: PublicLayoutProps) {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const { isAuthenticated } = useAuth();
  const isFr = lang === "fr";
  const banner = getBannerContent(location.pathname);
  const siteDisclaimers = (t("disclaimers") as string[]) ?? [];
  const nextPath = `${location.pathname}${location.search}` || "/";
  const authNext = nextPath === "/" ? "/app/control-tower" : nextPath;
  const authNextParam = encodeURIComponent(authNext);
  const isHome = location.pathname === "/";

  const [supportReady, setSupportReady] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = React.useState(false);

  const mainFooterLinks = React.useMemo(() => footerNav.filter((item) => !item.legal), []);
  const legalFooterLinks = React.useMemo(() => footerNav.filter((item) => item.legal), []);

  const resourceLinks = React.useMemo(
    () => [
      { to: "/guides/incoterms", label: isFr ? "Incoterms" : "Incoterms" },
      { to: "/methodologie", label: isFr ? "Methodologie" : "Methodology" },
      { to: "/veille", label: isFr ? "Veille" : "Watch" },
      { to: "/prospection", label: isFr ? "Prospection" : "Prospection" },
      { to: "/services", label: isFr ? "Offre" : "Offer" },
      { to: "/about", label: isFr ? "A propos" : "About" },
      { to: "/pricing#plans", label: isFr ? "Payer en ligne" : "Pay online" },
    ],
    [isFr]
  );

  const registerLabel = isFr ? "Creer un compte gratuit" : "Create free account";
  const loginLabel = isFr ? "Connexion" : "Sign in";
  const appLabel = isFr ? "Tour de controle" : "Control Tower";

  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

  const resolvePublicLabel = React.useCallback(
    (item: (typeof publicNav)[number]) => {
      const translated = item.tKey ? String((t(item.tKey) as string) || "").trim() : "";
      if (translated && translated !== item.tKey) return translated;
      return item.labels[lang];
    },
    [lang, t]
  );

  const resolveFooterLabel = React.useCallback(
    (item: (typeof footerNav)[number]) => item.labels[lang],
    [lang]
  );

  React.useEffect(() => {
    const handler = () => {
      setSupportReady(true);
      setSupportOpen(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("support-widget:open", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("support-widget:open", handler as EventListener);
      }
    };
  }, []);

  React.useEffect(() => {
    setMobileMenuOpen(false);
    setMobileResourcesOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="public-cinematic-shell relative min-h-screen overflow-x-hidden bg-[hsl(var(--background))] text-foreground">
      {!isHome ? <CinematicBackdrop variant="public" className="z-0 opacity-30" /> : null}
      {!isHome ? <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-[#f8efe2]/85 via-[#f5ecde]/90 to-[#f2e6d6]" /> : null}

      <header className="relative z-20 border-b border-[#d6c8b2] bg-[#eadfce]/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3 px-4 py-2 md:px-6">
          <BrandLogo
            href="/"
            size="sm"
            imageClassName="h-8 w-auto rounded-md bg-white p-1 md:h-9"
            textClassName="text-[11px] md:text-[12px]"
            titleClassName="text-black"
            subtitleClassName="text-black/80"
            locationClassName="text-black/70"
            title="MPL Export Navigator"
            subtitle="par MPL Export Conseil"
            location="Conseil Export"
            className="group rounded-xl bg-white/95 px-3 py-2 shadow-lg shadow-black/20"
          />

          <nav className="hidden flex-1 items-center justify-center gap-4 text-sm font-semibold text-slate-900 md:flex">
            {publicNav.map((link) => {
              const label = resolvePublicLabel(link);
              const active = isPathActive(location.pathname, link.to);
              const badge = link.badge?.[lang];
              return (
                <Link key={link.id} to={link.to} className={cx("transition-colors hover:text-black", active && "text-black")} aria-label={label}>
                  <span className={cx("inline-flex items-center gap-1", active && "border-b-2 border-blue-700 pb-1")}>
                    {label}
                    {badge ? (
                      <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">{badge}</span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div
              role="group"
              aria-label={(t("header.languageAria") as string) || "Langue"}
              className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm"
            >
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => setLang(code)}
                  className={cx(
                    "flex items-center gap-1 rounded-full px-2 py-1 transition",
                    lang === code ? "bg-blue-800 text-white" : "text-slate-900 hover:text-black"
                  )}
                >
                  <span aria-hidden="true">{flags[code]}</span>
                  <span>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <Link to="/app/control-tower" className="inline-flex rounded-full border border-slate-500/60 bg-[#0a1d3a] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#0d2a54]">
                {appLabel}
              </Link>
            ) : (
              <>
                <Link to={`/register?next=${authNextParam}`} className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]">
                  {registerLabel}
                </Link>
                <Link
                  to={`/login?next=${authNextParam}`}
                  className="inline-flex rounded-full border border-slate-500/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-900 transition hover:bg-slate-50"
                >
                  {loginLabel}
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {!isAuthenticated ? (
              <Link to={`/register?next=${authNextParam}`} className="inline-flex rounded-full bg-[#DC2626] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white">
                {registerLabel}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? (isFr ? "Fermer le menu" : "Close menu") : (isFr ? "Ouvrir le menu" : "Open menu")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#cdbda4] bg-[#f8efe2] text-slate-900"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="md:hidden border-t border-[#d6c8b2] bg-[#eadfce]/95 px-4 py-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                {(["fr", "en"] as LanguageCode[]).map((code) => (
                  <button
                    key={`mob-${code}`}
                    type="button"
                    onClick={() => setLang(code)}
                    className={cn(
                      "rounded-full px-2 py-1",
                      lang === code ? "bg-blue-800 text-white" : "text-slate-900"
                    )}
                  >
                    {flags[code]} {code.toUpperCase()}
                  </button>
                ))}
              </div>

              {isAuthenticated ? (
                <Link to="/app/control-tower" className="rounded-full border border-slate-500/60 bg-[#0a1d3a] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {appLabel}
                </Link>
              ) : (
                <Link to={`/login?next=${authNextParam}`} className="text-xs font-semibold text-slate-900 underline">
                  {loginLabel}
                </Link>
              )}
            </div>

            <nav className="grid grid-cols-1 gap-2">
              {publicNav.map((link) => {
                const active = isPathActive(location.pathname, link.to);
                const label = resolvePublicLabel(link);
                const badge = link.badge?.[lang];
                return (
                  <Link
                    key={`${link.id}-drawer`}
                    to={link.to}
                    className={cn(
                      "flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold",
                      active ? "border-blue-800 bg-blue-800 text-white" : "border-[#cdbda4] bg-[#f8efe2] text-slate-900"
                    )}
                  >
                    <span>{label}</span>
                    {badge ? (
                      <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">{badge}</span>
                    ) : null}
                  </Link>
                );
              })}

              <div className="rounded-xl border border-[#cdbda4] bg-[#f8efe2]">
                <button
                  type="button"
                  onClick={() => setMobileResourcesOpen((prev) => !prev)}
                  className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-900"
                >
                  <span>{isFr ? "Ressources" : "Resources"}</span>
                  {mobileResourcesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {mobileResourcesOpen ? (
                  <div className="grid grid-cols-1 gap-2 border-t border-[#d6c8b2] p-2">
                    {resourceLinks.map((item) => (
                      <Link
                        key={`mobile-resource-${item.to}`}
                        to={item.to}
                        className="flex min-h-11 items-center rounded-lg border border-[#cdbda4] bg-white px-3 py-2 text-sm font-medium text-slate-900"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </nav>
          </div>
        ) : null}

        <div className="h-[2px] bg-gradient-to-r from-[#1e3a8a] via-[#8fd8ff] to-[#c81e33]" />
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto w-full",
          isHome ? "max-w-none px-0 py-0" : "max-w-[90rem] px-4 py-8 text-foreground sm:px-6 md:px-10 md:py-10"
        )}
      >
        {isHome || hideBanner ? null : (
          <div className="mb-6">
            <TricolorBanner title={banner.title} question={banner.question} />
          </div>
        )}
        {children ?? <Outlet />}
      </main>

      {isAuthenticated ? (
        <Link
          to="/app/control-tower"
          className="fixed bottom-6 left-4 z-[80] inline-flex items-center rounded-full border border-slate-500/70 bg-[#0a1d3a] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/25 hover:bg-[#0d2a54] md:left-6"
        >
          {isFr ? "Retour tour de controle" : "Back to Control Tower"}
        </Link>
      ) : null}

      {hideFooter ? null : (
        <footer className="relative z-10 border-t border-slate-700/70 bg-[#040a15]/90">
          <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 py-8 sm:px-6 md:px-10 md:py-10 lg:grid-cols-[1fr_0.95fr]">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-white">MPL Export Navigator</div>
              <div className="text-sm text-white">
                Outil d'aide a la decision export - par MPL Export Conseil (audit, conformite, veille personnalisee).
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-white">
                {mainFooterLinks.map((item) => (
                  <Link key={item.id} to={item.to} className="hover:text-white hover:underline">
                    {resolveFooterLabel(item)}
                  </Link>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-white">
                <a href={`tel:${phoneRaw}`} className="hover:text-white hover:underline">{phonePretty}</a>
                <a href={`mailto:${emailMain}`} className="hover:text-white hover:underline">{emailMain}</a>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-white/90">
                {legalFooterLinks.map((item) => (
                  <Link key={item.id} to={item.to} className="hover:text-white hover:underline">
                    {resolveFooterLabel(item)}
                  </Link>
                ))}
              </div>

              <div className="text-xs text-white">(c) {new Date().getFullYear()} MPL Export Conseil - outil d'aide a la decision.</div>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white md:mt-2">
                {siteDisclaimers.map((text, index) => (
                  <span key={`foot-disclaimer-${index}`} className="leading-snug">{text}</span>
                ))}
              </div>
            </div>

            <FooterSocial />
          </div>
        </footer>
      )}

      {supportReady ? (
        <SupportChatWidget open={supportOpen} onOpenChange={setSupportOpen} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setSupportReady(true);
            setSupportOpen(true);
          }}
          className="fixed bottom-6 right-4 z-[90] inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a] md:right-6"
          aria-label={isFr ? "Ouvrir MPL Export Expert" : "Open MPL Export Expert"}
        >
          {isFr ? "MPL Export Expert" : "MPL Export Expert"}
        </button>
      )}
    </div>
  );
}

```

## src/components/layout/Sidebar.tsx
`$ext
import type { ElementType } from "react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { isAdminUser } from "@/lib/authz";
import { appNav, isPathActive, type AppNavItem } from "@/config/navigation";

type NavItem = {
  name: string;
  href: string;
  icon: ElementType;
  badge?: string;
  featured?: boolean;
  aliases?: string[];
  adminOnly?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { lang } = useI18n();

  const safeName = (user?.email || "Utilisateur").split("@")[0];

  const getInitials = (name: string) => {
    const parts = name.split(/[.\s_-]+/).filter(Boolean);
    const initials = parts.map((p) => p[0]).join("").toUpperCase();
    return (initials || "??").slice(0, 2);
  };

  const isAdmin = isAdminUser(user);

  const navigation: NavSection[] = React.useMemo(
    () =>
      appNav.map((section) => ({
        title: section.labels[lang],
        items: section.items.map((item: AppNavItem) => ({
          name: item.labels[lang],
          href: item.to,
          icon: item.icon,
          badge: item.badge,
          featured: item.featured,
          aliases: item.aliases,
          adminOnly: item.adminOnly,
        })),
      })),
    [lang]
  );

  const isItemActive = (item: NavItem) => {
    const path = location.pathname;
    const matchesAlias = item.aliases?.some((alias) => path === alias || path.startsWith(`${alias}/`));
    return matchesAlias || isPathActive(path, item.href);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      onNavigate?.();
      navigate("/login");
    }
  };

  const renderLink = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return null;

    const active = isItemActive(item);

    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={() => onNavigate?.()}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all border",
          "focus:outline-none focus:ring-2 focus:ring-primary/30",
          active
            ? "bg-primary/10 text-foreground border-primary/30 shadow-sm"
            : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground hover:border-border",
          item.featured && !active && "border-border bg-card"
        )}
        aria-current={active ? "page" : undefined}
      >
        <item.icon className="h-5 w-5" />
        <span className="truncate">{item.name}</span>

        {item.badge ? (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[70] flex w-64 flex-col",
        "bg-card/95 backdrop-blur-xl border-r border-border shadow-xl",
        className
      )}
      aria-label={lang === "en" ? "Main navigation" : "Navigation principale"}
    >
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((it) => !(it.adminOnly && !isAdmin));
          if (!visibleItems.length) return null;

          return (
            <div key={section.title}>
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
              <div className="space-y-1.5">{visibleItems.map(renderLink)}</div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="text-sm font-medium">{getInitials(safeName)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{safeName}</p>
            <p className="text-xs text-muted-foreground truncate">{isAdmin ? "Admin" : lang === "en" ? "User" : "Utilisateur"}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-muted transition focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={lang === "en" ? "Sign out" : "Deconnexion"}
            title={lang === "en" ? "Sign out" : "Deconnexion"}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}

```

## src/components/marketing/MarketingFooter.tsx
`$ext
import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";

import { useI18n } from "@/contexts/LanguageContext";
import { footerNav } from "@/config/navigation";

type FooterProps = {
  className?: string;
};

export function MarketingFooter({ className = "" }: FooterProps) {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const navLinks = footerNav.filter((item) => !item.legal);
  const legalLinks = footerNav.filter((item) => item.legal);

  const socialLinks = [
    {
      label: "Facebook",
      href: "https://www.facebook.com/profile.php?id=61587254986176",
      icon: "/facebook.svg",
    },
    {
      label: "YouTube",
      href: "https://www.youtube.com/channel/UCxRRjAnotPJahv9SzaPJsAw",
      icon: "/youtube.svg",
    },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/company/mpl-conseil-export/?viewAsMember=true",
      icon: "/linkedin.svg",
    },
  ];

  return (
    <footer className={`border-t border-[hsl(var(--mkt-blue-100))] bg-white ${className}`}>
      <div className="mkt-container py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block">
              <h3 className="mkt-display text-xl font-semibold text-[hsl(var(--mkt-ink))]">
                MPL Export Navigator
              </h3>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Cockpit export pour PME. Couts rendus, documents, risques et veille reglementaire dans un outil unifie."
                : "Export cockpit for SMEs. Landed cost, documents, risks, and regulatory watch in a unified tool."}
            </p>

            <div className="mt-6 space-y-3">
              <a
                href="mailto:contact@exportfrancefacile.com"
                className="flex items-center gap-3 text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
              >
                <Mail className="h-4 w-4" />
                contact@exportfrancefacile.com
              </a>
              <a
                href="tel:+33676435551"
                className="flex items-center gap-3 text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
              >
                <Phone className="h-4 w-4" />
                06 76 43 55 51
              </a>
            </div>
          </div>

          <div>
            <h4 className="mkt-label mb-4">{isFr ? "Navigation" : "Navigation"}</h4>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    to={link.to}
                    className="text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
                  >
                    {link.labels[lang]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mkt-label mb-4">{isFr ? "Legal" : "Legal"}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    to={link.to}
                    className="text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
                  >
                    {link.labels[lang]}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <h4 className="mkt-label mb-4">{isFr ? "Reseaux" : "Social"}</h4>
              <ul className="space-y-2">
                {socialLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-3 text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
                    >
                      <img src={link.icon} alt={link.label} className="h-4 w-4" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--mkt-blue-100))]">
        <div className="mkt-container flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-xs text-[hsl(var(--mkt-ink-muted))]">
            © {new Date().getFullYear()} MPL Export Conseil. {isFr ? "Tous droits reserves." : "All rights reserved."}
          </p>
          <p className="text-xs text-[hsl(var(--mkt-ink-muted))]">
            {isFr
              ? "Cet outil aide a structurer vos decisions export. Il ne remplace pas un conseil reglementaire."
              : "This tool helps structure your export decisions. It does not replace regulatory advice."}
          </p>
        </div>
      </div>
    </footer>
  );
}

```

## src/components/marketing/MarketingHeader.tsx
`$ext
import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { LanguageCode } from "@/i18n/translations";
import { cn } from "@/lib/utils";
import { isPathActive, publicNav } from "@/config/navigation";

const FLAGS: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7),
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7),
};

export function MarketingHeader() {
  const { lang, t, setLang } = useI18n();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const nextPath = `${location.pathname}${location.search}` || "/";
  const authNext = nextPath === "/" ? "/app/control-tower" : nextPath;
  const authNextParam = encodeURIComponent(authNext);

  const isEN = lang === "en";
  const registerLabel = isEN ? "Create free account" : "Creer un compte gratuit";
  const loginLabel = isEN ? "Sign in" : "Connexion";
  const appLabel = isEN ? "My workspace" : "Mon espace";

  const navLabel = (item: (typeof publicNav)[number]) => {
    const translated = item.tKey ? String((t(item.tKey) as string) || "").trim() : "";
    if (translated && translated !== item.tKey) return translated;
    return item.labels[lang];
  };

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#d6c8b2] bg-[#eadfce]/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3 px-4 py-2 md:px-6">
        <BrandLogo
          href="/"
          size="sm"
          imageClassName="h-8 w-auto rounded-md bg-white p-1 md:h-9"
          textClassName="text-[11px] md:text-[12px]"
          titleClassName="text-black"
          subtitleClassName="text-black/80"
          locationClassName="text-black/70"
          title="MPL Export Navigator"
          subtitle="par MPL Export Conseil"
          location="Conseil Export"
          className="group rounded-xl bg-white/95 px-3 py-2 shadow-lg shadow-black/20"
        />

        <nav className="hidden flex-1 items-center justify-center gap-4 text-sm font-semibold text-slate-900 md:flex">
          {publicNav.map((item) => {
            const label = navLabel(item);
            const active = isPathActive(location.pathname, item.to);
            const badge = item.badge?.[lang];
            return (
              <Link key={item.id} to={item.to} className="transition-colors hover:text-black" aria-label={label}>
                <span className={cn("inline-flex items-center gap-1", active && "border-b-2 border-blue-700 pb-1 text-black")}>
                  {label}
                  {badge ? (
                    <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                      {badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm">
            {(["fr", "en"] as LanguageCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 transition",
                  lang === code ? "bg-blue-800 text-white" : "text-slate-900 hover:text-black"
                )}
              >
                <span aria-hidden="true">{FLAGS[code]}</span>
                <span>{code.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {isAuthenticated ? (
            <Link
              to="/app/control-tower"
              className="inline-flex rounded-full border border-slate-500/60 bg-[#0a1d3a] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#0d2a54]"
            >
              {appLabel}
            </Link>
          ) : (
            <>
              <Link
                to={`/register?next=${authNextParam}`}
                className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]"
              >
                {registerLabel}
              </Link>
              <Link
                to={`/login?next=${authNextParam}`}
                className="inline-flex rounded-full border border-slate-500/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-900 transition hover:bg-slate-50"
              >
                {loginLabel}
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#cdbda4] bg-[#f8efe2] text-slate-900"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? (isEN ? "Close menu" : "Fermer le menu") : (isEN ? "Open menu" : "Ouvrir le menu")}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="h-[2px] bg-gradient-to-r from-[#1e3a8a] via-[#8fd8ff] to-[#c81e33]" />

      {mobileOpen ? (
        <div className="border-t border-[#d6c8b2] bg-[#eadfce]/95 px-4 py-3 shadow-lg md:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  key={`mob-${code}`}
                  type="button"
                  onClick={() => setLang(code)}
                  className={cn("rounded-full px-2 py-1", lang === code ? "bg-blue-800 text-white" : "text-slate-900")}
                >
                  {FLAGS[code]} {code.toUpperCase()}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <Link
                to="/app/control-tower"
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-slate-500/60 bg-[#0a1d3a] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white"
              >
                {appLabel}
              </Link>
            ) : (
              <Link
                to={`/login?next=${authNextParam}`}
                onClick={() => setMobileOpen(false)}
                className="text-xs font-semibold text-slate-900 underline"
              >
                {loginLabel}
              </Link>
            )}
          </div>

          {!isAuthenticated ? (
            <Link
              to={`/register?next=${authNextParam}`}
              onClick={() => setMobileOpen(false)}
              className="mb-3 inline-flex rounded-full bg-[#DC2626] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white"
            >
              {registerLabel}
            </Link>
          ) : null}

          <nav className="grid grid-cols-1 gap-2">
            {publicNav.map((item) => {
              const label = navLabel(item);
              const active = isPathActive(location.pathname, item.to);
              const badge = item.badge?.[lang];
              return (
                <Link
                  key={`${item.id}-mobile`}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold",
                    active ? "border-blue-800 bg-blue-800 text-white" : "border-[#cdbda4] bg-[#f8efe2] text-slate-900"
                  )}
                >
                  <span>{label}</span>
                  {badge ? (
                    <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

```

## src/components/marketing/MarketingLayout.tsx
`$ext
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { GdprGuarantee } from "@/components/GdprGuarantee";
import { getBannerContent } from "@/config/bannerContent";

type MarketingLayoutProps = {
  children: ReactNode;
  hideBanner?: boolean;
  hideFooter?: boolean;
};

export const MarketingLayout = ({
  children,
  hideBanner = false,
  hideFooter = false,
}: MarketingLayoutProps) => {
  const { t } = useI18n();
  const location = useLocation();
  const banner = getBannerContent(location.pathname);

  const heroDisclaimers = (t("heroLanding.disclaimers") as string[]) ?? [];
  const globalDisclaimers = (t("disclaimers") as string[]) ?? [];

  return (
    <PublicLayout hideBanner={hideBanner} hideFooter={hideFooter}>
      <div className="flex min-h-[40vh] flex-col bg-white text-slate-900">
        <main className="flex-1">{children}</main>

        {!hideFooter ? (
          <div className="border-t border-blue-100 bg-white/85 px-6 py-8">
            <div className="mx-auto max-w-6xl">
              <GdprGuarantee />

              {globalDisclaimers.length > 0 || heroDisclaimers.length > 0 ? (
                <div className="mt-6 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                  {[...heroDisclaimers, ...globalDisclaimers]
                    .filter(Boolean)
                    .map((text, index) => (
                      <p key={`${banner.title}-${index}`} className="text-xs text-slate-500">
                        {text}
                      </p>
                    ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PublicLayout>
  );
};

```

## src/components/marketing/PremiumMarketingLayout.tsx
`$ext
import type { ReactNode } from "react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import "@/styles/marketing.css";

type PremiumMarketingLayoutProps = {
  children: ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
};

export function PremiumMarketingLayout({
  children,
  hideHeader = false,
  hideFooter = false,
}: PremiumMarketingLayoutProps) {
  return (
    <PublicLayout hideBanner={!hideHeader} hideFooter={hideFooter}>
      <div className="mkt-shell min-h-[40vh] flex flex-col">
        <main className="flex-1">{children}</main>
      </div>
    </PublicLayout>
  );
}

```

## src/components/RssFooter.tsx
`$ext
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ExternalLink, RefreshCw, Rss, ShieldCheck } from "lucide-react";

type RssFooterItem = {
  id?: string;
  title?: string;
  link?: string;
  sourceName?: string;
  pubDate?: string;
};

type RssMeta = {
  title?: string;
  description?: string;
  link?: string;
  lastBuildDate?: string;
};

type RssApiJsonResponse = {
  data?: { items?: Array<Record<string, unknown>> };
  items?: Array<Record<string, unknown>>;
  meta?: RssMeta;
  sources?: string[];
  pinned?: string[];
  territory?: string;
  error?: string;
  message?: string;
};

type RssFooterProps = {
  territory?: string | null;
  territoryLabel?: string | null;
};

const PINNED_SOURCE_LABELS = [
  "Le Moci",
  "WHO News",
  "Douane francaise",
  "UE DG Trade",
];

function safeExternalUrl(url?: string) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function safeDateLabel(pubDate?: string) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function safeDateTimeLabel(pubDate?: string) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function normalizeTerritory(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "WORLD" || raw === "GLOBAL" || raw === "ALL" || raw === "MONDE" || raw === "EU") {
    return "WORLD";
  }
  return /^[A-Z]{2}$/.test(raw) ? raw : "WORLD";
}

function toStringOrUndefined(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function pickItemsJson(payload: RssApiJsonResponse | null): RssFooterItem[] {
  const a = payload?.data?.items;
  const b = payload?.items;
  const items = (Array.isArray(a) ? a : Array.isArray(b) ? b : []) as Array<Record<string, unknown>>;
  return (items
    .map((it, idx) => {
      const title = toStringOrUndefined(it.title) || "Article";
      const link = toStringOrUndefined(it.link) || toStringOrUndefined(it.url);
      const sourceName =
        toStringOrUndefined(it.sourceName) ||
        toStringOrUndefined(it.source) ||
        toStringOrUndefined(it.feed) ||
        toStringOrUndefined(it.siteName);
      const pubDate =
        toStringOrUndefined(it.pubDate) ||
        toStringOrUndefined(it.publishedAt) ||
        toStringOrUndefined(it.published_at);

      if (!link) return null;
      return {
        id: toStringOrUndefined(it.id) || `${link}-${idx}`,
        title,
        link,
        sourceName,
        pubDate,
      } satisfies RssFooterItem;
    })
    .filter((it) => it !== null) as RssFooterItem[])
    .slice(0, 6);
}

function parseRssXml(xml: string): { meta: RssMeta; items: RssFooterItem[] } {
  // DOMParser dispo cÃ´tÃ© navigateur
  if (typeof window === "undefined") return { meta: {}, items: [] };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");

    const channel = doc.querySelector("channel");
    const meta: RssMeta = {
      title: channel?.querySelector("title")?.textContent?.trim() || undefined,
      description: channel?.querySelector("description")?.textContent?.trim() || undefined,
      link: channel?.querySelector("link")?.textContent?.trim() || undefined,
      lastBuildDate: channel?.querySelector("lastBuildDate")?.textContent?.trim() || undefined,
    };

    const nodes = Array.from(doc.querySelectorAll("item"));
    const items: RssFooterItem[] = nodes.slice(0, 6).map((n, idx) => {
      const title = n.querySelector("title")?.textContent?.trim() || "Article";
      const link = n.querySelector("link")?.textContent?.trim() || undefined;
      const pubDate = n.querySelector("pubDate")?.textContent?.trim() || undefined;

      // sourceName : parfois <source> ou <dc:creator> selon feed. On met le mieux possible.
      const source =
        n.querySelector("source")?.textContent?.trim() ||
        n.querySelector("dc\\:creator")?.textContent?.trim() ||
        undefined;

      return {
        id: `${link || title}-${idx}`,
        title,
        link,
        pubDate,
        sourceName: source,
      };
    });

    return { meta, items };
  } catch {
    return { meta: {}, items: [] };
  }
}

async function fetchRaw(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: "*/*" } });
  const raw = await res.text();

  if (!res.ok) {
    // certains backends renvoient HTML en erreur â†’ on renvoie un message gÃ©nÃ©rique
    throw new Error("Veille indisponible pour le moment. RÃ©essayez dans quelques minutes.");
  }

  return { raw, contentType: res.headers.get("content-type") || "" };
}

export function RssFooter({ territory, territoryLabel }: RssFooterProps) {
  const effectiveTerritory = React.useMemo(() => normalizeTerritory(territory), [territory]);
  const [items, setItems] = React.useState<RssFooterItem[]>([]);
  const [meta, setMeta] = React.useState<RssMeta>({});
  const [sourceLabels, setSourceLabels] = React.useState<string[]>([]);
  const [pinnedLabels, setPinnedLabels] = React.useState<string[]>(PINNED_SOURCE_LABELS);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      // Flux dynamique lie au territoire selectionne (map -> RSS).
      const endpoint = `/api/rss?limit=18&territory=${encodeURIComponent(effectiveTerritory)}`;

      try {
        const { raw, contentType } = await fetchRaw(endpoint, controller.signal);
        if (!mounted) return;

        const looksXml = contentType.includes("xml") || raw.trim().startsWith("<rss") || raw.trim().startsWith("<?xml");
        const looksJson = contentType.includes("json") || raw.trim().startsWith("{") || raw.trim().startsWith("[");

        if (looksXml) {
          const parsed = parseRssXml(raw);
          setMeta(parsed.meta);
          setItems(parsed.items);
          setSourceLabels([]);
          setPinnedLabels(PINNED_SOURCE_LABELS);
          setError(null);
        } else if (looksJson) {
          let payload: RssApiJsonResponse | null = null;
          try {
            payload = raw ? (JSON.parse(raw) as RssApiJsonResponse) : null;
          } catch {
            payload = null;
          }
          const territoryText = territoryLabel || (effectiveTerritory === "WORLD" ? "Monde" : effectiveTerritory);
          setMeta({
            title: payload?.meta?.title || `Veille export - ${territoryText}`,
            description:
              payload?.meta?.description ||
              `Flux dynamique relie a la carte (territoire: ${territoryText}).`,
            link: payload?.meta?.link || "/veille",
            lastBuildDate: payload?.meta?.lastBuildDate,
          });
          setItems(pickItemsJson(payload));
          setSourceLabels(Array.isArray(payload?.sources) ? payload.sources.slice(0, 8) : []);
          setPinnedLabels(
            Array.isArray(payload?.pinned) && payload.pinned.length
              ? payload.pinned
              : PINNED_SOURCE_LABELS
          );
          if (payload?.error) setError(payload.error);
          else setError(null);
        } else {
          // format inattendu
          setMeta({});
          setItems([]);
          setSourceLabels([]);
          setPinnedLabels(PINNED_SOURCE_LABELS);
          setError("Format de veille non reconnu.");
        }
      } catch (err) {
        if (!mounted) return;
        const anyErr = err as { name?: string; message?: string };
        if (anyErr?.name === "AbortError") return;
        setMeta({});
        setItems([]);
        setSourceLabels([]);
        setPinnedLabels(PINNED_SOURCE_LABELS);
        setError(anyErr?.message || "Veille indisponible pour le moment. RÃ©essayez dans quelques minutes.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [effectiveTerritory, refreshTick, territoryLabel]);

  const hasItems = items.length > 0;
  const lastBuild = safeDateTimeLabel(meta.lastBuildDate);
  const selectedLabel = territoryLabel || (effectiveTerritory === "WORLD" ? "Monde" : effectiveTerritory);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted">
              <Rss className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Veille export</div>
              <div className="text-sm font-semibold text-foreground">
                {meta.title ? meta.title : "Alertes rÃ©centes"}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {meta.description ? meta.description : "Signaux faibles, conformitÃ© et points de vigilance."}
            {lastBuild ? <span className="ml-2">Â· DerniÃ¨re mise Ã  jour : <b>{lastBuild}</b></span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">Pays/zone: {selectedLabel}</Badge>
          {pinnedLabels.map((label) => (
            <Badge key={`pinned-${label}`} variant="outline">
              {label}
            </Badge>
          ))}
          {sourceLabels.length ? <Badge variant="outline">+{sourceLabels.length} source(s) pays</Badge> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setRefreshTick((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>

          {/* /watch redirige dÃ©jÃ  vers /veille chez toi */}
          <a href="/veille" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Centre de veille <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : !hasItems ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Aucune actualitÃ© disponible pour le moment.</div>
              <div className="mt-1 text-xs">
                Ton RSS est valide mais il ne contient aucun <code>&lt;item&gt;</code>. DÃ¨s que le flux est alimentÃ©,
                les alertes apparaÃ®tront ici automatiquement.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const href = safeExternalUrl(item.link);
                const dateLabel = safeDateLabel(item.pubDate);
                const key = item.id || item.link || item.title || Math.random().toString(36);

                return (
                  <div key={key} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sm font-semibold text-foreground hover:text-primary"
                          >
                            <span className="line-clamp-2">{item.title || "Article"}</span>
                          </a>
                        ) : (
                          <div className="block text-sm font-semibold text-foreground">
                            <span className="line-clamp-2">{item.title || "Article"}</span>
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {item.sourceName ? (
                            <Badge variant="outline" className="h-5 px-2 text-[11px]">
                              {item.sourceName}
                            </Badge>
                          ) : null}
                          {dateLabel ? <span>{dateLabel}</span> : null}
                        </div>
                      </div>

                      {href ? <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-[11px] text-muted-foreground">
            Astuce : dans le Centre de veille, tu peux aller plus loin (filtres, suivi, historique).
          </div>
        </div>

        {/* CTA / Conversion */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">DÃ©bloquez le suivi et lâ€™historique</div>
              <div className="text-xs text-muted-foreground">
                Compte gratuit : sauvegarde de vos contrÃ´les + accÃ¨s aux vues avancÃ©es.
              </div>
            </div>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-foreground/90">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Historique des vÃ©rifications & export des rÃ©sultats</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Veille plus ciblÃ©e (pays/secteur) dans lâ€™app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>AccÃ¨s aux outils : Control Tower, simulateur, conformitÃ©</span>
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/register?next=%2Fapp%2Finvoice-check" className="w-full">
              <Button className="w-full gap-2">
                CrÃ©er un compte gratuit <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Se connecter
              </Button>
            </a>
          </div>

          {meta.link ? (
            <div className="mt-3 text-[11px] text-muted-foreground">
              Source :{" "}
              <a href={meta.link} target="_blank" rel="noreferrer" className="underline">
                {meta.link}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


```

## src/config/navigation.ts
`$ext
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Bot,
  Calculator,
  FileCheck2,
  Scale,
  Settings,
  ShieldCheck,
} from "lucide-react";

import type { LanguageCode } from "@/i18n/translations";

export type NavLabels = Record<LanguageCode, string>;

export type PublicNavItem = {
  id: string;
  to: string;
  labels: NavLabels;
  tKey?: string;
  badge?: NavLabels;
};

export type FooterNavItem = {
  id: string;
  to: string;
  labels: NavLabels;
  legal?: boolean;
};

export type AppNavItem = {
  id: string;
  to: string;
  labels: NavLabels;
  descriptions?: NavLabels;
  icon: LucideIcon;
  aliases?: string[];
  badge?: string;
  featured?: boolean;
  adminOnly?: boolean;
};

export type AppNavSection = {
  id: string;
  labels: NavLabels;
  items: AppNavItem[];
};

export const publicNav: PublicNavItem[] = [
  {
    id: "copilot",
    to: "/copilote",
    tKey: "header.menu.copilot",
    labels: { fr: "Copilote IA", en: "AI Copilot" },
    badge: { fr: "Gratuit", en: "Free" },
  },
  {
    id: "services",
    to: "/services",
    tKey: "header.menu.services",
    labels: { fr: "Produits", en: "Products" },
  },
  {
    id: "about",
    to: "/about",
    tKey: "header.menu.about",
    labels: { fr: "A propos", en: "About" },
  },
  {
    id: "contact",
    to: "/contact",
    tKey: "header.menu.contact",
    labels: { fr: "Contact", en: "Contact" },
  },
];

const legalFooter: FooterNavItem[] = [
  { id: "legal-notice", to: "/mentions-legales", labels: { fr: "Mentions legales", en: "Legal notice" }, legal: true },
  { id: "privacy", to: "/confidentialite", labels: { fr: "Confidentialite", en: "Privacy" }, legal: true },
  { id: "cookies", to: "/cookies", labels: { fr: "Cookies", en: "Cookies" }, legal: true },
  { id: "cgu", to: "/cgu", labels: { fr: "CGU", en: "Terms of use" }, legal: true },
  { id: "cgv", to: "/cgv", labels: { fr: "CGV", en: "Terms of sale" }, legal: true },
];

export const footerNav: FooterNavItem[] = [
  ...publicNav.map((item) => ({ id: item.id, to: item.to, labels: item.labels })),
  ...legalFooter,
];

export const appNav: AppNavSection[] = [
  {
    id: "home",
    labels: { fr: "Accueil", en: "Home" },
    items: [
      {
        id: "control-tower",
        to: "/app/control-tower",
        icon: Activity,
        labels: { fr: "Tour de controle", en: "Control Tower" },
        descriptions: {
          fr: "Vue globale des flux, alertes et priorites export.",
          en: "Global view of flows, alerts and export priorities.",
        },
        badge: "Live",
        featured: true,
        aliases: ["/dashboard", "/command-center", "/hub", "/app", "/app/command-center", "/tour-de-controle"],
      },
    ],
  },
  {
    id: "decide",
    labels: { fr: "Decider vite", en: "Decide fast" },
    items: [
      {
        id: "simulator",
        to: "/app/simulator",
        icon: Calculator,
        labels: { fr: "Analyse couts", en: "Cost analysis" },
        descriptions: {
          fr: "Simuler prix rendu, documents et risques logistiques.",
          en: "Simulate landed cost, documents and logistics risks.",
        },
        aliases: ["/analyse", "/app/analyse", "/app/export/costing", "/simulator"],
      },
      {
        id: "invoice-check",
        to: "/app/invoice-check",
        icon: FileCheck2,
        labels: { fr: "Controle facture", en: "Invoice check" },
        descriptions: {
          fr: "Verifier coherence facture, Incoterm et conformite de base.",
          en: "Check invoice consistency, Incoterm and base compliance.",
        },
        aliases: ["/invoice-check", "/app/import/check-invoice"],
      },
      {
        id: "taxes",
        to: "/app/taxes-om",
        icon: Scale,
        labels: { fr: "Taxes territoires", en: "Territory taxes" },
        descriptions: {
          fr: "Estimation taxes, droits et regimes specifiques.",
          en: "Estimate taxes, duties and specific regimes.",
        },
        aliases: ["/app/taxes", "/taxes-om", "/taxes", "/app/droits-taxes"],
      },
    ],
  },
  {
    id: "compliance",
    labels: { fr: "Conformite", en: "Compliance" },
    items: [
      {
        id: "audit",
        to: "/app/audit-interne",
        icon: ShieldCheck,
        labels: { fr: "Audit interne", en: "Internal audit" },
        descriptions: {
          fr: "Suivi conformite, screening et points de vigilance.",
          en: "Track compliance, screening and red flags.",
        },
        aliases: ["/app/compliance", "/app/centre-conformite", "/app/controls", "/app/sanctions"],
      },
      {
        id: "watch",
        to: "/app/centre-veille/reglementation",
        icon: BookOpen,
        labels: { fr: "Veille reglementaire", en: "Regulatory watch" },
        descriptions: {
          fr: "Veille officielle par pays, sujet et date.",
          en: "Official watch by country, topic and date.",
        },
        aliases: ["/veille", "/watch", "/app/centre-veille", "/watch/regulatory"],
      },
    ],
  },
  {
    id: "assistant",
    labels: { fr: "IA", en: "AI" },
    items: [
      {
        id: "assistant",
        to: "/app/assistant",
        icon: Bot,
        labels: { fr: "MPL Export Expert", en: "MPL Export Expert" },
        descriptions: {
          fr: "Assistant export structure, oriente documents et actions.",
          en: "Structured export assistant focused on documents and actions.",
        },
        aliases: ["/assistant", "/expert", "/app/expert"],
      },
    ],
  },
  {
    id: "admin",
    labels: { fr: "Admin", en: "Admin" },
    items: [
      {
        id: "admin",
        to: "/app/admin",
        icon: Settings,
        labels: { fr: "Admin", en: "Admin" },
        descriptions: {
          fr: "Base documentaire, donnees de reference et supervision.",
          en: "Knowledge base, reference data and supervision.",
        },
        adminOnly: true,
      },
    ],
  },
];

export function isPathActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

export function matchAppNavItem(pathname: string) {
  for (const section of appNav) {
    for (const item of section.items) {
      if (isPathActive(pathname, item.to)) return item;
      if (item.aliases?.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))) {
        return item;
      }
    }
  }
  return null;
}

```

## src/config/navLinks.ts
`$ext
import { publicNav } from "@/config/navigation";

export type NavLinkConfig = {
  key: string;
  to: string;
  fallback: string;
};

export const navLinks: NavLinkConfig[] = publicNav.map((item) => ({
  key: item.tKey || `header.menu.${item.id}`,
  to: item.to,
  fallback: item.labels.fr,
}));

```

## src/pages/ControlTower.tsx
`$ext
import * as React from "react";
import { FileSpreadsheet, Plus, RefreshCw, UploadCloud } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";
import { RssFooter } from "@/components/RssFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  COUNTRIES,
  CURRENCIES,
  DISTRIBUTION_CHANNELS,
  INCOTERMS,
  PRODUCTS,
  getCountryLabel,
} from "@/lib/constants";
import { useI18n } from "@/contexts/LanguageContext";
import { toFriendlyErrorMessage } from "@/lib/textSanitizer";

type TabularData = {
  headers: string[];
  rows: string[][];
};

type ColumnMapping = {
  country: string;
  product: string;
  qty: string;
  amount: string;
  currency: string;
  incoterm: string;
  channel: string;
  transportCost: string;
};

type ControlTowerRow = {
  id: string;
  country: string;
  productCode: string;
  qty: number;
  amount: number;
  currency: string;
  incoterm: string;
  channel: string;
  transportCost: number;
};

type ManualRowInput = {
  country: string;
  productCode: string;
  qty: string;
  amount: string;
  currency: string;
  incoterm: string;
  channel: string;
  transportCost: string;
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const EMPTY_MAPPING: ColumnMapping = {
  country: "",
  product: "",
  qty: "",
  amount: "",
  currency: "",
  incoterm: "",
  channel: "",
  transportCost: "",
};

const EMPTY_MANUAL_ROW: ManualRowInput = {
  country: "",
  productCode: "",
  qty: "",
  amount: "",
  currency: "EUR",
  incoterm: "EXW",
  channel: "direct",
  transportCost: "",
};

function parseNumber(value: string | null | undefined) {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/,/g, "");

  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function isIso2(value: string) {
  return /^[A-Z]{2}$/.test(String(value || "").toUpperCase());
}

function detectDelimiter(line: string) {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestScore = -1;

  for (const separator of candidates) {
    const score = line.split(separator).length;
    if (score > bestScore) {
      bestScore = score;
      best = separator;
    }
  }

  return best;
}

function parseCsv(rawText: string): TabularData {
  const clean = rawText.replace(/^\uFEFF/, "").trim();
  if (!clean) return { headers: [], rows: [] };

  const firstLine = clean.split(/\r?\n/)[0] || "";
  const separator = detectDelimiter(firstLine);

  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.map((line) => line.split(separator).map((cell) => cell.trim()));

  const headers = rows.shift() || [];
  return { headers, rows };
}

async function readTabularFile(file: File): Promise<TabularData> {
  const lower = file.name.toLowerCase();
  const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls") || file.type.includes("excel") || file.type.includes("sheet");

  if (!isExcel) {
    const text = await file.text();
    return parseCsv(text);
  }

  const xlsx = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = xlsx.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet || !workbook.Sheets[firstSheet]) {
    return { headers: [], rows: [] };
  }

  const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheet], { FS: ";", RS: "\n" });
  return parseCsv(csv);
}

function normalizeCountry(value: string) {
  const input = String(value || "").trim();
  if (!input) return "";

  const upper = input.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const low = input.toLowerCase();
  const found = COUNTRIES.find((country) => {
    const fr = country.label_fr.toLowerCase();
    const en = country.label_en.toLowerCase();
    return low === fr || low === en;
  });

  return found?.iso2 || upper.slice(0, 2);
}

function resolveProductCode(value: string) {
  const input = String(value || "").trim().toLowerCase();
  if (!input) return "";

  const exact = PRODUCTS.find((product) => product.code === input);
  if (exact) return exact.code;

  const byLabel = PRODUCTS.find((product) => {
    const fr = product.label_fr.toLowerCase();
    const en = product.label_en.toLowerCase();
    return input === fr || input === en || fr.includes(input) || en.includes(input);
  });

  return byLabel?.code || "";
}

function estimateTotalCosts(row: ControlTowerRow) {
  const baseCostRatio = 0.62;
  const variableCost = row.amount * baseCostRatio;
  return variableCost + row.transportCost;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${Math.round(value || 0)} ${currency || "EUR"}`;
  }
}

function getColumnIndex(headers: string[], selectedHeader: string) {
  const idx = headers.findIndex((header) => header === selectedHeader);
  return idx >= 0 ? idx : null;
}

function mapRowsToControlTowerRows(data: TabularData, mapping: ColumnMapping): ControlTowerRow[] {
  const countryIdx = getColumnIndex(data.headers, mapping.country);
  const productIdx = getColumnIndex(data.headers, mapping.product);
  const qtyIdx = getColumnIndex(data.headers, mapping.qty);
  const amountIdx = getColumnIndex(data.headers, mapping.amount);
  const currencyIdx = getColumnIndex(data.headers, mapping.currency);
  const incotermIdx = getColumnIndex(data.headers, mapping.incoterm);
  const channelIdx = getColumnIndex(data.headers, mapping.channel);
  const transportIdx = getColumnIndex(data.headers, mapping.transportCost);

  if (countryIdx === null || productIdx === null || qtyIdx === null || amountIdx === null) {
    return [];
  }

  return data.rows
    .map((cells) => {
      const country = normalizeCountry(cells[countryIdx] || "");
      const productCode = resolveProductCode(cells[productIdx] || "");
      const qty = Math.max(0, parseNumber(cells[qtyIdx] || "0"));
      const amount = Math.max(0, parseNumber(cells[amountIdx] || "0"));

      const currency = currencyIdx === null ? "EUR" : String(cells[currencyIdx] || "EUR").toUpperCase();
      const incoterm = incotermIdx === null ? "EXW" : String(cells[incotermIdx] || "EXW").toUpperCase();
      const channel = channelIdx === null ? "direct" : String(cells[channelIdx] || "direct").toLowerCase();
      const transportCost = transportIdx === null ? 0 : Math.max(0, parseNumber(cells[transportIdx] || "0"));

      if (!country || !productCode || amount <= 0) return null;

      return {
        id: uid(),
        country,
        productCode,
        qty: qty || 1,
        amount,
        currency,
        incoterm,
        channel,
        transportCost,
      } satisfies ControlTowerRow;
    })
    .filter(Boolean) as ControlTowerRow[];
}

function getProductLabel(productCode: string, lang: "fr" | "en") {
  const product = PRODUCTS.find((item) => item.code === productCode);
  if (!product) return productCode;
  return lang === "en" ? product.label_en : product.label_fr;
}

export default function ControlTower() {
  const { lang } = useI18n();
  const isEn = lang === "en";

  const [fileName, setFileName] = React.useState("");
  const [tabularData, setTabularData] = React.useState<TabularData>({ headers: [], rows: [] });
  const [mapping, setMapping] = React.useState<ColumnMapping>(EMPTY_MAPPING);
  const [importMode, setImportMode] = React.useState<"merge" | "replace">("merge");
  const [rows, setRows] = React.useState<ControlTowerRow[]>([]);
  const [manualRow, setManualRow] = React.useState<ManualRowInput>(EMPTY_MANUAL_ROW);
  const [selectedCountry, setSelectedCountry] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");

  const hasMappedRequiredFields = Boolean(mapping.country && mapping.product && mapping.qty && mapping.amount);

  const rowsForDashboard = React.useMemo(() => {
    if (!selectedCountry) return rows;
    return rows.filter((row) => row.country === selectedCountry);
  }, [rows, selectedCountry]);

  const countryStats = React.useMemo(() => {
    const map: Record<string, { label?: string; alerts: number; updates: number; total: number }> = {};

    rows.forEach((row) => {
      const country = String(row.country || "").toUpperCase();
      if (!isIso2(country)) return;

      const margin = row.amount - estimateTotalCosts(row);
      const current = map[country] || {
        label: getCountryLabel(country, lang),
        alerts: 0,
        updates: 0,
        total: 0,
      };

      if (margin < 0) {
        current.alerts += 1;
      } else {
        current.updates += 1;
      }
      current.total += 1;
      map[country] = current;
    });

    return map;
  }, [lang, rows]);

  const selectedCountryStats = React.useMemo(() => {
    if (selectedCountry && countryStats[selectedCountry]) {
      return countryStats[selectedCountry];
    }

    return Object.values(countryStats).reduce(
      (acc, item) => {
        acc.alerts += item.alerts || 0;
        acc.updates += item.updates || 0;
        acc.total += item.total || 0;
        return acc;
      },
      { alerts: 0, updates: 0, total: 0 }
    );
  }, [countryStats, selectedCountry]);

  React.useEffect(() => {
    if (!selectedCountry) return;
    const stillPresent = rows.some((row) => row.country === selectedCountry);
    if (!stillPresent) {
      setSelectedCountry(null);
    }
  }, [rows, selectedCountry]);

  const profitabilityByCountry = React.useMemo(() => {
    const map = new Map<
      string,
      { country: string; revenue: number; cost: number; margin: number; lines: number }
    >();

    rowsForDashboard.forEach((row) => {
      const current = map.get(row.country) || { country: row.country, revenue: 0, cost: 0, margin: 0, lines: 0 };
      const costs = estimateTotalCosts(row);
      const margin = row.amount - costs;
      current.revenue += row.amount;
      current.cost += costs;
      current.margin += margin;
      current.lines += 1;
      map.set(row.country, current);
    });

    return Array.from(map.values()).sort((a, b) => b.margin - a.margin);
  }, [rowsForDashboard]);

  const topProductsByCountry = React.useMemo(() => {
    const map = new Map<string, { country: string; productCode: string; qty: number; amount: number }>();

    rowsForDashboard.forEach((row) => {
      const key = `${row.country}:${row.productCode}`;
      const current = map.get(key) || {
        country: row.country,
        productCode: row.productCode,
        qty: 0,
        amount: 0,
      };
      current.qty += row.qty;
      current.amount += row.amount;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [rowsForDashboard]);

  const channelPerformance = React.useMemo(() => {
    const map = new Map<string, { channel: string; amount: number; margin: number }>();

    rowsForDashboard.forEach((row) => {
      const current = map.get(row.channel) || { channel: row.channel, amount: 0, margin: 0 };
      const margin = row.amount - estimateTotalCosts(row);
      current.amount += row.amount;
      current.margin += margin;
      map.set(row.channel, current);
    });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [rowsForDashboard]);

  const suggestions = React.useMemo(() => {
    const list: string[] = [];

    const bestCountry = profitabilityByCountry[0];
    if (bestCountry) {
      list.push(
        isEn
          ? `Scale in ${getCountryLabel(bestCountry.country, "en")}: currently highest margin destination.`
          : `Accroitre l'activite sur ${getCountryLabel(bestCountry.country, "fr")}: destination la plus rentable.`
      );
    }

    const weakCountry = profitabilityByCountry.find((entry) => entry.margin < 0);
    if (weakCountry) {
      list.push(
        isEn
          ? `Review pricing/incoterm on ${getCountryLabel(weakCountry.country, "en")} (negative margin).`
          : `Revoir prix/incoterm sur ${getCountryLabel(weakCountry.country, "fr")} (marge negative).`
      );
    }

    const topChannel = channelPerformance[0];
    if (topChannel) {
      list.push(
        isEn
          ? `Reinforce channel ${topChannel.channel} and replicate its playbook in similar countries.`
          : `Renforcer le canal ${topChannel.channel} et reproduire son playbook sur des pays proches.`
      );
    }

    if (!list.length) {
      list.push(
        isEn
          ? "Import CSV/XLSX data first to generate optimization recommendations."
          : "Importez d'abord des donnees CSV/XLSX pour obtenir des recommandations d'optimisation."
      );
    }

    return list.slice(0, 4);
  }, [channelPerformance, isEn, profitabilityByCountry]);

  const handleFile = async (file: File) => {
    setLoading(true);
    setErrorText("");

    try {
      const parsed = await readTabularFile(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        throw new Error(isEn ? "Empty file" : "Fichier vide");
      }

      setTabularData(parsed);
      setFileName(file.name);
      setMapping(EMPTY_MAPPING);
    } catch (error) {
      setErrorText(toFriendlyErrorMessage(error, lang));
    } finally {
      setLoading(false);
    }
  };

  const applyMapping = () => {
    if (!hasMappedRequiredFields) return;

    const mappedRows = mapRowsToControlTowerRows(tabularData, mapping);
    if (!mappedRows.length) {
      setErrorText(
        isEn
          ? "No usable lines after mapping. Please check your column mapping."
          : "Aucune ligne exploitable apres mapping. Verifiez la correspondance des colonnes."
      );
      return;
    }

    setRows((prev) => (importMode === "replace" ? mappedRows : [...prev, ...mappedRows]));
    setErrorText("");
  };

  const addManualRow = () => {
    const qty = Math.max(1, parseNumber(manualRow.qty));
    const amount = Math.max(0, parseNumber(manualRow.amount));
    const transportCost = Math.max(0, parseNumber(manualRow.transportCost));

    if (!manualRow.country || !manualRow.productCode || amount <= 0) {
      setErrorText(
        isEn
          ? "Manual row requires country, product and amount."
          : "Ligne manuelle: pays, produit et montant obligatoires."
      );
      return;
    }

    const row: ControlTowerRow = {
      id: uid(),
      country: manualRow.country,
      productCode: manualRow.productCode,
      qty,
      amount,
      currency: manualRow.currency || "EUR",
      incoterm: manualRow.incoterm || "EXW",
      channel: manualRow.channel || "direct",
      transportCost,
    };

    setRows((prev) => [...prev, row]);
    setManualRow(EMPTY_MANUAL_ROW);
    setErrorText("");
  };

  const clearRows = () => {
    setRows([]);
    setSelectedCountry(null);
    setFileName("");
    setTabularData({ headers: [], rows: [] });
    setMapping(EMPTY_MAPPING);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">MPL Export Navigator</p>
          <h1 className="text-2xl font-semibold">
            {isEn ? "Control Tower" : "Control Tower export"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn
              ? "Upload CSV/XLSX, map columns with dropdowns, then monitor profitability and channel performance."
              : "Importez un CSV/XLSX, mappez les colonnes avec des dropdowns, puis suivez rentabilite et performance des canaux."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "1) Upload dataset" : "1) Importer le dataset"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Supported formats: CSV, XLSX, XLS."
                : "Formats supportes: CSV, XLSX, XLS."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-dashed p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <UploadCloud className="h-4 w-4" />
                  {fileName || (isEn ? "No file selected" : "Aucun fichier selectionne")}
                </div>

                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  disabled={loading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFile(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              {loading ? (
                <div className="mt-3 text-sm text-muted-foreground">{isEn ? "Loading file..." : "Chargement du fichier..."}</div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{tabularData.headers.length} {isEn ? "columns" : "colonnes"}</Badge>
              <Badge variant="outline">{tabularData.rows.length} {isEn ? "rows" : "lignes"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "2) Column mapping (required)" : "2) Mapping colonnes (obligatoire)"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Each business field must be mapped through a dropdown."
                : "Chaque champ metier doit etre mappe via un menu deroulant."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              { key: "country", labelFr: "Colonne pays", labelEn: "Country column" },
              { key: "product", labelFr: "Colonne produit", labelEn: "Product column" },
              { key: "qty", labelFr: "Colonne quantite", labelEn: "Quantity column" },
              { key: "amount", labelFr: "Colonne montant", labelEn: "Amount column" },
              { key: "currency", labelFr: "Colonne devise", labelEn: "Currency column" },
              { key: "incoterm", labelFr: "Colonne incoterm", labelEn: "Incoterm column" },
              { key: "channel", labelFr: "Colonne canal", labelEn: "Channel column" },
              { key: "transportCost", labelFr: "Colonne cout transport", labelEn: "Transport cost column" },
            ].map((field) => (
              <div className="space-y-1" key={field.key}>
                <Label>{isEn ? field.labelEn : field.labelFr}</Label>
                <Select
                  value={mapping[field.key as keyof ColumnMapping]}
                  onValueChange={(value) =>
                    setMapping((prev) => ({ ...prev, [field.key]: value }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>
                    {tabularData.headers.map((header) => (
                      <SelectItem key={`${field.key}-${header}`} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="space-y-1 md:col-span-2">
              <Label>{isEn ? "Import mode" : "Mode d'import"}</Label>
              <Select value={importMode} onValueChange={(value) => setImportMode(value as "merge" | "replace")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">{isEn ? "Merge with existing rows" : "Fusionner avec les lignes existantes"}</SelectItem>
                  <SelectItem value="replace">{isEn ? "Replace existing rows" : "Remplacer les lignes existantes"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button onClick={applyMapping} disabled={!hasMappedRequiredFields}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                {isEn ? "Apply mapping" : "Appliquer le mapping"}
              </Button>
              <Button variant="outline" onClick={clearRows}>
                <RefreshCw className="mr-1 h-4 w-4" />
                {isEn ? "Reset" : "Reinitialiser"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "3) Manual row" : "3) Ajout manuel"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Add missing sales operations with controlled dropdowns."
                : "Ajoutez les operations manquantes avec menus deroulants controles."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>{isEn ? "Country" : "Pays"}</Label>
              <Select value={manualRow.country} onValueChange={(value) => setManualRow((prev) => ({ ...prev, country: value }))}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={`manual-country-${country.iso2}`} value={country.iso2}>
                      {lang === "en" ? country.label_en : country.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Product" : "Produit"}</Label>
              <Select value={manualRow.productCode} onValueChange={(value) => setManualRow((prev) => ({ ...prev, productCode: value }))}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((product) => (
                    <SelectItem key={`manual-product-${product.code}`} value={product.code}>
                      {lang === "en" ? product.label_en : product.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Quantity" : "Quantite"}</Label>
              <Input
                type="number"
                min={1}
                value={manualRow.qty}
                onChange={(event) => setManualRow((prev) => ({ ...prev, qty: event.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Amount" : "Montant"}</Label>
              <Input
                type="number"
                min={0}
                value={manualRow.amount}
                onChange={(event) => setManualRow((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Currency" : "Devise"}</Label>
              <Select value={manualRow.currency} onValueChange={(value) => setManualRow((prev) => ({ ...prev, currency: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={`manual-currency-${currency.value}`} value={currency.value}>{currency.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Incoterm</Label>
              <Select value={manualRow.incoterm} onValueChange={(value) => setManualRow((prev) => ({ ...prev, incoterm: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((incoterm) => (
                    <SelectItem key={`manual-incoterm-${incoterm.value}`} value={incoterm.value}>{incoterm.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Channel" : "Canal"}</Label>
              <Select value={manualRow.channel} onValueChange={(value) => setManualRow((prev) => ({ ...prev, channel: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISTRIBUTION_CHANNELS.map((channel) => (
                    <SelectItem key={`manual-channel-${channel.value}`} value={channel.value}>{channel.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Transport cost" : "Cout transport"}</Label>
              <Input
                type="number"
                min={0}
                value={manualRow.transportCost}
                onChange={(event) => setManualRow((prev) => ({ ...prev, transportCost: event.target.value }))}
              />
            </div>

            <div className="md:col-span-4">
              <Button onClick={addManualRow}>
                <Plus className="mr-1 h-4 w-4" />
                {isEn ? "Add row" : "Ajouter la ligne"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {errorText ? <p className="text-sm text-rose-700">{errorText}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Map & RSS watch" : "Carte & veille RSS"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Select a country on the map to filter dashboard metrics. RSS feed remains available below."
                : "Selectionnez un pays sur la carte pour filtrer les indicateurs du dashboard. Les flux RSS restent disponibles ci-dessous."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PanoramicControlTowerMap
              selectedCountry={selectedCountry}
              selectedLabel={
                selectedCountry
                  ? getCountryLabel(selectedCountry, lang)
                  : isEn
                  ? "All countries"
                  : "Tous les pays"
              }
              stats={selectedCountryStats}
              countryStats={countryStats}
              onCountrySelect={(iso) => setSelectedCountry((prev) => (prev === iso ? null : iso))}
              onReset={() => setSelectedCountry(null)}
            />
            <RssFooter
              territory={selectedCountry || "WORLD"}
              territoryLabel={
                selectedCountry
                  ? getCountryLabel(selectedCountry, lang)
                  : isEn
                  ? "World"
                  : "Monde"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Dashboard" : "Tableau de bord"}</CardTitle>
            <CardDescription>
              {selectedCountry
                ? isEn
                  ? `Filtered on ${getCountryLabel(selectedCountry, "en")}.`
                  : `Filtre actif sur ${getCountryLabel(selectedCountry, "fr")}.`
                : isEn
                ? "Top products by country, profitable destinations and channel performance."
                : "Top produits par pays, destinations rentables et performance canaux."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Rows" : "Lignes"}</div>
                <div className="text-2xl font-semibold">{rowsForDashboard.length}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Countries" : "Pays"}</div>
                <div className="text-2xl font-semibold">{new Set(rowsForDashboard.map((row) => row.country)).size}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Channels" : "Canaux"}</div>
                <div className="text-2xl font-semibold">{new Set(rowsForDashboard.map((row) => row.channel)).size}</div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold">{isEn ? "Top products by country" : "Top produits par pays"}</p>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">{isEn ? "Country" : "Pays"}</th>
                        <th className="px-2 py-2 text-left">{isEn ? "Product" : "Produit"}</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">{isEn ? "Amount" : "Montant"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProductsByCountry.map((entry) => (
                        <tr key={`${entry.country}-${entry.productCode}`} className="border-t">
                          <td className="px-2 py-2">{getCountryLabel(entry.country, lang)}</td>
                          <td className="px-2 py-2">{getProductLabel(entry.productCode, lang)}</td>
                          <td className="px-2 py-2 text-right">{entry.qty.toFixed(0)}</td>
                          <td className="px-2 py-2 text-right">{formatMoney(entry.amount, "EUR")}</td>
                        </tr>
                      ))}
                      {!topProductsByCountry.length ? (
                        <tr>
                          <td className="px-2 py-3 text-center text-muted-foreground" colSpan={4}>
                            {isEn ? "No data yet" : "Pas de donnees"}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">{isEn ? "Most profitable countries" : "Pays les plus rentables"}</p>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">{isEn ? "Country" : "Pays"}</th>
                        <th className="px-2 py-2 text-right">CA</th>
                        <th className="px-2 py-2 text-right">{isEn ? "Costs" : "Couts"}</th>
                        <th className="px-2 py-2 text-right">{isEn ? "Margin" : "Marge"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitabilityByCountry.map((entry) => (
                        <tr key={`profit-${entry.country}`} className="border-t">
                          <td className="px-2 py-2">{getCountryLabel(entry.country, lang)}</td>
                          <td className="px-2 py-2 text-right">{formatMoney(entry.revenue, "EUR")}</td>
                          <td className="px-2 py-2 text-right">{formatMoney(entry.cost, "EUR")}</td>
                          <td className={`px-2 py-2 text-right ${entry.margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {formatMoney(entry.margin, "EUR")}
                          </td>
                        </tr>
                      ))}
                      {!profitabilityByCountry.length ? (
                        <tr>
                          <td className="px-2 py-3 text-center text-muted-foreground" colSpan={4}>
                            {isEn ? "No data yet" : "Pas de donnees"}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">{isEn ? "Best channels" : "Canaux performants"}</p>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">{isEn ? "Channel" : "Canal"}</th>
                      <th className="px-2 py-2 text-right">CA</th>
                      <th className="px-2 py-2 text-right">{isEn ? "Margin" : "Marge"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelPerformance.map((entry) => (
                      <tr key={`channel-${entry.channel}`} className="border-t">
                        <td className="px-2 py-2">{entry.channel}</td>
                        <td className="px-2 py-2 text-right">{formatMoney(entry.amount, "EUR")}</td>
                        <td className={`px-2 py-2 text-right ${entry.margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {formatMoney(entry.margin, "EUR")}
                        </td>
                      </tr>
                    ))}
                    {!channelPerformance.length ? (
                      <tr>
                        <td className="px-2 py-3 text-center text-muted-foreground" colSpan={3}>
                          {isEn ? "No data yet" : "Pas de donnees"}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">{isEn ? "Optimization suggestions" : "Pistes d'optimisation"}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}


```

## src/pages/Copilote.tsx
`$ext
import * as React from "react";
import { Bot, ExternalLink, Loader2, Send } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ingestChatExchange } from "@/lib/chatIngest";
import { buildGuidedFallback, buildResearchLinks } from "@/lib/chatGuidance";
import { detectCountryFromShortInput } from "@/lib/countryInput";
import { supabase } from "@/integrations/supabase/client";

type ChatDocument = {
  name: string;
  required: boolean;
  source_url: string | null;
};

type ChatDossier = {
  summary: string;
  documents: ChatDocument[];
  restrictions: string[];
  sanctions: string[];
  taxes: string[];
  logistics: string[];
  contract: { clauses: string[] };
  next_actions: string[];
};

type ChatResponse = {
  ok?: boolean;
  error?: string;
  detail?: string;
  thread_id?: string;
  session_id?: string;
  answer?: string;
  answer_markdown?: string;
  mode?: string;
  missing_questions?: string[];
  follow_up_questions?: string[];
  source_links?: Array<{ title: string; url: string }>;
  dossier?: ChatDossier;
};

type QuotaResponse = {
  ok?: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
  error?: string;
  detail?: string;
};

type AssistantBlocks = {
  summary: string[];
  checklist: Array<{ label: string; required: boolean }>;
  risks: string[];
  documents: ChatDocument[];
  actions: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: Array<{ title: string; url: string }>;
  followUpQuestions?: string[];
  blocks?: AssistantBlocks;
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const COUNTRY_FOLLOWUP_RE = /(quel est le pays|pays de destination|destination exact)/i;
const COUNTRY_MISSING_RE = /(pays.*(a confirmer|manquant)|quel est le pays de destination|destination exacte)/i;

function isUncertainAnswer(answer: string) {
  const txt = answer.trim().toLowerCase();
  if (!txt) return true;
  if (txt.length < 40) return true;
  if (/(pas de reponse|indisponible|erreur|vide|reessaye|reessaie)/i.test(txt)) return true;
  return false;
}

function buildAssistantBlocks(dossier: ChatDossier | undefined): AssistantBlocks | undefined {
  if (!dossier) return undefined;

  const summary = String(dossier.summary || "")
    .split("\n")
    .map((line) => line.replace(/^[-\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  const checklist = (Array.isArray(dossier.documents) ? dossier.documents : [])
    .map((doc) => ({ label: doc.name || "Document", required: Boolean(doc.required) }))
    .slice(0, 8);

  const risks = [
    ...(Array.isArray(dossier.restrictions) ? dossier.restrictions : []),
    ...(Array.isArray(dossier.sanctions) ? dossier.sanctions : []),
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const documents = (Array.isArray(dossier.documents) ? dossier.documents : [])
    .filter((doc) => doc && typeof doc === "object")
    .slice(0, 8);

  const actions = (Array.isArray(dossier.next_actions) ? dossier.next_actions : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!summary.length && !checklist.length && !risks.length && !documents.length && !actions.length) {
    return undefined;
  }

  return { summary, checklist, risks, documents, actions };
}

export default function Copilote() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Bonjour. Posez votre question export en une phrase. Je reponds avec resume, checklist, risques, documents et actions.",
    },
  ]);

  const [sessionId, setSessionId] = React.useState<string | undefined>();
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [quotaLimit, setQuotaLimit] = React.useState(30);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [quotaStatus, setQuotaStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [destinationCountry, setDestinationCountry] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading]);

  const refreshQuota = React.useCallback(async () => {
    try {
      const resp = await fetch("/api/hs/quota", { method: "GET" });
      const data = (await resp.json().catch(() => ({}))) as QuotaResponse;
      if (!resp.ok || data?.ok === false || typeof data?.remaining !== "number" || typeof data?.limit !== "number") {
        throw new Error(data?.detail || data?.error || `quota_failed_${resp.status}`);
      }
      setQuotaLimit(data.limit);
      setRemaining(data.remaining);
      setQuotaStatus("ready");
    } catch {
      setQuotaStatus("error");
      setRemaining(null);
    }
  }, []);

  React.useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const quotaLabel =
    quotaStatus === "loading"
      ? ".../30"
      : quotaStatus === "error"
        ? "indisponible"
        : `${Math.max(0, Number(remaining ?? 0))}/${quotaLimit}`;

  const send = React.useCallback(async (preset?: string) => {
    const question = (preset ?? draft).trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);
    setError(null);

    try {
      let trackedRemaining: number | null = null;
      const trackingResp = await fetch(
        `/api/hs/search?mode=track&q=${encodeURIComponent(question)}&universe=copilote&locale=fr`,
        { method: "GET" },
      );
      const trackingData = (await trackingResp.json().catch(() => ({}))) as QuotaResponse;
      if (typeof trackingData?.limit === "number") setQuotaLimit(trackingData.limit);
      if (typeof trackingData?.remaining === "number") {
        trackedRemaining = trackingData.remaining;
        setRemaining(trackedRemaining);
        setQuotaStatus("ready");
      }

      if (trackingResp.status === 429 || trackingData?.error === "daily_limit_reached") {
        const blockedAnswer = "Quota gratuit atteint pour les 24h. Reessayez plus tard ou contactez l'equipe MPL.";
        setError(blockedAnswer);
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: blockedAnswer }]);
        return;
      }
      if (!trackingResp.ok || trackingData?.ok === false) {
        throw new Error(trackingData?.detail || trackingData?.error || `quota_track_failed_${trackingResp.status}`);
      }

      const detectedCountry = detectCountryFromShortInput(question);
      if (detectedCountry) setDestinationCountry(detectedCountry);
      const resolvedDestination = detectedCountry || destinationCountry || null;

      const questionForApi = detectedCountry
        ? `Destination: ${detectedCountry}. Je n'ai donne que le pays. Cadre le dossier export et demande ensuite produit + code HS + incoterm.`
        : question;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: questionForApi,
          thread_id: sessionId || null,
          lang: "fr",
          overrides: {
            destination: resolvedDestination,
            incoterm: "DAP",
            transport: "road",
          },
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as ChatResponse;
      if (!resp.ok || data?.ok === false || data?.error) {
        throw new Error(data?.detail || data?.error || `chat_failed_${resp.status}`);
      }

      const answerRaw = String(data?.answer_markdown || data?.answer || "").trim();
      const guided = buildGuidedFallback(resolvedDestination ? `export vers ${resolvedDestination}` : question);

      const modelFollowUps = [
        ...(Array.isArray(data?.follow_up_questions) ? data.follow_up_questions : []),
        ...(Array.isArray(data?.missing_questions) ? data.missing_questions : []),
      ]
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 6);

      const filteredModelFollowUps = resolvedDestination
        ? modelFollowUps.filter((q) => !COUNTRY_FOLLOWUP_RE.test(q))
        : modelFollowUps;

      const filteredGuidedFollowUps = resolvedDestination
        ? guided.followUpQuestions.filter((q) => !COUNTRY_FOLLOWUP_RE.test(q))
        : guided.followUpQuestions;

      const followUpQuestions = filteredModelFollowUps.length
        ? filteredModelFollowUps.slice(0, 3)
        : (filteredGuidedFollowUps.length ? filteredGuidedFollowUps.slice(0, 3) : guided.followUpQuestions.slice(0, 3));

      const countryStillMissing = Boolean(resolvedDestination && COUNTRY_MISSING_RE.test(answerRaw.toLowerCase()));
      const blocks = buildAssistantBlocks(data?.dossier);
      const uncertain = (isUncertainAnswer(answerRaw) && !blocks) || countryStillMissing;

      const links = [
        ...(Array.isArray(data?.source_links)
          ? data.source_links
              .filter((x): x is { title: string; url: string } => Boolean(x?.title && x?.url))
              .map((x) => ({ title: x.title, url: x.url }))
          : []),
        ...(uncertain ? buildResearchLinks(question).map((x) => ({ title: x.title, url: x.url })) : []),
      ].slice(0, 6);

      const answer = uncertain ? guided.answer : (answerRaw || guided.answer);

      const nextThreadId = data?.thread_id || data?.session_id;
      if (nextThreadId) setSessionId(nextThreadId);
      if (typeof trackedRemaining === "number") {
        setRemaining(trackedRemaining);
        setQuotaStatus("ready");
      }

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: answer,
        links,
        followUpQuestions,
        blocks,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      void ingestChatExchange({
        channel: "copilote_page",
        source: "CopilotePage",
        question,
        answer,
        mode: data?.mode || (uncertain ? "api_chat_with_links" : "api_chat"),
        context: {
          session_id: nextThreadId || sessionId || null,
          remaining: trackedRemaining,
          source_links_count: links.length,
          follow_up_questions_count: followUpQuestions.length,
          destination_country: resolvedDestination,
          has_structured_blocks: Boolean(blocks),
        },
      });
    } catch (err: any) {
      const guided = buildGuidedFallback(question);
      const links = buildResearchLinks(question).map((x) => ({ title: x.title, url: x.url }));
      const answer = guided.answer;

      setError("Reponse serveur indisponible: je passe en mode guide pour avancer pas a pas.");
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: answer,
          links,
          followUpQuestions: guided.followUpQuestions,
        },
      ]);

      void ingestChatExchange({
        channel: "copilote_page",
        source: "CopilotePage",
        question,
        answer,
        mode: "assistant_error_with_links",
        context: {
          session_id: sessionId || null,
          error: String(err?.message || "api_chat_error"),
          source_links_count: links.length,
          follow_up_questions_count: guided.followUpQuestions.length,
          destination_country: destinationCountry,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [draft, loading, destinationCountry, sessionId]);

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <Card className="mx-auto w-full max-w-5xl">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle>Copilote IA export</CardTitle>
              <Badge variant="secondary">Gratuit</Badge>
            </div>
            <p className="text-sm text-slate-600">Resume, checklist, risques, documents et actions sur une seule reponse.</p>
            <p className="text-xs text-slate-500">Quota restant: {quotaLabel}</p>
          </CardHeader>

          <CardContent className="space-y-3">
            <div ref={scrollRef} className="max-h-[60vh] min-h-[380px] space-y-3 overflow-auto rounded-xl border bg-slate-50 p-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" ? (
                    <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-3 w-3" />
                    </div>
                  ) : null}

                  <div className={`max-w-[86%] rounded-xl border px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-white"}`}>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                    {m.role === "assistant" && m.blocks ? (
                      <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 md:grid-cols-2">
                        {m.blocks.summary.length ? (
                          <div className="rounded-lg border bg-muted/30 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resume</div>
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                              {m.blocks.summary.map((line) => <li key={`${m.id}-sum-${line}`}>{line}</li>)}
                            </ul>
                          </div>
                        ) : null}

                        {m.blocks.checklist.length ? (
                          <div className="rounded-lg border bg-muted/30 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Checklist</div>
                            <ul className="mt-1 space-y-1 text-xs">
                              {m.blocks.checklist.map((item) => (
                                <li key={`${m.id}-chk-${item.label}`}>{item.required ? "[x]" : "[ ]"} {item.label}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {m.blocks.risks.length ? (
                          <div className="rounded-lg border bg-rose-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Risques</div>
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-rose-800">
                              {m.blocks.risks.map((item) => <li key={`${m.id}-risk-${item}`}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null}

                        {m.blocks.actions.length ? (
                          <div className="rounded-lg border bg-emerald-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Actions</div>
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-emerald-800">
                              {m.blocks.actions.map((item) => <li key={`${m.id}-act-${item}`}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {m.role === "assistant" && m.links?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                        {m.links.map((link) => (
                          <a
                            key={`${m.id}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-slate-700 hover:bg-muted"
                          >
                            {link.title}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {m.role === "assistant" && m.followUpQuestions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                        {m.followUpQuestions.map((q) => (
                          <button
                            key={`${m.id}-${q}`}
                            type="button"
                            onClick={() => setDraft(q)}
                            className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-slate-700 hover:bg-muted"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyse en cours...
                </div>
              ) : null}
            </div>

            {error ? <div className="text-xs text-rose-600">{error}</div> : null}

            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ecrivez votre question export ici..."
                className="min-h-[96px] flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />

              <Button onClick={() => void send()} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">Entree = envoyer, Shift+Entree = nouvelle ligne.</p>
          </CardContent>
        </Card>
      </main>
    </PublicLayout>
  );
}


```

## src/pages/ExportSimulator.tsx
`$ext
import * as React from "react";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { computeLandedCost, type Currency, type Incoterm } from "@/lib/exportSimulator";
import { runExportWorkflow } from "@/lib/workflows/exportWorkflow";
import { CostBreakdownBar, CostSharePie } from "@/components/charts/CostCharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

const INCOTERMS: Incoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CHF", "CNY"];

export default function ExportSimulator() {
  const [form, setForm] = React.useState({
    quantity: 100,

    productUnitPrice: 12.5,
    productCurrency: "EUR" as Currency,
    fxToEur: 0.92,

    incoterm: "EXW" as Incoterm,

    preCarriageEur: 120,
    mainCarriageEur: 450,
    insuranceMode: "rate" as "rate" | "fixed",
    insuranceRatePct: 0.6,
    insuranceFixedEur: 0,

    exportClearanceEur: 40,
    importClearanceEur: 85,
    handlingEur: 60,
    otherFeesEur: 35,

    dutyRatePct: 4.2,
    preferOrigin: false,
    dutyRatePreferentialPct: 0,
    vatRatePct: 20,

    sellingUnitPriceEur: 21,
  });

  const result = React.useMemo(() => computeLandedCost(form), [form]);
  const workflow = React.useMemo(
    () =>
      runExportWorkflow({
        origin: "FR",
        destination: "WORLD",
        hs6: "000000",
        incoterm: form.incoterm,
        value: result.customsValueEur,
        currency: "EUR",
        transport: "road",
        payment: "tt",
      }),
    [form.incoterm, result.customsValueEur]
  );
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const onNum =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [k]: Number(e.target.value) }));

  const onStr =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <AppLayout wrapperClassName="simulator-world">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* HERO */}
        <div className="mb-8 rounded-3xl border bg-card/95 p-6 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Simulation opÃ©rationnelle
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Calcule ton coÃ»t complet export (Incoterm, transport, droits, TVA)
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                DÃ©cide vite, sans approximations â€” coÃ»t complet, coÃ»t unitaire, marge, et lecture visuelle.
              </p>

              {/* mini actions (cohÃ©rent avec l'app) */}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/app/control-tower">
                  <Button variant="outline">Retour cockpit</Button>
                </Link>
                <Link to="/app/centre-veille/reglementation">
                  <Button variant="outline">Veille</Button>
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setForm((s) => ({ ...s, incoterm: "EXW", productCurrency: "EUR", fxToEur: 1 }));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Repartir dâ€™un exemple
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {/* INPUTS */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>ParamÃ¨tres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>QuantitÃ©</Label>
                  <Input type="number" value={form.quantity} onChange={onNum("quantity")} min={1} />
                </div>

                <div className="space-y-2">
                  <Label>Incoterm</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.incoterm}
                    onChange={onStr("incoterm")}
                  >
                    {INCOTERMS.map((it) => (
                      <option key={it} value={it}>
                        {it}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Prix unitaire produit</Label>
                  <Input
                    type="number"
                    value={form.productUnitPrice}
                    onChange={onNum("productUnitPrice")}
                    min={0}
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Devise</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.productCurrency}
                    onChange={(e) => setForm((s) => ({ ...s, productCurrency: e.target.value as Currency }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Taux de change â†’ EUR (1 devise = X EUR)</Label>
                  <Input type="number" value={form.fxToEur} onChange={onNum("fxToEur")} min={0} step="0.0001" />
                  <div className="text-xs text-muted-foreground">Si devise = EUR, tu peux laisser 1.</div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>PrÃ©-acheminement (â‚¬)</Label>
                  <Input
                    type="number"
                    value={form.preCarriageEur}
                    onChange={onNum("preCarriageEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Transport principal (â‚¬)</Label>
                  <Input
                    type="number"
                    value={form.mainCarriageEur}
                    onChange={onNum("mainCarriageEur")}
                    min={0}
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assurance</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.insuranceMode}
                    onChange={(e) => setForm((s) => ({ ...s, insuranceMode: e.target.value as any }))}
                  >
                    <option value="rate">Taux (%)</option>
                    <option value="fixed">Forfait (â‚¬)</option>
                  </select>
                </div>

                {form.insuranceMode === "rate" ? (
                  <div className="space-y-2">
                    <Label>Taux assurance (%)</Label>
                    <Input
                      type="number"
                      value={form.insuranceRatePct}
                      onChange={onNum("insuranceRatePct")}
                      min={0}
                      step="0.01"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Assurance forfait (â‚¬)</Label>
                    <Input
                      type="number"
                      value={form.insuranceFixedEur}
                      onChange={onNum("insuranceFixedEur")}
                      min={0}
                      step="0.01"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>FormalitÃ©s export (â‚¬)</Label>
                  <Input
                    type="number"
                    value={form.exportClearanceEur}
                    onChange={onNum("exportClearanceEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>DÃ©douanement import (â‚¬)</Label>
                  <Input
                    type="number"
                    value={form.importClearanceEur}
                    onChange={onNum("importClearanceEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manutention / terminal (â‚¬)</Label>
                  <Input
                    type="number"
                    value={form.handlingEur}
                    onChange={onNum("handlingEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Autres frais (â‚¬)</Label>
                  <Input
                    type="number"
                    value={form.otherFeesEur}
                    onChange={onNum("otherFeesEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Droits de douane (%)</Label>
                  <Input type="number" value={form.dutyRatePct} onChange={onNum("dutyRatePct")} min={0} step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>TVA import (%)</Label>
                  <Input type="number" value={form.vatRatePct} onChange={onNum("vatRatePct")} min={0} step="0.01" />
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    id="prefer"
                    type="checkbox"
                    checked={form.preferOrigin}
                    onChange={(e) => setForm((s) => ({ ...s, preferOrigin: e.target.checked }))}
                  />
                  <Label htmlFor="prefer">Origine prÃ©fÃ©rentielle (rÃ©duction droits)</Label>
                </div>

                {form.preferOrigin ? (
                  <div className="space-y-2 col-span-2">
                    <Label>Droits prÃ©fÃ©rentiels (%)</Label>
                    <Input
                      type="number"
                      value={form.dutyRatePreferentialPct}
                      onChange={onNum("dutyRatePreferentialPct")}
                      min={0}
                      step="0.01"
                    />
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Prix de vente unitaire (â‚¬) (pour marge)</Label>
                <Input
                  type="number"
                  value={form.sellingUnitPriceEur}
                  onChange={onNum("sellingUnitPriceEur")}
                  min={0}
                  step="0.01"
                />
              </div>


              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={scrollToResults}>
                  Voir le resultat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* OUTPUTS + CHARTS */}
          <div ref={resultsRef} className="space-y-6 md:col-span-3">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>CoÃ»t complet</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{eur(result.totalLandedCostEur)}</CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>CoÃ»t unitaire</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{eur(result.unitLandedCostEur)}</CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-2xl font-semibold">{result.marginEur !== undefined ? eur(result.marginEur) : "â€”"}</div>
                  <div className="text-sm text-muted-foreground">
                    {result.marginPct !== undefined ? `${pct(result.marginPct)} du CA` : "Renseigne un prix de vente"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Lecture douane (utile pour vÃ©rifier)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valeur marchandise</span>
                  <span className="font-medium">{eur(result.goodsValueEur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valeur en douane (base droits)</span>
                  <span className="font-medium">{eur(result.customsValueEur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Droits</span>
                  <span className="font-medium">{eur(result.dutyEur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TVA (base {eur(result.vatBaseEur)})</span>
                  <span className="font-medium">{eur(result.vatEur)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Workflow unifiÃ© (shipment)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{workflow.amounts.duty_estimate.label}</span>
                  <span className="font-medium">
                    {eur(workflow.amounts.duty_estimate.value)} ({workflow.amounts.duty_estimate.source})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{workflow.amounts.tax_estimate.label}</span>
                  <span className="font-medium">
                    {eur(workflow.amounts.tax_estimate.value)} ({workflow.amounts.tax_estimate.source})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{workflow.amounts.logistics_estimate.label}</span>
                  <span className="font-medium">
                    {eur(workflow.amounts.logistics_estimate.value)} ({workflow.amounts.logistics_estimate.source})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{workflow.amounts.total_estimate.label}</span>
                  <span className="font-semibold">
                    {eur(workflow.amounts.total_estimate.value)} ({workflow.amounts.total_estimate.source})
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>RÃ©partition des coÃ»ts</CardTitle>
                </CardHeader>
                <CardContent>
                  <CostBreakdownBar lines={result.lines.map((l) => ({ label: l.label, amountEur: l.amountEur }))} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Part relative</CardTitle>
                </CardHeader>
                <CardContent>
                  <CostSharePie lines={result.lines.map((l) => ({ label: l.label, amountEur: l.amountEur }))} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border p-6 text-sm text-muted-foreground">
          HypothÃ¨ses simplifiÃ©es (mais opÃ©rationnelles) : valeur en douane ~ marchandise + transport principal + assurance
          (et prÃ©-acheminement selon incoterm). Base TVA import ~ valeur douane + droits + frais import.
        </div>
      </div>
    </AppLayout>
  );
}

```

## src/pages/InvoiceCheck.tsx
`$ext
import * as React from "react";
import { FileUp, Loader2, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { runImportWorkflow } from "@/lib/workflows/importWorkflow";
import {
  COUNTRIES,
  CURRENCIES,
  INCOTERMS,
  OPERATION_TYPES,
  PAYMENT_TERMS,
  PRODUCTS,
  getCountryLabel,
  getLocalizedLabel,
} from "@/lib/constants";
import { sanitizeOptionalComment, toFriendlyErrorMessage } from "@/lib/textSanitizer";
import { useI18n } from "@/contexts/LanguageContext";

type CheckLevel = "ok" | "warning" | "risk";

type InvoiceCheckItem = {
  level: CheckLevel;
  label: string;
  detail: string;
};

type InvoiceAnalysisResult = {
  ok: boolean;
  analysis_source: string;
  status: "ok" | "review" | "risk";
  extracted: {
    invoice_number: string | null;
    date: string | null;
    seller: string | null;
    buyer: string | null;
    destination: string | null;
    incoterm: string | null;
    currency: string | null;
    total_ht: number | null;
    total_ttc: number | null;
    line_count: number | null;
  };
  checks: InvoiceCheckItem[];
  recommendations: string[];
  checklist: string[];
};

type EditableInvoiceContext = {
  operationType: string;
  destination: string;
  incoterm: string;
  currency: string;
  paymentTerm: string;
  productCode: string;
  optionalComment: string;
};

const INITIAL_CONTEXT: EditableInvoiceContext = {
  operationType: "export",
  destination: "",
  incoterm: "",
  currency: "EUR",
  paymentTerm: "",
  productCode: "",
  optionalComment: "",
};

function formatMoney(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency || "EUR"}`;
  }
}

function resolveStatusFromChecks(checks: InvoiceCheckItem[]): "ok" | "review" | "risk" {
  if (checks.some((item) => item.level === "risk")) return "risk";
  if (checks.some((item) => item.level === "warning")) return "review";
  return "ok";
}

function buildLocalChecks(ctx: EditableInvoiceContext, parsed: InvoiceAnalysisResult | null) {
  const checks: InvoiceCheckItem[] = [];

  if (!ctx.destination) {
    checks.push({
      level: "warning",
      label: "Destination",
      detail: "Le pays de destination doit etre confirme pour la partie douane et sanctions.",
    });
  } else {
    checks.push({
      level: "ok",
      label: "Destination",
      detail: `Destination selectionnee: ${getCountryLabel(ctx.destination, "fr")}.`,
    });
  }

  if (!ctx.incoterm) {
    checks.push({
      level: "risk",
      label: "Incoterm",
      detail: "Incoterm manquant: impossible de fixer clairement la repartition des risques et couts.",
    });
  } else {
    checks.push({
      level: "ok",
      label: "Incoterm",
      detail: `Incoterm confirme: ${ctx.incoterm}.`,
    });
  }

  if (!ctx.paymentTerm) {
    checks.push({
      level: "warning",
      label: "Paiement",
      detail: "Mode de paiement non precise. Ajoutez-le pour reduire le risque contractuel.",
    });
  } else {
    checks.push({
      level: "ok",
      label: "Paiement",
      detail: `Mode de paiement: ${ctx.paymentTerm}.`,
    });
  }

  if (parsed?.extracted.total_ht != null && parsed?.extracted.total_ttc != null && parsed.extracted.total_ttc < parsed.extracted.total_ht) {
    checks.push({
      level: "risk",
      label: "Totaux HT/TTC",
      detail: "Incoherence detectee: le total TTC est inferieur au total HT.",
    });
  }

  if ((parsed?.extracted.line_count || 0) <= 0) {
    checks.push({
      level: "warning",
      label: "Lignes facture",
      detail: "Aucune ligne produit detectee automatiquement. Controle manuel recommande.",
    });
  }

  return checks;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function statusBadge(status: "ok" | "review" | "risk") {
  if (status === "ok") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <ShieldCheck className="h-3.5 w-3.5" /> OK
      </Badge>
    );
  }
  if (status === "review") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
        <TriangleAlert className="h-3.5 w-3.5" /> Points a corriger
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-rose-100 text-rose-800 hover:bg-rose-100">
      <ShieldAlert className="h-3.5 w-3.5" /> Risques
    </Badge>
  );
}

function checkColor(level: CheckLevel) {
  if (level === "ok") return "text-emerald-700";
  if (level === "warning") return "text-amber-700";
  return "text-rose-700";
}

export default function InvoiceCheck() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const isEn = lang === "en";

  const [context, setContext] = React.useState<EditableInvoiceContext>(INITIAL_CONTEXT);
  const [pdfFileName, setPdfFileName] = React.useState<string>("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<InvoiceAnalysisResult | null>(null);
  const [localChecks, setLocalChecks] = React.useState<InvoiceCheckItem[]>([]);
  const [errorText, setErrorText] = React.useState<string>("");

  const mergedChecks = React.useMemo(() => {
    const serverChecks = Array.isArray(analysis?.checks) ? analysis?.checks : [];
    const all = [...serverChecks, ...localChecks];
    return all;
  }, [analysis?.checks, localChecks]);

  const finalStatus = React.useMemo(() => {
    if (analysis?.status) {
      const localStatus = resolveStatusFromChecks(localChecks);
      if (analysis.status === "risk" || localStatus === "risk") return "risk";
      if (analysis.status === "review" || localStatus === "review") return "review";
      return "ok";
    }
    return resolveStatusFromChecks(localChecks);
  }, [analysis?.status, localChecks]);

  const importWorkflow = React.useMemo(
    () =>
      runImportWorkflow({
        origin: context.operationType === "import" ? "WORLD" : "FR",
        destination: context.destination || analysis?.extracted.destination || "FR",
        hs6: context.productCode || "000000",
        incoterm: context.incoterm || analysis?.extracted.incoterm || "DAP",
        value: Number(analysis?.extracted.total_ht || analysis?.extracted.total_ttc || 0),
        currency: context.currency || analysis?.extracted.currency || "EUR",
        transport: "road",
        payment: context.paymentTerm || "tt",
      }),
    [
      analysis?.extracted.currency,
      analysis?.extracted.destination,
      analysis?.extracted.incoterm,
      analysis?.extracted.total_ht,
      analysis?.extracted.total_ttc,
      context.currency,
      context.destination,
      context.incoterm,
      context.operationType,
      context.paymentTerm,
      context.productCode,
    ],
  );

  const onContextChange = (patch: Partial<EditableInvoiceContext>) => {
    setContext((prev) => ({ ...prev, ...patch }));
  };

  const applyExtractedToContext = React.useCallback((result: InvoiceAnalysisResult) => {
    setContext((prev) => ({
      ...prev,
      destination: result.extracted.destination || prev.destination,
      incoterm: result.extracted.incoterm || prev.incoterm,
      currency: result.extracted.currency || prev.currency || "EUR",
    }));
  }, []);

  const runChecks = React.useCallback((result: InvoiceAnalysisResult | null, currentContext: EditableInvoiceContext) => {
    const checks = buildLocalChecks(currentContext, result);
    setLocalChecks(checks);
  }, []);

  const analyzeInvoice = React.useCallback(
    async (file: File) => {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({
          title: isEn ? "Unsupported file" : "Fichier non supporte",
          description: isEn ? "Please upload a PDF invoice." : "Merci d'importer une facture au format PDF.",
        });
        return;
      }

      setLoading(true);
      setErrorText("");
      setPdfFileName(file.name);

      try {
        const payload = {
          file_name: file.name,
          file_base64: await fileToBase64(file),
          operation_type: context.operationType,
          destination: context.destination,
          incoterm: context.incoterm,
          currency: context.currency,
          payment_term: context.paymentTerm,
          product_code: context.productCode,
          optional_comment: sanitizeOptionalComment(context.optionalComment),
        };

        const response = await fetch("/api/invoice/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = (await response.json().catch(() => ({}))) as InvoiceAnalysisResult & { error?: string };

        if (!response.ok || !json.ok) {
          throw new Error(json?.error || `invoice_analyze_failed_${response.status}`);
        }

        setAnalysis(json);
        applyExtractedToContext(json);

        const nextContext: EditableInvoiceContext = {
          ...context,
          destination: json.extracted.destination || context.destination,
          incoterm: json.extracted.incoterm || context.incoterm,
          currency: json.extracted.currency || context.currency,
        };
        runChecks(json, nextContext);

        toast({
          title: isEn ? "Invoice analyzed" : "Facture analysee",
          description: isEn
            ? "Extraction completed. Please review and adjust the controlled fields."
            : "Extraction terminee. Merci de verifier les champs controles ci-dessous.",
        });
      } catch (error) {
        const friendly = toFriendlyErrorMessage(error, lang);
        setErrorText(friendly);
        toast({
          title: isEn ? "Analysis unavailable" : "Analyse indisponible",
          description: friendly,
        });
      } finally {
        setLoading(false);
      }
    },
    [applyExtractedToContext, context, isEn, lang, runChecks, toast],
  );

  React.useEffect(() => {
    runChecks(analysis, context);
  }, [analysis, context, runChecks]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">MPL Export Navigator</p>
          <h1 className="text-2xl font-semibold">
            {isEn ? "Invoice verification" : "Verification facture export/import"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn
              ? "Upload a PDF, extract key fields, validate consistency, and get an action checklist."
              : "Importez un PDF, detectez les champs cles, validez la coherence et obtenez une checklist actionnable."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Context (controlled fields)" : "Contexte (champs controles)"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Only dropdowns are allowed, plus one optional comment."
                : "Utilisation exclusive de menus deroulants, avec un seul commentaire optionnel."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>{isEn ? "Operation" : "Operation"}</Label>
              <Select value={context.operationType} onValueChange={(value) => onContextChange({ operationType: value })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {OPERATION_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{getLocalizedLabel(item, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Destination country" : "Pays destination"}</Label>
              <Select value={context.destination} onValueChange={(value) => onContextChange({ destination: value })}>
                <SelectTrigger><SelectValue placeholder={isEn ? "Select country" : "Choisir un pays"} /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.iso2} value={country.iso2}>
                      {lang === "en" ? country.label_en : country.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Incoterm</Label>
              <Select value={context.incoterm} onValueChange={(value) => onContextChange({ incoterm: value })}>
                <SelectTrigger><SelectValue placeholder="EXW/FCA/..." /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Currency" : "Devise"}</Label>
              <Select value={context.currency} onValueChange={(value) => onContextChange({ currency: value })}>
                <SelectTrigger><SelectValue placeholder="EUR/USD/..." /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Payment method" : "Mode de paiement"}</Label>
              <Select value={context.paymentTerm} onValueChange={(value) => onContextChange({ paymentTerm: value })}>
                <SelectTrigger><SelectValue placeholder="LC/CAD/..." /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{getLocalizedLabel(item, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Product" : "Produit"}</Label>
              <Select value={context.productCode} onValueChange={(value) => onContextChange({ productCode: value })}>
                <SelectTrigger><SelectValue placeholder={isEn ? "Select product" : "Choisir un produit"} /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((product) => (
                    <SelectItem key={product.code} value={product.code}>
                      {lang === "en" ? product.label_en : product.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-3">
              <Label>{isEn ? "Optional precision" : "Precision optionnelle"}</Label>
              <Textarea
                rows={2}
                value={context.optionalComment}
                onChange={(event) => onContextChange({ optionalComment: event.target.value })}
                placeholder={isEn ? "Optional details" : "Details optionnels"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Upload invoice PDF" : "Importer la facture PDF"}</CardTitle>
            <CardDescription>
              {isEn
                ? "File is analyzed without mandatory storage."
                : "Le fichier est analyse sans stockage obligatoire."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
                isDragging ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  void analyzeInvoice(file);
                }
              }}
            >
              <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm">
                {isEn ? "Drop your PDF here or choose a file" : "Glissez votre PDF ici ou choisissez un fichier"}
              </p>
              <div className="mt-3">
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={loading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void analyzeInvoice(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEn ? "Analyzing invoice..." : "Analyse de la facture en cours..."}
              </div>
            ) : null}

            {pdfFileName ? (
              <p className="text-xs text-muted-foreground">{isEn ? "Last file" : "Dernier fichier"}: {pdfFileName}</p>
            ) : null}

            {errorText ? <p className="text-sm text-rose-700">{errorText}</p> : null}
          </CardContent>
        </Card>

        {analysis ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{isEn ? "Analysis result" : "Resultat de l'analyse"}</CardTitle>
                  {statusBadge(finalStatus)}
                </div>
                <CardDescription>
                  {isEn ? "Detected values are editable in the controlled context above." : "Les valeurs detectees restent modifiables dans le contexte controle ci-dessus."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{isEn ? "Invoice number" : "Numero facture"}</div>
                  <div className="text-sm font-medium">{analysis.extracted.invoice_number || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="text-sm font-medium">{analysis.extracted.date || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{isEn ? "Detected destination" : "Destination detectee"}</div>
                  <div className="text-sm font-medium">{analysis.extracted.destination ? getCountryLabel(analysis.extracted.destination, lang) : "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">HT</div>
                  <div className="text-sm font-medium">{formatMoney(analysis.extracted.total_ht, context.currency)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">TTC</div>
                  <div className="text-sm font-medium">{formatMoney(analysis.extracted.total_ttc, context.currency)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{isEn ? "Detected lines" : "Lignes detectees"}</div>
                  <div className="text-sm font-medium">{analysis.extracted.line_count ?? "-"}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Checks and risks" : "Controles et risques"}</CardTitle>
                <CardDescription>
                  {isEn ? "No technical errors are exposed. Use this checklist to correct the invoice." : "Aucune erreur technique n'est exposee. Utilisez cette checklist pour corriger la facture."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {mergedChecks.map((check, index) => (
                  <div key={`${check.label}-${index}`} className="rounded-lg border bg-card px-3 py-2">
                    <p className={`text-sm font-medium ${checkColor(check.level)}`}>{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Action checklist" : "Checklist actionnable"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {(analysis.checklist || []).map((item) => (
                    <li key={`checklist-${item}`}>{item}</li>
                  ))}
                </ul>
                <Separator />
                <p className="text-sm font-medium">{isEn ? "Recommendations" : "Recommandations"}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {(analysis.recommendations || []).map((item) => (
                    <li key={`reco-${item}`}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Unified workflow" : "Workflow unifie"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "Estimated duties/taxes with source traceability (eu/mock/fallback)."
                    : "Estimation droits/taxes avec tracabilite de source (eu/mock/fallback)."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{importWorkflow.amounts.duty_estimate.label}</span>
                  <span className="font-medium">
                    {formatMoney(importWorkflow.amounts.duty_estimate.value, importWorkflow.amounts.duty_estimate.currency)} ({importWorkflow.amounts.duty_estimate.source})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{importWorkflow.amounts.tax_estimate.label}</span>
                  <span className="font-medium">
                    {formatMoney(importWorkflow.amounts.tax_estimate.value, importWorkflow.amounts.tax_estimate.currency)} ({importWorkflow.amounts.tax_estimate.source})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{importWorkflow.amounts.total_import_estimate.label}</span>
                  <span className="font-semibold">
                    {formatMoney(importWorkflow.amounts.total_import_estimate.value, importWorkflow.amounts.total_import_estimate.currency)} ({importWorkflow.amounts.total_import_estimate.source})
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

```

## src/pages/WatchRegulatory.tsx
`$ext
import * as React from "react";
import { ExternalLink, Filter, RefreshCw, Rss } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDateTimeFr } from "@/lib/formatters";

type RssItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  source: string | null;
  zone: string | null;
  territory?: string | null;
  category: string | null;
  tags?: string[];
  official?: boolean;
  importance?: number;
  imageUrl: string | null;
};

type RssPayload = {
  ok?: boolean;
  degraded?: boolean;
  territory?: string;
  topic?: string | null;
  from?: string | null;
  to?: string | null;
  official_only?: boolean;
  updatedAt?: string | null;
  items?: RssItem[];
  sources?: string[];
  pinned?: string[];
  error?: string;
};

const TOPICS = [
  { value: "all", label: "Tous" },
  { value: "sanctions", label: "Sanctions" },
  { value: "douane", label: "Douane" },
  { value: "taxes", label: "Taxes" },
  { value: "documents", label: "Documents" },
  { value: "logistics", label: "Logistique" },
  { value: "trade", label: "Commerce" },
  { value: "health", label: "Sante" },
];

function normalizeTerritory(value: string | null | undefined) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "WORLD" || raw === "GLOBAL" || raw === "ALL" || raw === "MONDE") return "WORLD";
  return /^[A-Z]{2}$/.test(raw) ? raw : "WORLD";
}

function territoryLabel(iso: string) {
  if (iso === "WORLD") return "Monde";
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    return dn.of(iso) || iso;
  } catch {
    return iso;
  }
}

function importanceVariant(score: number) {
  if (score >= 75) return "destructive" as const;
  if (score >= 45) return "secondary" as const;
  return "outline" as const;
}

export default function WatchRegulatory() {
  const [territory, setTerritory] = React.useState("WORLD");
  const [topic, setTopic] = React.useState("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [officialOnly, setOfficialOnly] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<RssPayload>({});

  const refreshKey = React.useRef(0);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", "60");
      params.set("territory", territory);
      params.set("official", officialOnly ? "1" : "0");
      if (topic !== "all") params.set("topic", topic);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      try {
        const res = await fetch(`/api/rss?${params.toString()}`);
        const json = (await res.json().catch(() => ({}))) as RssPayload;
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `rss_failed_${res.status}`);
        }

        if (!active) return;
        setPayload(json);
      } catch (e: any) {
        if (!active) return;
        setPayload({ items: [], pinned: [], sources: [] });
        setError(String(e?.message || "rss_unavailable"));
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [territory, topic, fromDate, toDate, officialOnly, refreshTick]);

  const items = React.useMemo(() => (Array.isArray(payload.items) ? payload.items : []), [payload.items]);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.summary || "",
        item.source || "",
        item.category || "",
        ...(item.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const countryStats = React.useMemo(() => {
    const stats: Record<string, { label?: string; alerts: number; updates: number; total: number }> = {};

    for (const item of items) {
      const iso = normalizeTerritory(item.territory || item.zone || payload.territory || "WORLD");
      if (iso === "WORLD") continue;
      const current = stats[iso] || {
        label: territoryLabel(iso),
        alerts: 0,
        updates: 0,
        total: 0,
      };
      const importance = Number(item.importance || 0);
      if (importance >= 70) current.alerts += 1;
      else current.updates += 1;
      current.total += 1;
      stats[iso] = current;
    }

    return stats;
  }, [items, payload.territory]);

  const selectedStats = React.useMemo(() => {
    if (territory !== "WORLD" && countryStats[territory]) return countryStats[territory];
    return Object.values(countryStats).reduce(
      (acc, curr) => ({ alerts: acc.alerts + curr.alerts, updates: acc.updates + curr.updates, total: acc.total + curr.total }),
      { alerts: 0, updates: 0, total: 0 },
    );
  }, [countryStats, territory]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Centre veille reglementaire</p>
              <h1 className="mt-1 text-2xl font-semibold">Flux RSS officiels et signaux export</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Filtres pays, topic, date et mode officiel. Les sources permanentes restent actives.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  refreshKey.current += 1;
                  setRefreshTick(refreshKey.current);
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {(payload.pinned || []).map((name) => (
              <Badge key={`pinned-${name}`} variant="secondary">{name}</Badge>
            ))}
            {(payload.sources || []).slice(0, 8).map((name) => (
              <Badge key={`src-${name}`} variant="outline">{name}</Badge>
            ))}
            {payload.degraded ? <Badge variant="outline">Mode degrade</Badge> : null}
          </div>
        </section>

        <PanoramicControlTowerMap
          selectedCountry={territory === "WORLD" ? null : territory}
          selectedLabel={territoryLabel(territory)}
          stats={selectedStats}
          countryStats={countryStats}
          onCountrySelect={(iso) => setTerritory(iso)}
          onReset={() => setTerritory("WORLD")}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
            <CardDescription>Par defaut, seuls les liens officiels sont actifs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1 md:col-span-2">
              <Label>Recherche</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titre, source, tag..." />
            </div>

            <div className="space-y-1">
              <Label>Topic</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  {TOPICS.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Du</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Au</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Mode officiel</Label>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Switch checked={officialOnly} onCheckedChange={setOfficialOnly} />
                <span className="text-xs text-muted-foreground">Liens officiels</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rss className="h-4 w-4" />
                Flux filtre ({filteredItems.length})
              </CardTitle>
              <CardDescription>
                Territoire: {territoryLabel(territory)}
                {payload.updatedAt ? ` - Mise a jour: ${formatDateTimeFr(payload.updatedAt)}` : ""}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Chargement des flux...</p>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Aucun item pour ces filtres.</div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const importance = Number(item.importance || 0);
                  const dateLabel = item.publishedAt ? formatDateTimeFr(item.publishedAt) : "Date inconnue";
                  return (
                    <div key={item.link} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{dateLabel}</div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Badge variant={importanceVariant(importance)}>Impact {importance}/100</Badge>
                          {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                          {item.official ? <Badge variant="secondary">Officiel</Badge> : null}
                        </div>
                      </div>

                      {item.summary ? <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.source ? <Badge variant="outline">{item.source}</Badge> : null}
                        {(item.tags || []).slice(0, 5).map((tag) => (
                          <Badge key={`${item.link}-${tag}`} variant="outline">#{tag}</Badge>
                        ))}
                        <span>{territoryLabel(normalizeTerritory(item.territory || item.zone || territory))}</span>
                      </div>

                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        Ouvrir la source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

```

## src\lib\workflows\exportWorkflow.ts
`$ext
export type WorkflowSource = "eu" | "mock" | "fallback";

export type ShipmentModel = {
  origin: string;
  destination: string;
  hs6: string;
  incoterm: string;
  value: number;
  currency: string;
  transport: string;
  payment: string;
};

export type WorkflowAmount = {
  label: string;
  value: number;
  currency: string;
  source: WorkflowSource;
};

export type WorkflowDocument = {
  name: string;
  required: boolean;
  source: WorkflowSource;
};

export type WorkflowRisk = {
  level: "low" | "medium" | "high";
  label: string;
  source: WorkflowSource;
};

export type ExportWorkflowResult = {
  shipment: ShipmentModel;
  amounts: {
    customs_value: WorkflowAmount;
    duty_estimate: WorkflowAmount;
    tax_estimate: WorkflowAmount;
    logistics_estimate: WorkflowAmount;
    total_estimate: WorkflowAmount;
  };
  documents: WorkflowDocument[];
  risks: WorkflowRisk[];
  taxes: string[];
  duties: string[];
  notes: string[];
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min = 0) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, value);
}

function normalizeShipment(input: Partial<ShipmentModel>): ShipmentModel {
  return {
    origin: String(input.origin || "FR").trim().toUpperCase(),
    destination: String(input.destination || "WORLD").trim().toUpperCase(),
    hs6: String(input.hs6 || "000000").replace(/[^0-9]/g, "").slice(0, 6) || "000000",
    incoterm: String(input.incoterm || "DAP").trim().toUpperCase(),
    value: clamp(Number(input.value || 0), 0),
    currency: String(input.currency || "EUR").trim().toUpperCase(),
    transport: String(input.transport || "road").trim().toLowerCase(),
    payment: String(input.payment || "tt").trim().toLowerCase(),
  };
}

function estimateDutyRate(shipment: ShipmentModel) {
  if (shipment.destination === "WORLD") return 0.05;
  if (["FR", "DE", "ES", "IT", "BE", "NL"].includes(shipment.destination)) return 0.025;
  return 0.045;
}

function estimateTaxRate(shipment: ShipmentModel) {
  if (["FR", "DE", "ES", "IT", "BE", "NL"].includes(shipment.destination)) return 0.2;
  if (shipment.destination === "US") return 0.08;
  return 0.12;
}

function estimateLogistics(shipment: ShipmentModel) {
  const base = shipment.transport === "air" ? 420 : shipment.transport === "sea" ? 280 : 180;
  return round2(base + shipment.value * 0.02);
}

export function runExportWorkflow(input: Partial<ShipmentModel>): ExportWorkflowResult {
  const shipment = normalizeShipment(input);

  const customsValue = round2(shipment.value);
  const dutyRate = estimateDutyRate(shipment);
  const taxRate = estimateTaxRate(shipment);
  const logistics = estimateLogistics(shipment);

  const duty = round2(customsValue * dutyRate);
  const tax = round2((customsValue + duty) * taxRate);
  const total = round2(customsValue + duty + tax + logistics);

  const source: WorkflowSource = shipment.destination === "WORLD" ? "fallback" : "mock";

  const documents: WorkflowDocument[] = [
    { name: "Facture commerciale", required: true, source },
    { name: "Packing list", required: true, source },
    { name: "Certificat d'origine", required: dutyRate > 0.03, source },
    { name: "Document de transport", required: true, source },
  ];

  const risks: WorkflowRisk[] = [
    {
      level: dutyRate >= 0.05 ? "high" : "medium",
      label: "Verifier classement HS6 et droits applicables avant engagement prix.",
      source,
    },
    {
      level: shipment.incoterm === "DDP" ? "high" : "low",
      label: shipment.incoterm === "DDP"
        ? "DDP engage fiscalite locale et formalites import.": "Incoterm limite l'exposition import.",
      source,
    },
  ];

  return {
    shipment,
    amounts: {
      customs_value: { label: "Valeur douane", value: customsValue, currency: shipment.currency, source },
      duty_estimate: { label: "Droits estimes", value: duty, currency: shipment.currency, source },
      tax_estimate: { label: "Taxes estimees", value: tax, currency: shipment.currency, source },
      logistics_estimate: { label: "Logistique estimee", value: logistics, currency: shipment.currency, source },
      total_estimate: { label: "Cout total estime", value: total, currency: shipment.currency, source },
    },
    documents,
    risks,
    taxes: [`Taxe estimee ${(taxRate * 100).toFixed(1)}%`],
    duties: [`Droit estime ${(dutyRate * 100).toFixed(1)}%`],
    notes: [
      "Estimation indicative a valider avec source officielle avant contractualisation.",
      "La source de chaque montant est exposee pour expliciter le niveau de fiabilite.",
    ],
  };
}

```

## src\lib\workflows\importWorkflow.ts
`$ext
import type { ShipmentModel, WorkflowAmount, WorkflowDocument, WorkflowRisk, WorkflowSource } from "./exportWorkflow";

export type ImportWorkflowResult = {
  shipment: ShipmentModel;
  invoice_checks: Array<{
    label: string;
    ok: boolean;
    source: WorkflowSource;
  }>;
  amounts: {
    duty_estimate: WorkflowAmount;
    tax_estimate: WorkflowAmount;
    total_import_estimate: WorkflowAmount;
  };
  documents: WorkflowDocument[];
  risks: WorkflowRisk[];
  recommendations: string[];
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeShipment(input: Partial<ShipmentModel>): ShipmentModel {
  return {
    origin: String(input.origin || "WORLD").trim().toUpperCase(),
    destination: String(input.destination || "FR").trim().toUpperCase(),
    hs6: String(input.hs6 || "000000").replace(/[^0-9]/g, "").slice(0, 6) || "000000",
    incoterm: String(input.incoterm || "DAP").trim().toUpperCase(),
    value: Math.max(0, Number(input.value || 0)),
    currency: String(input.currency || "EUR").trim().toUpperCase(),
    transport: String(input.transport || "road").trim().toLowerCase(),
    payment: String(input.payment || "tt").trim().toLowerCase(),
  };
}

export function runImportWorkflow(input: Partial<ShipmentModel>): ImportWorkflowResult {
  const shipment = normalizeShipment(input);
  const source: WorkflowSource = shipment.destination === "FR" ? "eu" : "mock";

  const dutyRate = shipment.destination === "FR" ? 0.03 : 0.05;
  const taxRate = shipment.destination === "FR" ? 0.2 : 0.12;

  const duty = round2(shipment.value * dutyRate);
  const tax = round2((shipment.value + duty) * taxRate);
  const total = round2(shipment.value + duty + tax);

  const invoiceChecks = [
    {
      label: "Devise facture coherente",
      ok: shipment.currency.length === 3,
      source,
    },
    {
      label: "Incoterm renseigne",
      ok: shipment.incoterm.length >= 3,
      source,
    },
    {
      label: "Code HS6 fourni",
      ok: shipment.hs6.length === 6,
      source,
    },
  ];

  return {
    shipment,
    invoice_checks: invoiceChecks,
    amounts: {
      duty_estimate: { label: "Droits import estimes", value: duty, currency: shipment.currency, source },
      tax_estimate: { label: "Taxes import estimees", value: tax, currency: shipment.currency, source },
      total_import_estimate: { label: "Cout import estime", value: total, currency: shipment.currency, source },
    },
    documents: [
      { name: "Facture commerciale", required: true, source },
      { name: "Packing list", required: true, source },
      { name: "Connaissement / AWB", required: true, source },
      { name: "Certificat d'origine", required: true, source },
    ],
    risks: [
      {
        level: invoiceChecks.every((check) => check.ok) ? "low" : "medium",
        label: "Verifier les champs manquants avant declaration en douane.",
        source,
      },
      {
        level: shipment.incoterm === "DDP" ? "high" : "low",
        label: shipment.incoterm === "DDP"
          ? "DDP peut masquer des couts import deja integres par le vendeur."
          : "Le cout import reste a verifier cote acheteur.",
        source,
      },
    ],
    recommendations: [
      "Valider les montants avec le declarant en douane.",
      "Conserver les preuves documentaires (facture, transport, origine).",
      "Tracer la source des estimations pour audit interne.",
    ],
  };
}

```

## supabase/migrations/20260226130500_watch_pipeline_and_unaccent_guard.sql
`$ext
-- Keep unaccent available for RPCs and normalize RSS watch pipeline tables.

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto;

create or replace function public.unaccent(text)
returns text
language sql
immutable
as $$
  select extensions.unaccent($1);
$$;

grant execute on function public.unaccent(text) to anon, authenticated, service_role;

-- -----------------------------
-- regulatory_feeds normalization
-- -----------------------------

alter table if exists public.regulatory_feeds
  add column if not exists source_name text,
  add column if not exists kind text default 'rss',
  add column if not exists territory text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists logo_url text,
  add column if not exists is_public boolean not null default true,
  add column if not exists last_fetched_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_feeds'
      and column_name = 'zone'
  ) then
    execute '
      update public.regulatory_feeds
      set territory = coalesce(nullif(territory, ''''), zone)
      where coalesce(nullif(territory, ''''), '''') = ''''
    ';
  end if;
end $$;

update public.regulatory_feeds
set source_name = coalesce(nullif(source_name, ''), nullif(name, ''))
where coalesce(nullif(source_name, ''), '') = '';

update public.regulatory_feeds
set kind = 'rss'
where coalesce(nullif(kind, ''), '') = '';

create index if not exists regulatory_feeds_enabled_idx on public.regulatory_feeds(enabled);
create index if not exists regulatory_feeds_territory_idx on public.regulatory_feeds(territory);
create index if not exists regulatory_feeds_kind_idx on public.regulatory_feeds(kind);

-- -----------------------------
-- regulatory_items normalization
-- -----------------------------

alter table if exists public.regulatory_items
  add column if not exists source_id uuid,
  add column if not exists link text,
  add column if not exists territory text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists image_url text,
  add column if not exists fingerprint text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_items'
      and column_name = 'feed_id'
  ) then
    execute '
      update public.regulatory_items
      set source_id = coalesce(source_id, feed_id)
      where source_id is null
    ';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_items'
      and column_name = 'url'
  ) then
    execute '
      update public.regulatory_items
      set link = coalesce(nullif(link, ''''), url)
      where coalesce(nullif(link, ''''), '''') = ''''
    ';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'regulatory_items'
      and column_name = 'zone'
  ) then
    execute '
      update public.regulatory_items
      set territory = coalesce(nullif(territory, ''''), zone)
      where coalesce(nullif(territory, ''''), '''') = ''''
    ';
  end if;
end $$;

update public.regulatory_items
set fingerprint = md5(
  coalesce(nullif(link, ''), '') || '|' ||
  coalesce(nullif(title, ''), '') || '|' ||
  coalesce(published_at::text, '')
)
where coalesce(nullif(fingerprint, ''), '') = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'regulatory_items_source_id_fkey'
      and conrelid = 'public.regulatory_items'::regclass
  ) then
    alter table public.regulatory_items
      add constraint regulatory_items_source_id_fkey
      foreign key (source_id)
      references public.regulatory_feeds(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists regulatory_items_source_fingerprint_uidx
  on public.regulatory_items(source_id, fingerprint)
  where source_id is not null and fingerprint is not null;

create index if not exists regulatory_items_published_idx on public.regulatory_items(published_at desc);
create index if not exists regulatory_items_territory_idx on public.regulatory_items(territory);
create index if not exists regulatory_items_category_idx on public.regulatory_items(category);

-- -----------------------------
-- feed fetch logs
-- -----------------------------

create table if not exists public.feed_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid null references public.regulatory_feeds(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  status text not null default 'started',
  http_status integer null,
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  deduped_count integer not null default 0,
  territory text null,
  error text null,
  created_at timestamptz not null default now(),
  constraint feed_fetch_logs_status_chk check (status in ('started', 'ok', 'failed', 'skipped'))
);

create index if not exists feed_fetch_logs_feed_id_idx on public.feed_fetch_logs(feed_id);
create index if not exists feed_fetch_logs_started_at_idx on public.feed_fetch_logs(started_at desc);
create index if not exists feed_fetch_logs_status_idx on public.feed_fetch_logs(status);

-- -----------------------------
-- RLS hardening (service role writes)
-- -----------------------------

alter table if exists public.regulatory_feeds enable row level security;
alter table if exists public.regulatory_items enable row level security;
alter table if exists public.feed_fetch_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_fetch_logs'
      and policyname = 'feed_fetch_logs_service_role'
  ) then
    create policy feed_fetch_logs_service_role
      on public.feed_fetch_logs
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

```

## supabase/migrations/20260226143000_seed_permanent_watch_feeds.sql
`$ext
-- Seed permanent regulatory feeds used by Control Tower + RSS API.

create unique index if not exists regulatory_feeds_source_url_uidx
  on public.regulatory_feeds ((lower(source_url)))
  where source_url is not null;

insert into public.regulatory_feeds (
  name,
  source_name,
  source_url,
  kind,
  category,
  territory,
  tags,
  enabled,
  is_public
)
select
  src.name,
  src.source_name,
  src.source_url,
  src.kind,
  src.category,
  src.territory,
  src.tags,
  true,
  true
from (
  values
    ('Le Moci', 'Le Moci', 'https://www.lemoci.com/feed/', 'rss', 'trade', 'WORLD', array['trade','official']),
    ('WHO News', 'WHO News', 'https://www.who.int/rss-feeds/news-english.xml', 'rss', 'health', 'WORLD', array['health','official']),
    ('Douane francaise', 'Douane francaise', 'https://www.douane.gouv.fr/meteo/prodouane/pages/rss', 'rss', 'douane', 'FR', array['douane','france','official']),
    ('UE DG Trade', 'UE DG Trade', 'https://policy.trade.ec.europa.eu/node/2/rss_en', 'rss', 'trade', 'EU', array['trade','eu','official'])
) as src(name, source_name, source_url, kind, category, territory, tags)
where not exists (
  select 1
  from public.regulatory_feeds rf
  where lower(rf.source_url) = lower(src.source_url)
);

update public.regulatory_feeds
set
  enabled = true,
  is_public = true,
  kind = coalesce(nullif(kind, ''), 'rss'),
  source_name = coalesce(nullif(source_name, ''), nullif(name, ''))
where lower(source_url) in (
  lower('https://www.lemoci.com/feed/'),
  lower('https://www.who.int/rss-feeds/news-english.xml'),
  lower('https://www.douane.gouv.fr/meteo/prodouane/pages/rss'),
  lower('https://policy.trade.ec.europa.eu/node/2/rss_en')
);

```


