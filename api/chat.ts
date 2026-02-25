import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

type DetectResponse = {
  lang?: string;
  countries?: Array<{ iso2?: string; name?: string; score?: number }>;
  hs?: Array<{ hs6?: string; desc?: string; score?: number }>;
  intent?: string;
  in_scope?: boolean;
  keywords_found?: string[];
};

type AssistantMode = "needs_input" | "brief_ready";

type AssistantBuildResult = {
  message: string;
  mode: AssistantMode;
  questions: string[];
};

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
  { code: "EUR", pattern: /\b(eur|€|euro)\b/i },
  { code: "USD", pattern: /\b(usd|\$|dollar)\b/i },
  { code: "GBP", pattern: /\b(gbp|£|pound)\b/i },
  { code: "CHF", pattern: /\b(chf|franc suisse)\b/i },
  { code: "CNY", pattern: /\b(cny|rmb|yuan)\b/i },
  { code: "JPY", pattern: /\b(jpy|yen)\b/i },
  { code: "CAD", pattern: /\b(cad|canadian dollar)\b/i },
];

function env(key: string) {
  return String(process.env[key] || "").trim();
}

function normalizeLang(input: unknown): Lang {
  const value = String(input || "").trim().toLowerCase();
  return value === "en" ? "en" : "fr";
}

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requireSupabasePublicEnv() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey =
    env("SUPABASE_ANON_KEY") ||
    env("VITE_SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY for user-scoped operations");
  }
  return { url, anonKey };
}

function createUserScopedClient(token: string) {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
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

function pickCountrySlots(message: string, candidates: string[], previous: DetectedEntities) {
  const unique = Array.from(new Set(candidates)).filter(Boolean);
  let origin = previous.origin;
  let destination = previous.destination;

  const hasFromTo = /\b(from|de|origine)\b[\s\S]{0,80}\b(to|vers|destination)\b/i.test(message);

  if (hasFromTo && unique.length >= 2) {
    origin = unique[0];
    destination = unique[1];
    return { origin, destination };
  }

  if (unique.length >= 2) {
    if (!destination) destination = unique[0];
    if (!origin) origin = unique[1];
    return { origin, destination };
  }

  if (unique.length === 1) {
    const c = unique[0];
    if (/\b(from|de|origine)\b/i.test(message) && !origin) {
      origin = c;
    } else if (!destination) {
      destination = c;
    }
  }

  return { origin, destination };
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

function outOfScopeMessage(lang: Lang) {
  if (lang === "en") {
    return [
      "I focus on international trade operations only.",
      "",
      "I can help with:",
      "- import/export planning",
      "- HS code framing and customs documentation",
      "- Incoterms and transfer of risk",
      "- payment terms and documentary risk",
      "- logistics and transport mode choices",
      "- sanctions/compliance checks",
      "- tax and customs concepts (VAT, duties, withholding concepts)",
      "- contract structures and essential clauses",
      "",
      "Try examples:",
      "- Export strawberries to Chile",
      "- Which HS code for frozen berries?",
      "- DDP vs FCA for Germany with LC payment",
    ].join("\n");
  }

  return [
    "Je suis specialise sur les operations import/export internationales.",
    "",
    "Je peux aider sur :",
    "- cadrage import/export",
    "- code HS et documents douaniers",
    "- Incoterms et transfert des risques",
    "- modes de paiement et risques documentaires",
    "- logistique et transport",
    "- sanctions et conformite",
    "- fiscalite/douane (TVA, droits, retenues en concept)",
    "- types de contrats et clauses essentielles",
    "",
    "Exemples :",
    "- Exporter des fraises vers le Chili",
    "- Quel code HS pour des fruits surgeles ?",
    "- DDP vs FCA vers l'Allemagne avec paiement LC",
  ].join("\n");
}

function listMissingSlots(entities: DetectedEntities) {
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
      return "Quel mode de paiement prévoyez-vous (LC, CAD, OA, TT) ?";
    case "transport":
      return "Quel mode de transport prévoyez-vous (air, sea, road, rail, courier) ?";
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

function buildGuidedQuestions(lang: Lang, dossier: any, entities: DetectedEntities) {
  const fromDossier = Array.isArray(dossier?.questions_missing)
    ? dossier.questions_missing.map((q: unknown) => String(q || "").trim()).filter(Boolean)
    : [];

  const fallback = listMissingSlots(entities).map((slot) => defaultQuestionBySlot(lang, slot));
  const merged = [...fromDossier, ...fallback];

  return Array.from(new Set(merged)).slice(0, 3);
}

function lineItems(items: unknown, limit: number, formatter: (item: any) => string) {
  if (!Array.isArray(items)) return [] as string[];
  return items
    .slice(0, limit)
    .map((item) => formatter(item))
    .filter((line) => Boolean(line));
}

function buildAssistantMessage(
  lang: Lang,
  dossier: any,
  entities: DetectedEntities,
  options: { isFirstExchange: boolean }
): AssistantBuildResult {
  const summary = dossier?.summary || {};
  const destinationName = summary?.destination?.name || summary?.destination?.iso2 || entities.destination || "?";
  const hsLabel = summary?.hs?.hs6 || entities.hs6 || "?";

  const docs = lineItems(dossier?.documents, 6, (d) => {
    const name = String(d?.name || d?.code || "").trim();
    const mandatory = d?.required === false ? "" : lang === "en" ? " (required)" : " (obligatoire)";
    return name ? `- ${name}${mandatory}` : "";
  });

  const restrictions = lineItems(dossier?.restrictions, 4, (r) => {
    const text = String(r?.summary || r?.notes || "").trim();
    return text ? `- ${text}` : "";
  });

  const clauses = lineItems(dossier?.contracts?.clauses, 5, (c) => {
    const title = String(c?.title || c?.code || "").trim();
    return title ? `- ${title}` : "";
  });

  const nextActions = lineItems(dossier?.next_actions, 6, (a) => {
    const text = String(a || "").trim();
    return text ? `- ${text}` : "";
  });

  const questions = buildGuidedQuestions(lang, dossier, entities);

  if (questions.length) {
    if (lang === "en") {
      return {
        mode: "needs_input",
        questions,
        message: [
          options.isFirstExchange
            ? "Welcome. I am your structured Export Expert assistant."
            : "Thanks. We will complete your case step by step.",
          "",
          "Current understanding:",
          `- Destination: ${entities.destination || "not provided"}`,
          `- HS/product: ${entities.hs6 || "not provided"}`,
          `- Incoterm: ${entities.incoterm || "not provided"}`,
          `- Payment: ${entities.payment || "not provided"}`,
          `- Transport: ${entities.transport || "not provided"}`,
          "",
          "Please answer these short questions:",
          ...questions.map((q, idx) => `${idx + 1}. ${q}`),
          "",
          "Once answered, I will produce your operational export brief.",
        ].join("\n"),
      };
    }

    return {
      mode: "needs_input",
      questions,
      message: [
        options.isFirstExchange
          ? "Bienvenue. Je suis votre assistant Export Expert guide."
          : "Merci. On complete votre dossier pas a pas.",
        "",
        "Ce que j'ai compris pour l'instant :",
        `- Destination : ${entities.destination || "non renseignee"}`,
        `- HS/produit : ${entities.hs6 || "non renseigne"}`,
        `- Incoterm : ${entities.incoterm || "non renseigne"}`,
        `- Paiement : ${entities.payment || "non renseigne"}`,
        `- Transport : ${entities.transport || "non renseigne"}`,
        "",
        "Merci de repondre a ces questions simples :",
        ...questions.map((q, idx) => `${idx + 1}. ${q}`),
        "",
        "Des que vous repondez, je genere le dossier export operationnel.",
      ].join("\n"),
    };
  }

  if (lang === "en") {
    return {
      mode: "brief_ready",
      questions: [],
      message: [
        `Export brief ready for ${destinationName} (HS: ${hsLabel}).`,
        "",
        "Documents:",
        ...(docs.length ? docs : ["- No specific document rule found yet."]),
        "",
        "Compliance & sanctions:",
        ...(restrictions.length ? restrictions : ["- No specific restriction found with current inputs."]),
        "",
        "Contract structure:",
        ...(clauses.length ? clauses : ["- No clause playbook matched yet."]),
        "",
        "Tax & customs:",
        `- VAT rule loaded: ${dossier?.tax_and_customs?.vat && Object.keys(dossier.tax_and_customs.vat).length ? "yes" : "not yet"}`,
        `- Duty/tax concepts loaded: ${Array.isArray(dossier?.tax_and_customs?.duties_concept) ? dossier.tax_and_customs.duties_concept.length : 0}`,
        "",
        "Next actions:",
        ...(nextActions.length ? nextActions : ["- Finalize assumptions and validate with legal/tax advisor."]),
        "",
        "Thank you. Was this answer relevant for your need? Tell me your next need and I continue.",
      ].join("\n"),
    };
  }

  return {
    mode: "brief_ready",
    questions: [],
    message: [
      `Dossier export pret pour ${destinationName} (HS : ${hsLabel}).`,
      "",
      "Documents :",
      ...(docs.length ? docs : ["- Aucune regle documentaire specifique trouvee pour l'instant."]),
      "",
      "Compliance & sanctions :",
      ...(restrictions.length ? restrictions : ["- Pas de restriction specifique detectee avec les infos actuelles."]),
      "",
      "Contrat :",
      ...(clauses.length ? clauses : ["- Aucun playbook clause correspondant pour l'instant."]),
      "",
      "Fiscalite & douane :",
      `- Regle TVA chargee : ${dossier?.tax_and_customs?.vat && Object.keys(dossier.tax_and_customs.vat).length ? "oui" : "non"}`,
      `- Concepts droits/taxes charges : ${Array.isArray(dossier?.tax_and_customs?.duties_concept) ? dossier.tax_and_customs.duties_concept.length : 0}`,
      "",
      "Actions suivantes :",
      ...(nextActions.length ? nextActions : ["- Finaliser les hypotheses puis valider avec conseil juridique/fiscal."]),
      "",
      "Merci. Cette reponse est-elle pertinente pour votre besoin ? Dites-moi votre prochain besoin et je continue.",
    ].join("\n"),
  };
}

async function ensureThread(
  client: SupabaseClient,
  userId: string,
  requestedThreadId: string | null,
  lang: Lang,
  titleSeed: string
) {
  const reqId = String(requestedThreadId || "").trim();

  if (reqId) {
    const { data: existing } = await client
      .from("chat_sessions")
      .select("id")
      .eq("id", reqId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.id) {
      await client
        .from("chat_threads")
        .upsert({ id: reqId, user_id: userId, lang }, { onConflict: "id" });
      return reqId;
    }
  }

  const { data: created, error } = await client
    .from("chat_sessions")
    .insert({
      user_id: userId,
      title: titleSeed.slice(0, 120),
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    throw new Error(`thread_create_failed:${error?.message || "unknown"}`);
  }

  await client
    .from("chat_threads")
    .upsert({ id: created.id, user_id: userId, lang }, { onConflict: "id" });

  return String(created.id);
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function readLatestEntities(historyRows: Array<Record<string, any>>): DetectedEntities {
  for (let i = historyRows.length - 1; i >= 0; i -= 1) {
    const candidate = asObject(historyRows[i]?.entities);
    if (Object.keys(candidate).length > 0) {
      return mergeEntities(defaultEntities(), {
        origin: normalizeIso2(candidate.origin),
        destination: normalizeIso2(candidate.destination),
        hs6: normalizeHs6(candidate.hs6),
        incoterm: String(candidate.incoterm || "").toUpperCase() || null,
        payment: String(candidate.payment || "").toUpperCase() || null,
        transport: String(candidate.transport || "").toLowerCase() || null,
        currency: String(candidate.currency || "").toUpperCase() || null,
        contract_type: String(candidate.contract_type || "").toLowerCase() || null,
      });
    }
  }
  return defaultEntities();
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson<ChatRequest>(req);
    const message = cleanMessage(body?.message);
    if (!message) {
      return json(res, 400, { ok: false, error: "message_required" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return json(res, 401, { ok: false, error: "missing_bearer_token" });
    }

    const admin = supabaseAdmin();
    const userScoped = createUserScopedClient(token);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return json(res, 401, { ok: false, error: "invalid_token" });
    }

    const preferredLang = normalizeLang(body?.lang);

    const threadId = await ensureThread(userScoped, userId, body?.thread_id || null, preferredLang, message);

    const { data: historyRowsRaw, error: historyError } = await userScoped
      .from("chat_messages")
      .select("role, content, entities, dossier, created_at")
      .eq("session_id", threadId)
      .order("created_at", { ascending: true })
      .limit(40);

    if (historyError) {
      throw new Error(`thread_history_failed:${historyError.message}`);
    }

    const historyRows = Array.isArray(historyRowsRaw) ? historyRowsRaw : [];
    const isFirstExchange = historyRows.filter((row: any) => row?.role === "user").length === 0;
    const previousEntities = readLatestEntities(historyRows as Array<Record<string, any>>);

    const { data: detectRaw, error: detectError } = await userScoped.rpc("rpc_detect_entities", {
      q: message,
      ui_lang: preferredLang,
    });

    if (detectError) {
      throw new Error(`rpc_detect_entities_failed:${detectError.message}`);
    }

    const detect = asObject(detectRaw) as DetectResponse;
    const lang: Lang = normalizeLang(detect.lang || preferredLang);

    const countriesDetected = Array.isArray(detect.countries)
      ? detect.countries
          .map((c) => normalizeIso2(c?.iso2))
          .filter((x): x is string => Boolean(x))
      : [];

    const hsDetected = Array.isArray(detect.hs)
      ? detect.hs
          .map((h) => normalizeHs6(h?.hs6))
          .filter((x): x is string => Boolean(x))
      : [];

    const countriesSlots = pickCountrySlots(message, countriesDetected, previousEntities);

    const detectedFromMessage: Partial<DetectedEntities> = {
      origin: countriesSlots.origin,
      destination: countriesSlots.destination,
      hs6: hsDetected[0] || normalizeHs6(message),
      incoterm: detectIncoterm(message),
      payment: detectByPatterns(message, PAYMENT_PATTERNS),
      transport: detectByPatterns(message, TRANSPORT_PATTERNS),
      currency: detectByPatterns(message, CURRENCY_PATTERNS),
      contract_type: detectByPatterns(message, CONTRACT_PATTERNS),
    };

    const override = asObject(body?.overrides);
    const overrideEntities: Partial<DetectedEntities> = {
      origin: normalizeIso2(override.origin),
      destination: normalizeIso2(override.destination),
      hs6: normalizeHs6(override.hs6),
      incoterm: String(override.incoterm || "").toUpperCase() || null,
      payment: String(override.payment || "").toUpperCase() || null,
      transport: String(override.transport || "").toLowerCase() || null,
      currency: String(override.currency || "").toUpperCase() || null,
      contract_type: String(override.contract_type || "").toLowerCase() || null,
    };

    const entities = mergeEntities(
      mergeEntities(previousEntities, detectedFromMessage),
      overrideEntities,
    );

    const inScope = Boolean(detect.in_scope);

    if (!inScope) {
      const assistantMessage = outOfScopeMessage(lang);

      const { error: insertError } = await userScoped.from("chat_messages").insert([
        {
          session_id: threadId,
          thread_id: threadId,
          user_id: userId,
          role: "user",
          content: message,
          entities,
          dossier: {},
        },
        {
          session_id: threadId,
          thread_id: threadId,
          user_id: userId,
          role: "assistant",
          content: assistantMessage,
          entities,
          dossier: {},
        },
      ]);

      if (insertError) {
        throw new Error(`chat_insert_failed:${insertError.message}`);
      }

      return json(res, 200, {
        ok: true,
        thread_id: threadId,
        in_scope: false,
        intent: detect.intent || "out_of_scope",
        assistant_message: assistantMessage,
        assistant_mode: "needs_input",
        follow_up_questions: [],
        entities,
        dossier: {},
      });
    }

    const dossierInput = {
      lang,
      origin: entities.origin,
      destination: entities.destination,
      hs6: entities.hs6,
      incoterm: entities.incoterm,
      payment: entities.payment,
      transport: entities.transport,
      currency: entities.currency,
      contract_type: entities.contract_type,
    };

    const { data: dossierRaw, error: dossierError } = await userScoped.rpc("rpc_build_export_dossier", {
      input: dossierInput,
    });

    if (dossierError) {
      throw new Error(`rpc_build_export_dossier_failed:${dossierError.message}`);
    }

    const dossier = asObject(dossierRaw);
    const assistant = buildAssistantMessage(lang, dossier, entities, { isFirstExchange });
    const assistantMessage = assistant.message;

    const { error: saveError } = await userScoped.from("chat_messages").insert([
      {
        session_id: threadId,
        thread_id: threadId,
        user_id: userId,
        role: "user",
        content: message,
        entities,
        dossier: {},
      },
      {
        session_id: threadId,
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        content: assistantMessage,
        entities,
        dossier,
      },
    ]);

    if (saveError) {
      throw new Error(`chat_insert_failed:${saveError.message}`);
    }

    return json(res, 200, {
      ok: true,
      thread_id: threadId,
      in_scope: true,
      intent: detect.intent || "general_export",
      assistant_message: assistantMessage,
      assistant_mode: assistant.mode,
      follow_up_questions: assistant.questions,
      entities,
      dossier,
    });
  } catch (err: any) {
    return json(res, 500, {
      ok: false,
      error: String(err?.message || "chat_failed"),
    });
  }
});

