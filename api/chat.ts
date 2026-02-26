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


