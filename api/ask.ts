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

type AskResult = {
  answer: string;
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

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function requireUser(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { ok: false, error: "missing_auth_bearer" });
    return null;
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    json(res, 401, { ok: false, error: "invalid_auth", detail: error?.message || null });
    return null;
  }
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
    .map((m: any) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content.trim() : "",
    }))
    .filter((m: ConversationMessage) => m.content.length > 0)
    .slice(-12);
}

function summarizeContext(question: string, context: Record<string, any> | null | undefined, signals: ReturnType<typeof extractSignals>) {
  const history = normalizeHistory(context);
  const corpus = [
    ...history.filter((m) => m.role === "user").map((m) => m.content),
    question,
    typeof context?.product === "string" ? context.product : "",
    typeof context?.destination === "string" ? context.destination : "",
  ]
    .filter(Boolean)
    .join("
");

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

function buildDegradedAnswer(question: string, signals: ReturnType<typeof extractSignals>, followUps: string[], snippets: string[]) {
  const known = [
    signals.country ? `Destination détectée: ${signals.country}.` : null,
    signals.incoterm ? `Incoterm détecté: ${signals.incoterm}.` : null,
    signals.hsCode ? `Code HS détecté: ${signals.hsCode}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const factualHint = snippets.length
    ? "J'ai trouvé des éléments dans la base Supabase (incoterms/HS/veille) que je peux affiner avec vos précisions."
    : "Je n'ai pas encore assez d'éléments en base pour répondre précisément.";

  const askBlock = followUps.length
    ? `Pour vous répondre correctement, j'ai besoin de:\n- ${followUps.join("\n- ")}`
    : "Je peux déjà proposer un plan d'action opérationnel sur votre cas.";

  return [
    `Question reçue: "${question}".`,
    known || "Signaux partiels détectés (infos clés manquantes).",
    factualHint,
    askBlock,
    "Réponse provisoire: commencez par verrouiller pays + HS + incoterm + mode de paiement avant toute validation finale.",
  ].join("\n\n");
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req, res);
    if (!auth) return;

    const body = await readJson<AskPayload>(req);
    const question = String(body?.question || "").trim();
    if (!question) {
      return json(res, 400, { ok: false, error: "question_required" });
    }

    const initialSignals = extractSignals(question);
    const contextual = summarizeContext(question, body?.context ?? null, initialSignals);
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
    const specializedLinks = specializedSourcesFor(`${question}
${contextual.contextSummary}`);

    const admin = supabaseAdmin();

    if (!OPENAI_API_KEY) {
      const source_links = [...supabaseFacts.links, ...specializedLinks].slice(0, 8);
      const degradedBase = buildDegradedAnswer(question, signals, followUps, supabaseFacts.snippets);
      const feedbackPrefix = contextual.satisfaction === false
        ? "Merci pour le retour. Je vais corriger ma proposition et repartir sur les informations essentielles.

"
        : "";
      const result: AskResult = {
        answer: `${feedbackPrefix}${degradedBase}`,
        actions: [
          "Confirmer destination + pays de transit.",
          "Fournir HS code (6/8 chiffres) ou description technique.",
          "Confirmer Incoterm + mode de paiement.",
          "Valider si la réponse est satisfaisante (oui/non).",
        ],
        follow_up_questions: followUps,
        source_links,
        context_summary: contextual.contextSummary,
        satisfaction_prompt: "Cette réponse vous aide-t-elle ? Si non, précisez ce qui manque et je reformule.",
      };

      try {
        await admin.from("tool_runs").insert({
          user_id: auth.user.id,
          tool_name: "ask",
          input_json: { question, context: body?.context ?? null, signals, context_summary: contextual.contextSummary, history: contextual.history, feedback_satisfied: contextual.satisfaction, mode: "degraded_no_openai" },
          output_json: result,
        });
      } catch (e) {
        console.error("[api/ask] tool_runs insert failed", e);
      }

      return json(res, 200, { ok: true, mode: "degraded", ...result });
    }

    const embedding = await openaiEmbed(question);
    if (!embedding) throw new Error("embedding_missing");

    const { data: chunks, error: matchError } = await admin.rpc("match_kb_chunks", {
      query_embedding: embedding,
      match_count: 6,
      min_similarity: 0.15,
    });

    if (matchError) {
      console.error("[api/ask] match_kb_chunks", matchError);
    }

    const safeChunks = Array.isArray(chunks) ? chunks : [];
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
      "Tu es un agent IA export opérationnel (incoterms, douane, conformité, risques pays, paiements). " +
      "Tu échanges de manière humaine et professionnelle, en français clair. " +
      "Tu dois collecter les infos critiques (produit, code HS, pays, incoterm, paiement, objectif) et combler les manques avec 1 à 3 questions max. " +
      "Si l'utilisateur indique que la réponse n'est pas satisfaisante, excuse-toi brièvement puis reformule avec un plan amélioré. " +
      "Fournis un plan actionnable et court, plus une demande de validation de satisfaction. " +
      "Réponds strictement en JSON avec les clés: answer (string), actions (array max 4), follow_up_questions (array max 3).";
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
      (contextual.satisfaction === false ? "Retour utilisateur: la réponse précédente n'est pas satisfaisante.
" : "") +
      (knowledgeBlocks ? `
Connaissances disponibles:
${knowledgeBlocks}` : "") +
      (followUps.length
        ? `
Questions de clarification suggérées (si infos insuffisantes):
${followUps.map((q) => `- ${q}`).join("\n")}`
        : "");

    const raw = await openaiChat([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);

    let answer = raw;
    let actions: string[] | undefined;
    let follow_up_questions: string[] | undefined = followUps;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.answer === "string") answer = parsed.answer;
      if (Array.isArray(parsed?.actions)) actions = parsed.actions.filter((x: any) => typeof x === "string").slice(0, 4);
      if (Array.isArray(parsed?.follow_up_questions)) {
        follow_up_questions = parsed.follow_up_questions.filter((x: any) => typeof x === "string").slice(0, 3);
      }
    } catch {
      // keep raw text
    }

    const source_links = [...supabaseFacts.links, ...specializedLinks].slice(0, 8);

    const apology = contextual.satisfaction === false ? "Merci pour votre retour — voici une version améliorée.\n\n" : "";
    const result: AskResult = {
      answer: `${apology}${answer}`,
      actions,
      follow_up_questions,
      sources: safeChunks.map((c: any) => ({
        document_id: c.document_id,
        chunk_id: c.id,
        similarity: Number(c.similarity || 0),
      })),
      source_links,
      context_summary: contextual.contextSummary,
      satisfaction_prompt: "Cette réponse vous semble-t-elle satisfaisante ? Si non, dites ce qui manque et je corrige.",
    };

    try {
      await admin.from("tool_runs").insert({
        user_id: auth.user.id,
        tool_name: "ask",
        input_json: { question, context: body?.context ?? null, signals, context_summary: contextual.contextSummary, history: contextual.history, feedback_satisfied: contextual.satisfaction },
        output_json: result,
      });
    } catch (e) {
      console.error("[api/ask] tool_runs insert failed", e);
    }

    return json(res, 200, { ok: true, ...result });
  } catch (err: any) {
    const raw = String(err?.message || "ask_failed");
    console.error("[api/ask] error", raw);

    if (raw === "ai_not_configured") {
      return json(res, 200, {
        ok: true,
        mode: "degraded",
        answer: "Le moteur IA avancé n'est pas configuré sur cet environnement. Donnez destination, HS, incoterm et paiement: je peux déjà vous guider en mode structuré.",
        actions: [
          "Confirmer destination + transit.",
          "Donner HS ou description technique.",
          "Confirmer incoterm et mode de paiement.",
        ],
      });
    }

    return json(res, 500, { ok: false, error: raw || "ask_failed" });
  }
});
