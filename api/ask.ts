import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type AskPayload = {
  question?: string;
  context?: Record<string, any> | null;
};

type AskResult = {
  answer: string;
  actions?: string[];
  sources?: Array<{ document_id: string; chunk_id: string; similarity: number }>;
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
      temperature: 0.4,
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

    const embedding = await openaiEmbed(question);
    if (!embedding) throw new Error("embedding_missing");

    const admin = supabaseAdmin();
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

    const system =
      "Tu es un expert en commerce international et geopolitique. " +
      "Ton style est humain, pro et cool. " +
      "Commence toujours par 'Bonjour' et termine par 'Merci'. " +
      "Propose exactement 3 actions immediates concretes. " +
      "Si des informations manquent, dis-le clairement. " +
      "Reponds en JSON avec les cles: answer (string), actions (array de 3 strings).";

    const user =
      `Question: ${question}\n` +
      (body?.context ? `Contexte utilisateur: ${JSON.stringify(body.context)}\n` : "") +
      (contextBlocks ? `\nBase documentaire (extraits):\n${contextBlocks}` : "");

    const raw = await openaiChat([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);

    let answer = raw;
    let actions: string[] | undefined;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.answer === "string") answer = parsed.answer;
      if (Array.isArray(parsed?.actions)) actions = parsed.actions.filter((x: any) => typeof x === "string");
    } catch {
      // keep raw text
    }

    const result: AskResult = {
      answer,
      actions,
      sources: safeChunks.map((c: any) => ({
        document_id: c.document_id,
        chunk_id: c.id,
        similarity: Number(c.similarity || 0),
      })),
    };

    // store tool run
    try {
      await admin.from("tool_runs").insert({
        user_id: auth.user.id,
        tool_name: "ask",
        input_json: { question, context: body?.context ?? null },
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
      return json(res, 503, {
        ok: false,
        error: "ai_temporarily_unavailable",
        detail: "Le service IA n'est pas configuré pour cet environnement.",
      });
    }

    return json(res, 500, { ok: false, error: raw || "ask_failed" });
  }
});
