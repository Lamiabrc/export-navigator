import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type AskPayload = {
  question?: string;
  context?: Record<string, any> | null;
};

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoredConversationRow = {
  role: "user" | "assistant" | "system";
  content: string;
};

type AskResult = {
  answer: string;
  session_id?: string;
  actions?: string[];
  follow_up_questions?: string[];
  sources?: Array<{ document_id: string; chunk_id: string; similarity: number }>;
  source_links?: Array<{ title: string; url: string; origin: "supabase" | "specialized_site" }>;
  context_summary?: string;
  satisfaction_prompt?: string;
};

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const CHAT_MODEL = (process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini").trim();
const EMBED_MODEL = (process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small").trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function resolveOptionalUser(req: VercelRequest) {
  const token = getBearerToken(req);
  if (!token) return null;

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, token };
}

async function openaiEmbed(input: string) {
  if (!OPENAI_API_KEY) throw new Error("ai_not_configured");
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`openai_embeddings_failed: ${resp.status} ${err}`);
  }
  const data = (await resp.json()) as any;
  return data?.data?.[0]?.embedding as number[] | undefined;
}

async function openaiChat(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  if (!OPENAI_API_KEY) throw new Error("ai_not_configured");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.35,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`openai_chat_failed: ${resp.status} ${err}`);
  }
  const data = (await resp.json()) as any;
  return String(data?.choices?.[0]?.message?.content || "");
}

async function geminiChat(prompt: string) {
  if (!GEMINI_API_KEY) throw new Error("ai_not_configured");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`gemini_chat_failed: ${resp.status} ${err}`);
  }

  const data = (await resp.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => String(p?.text || "")).join("\n").trim();
  return text || "";
}


async function storeConversationEmbedding(params: {
  userId: string;
  message: string;
  embedding: number[];
  role?: "user" | "assistant";
  sessionId?: string | null;
  metadata?: Record<string, any>;
}) {
  const admin = supabaseAdmin();
  try {
    const { error } = await admin.from("llm_message_embeddings").insert({
      user_id: params.userId,
      source: "api_ask",
      session_id: params.sessionId ?? null,
      role: params.role ?? "user",
      message: params.message,
      embedding: params.embedding,
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.error("[api/ask] llm_message_embeddings insert failed", error.message);
    }
  } catch (e: any) {
    console.error("[api/ask] llm_message_embeddings insert exception", e?.message || e);
  }
}

function normalizeSessionId(input: unknown) {
  const value = typeof input === "string" ? input.trim() : "";
  return value || null;
}

function mergeConversationHistory(dbHistory: ConversationMessage[], contextHistory: ConversationMessage[]) {
  const merged: ConversationMessage[] = [];
  for (const entry of [...dbHistory, ...contextHistory]) {
    const content = String(entry?.content || "").trim();
    if (!content) continue;
    const role: ConversationMessage["role"] = entry?.role === "assistant" ? "assistant" : "user";
    const previous = merged[merged.length - 1];
    if (previous && previous.role === role && previous.content === content) continue;
    merged.push({ role, content });
  }
  return merged.slice(-12);
}

async function resolveChatSession(params: {
  userId: string;
  requestedSessionId: string | null;
  fallbackTitle: string;
}) {
  const admin = supabaseAdmin();

  let sessionId = params.requestedSessionId;
  if (sessionId) {
    const { data, error } = await admin
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", params.userId)
      .maybeSingle();
    if (error || !data?.id) sessionId = null;
  }

  if (!sessionId) {
    const { data, error } = await admin
      .from("chat_sessions")
      .insert({
        user_id: params.userId,
        title: params.fallbackTitle.slice(0, 120),
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      throw new Error(`chat_session_create_failed: ${error?.message || "unknown_error"}`);
    }
    sessionId = String(data.id);
  }

  const { data: rows, error: historyError } = await admin
    .from("chat_messages")
    .select("role,content")
    .eq("session_id", sessionId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (historyError) {
    console.error("[api/ask] chat_messages load failed", historyError.message);
    return { sessionId, history: [] as ConversationMessage[] };
  }

  const history = (Array.isArray(rows) ? rows : [])
    .reverse()
    .map((row) => {
      const value = row as StoredConversationRow;
      return {
        role: value.role === "assistant" ? "assistant" : "user",
        content: String(value.content || "").trim(),
      } as ConversationMessage;
    })
    .filter((entry) => entry.content.length > 0)
    .slice(-20);

  return { sessionId, history };
}

async function persistChatExchange(params: {
  userId: string;
  sessionId: string | null;
  question: string;
  answer: string;
}) {
  if (!params.sessionId) return;
  const admin = supabaseAdmin();
  try {
    const { error } = await admin.from("chat_messages").insert([
      {
        session_id: params.sessionId,
        user_id: params.userId,
        role: "user",
        content: params.question,
      },
      {
        session_id: params.sessionId,
        user_id: params.userId,
        role: "assistant",
        content: params.answer,
      },
    ]);

    if (error) {
      console.error("[api/ask] chat_messages insert failed", error.message);
    }
  } catch (e: any) {
    console.error("[api/ask] chat_messages insert exception", e?.message || e);
  }
}

function extractSignals(question: string) {
  const q = question.toUpperCase();
  const incoterm = q.match(/\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/)?.[1] ?? null;
  const hsCode = question.match(/\b\d{4,10}\b/)?.[0] ?? null;

  const countryCandidates = [
    "FRANCE", "ALLEMAGNE", "GERMANY", "ESPAGNE", "SPAIN", "ITALIE", "ITALY", "MAROC", "MOROCCO", "TURQUIE", "TURKEY", "USA", "ETATS-UNIS", "UNITED STATES", "CHINE", "CHINA", "ROYAUME-UNI", "UNITED KINGDOM", "UK",
  ];
  const country = countryCandidates.find((c) => q.includes(c)) ?? null;

  const paymentMentioned = /LC|LETTRE DE CREDIT|CREDOC|COMPTE OUVERT|OPEN ACCOUNT|ACOMPTE|VIREMENT|DP|DA/i.test(question);
  const sanctionsMentioned = /SANCTION|EMBARGO|OFAC|RESTRICTION/i.test(question);

  return { incoterm, hsCode, country, paymentMentioned, sanctionsMentioned };
}

function specializedSourcesFor(question: string) {
  const sources: Array<{ title: string; url: string; origin: "specialized_site" }> = [];
  const q = question.toLowerCase();

  if (/incoterm|ddp|dap|fob|cif|cpt|cip|exw|fca/.test(q)) {
    sources.push({ title: "ICC – Incoterms 2020", url: "https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/", origin: "specialized_site" });
  }
  if (/douane|tarif|hs|code/.test(q)) {
    sources.push({ title: "Commission européenne – TARIC", url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp", origin: "specialized_site" });
    sources.push({ title: "WCO – Harmonized System", url: "https://www.wcoomd.org/en/topics/nomenclature/overview/what-is-the-harmonized-system.aspx", origin: "specialized_site" });
  }
  if (/sanction|embargo|ofac/.test(q)) {
    sources.push({ title: "EU Sanctions Map", url: "https://www.sanctionsmap.eu/", origin: "specialized_site" });
    sources.push({ title: "OFAC Sanctions", url: "https://ofac.treasury.gov/sanctions-programs-and-country-information", origin: "specialized_site" });
  }
  if (/tva|vat/.test(q)) {
    sources.push({ title: "Douane.gouv.fr – Infos import/export", url: "https://www.douane.gouv.fr", origin: "specialized_site" });
  }

  return sources.slice(0, 4);
}


function normalizeHistory(context: Record<string, any> | null | undefined): ConversationMessage[] {
  const raw = Array.isArray(context?.chat_history) ? context?.chat_history : [];
  return raw
    .filter((m: any) => m && typeof m === "object")
    .map((m: any): ConversationMessage => {
      const role: ConversationMessage["role"] = m?.role === "assistant" ? "assistant" : "user";
      return {
        role,
        content: typeof m?.content === "string" ? m.content.trim() : "",
      };
    })
    .filter((m: ConversationMessage) => m.content.length > 0)
    .slice(-12);
}

function summarizeContext(
  question: string,
  context: Record<string, any> | null | undefined,
  signals: ReturnType<typeof extractSignals>,
  history: ConversationMessage[],
) {
  const corpus = [
    ...history.filter((m) => m.role === "user").map((m) => m.content),
    question,
    typeof context?.product === "string" ? context.product : "",
    typeof context?.destination === "string" ? context.destination : "",
  ]
    .filter(Boolean)
    .join("\n");

  const merged = extractSignals(corpus);
  const product = typeof context?.product === "string" ? context.product.trim() : "";
  const destination = typeof context?.destination === "string" ? context.destination.trim() : "";
  const objective = typeof context?.objective === "string" ? context.objective.trim() : "";

  const summaryParts = [
    merged.country || signals.country || destination ? `Pays: ${merged.country || signals.country || destination}` : "Pays: manquant",
    merged.hsCode || signals.hsCode ? `HS: ${merged.hsCode || signals.hsCode}` : "HS: manquant",
    merged.incoterm || signals.incoterm || (typeof context?.incoterm === "string" ? context?.incoterm : "")
      ? `Incoterm: ${merged.incoterm || signals.incoterm || context?.incoterm}`
      : "Incoterm: manquant",
    product ? `Produit: ${product}` : "Produit: manquant",
    objective ? `Objectif: ${objective}` : null,
  ].filter(Boolean);

  return {
    mergedSignals: merged,
    history,
    contextSummary: summaryParts.join(" | "),
    satisfaction: context?.feedback?.satisfied,
  };
}

async function fetchSupabaseFacts(question: string, signals: ReturnType<typeof extractSignals>) {
  const admin = supabaseAdmin();
  const snippets: string[] = [];
  const links: Array<{ title: string; url: string; origin: "supabase" }> = [];

  const { data: incotermRows } = await admin
    .from("export_incoterms")
    .select("code,title,description,insurance_required,insurance_min_percent")
    .limit(signals.incoterm ? 3 : 6)
    .ilike("code", signals.incoterm ? signals.incoterm : "%");

  if (Array.isArray(incotermRows) && incotermRows.length) {
    snippets.push(
      "Référentiel incoterms (Supabase):\n" +
        incotermRows
          .map((r: any) => `${r.code}: ${r.title || ""} | assurance requise=${Boolean(r.insurance_required)} | min=${r.insurance_min_percent ?? "n/a"} | ${r.description || ""}`)
          .join("\n")
    );
  }

  const hsPattern = signals.hsCode ? `${signals.hsCode.slice(0, 6)}%` : null;
  const hsOr = [
    hsPattern ? `hs_code.ilike.${hsPattern}` : null,
    signals.country ? `destination.ilike.%${signals.country}%` : null,
  ].filter(Boolean);

  let hsQuery = admin
    .from("export_hs_catalog")
    .select("hs_code,destination,om_rate,omr_rate,notes,source")
    .limit(8);

  if (hsOr.length) hsQuery = hsQuery.or(hsOr.join(","));
  const { data: hsRows } = await hsQuery;

  if (Array.isArray(hsRows) && hsRows.length) {
    snippets.push(
      "Catalogue HS (Supabase):\n" +
        hsRows
          .map((r: any) => `${r.hs_code} -> ${r.destination} | OM=${r.om_rate ?? "n/a"} | OMR=${r.omr_rate ?? "n/a"} | ${r.notes || ""}`)
          .join("\n")
    );
    hsRows.forEach((r: any) => {
      if (r?.source && /^https?:\/\//i.test(String(r.source))) {
        links.push({ title: `Source HS ${r.hs_code}`, url: String(r.source), origin: "supabase" });
      }
    });
  }

  const regFilter = signals.country
    ? `jurisdiction.ilike.%${signals.country}%,title.ilike.%${signals.country}%`
    : `title.ilike.%${question.slice(0, 20)}%`;

  const { data: regRows } = await admin
    .from("reg_events")
    .select("title,summary,jurisdiction,impact,created_at")
    .order("created_at", { ascending: false })
    .limit(6)
    .or(regFilter);

  if (Array.isArray(regRows) && regRows.length) {
    snippets.push(
      "Veille réglementaire (Supabase reg_events):\n" +
        regRows
          .map((r: any) => `${r.title} | ${r.jurisdiction || "n/a"} | impact=${r.impact || "n/a"} | ${r.summary || ""}`)
          .join("\n")
    );
  }

  return { snippets, links: links.slice(0, 4) };
}

function buildFollowUpQuestions(question: string, signals: ReturnType<typeof extractSignals>) {
  const asks: string[] = [];
  if (!signals.country) asks.push("Quel est le pays de destination exact (et éventuellement pays de transit) ?");
  if (!signals.hsCode) asks.push("As-tu un code HS (6 ou 8 chiffres) ou une description produit plus précise ?");
  if (!signals.incoterm) asks.push("Quel Incoterm est prévu (EXW/FCA/FOB/CIF/DAP/DDP...) ?");
  if (!signals.paymentMentioned && /paiement|risque|client|exporter/i.test(question)) {
    asks.push("Quel mode de paiement est envisagé (acompte, crédit documentaire, compte ouvert, virement) ?");
  }
  return asks.slice(0, 3);
}

function normalizeFollowUpQuestion(input: string) {
  const value = input.trim();
  if (!value) return value;
  return /[?]$/.test(value) ? value : `${value} ?`;
}

function buildActionPlan(signals: ReturnType<typeof extractSignals>) {
  const actions: string[] = [];
  if (!signals.country) actions.push("Confirmer le pays de destination exact et les pays de transit.");
  if (!signals.hsCode) actions.push("Valider le code HS (6/8 chiffres) et la description technique du produit.");
  if (!signals.incoterm) actions.push("Choisir l'Incoterm cible (FCA, FOB, CIF, DAP, DDP...) et qui paie quoi.");
  actions.push("Verifier droits/taxes, exigences documentaires et restrictions avant expedition.");
  return actions.slice(0, 4);
}

function buildGuidedConversationAnswer(params: {
  question: string;
  signals: ReturnType<typeof extractSignals>;
  followUps: string[];
  contextSummary: string;
  snippets?: string[];
}) {
  const known = [
    params.signals.country ? `- Pays detecte: ${params.signals.country}` : "- Pays: a confirmer",
    params.signals.hsCode ? `- HS detecte: ${params.signals.hsCode}` : "- HS: a confirmer",
    params.signals.incoterm ? `- Incoterm detecte: ${params.signals.incoterm}` : "- Incoterm: a confirmer",
  ].join("\n");

  const questions = (params.followUps.length ? params.followUps : buildFollowUpQuestions(params.question, params.signals))
    .slice(0, 3)
    .map((q) => `- ${normalizeFollowUpQuestion(q)}`)
    .join("\n");

  const dataHint = params.snippets?.length
    ? "J'ai trouve des elements dans la base export pour appuyer la suite."
    : "Je n'ai pas encore assez de donnees fiables pour conclure sans precision complementaire.";

  return [
    `J'ai bien compris votre demande: "${params.question}".`,
    `Diagnostic provisoire:\n${known}`,
    dataHint,
    "Plan immediat:\n- Verifier la classification douaniere (HS)\n- Verifier droits/taxes et restrictions\n- Verrouiller Incoterm + transport + paiement",
    `Pour vous donner une reponse finale precise, merci de confirmer:\n${questions}`,
    `Contexte courant: ${params.contextSummary}`,
  ].join("\n\n");
}

function isVagueModelAnswer(answer: string, mode?: string) {
  const txt = answer.trim().toLowerCase();
  if (!txt) return true;
  if (txt.length < 80) return true;
  if (/(je ne peux pas|je ne sais pas|pas de reponse|indisponible|reessayez|reessaie|erreur|aucune donnee fiable)/i.test(txt)) {
    return true;
  }
  if (/(fallback|timeout|error)/i.test(String(mode || ""))) return true;
  return false;
}

function parseModelJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;
  try {
    return JSON.parse(candidate) as { answer?: unknown; actions?: unknown; follow_up_questions?: unknown };
  } catch {
    return null;
  }
}

function normalizeModelAnswer(params: {
  raw: string;
  followUps: string[];
  contextSummary: string;
}) {
  const parsed = parseModelJson(params.raw);
  const parsedAnswer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
  const parsedActions = Array.isArray(parsed?.actions)
    ? parsed.actions.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 4)
    : [];
  const parsedFollowUps = Array.isArray(parsed?.follow_up_questions)
    ? parsed.follow_up_questions.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 3)
    : [];

  const answer = (parsedAnswer || params.raw || "").trim();
  const fallbackAnswer = [
    "Voici une réponse opérationnelle avec les informations disponibles.",
    `Contexte: ${params.contextSummary}.`,
    "Je peux affiner le plan dès que vous confirmez le pays, le code HS et l'incoterm.",
  ].join(" ");

  return {
    answer: answer || fallbackAnswer,
    actions: parsedActions.length
      ? parsedActions
      : [
          "Valider destination + pays de transit.",
          "Confirmer code HS (6/8 chiffres) et description technique.",
          "Confirmer Incoterm + mode de paiement + assurance.",
        ],
    follow_up_questions: parsedFollowUps.length ? parsedFollowUps : params.followUps,
  };
}

async function fetchLexicalKbChunks(admin: ReturnType<typeof supabaseAdmin>, question: string) {
  try {
    const q = question.trim().slice(0, 80);
    if (!q) return [] as Array<{ id: string; document_id: string; content: string; similarity: number }>;

    const { data: chunks, error } = await admin
      .from("kb_chunks")
      .select("id,document_id,content")
      .ilike("content", `%${q}%`)
      .limit(4);

    if (error) {
      console.error("[api/ask] lexical kb_chunks", error.message);
      return [];
    }

    return (Array.isArray(chunks) ? chunks : []).map((c: any) => ({
      id: String(c.id),
      document_id: String(c.document_id),
      content: String(c.content || ""),
      similarity: 0,
    }));
  } catch (e: any) {
    console.error("[api/ask] lexical retrieval exception", e?.message || e);
    return [];
  }
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  let fallbackQuestion = "";
  let fallbackSessionId: string | null = null;
  let fallbackSignals = extractSignals("");
  let fallbackFollowUps: string[] = [];
  let fallbackContextSummary = "Pays: manquant | HS: manquant | Incoterm: manquant | Produit: manquant";
  let fallbackSourceLinks: Array<{ title: string; url: string; origin: "supabase" | "specialized_site" }> = [];
  let fallbackSnippets: string[] = [];

  try {
    const auth = await resolveOptionalUser(req);

    const body = await readJson<AskPayload>(req);
    const question = String(body?.question || "").trim();
    if (!question) {
      return json(res, 400, { ok: false, error: "question_required" });
    }

    const admin = supabaseAdmin();
    const requestedSessionId = normalizeSessionId(body?.context?.session_id);
    const session = auth
      ? await resolveChatSession({
          userId: auth.user.id,
          requestedSessionId,
          fallbackTitle: question,
        })
      : { sessionId: null as string | null, history: [] as ConversationMessage[] };

    const contextHistory = normalizeHistory(body?.context ?? null);
    const mergedHistory = mergeConversationHistory(session.history, contextHistory);

    const initialSignals = extractSignals(question);
    const contextual = summarizeContext(question, body?.context ?? null, initialSignals, mergedHistory);
    const signals = {
      ...initialSignals,
      ...contextual.mergedSignals,
      country: contextual.mergedSignals.country || initialSignals.country,
      hsCode: contextual.mergedSignals.hsCode || initialSignals.hsCode,
      incoterm: contextual.mergedSignals.incoterm || initialSignals.incoterm,
      paymentMentioned: initialSignals.paymentMentioned || contextual.mergedSignals.paymentMentioned,
      sanctionsMentioned: initialSignals.sanctionsMentioned || contextual.mergedSignals.sanctionsMentioned,
    };

    const followUps = buildFollowUpQuestions(question, signals);
    const supabaseFacts = await fetchSupabaseFacts(question, signals);
    const specializedLinks = specializedSourcesFor(`${question}\n${contextual.contextSummary}`);
    fallbackQuestion = question;
    fallbackSessionId = session.sessionId;
    fallbackSignals = signals;
    fallbackFollowUps = followUps;
    fallbackContextSummary = contextual.contextSummary;
    fallbackSourceLinks = [...supabaseFacts.links, ...specializedLinks].slice(0, 8);
    fallbackSnippets = supabaseFacts.snippets;

    if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
      const source_links = fallbackSourceLinks;
      const degradedBase = buildGuidedConversationAnswer({
        question,
        signals,
        followUps,
        contextSummary: contextual.contextSummary,
        snippets: supabaseFacts.snippets,
      });
      const feedbackPrefix = contextual.satisfaction === false
        ? "Merci pour le retour. Je vais corriger ma proposition et repartir sur les informations essentielles.\n\n"
        : "";
      const result: AskResult = {
        answer: `${feedbackPrefix}${degradedBase}`,
        actions: buildActionPlan(signals),
        follow_up_questions: followUps,
        source_links,
        context_summary: contextual.contextSummary,
        satisfaction_prompt: "Cette réponse vous aide-t-elle ? Si non, précisez ce qui manque et je reformule.",
      };

      if (auth) {
        await persistChatExchange({
          userId: auth.user.id,
          sessionId: session.sessionId,
          question,
          answer: result.answer,
        });

        try {
          await admin.from("tool_runs").insert({
            user_id: auth.user.id,
            tool_name: "ask",
            input_json: { question, context: body?.context ?? null, signals, session_id: session.sessionId, context_summary: contextual.contextSummary, history: contextual.history, feedback_satisfied: contextual.satisfaction, mode: "degraded_no_openai" },
            output_json: result,
          });
        } catch (e) {
          console.error("[api/ask] tool_runs insert failed", e);
        }
      }

      return json(res, 200, { ok: true, mode: "degraded", session_id: session.sessionId, ...result });
    }

    let safeChunks: any[] = [];
    if (OPENAI_API_KEY) {
      const embedding = await openaiEmbed(question);
      if (!embedding) throw new Error("embedding_missing");

      if (auth) {
        await storeConversationEmbedding({
          userId: auth.user.id,
          message: question,
          embedding,
          role: "user",
          sessionId: typeof body?.context?.session_id === "string" ? body.context.session_id : null,
          metadata: {
            context_summary: contextual.contextSummary,
            signals,
          },
        });
      }

      const { data: chunks, error: matchError } = await admin.rpc("match_kb_chunks", {
        query_embedding: embedding,
        match_count: 6,
        min_similarity: 0.15,
      });

      if (matchError) {
        console.error("[api/ask] match_kb_chunks", matchError);
      }

      safeChunks = Array.isArray(chunks) ? chunks : [];
    } else {
      safeChunks = await fetchLexicalKbChunks(admin, `${question}
${contextual.contextSummary}`);
    }
    const contextBlocks = safeChunks
      .map((c: any, idx: number) => `#${idx + 1} (doc ${c.document_id}):\n${c.content}`)
      .join("\n\n");

    const knowledgeBlocks = [
      contextBlocks ? `Base documentaire (RAG):\n${contextBlocks}` : "",
      supabaseFacts.snippets.length ? supabaseFacts.snippets.join("\n\n") : "",
      specializedLinks.length
        ? "Sources spécialisées suggérées:\n" + specializedLinks.map((s) => `- ${s.title}: ${s.url}`).join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const system =
      "Tu es MPL Export Navigator, conseiller export senior (incoterms, douane, conformite, risques pays, paiements). " +
      "Ta mission: repondre comme dans une vraie conversation de conseil, de facon claire et concrete. " +
      "Format attendu: 1) diagnostic adapte au cas, 2) actions prioritaires (3-4 max), 3) questions de clarification (2-3) quand des donnees manquent. " +
      "N'ecris jamais une reponse vague ou generique. Si une information manque, dis precisement laquelle et pourquoi elle bloque la decision. " +
      "Si l'utilisateur dit que la reponse n'aide pas, excuse-toi en une phrase puis propose une version corrigee et plus operationnelle. " +
      "Reponds strictement en JSON avec les cles: answer (string), actions (array max 4), follow_up_questions (array max 3).";
    const user =
      `Question courante: ${question}
` +
      `Résumé du contexte: ${contextual.contextSummary}
` +
      (contextual.history.length
        ? `Historique conversation (récent):
${contextual.history.map((m) => `- ${m.role}: ${m.content}`).join("\n")}
`
        : "") +
      (body?.context ? `Contexte utilisateur brut: ${JSON.stringify(body.context)}
` : "") +
      (contextual.satisfaction === false ? "Retour utilisateur: la réponse précédente n'est pas satisfaisante.\n" : "") +
      (knowledgeBlocks ? `
Connaissances disponibles:
${knowledgeBlocks}` : "") +
      (followUps.length
        ? `
Questions de clarification suggérées (si infos insuffisantes):
${followUps.map((q) => `- ${q}`).join("\n")}`
        : "");

    const raw = OPENAI_API_KEY
      ? await openaiChat([
          { role: "system", content: system },
          { role: "user", content: user },
        ])
      : await geminiChat(`${system}\n\n${user}`);

    const normalized = normalizeModelAnswer({
      raw,
      followUps,
      contextSummary: contextual.contextSummary,
    });

    const source_links = fallbackSourceLinks;
    const mergedFollowUps = Array.from(
      new Set(
        [...(normalized.follow_up_questions || []), ...followUps]
          .map((x) => String(x || "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 3);
    const shouldUseGuidedAnswer = isVagueModelAnswer(normalized.answer, OPENAI_API_KEY ? "openai" : "gemini");
    const guidedAnswer = buildGuidedConversationAnswer({
      question,
      signals,
      followUps: mergedFollowUps,
      contextSummary: contextual.contextSummary,
      snippets: supabaseFacts.snippets,
    });
    const finalAnswer = shouldUseGuidedAnswer ? guidedAnswer : normalized.answer;
    const finalActions = (Array.isArray(normalized.actions) && normalized.actions.length)
      ? normalized.actions
      : buildActionPlan(signals);

    const apology = contextual.satisfaction === false ? "Merci pour votre retour — voici une version améliorée.\n\n" : "";
    const result: AskResult = {
      answer: `${apology}${finalAnswer}`,
      actions: finalActions,
      follow_up_questions: mergedFollowUps,
      sources: safeChunks.map((c: any) => ({
        document_id: c.document_id,
        chunk_id: c.id,
        similarity: Number(c.similarity || 0),
      })),
      source_links,
      context_summary: contextual.contextSummary,
      satisfaction_prompt: "Cette réponse vous semble-t-elle satisfaisante ? Si non, dites ce qui manque et je corrige.",
    };

      if (auth) {
        try {
          await admin.from("tool_runs").insert({
            user_id: auth.user.id,
            tool_name: "ask",
            input_json: { question, context: body?.context ?? null, signals, session_id: session.sessionId, context_summary: contextual.contextSummary, history: contextual.history, feedback_satisfied: contextual.satisfaction },
            output_json: result,
          });
        } catch (e) {
          console.error("[api/ask] tool_runs insert failed", e);
        }

        await persistChatExchange({
          userId: auth.user.id,
          sessionId: session.sessionId,
          question,
          answer: result.answer,
        });
      }

    const mode = OPENAI_API_KEY ? "openai" : "gemini";
    return json(res, 200, { ok: true, mode, session_id: session.sessionId, ...result });
  } catch (err: any) {
    const raw = String(err?.message || "ask_failed");
    console.error("[api/ask] error", raw);

    const safeQuestion = fallbackQuestion || "Demande export";
    const safeFollowUps = (fallbackFollowUps.length
      ? fallbackFollowUps
      : buildFollowUpQuestions(safeQuestion, fallbackSignals)).slice(0, 3);
    const source_links = fallbackSourceLinks.length
      ? fallbackSourceLinks
      : specializedSourcesFor(safeQuestion).slice(0, 4);
    const answer = buildGuidedConversationAnswer({
      question: safeQuestion,
      signals: fallbackSignals,
      followUps: safeFollowUps,
      contextSummary: fallbackContextSummary,
      snippets: fallbackSnippets,
    });

    return json(res, 200, {
      ok: true,
      mode: raw === "ai_not_configured" ? "degraded_no_ai" : "degraded_error",
      answer,
      actions: buildActionPlan(fallbackSignals),
      follow_up_questions: safeFollowUps,
      source_links,
      context_summary: fallbackContextSummary,
      session_id: fallbackSessionId,
      technical_status: raw || "ask_failed",
      satisfaction_prompt: "Si vous repondez aux 2-3 questions ci-dessus, je vous fournis une reponse finale plus precise.",
    });
  }
});
