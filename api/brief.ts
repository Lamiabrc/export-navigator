import type { VercelRequest, VercelResponse } from "@vercel/node";

type BriefRequestQuery = {
  sector?: string;
  product?: string;
  destination?: string;
};

type BriefSource = {
  id: string;
  title: string;
  link: string;
  sourceName: string;
  pubDate: string;
  impact: string;
};

type BriefResponse = {
  summary: string;
  sources: BriefSource[];
  createdAt: string;
  model: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getBaseUrl(req: VercelRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function scoreItem(item: any, terms: string[]) {
  const impact = String(item.impact || "").toUpperCase();
  let score = 0;
  if (impact === "HIGH") score += 4;
  if (impact === "MED") score += 2;

  const haystack = normalize(`${item.title || ""} ${item.summary || ""} ${(item.tags || []).join(" ")}`);
  terms.forEach((term) => {
    if (term && haystack.includes(term)) score += 3;
  });

  return score;
}

function buildPrompt(params: BriefRequestQuery, sources: BriefSource[]) {
  const focus = [params.sector, params.product, params.destination].filter(Boolean).join(" / ") || "operation export";
  const sourcesText = sources
    .map((source, index) => {
      return `[${index + 1}] ${source.title} - ${source.sourceName} (${source.pubDate})`;
    })
    .join("\n");

  return `Tu es un analyste export. Tu dois produire un brief actionnable en francais, base uniquement sur les sources ci-dessous.
Contexte: ${focus}

Sources:
${sourcesText}

Format attendu:
- Points cles (3 puces max)
- Risques (3 puces max)
- Actions immediates (3 puces max)

Regles:
- Cite les sources sous forme [1], [2] a la fin de chaque puce quand pertinent.
- Si les sources ne contiennent pas assez d'infos, le dire explicitement et proposer une prochaine action.
- Pas d'invention de taux ou donnees non presentes.
`;
}

async function callMistral(prompt: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  const model = process.env.MISTRAL_MODEL || "mistral-small-latest";
  const llmRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Tu es un assistant fiable pour les PME exportatrices francaises." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 450,
    }),
  });

  const llmPayload = await llmRes.json();
  if (!llmRes.ok) {
    throw new Error(llmPayload?.error?.message || "Mistral request failed");
  }

  const summary = llmPayload?.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("Mistral response empty");
  }

  return { summary, model };
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Tu es un assistant fiable pour les PME exportatrices francaises." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 450,
    }),
  });

  const llmPayload = await llmRes.json();
  if (!llmRes.ok) {
    throw new Error(llmPayload?.error?.message || "OpenAI request failed");
  }

  const summary = llmPayload?.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("OpenAI response empty");
  }

  return { summary, model };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const query = req.query as BriefRequestQuery;
    const sector = typeof query.sector === "string" ? query.sector : "";
    const product = typeof query.product === "string" ? query.product : "";
    const destination = typeof query.destination === "string" ? query.destination : "";

    const terms = [sector, product, destination].map((value) => normalize(value)).filter(Boolean);
    const baseUrl = getBaseUrl(req);

    const rssRes = await fetch(`${baseUrl}/api/rss?limit=60&offset=0`);
    const rssPayload = await rssRes.json();

    if (!rssRes.ok || rssPayload?.ok === false) {
      return res.status(500).json({ ok: false, error: rssPayload?.error || "RSS unavailable" });
    }

    const items = (rssPayload?.data?.items || []) as any[];
    if (!items.length) {
      return res.status(200).json({
        ok: true,
        data: { summary: "Aucune source disponible.", sources: [], createdAt: new Date().toISOString(), model: "none" },
      });
    }

    const scored = items
      .map((item) => ({ item, score: scoreItem(item, terms) }))
      .sort((a, b) => b.score - a.score || String(b.item.pubDate).localeCompare(String(a.item.pubDate)));

    const selected = (terms.length ? scored.filter((row) => row.score > 0) : scored)
      .slice(0, 6)
      .map((row) => row.item);

    const sources: BriefSource[] = selected.map((item) => ({
      id: item.id,
      title: item.title,
      link: item.link,
      sourceName: item.sourceName,
      pubDate: item.pubDate,
      impact: item.impact,
    }));

    const prompt = buildPrompt({ sector, product, destination }, sources);

    let result: { summary: string; model: string } | null = null;
    let lastError: string | null = null;

    try {
      result = await callMistral(prompt);
    } catch (err: any) {
      lastError = err?.message || "Mistral failed";
    }

    if (!result) {
      try {
        result = await callOpenAI(prompt);
      } catch (err: any) {
        lastError = err?.message || "OpenAI failed";
      }
    }

    if (!result) {
      return res.status(503).json({ ok: false, error: lastError || "No LLM configured" });
    }

    const data: BriefResponse = {
      summary: result.summary,
      sources,
      createdAt: new Date().toISOString(),
      model: result.model,
    };

    return res.status(200).json({ ok: true, data });
  } catch (error: any) {
    console.error("[api/brief] error", error?.message || error);
    return res.status(500).json({ ok: false, error: "Brief request failed" });
  }
}
