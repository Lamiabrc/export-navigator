import type { VercelRequest, VercelResponse } from "@vercel/node";

import { allowCors, json, readJson } from "../src/server/http.js";

type ChatRole = "user" | "assistant";

type BusinessDealChatMessage = {
  role: ChatRole;
  content: string;
};

type BusinessDealContext = {
  title?: string | null;
  summary?: string | null;
  company_name?: string | null;
  opportunity_type?: string | null;
  sector?: string | null;
  origin_country?: string | null;
  target_country?: string | null;
  website?: string | null;
};

type BusinessDealChatRequest = {
  lang?: "fr" | "en" | null;
  messages?: BusinessDealChatMessage[] | null;
  opportunity?: BusinessDealContext | null;
};

type BusinessDealChatResult = {
  verdict: "forte_opportunite" | "a_creuser" | "risque_eleve";
  score: number;
  why: string[];
  how: string[];
  missing: string[];
  answer_markdown: string;
  provider: "chatgpt" | "heuristic";
};

const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

function cleanText(value: unknown, limit = 4000) {
  return String(value || "").trim().slice(0, limit);
}

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return [] as BusinessDealChatMessage[];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const role = cleanText(item.role, 20) as ChatRole;
      const content = cleanText(item.content, 4000);
      if (!["user", "assistant"].includes(role) || !content) return null;
      return { role, content };
    })
    .filter((entry): entry is BusinessDealChatMessage => Boolean(entry))
    .slice(-8);
}

function normalizeOpportunity(value: unknown): BusinessDealContext | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return {
    title: cleanText(source.title, 240) || null,
    summary: cleanText(source.summary, 2000) || null,
    company_name: cleanText(source.company_name, 200) || null,
    opportunity_type: cleanText(source.opportunity_type, 80) || null,
    sector: cleanText(source.sector, 120) || null,
    origin_country: cleanText(source.origin_country, 16) || null,
    target_country: cleanText(source.target_country, 16) || null,
    website: cleanText(source.website, 240) || null,
  };
}

function buildHeuristicResult(params: {
  lang: "fr" | "en";
  messages: BusinessDealChatMessage[];
  opportunity: BusinessDealContext | null;
}): BusinessDealChatResult {
  const opportunity = params.opportunity;
  const question = params.messages.filter((entry) => entry.role === "user").slice(-1)[0]?.content || "";

  let score = 35;
  const why: string[] = [];
  const how: string[] = [];
  const missing: string[] = [];

  if (opportunity?.summary && opportunity.summary.length >= 80) {
    score += 18;
    why.push(params.lang === "en" ? "The request is described with useful operational detail." : "La demande est decrite avec un minimum de detail operationnel.");
  } else {
    missing.push(params.lang === "en" ? "Clarify the offer, expected volume and timing." : "Preciser l'offre, le volume attendu et le timing.");
  }

  if (opportunity?.origin_country && opportunity?.target_country) {
    score += 14;
    why.push(
      params.lang === "en"
        ? `There is already a clear market path from ${opportunity.origin_country} to ${opportunity.target_country}.`
        : `Il existe deja un couloir de marche clair entre ${opportunity.origin_country} et ${opportunity.target_country}.`
    );
  } else {
    missing.push(params.lang === "en" ? "Add origin and target geographies." : "Ajouter l'origine et le pays cible.");
  }

  if (opportunity?.contact_email || opportunity?.website) {
    score += 10;
    why.push(params.lang === "en" ? "There is an identifiable point of contact." : "Le contact est identifiable.");
  } else {
    missing.push(params.lang === "en" ? "Add a reachable contact channel." : "Ajouter un canal de contact reel.");
  }

  if (opportunity?.sector) {
    score += 8;
    why.push(params.lang === "en" ? `The sector is explicit (${opportunity.sector}).` : `Le secteur est explicite (${opportunity.sector}).`);
  }

  if (/prix|marge|budget|volume|MOQ|certif|certification|distributeur|exclusiv/i.test(`${opportunity?.summary || ""} ${question}`)) {
    score += 10;
    why.push(
      params.lang === "en"
        ? "The conversation already points to qualification criteria."
        : "La conversation commence deja a parler de criteres de qualification."
    );
  } else {
    missing.push(
      params.lang === "en"
        ? "Qualify margin, budget, certifications or expected volume."
        : "Qualifier la marge, le budget, les certifications ou le volume attendu."
    );
  }

  how.push(
    params.lang === "en"
      ? "Ask for the first commercial call with target volume, pricing level and timeline."
      : "Demander un premier call commercial avec volume cible, niveau de prix et delai."
  );
  how.push(
    params.lang === "en"
      ? "Validate execution capacity: logistics, payment terms and certifications."
      : "Valider la capacite d'execution: logistique, paiement et certifications."
  );
  how.push(
    params.lang === "en"
      ? "Use a short qualification sheet before spending sales time."
      : "Utiliser une fiche de qualification courte avant d'investir du temps commercial."
  );

  score = Math.max(5, Math.min(95, score));

  const verdict =
    score >= 72 ? "forte_opportunite" : score >= 48 ? "a_creuser" : "risque_eleve";

  const verdictLabel =
    verdict === "forte_opportunite"
      ? params.lang === "en"
        ? "Strong opportunity"
        : "Forte opportunite"
      : verdict === "a_creuser"
        ? params.lang === "en"
          ? "Worth exploring"
          : "A creuser"
        : params.lang === "en"
          ? "High risk"
          : "Risque eleve";

  const answer_markdown = [
    params.lang === "en"
      ? `Assessment: ${verdictLabel} (${score}/100).`
      : `Avis: ${verdictLabel} (${score}/100).`,
    "",
    params.lang === "en" ? "Why this can work:" : "Pourquoi cela peut marcher:",
    ...(why.length ? why.map((item) => `- ${item}`) : [params.lang === "en" ? "- Information is still too thin." : "- Les informations restent trop faibles."]),
    "",
    params.lang === "en" ? "How to make it a real deal:" : "Comment en faire une vraie affaire:",
    ...how.slice(0, 3).map((item) => `- ${item}`),
    ...(missing.length
      ? [
          "",
          params.lang === "en" ? "Missing before committing:" : "A verifier avant d'y consacrer du temps:",
          ...missing.slice(0, 3).map((item) => `- ${item}`),
        ]
      : []),
  ].join("\n");

  return {
    verdict,
    score,
    why: why.slice(0, 4),
    how: how.slice(0, 4),
    missing: missing.slice(0, 4),
    answer_markdown,
    provider: "heuristic",
  };
}

async function callOpenAI(params: {
  lang: "fr" | "en";
  messages: BusinessDealChatMessage[];
  opportunity: BusinessDealContext | null;
}): Promise<BusinessDealChatResult> {
  const transcript = params.messages
    .map((entry) => `${entry.role === "user" ? "Utilisateur" : "Assistant"}: ${entry.content}`)
    .join("\n\n");

  const context = params.opportunity
    ? [
        `Titre: ${params.opportunity.title || "n/a"}`,
        `Entreprise: ${params.opportunity.company_name || "n/a"}`,
        `Type: ${params.opportunity.opportunity_type || "n/a"}`,
        `Secteur: ${params.opportunity.sector || "n/a"}`,
        `Origine: ${params.opportunity.origin_country || "n/a"}`,
        `Cible: ${params.opportunity.target_country || "n/a"}`,
        `Site: ${params.opportunity.website || "n/a"}`,
        `Resume: ${params.opportunity.summary || "n/a"}`,
      ].join("\n")
    : "Aucune opportunite structuree fournie.";

  const system =
    params.lang === "en"
      ? "You are a senior B2B deal analyst for export opportunities. Assess business attractiveness and execution realism. Be concrete. Do not give legal advice. If data is missing, state it clearly."
      : "Tu es un analyste senior de deals B2B pour des opportunites export. Evalue l'attractivite business et la realite d'execution. Sois concret. Pas de conseil juridique. Si des donnees manquent, dis-le clairement.";

  const userPrompt = [
    params.lang === "en"
      ? "Return strict JSON with keys: verdict, score, why, how, missing, answer_markdown."
      : "Retourne un JSON strict avec les cles: verdict, score, why, how, missing, answer_markdown.",
    params.lang === "en"
      ? 'Allowed verdict values: "forte_opportunite", "a_creuser", "risque_eleve".'
      : 'Valeurs autorisees pour verdict: "forte_opportunite", "a_creuser", "risque_eleve".',
    params.lang === "en"
      ? "Use score as an integer from 0 to 100."
      : "Le score doit etre un entier entre 0 et 100.",
    "",
    "Contexte opportunite:",
    context,
    "",
    "Conversation:",
    transcript || (params.lang === "en" ? "No prior conversation." : "Pas d'historique."),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `openai_failed_${response.status}`);
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
  const content = String(payload?.choices?.[0]?.message?.content || "").trim();
  const parsed = JSON.parse(content || "{}") as Partial<BusinessDealChatResult>;

  const verdict =
    parsed.verdict === "forte_opportunite" || parsed.verdict === "a_creuser" || parsed.verdict === "risque_eleve"
      ? parsed.verdict
      : "a_creuser";

  const score = Math.max(0, Math.min(100, Number(parsed.score || 0) || 0));
  const why = Array.isArray(parsed.why) ? parsed.why.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 4) : [];
  const how = Array.isArray(parsed.how) ? parsed.how.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 4) : [];
  const missing = Array.isArray(parsed.missing)
    ? parsed.missing.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 4)
    : [];
  const answer_markdown = cleanText(parsed.answer_markdown, 4000);

  return {
    verdict,
    score,
    why,
    how,
    missing,
    answer_markdown,
    provider: "chatgpt",
  };
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const method = String(req.method || "").toUpperCase();
  if (method === "GET") {
    return json(res, 200, {
      ok: true,
      endpoint: "/api/business-deal-chat",
      methods: ["POST"],
      model: OPENAI_MODEL,
    });
  }

  if (method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const body = await readJson<BusinessDealChatRequest>(req);
    const lang = body?.lang === "en" ? "en" : "fr";
    const messages = normalizeMessages(body?.messages);
    const opportunity = normalizeOpportunity(body?.opportunity);

    if (!messages.length && !opportunity?.summary && !opportunity?.title) {
      return json(res, 400, { ok: false, error: "missing_context" });
    }

    let result: BusinessDealChatResult;
    if (OPENAI_API_KEY) {
      try {
        result = await callOpenAI({ lang, messages, opportunity });
      } catch {
        result = buildHeuristicResult({ lang, messages, opportunity });
      }
    } else {
      result = buildHeuristicResult({ lang, messages, opportunity });
    }

    return json(res, 200, {
      ok: true,
      ...result,
      model: OPENAI_API_KEY ? OPENAI_MODEL : null,
    });
  } catch (error: any) {
    return json(res, 500, {
      ok: false,
      error: "server_error",
      detail: String(error?.message || error || "server_error"),
    });
  }
}

export default allowCors(handler);

export const config = {
  runtime: "nodejs",
};
