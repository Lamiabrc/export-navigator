import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const DAILY_LIMIT = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatRequest = {
  session_id?: string;
  message?: string;
  context?: {
    countryIso2?: string;
    hs6?: string;
    product?: string;
    incoterm?: string;
    paymentTerms?: string;
  };
};

type DetectedContext = {
  countryIso2?: string;
  product?: string;
  hs6?: string;
};

async function callOpenAI(prompt: string, previousResponseId?: string) {
  if (!OPENAI_API_KEY) return { reply: "Le moteur IA n'est pas encore configuré. Je peux déjà vous aider: donnez pays, produit et code HS pour un plan concret.", responseId: undefined };

  const payload: Record<string, unknown> = {
    model: OPENAI_MODEL,
    input: prompt,
    max_output_tokens: 500,
  };
  if (previousResponseId) payload.previous_response_id = previousResponseId;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return {
    reply: data?.output_text || "Je n'ai pas pu formuler une réponse fiable.",
    responseId: data?.id as string | undefined,
  };
}

function extractHs(message: string): string | undefined {
  const found = message.match(/\b\d{4,6}\b/);
  return found?.[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
    const user = userData.user;

    const body = (await req.json().catch(() => ({}))) as ChatRequest;
    const message = String(body.message || "").trim();
    const requestContext = body.context || {};
    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400, headers: corsHeaders });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin
      .from("chat_usage_daily")
      .select("count")
      .eq("user_id", user.id)
      .eq("day", today)
      .maybeSingle();
    const current = Number(usage?.count || 0);
    if (current >= DAILY_LIMIT) {
      return Response.json({ error: "Daily limit reached", remaining: 0 }, { status: 429, headers: corsHeaders });
    }
    await admin.from("chat_usage_daily").upsert({ user_id: user.id, day: today, count: current + 1 });

    let sessionId = String(body.session_id || "").trim();
    let previousResponseId: string | undefined;
    if (!sessionId) {
      const { data: created, error } = await admin
        .from("chat_sessions")
        .insert({ user_id: user.id, title: message.slice(0, 80) })
        .select("id")
        .single();
      if (error) throw error;
      sessionId = created.id;
    } else {
      const { data: existing } = await admin
        .from("chat_sessions")
        .select("last_response_id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      previousResponseId = existing?.last_response_id || undefined;
    }

    const detected: DetectedContext = {
      hs6: requestContext.hs6 || extractHs(message),
      countryIso2: requestContext.countryIso2,
      product: requestContext.product,
    };

    if (!detected.countryIso2) {
      const { data: aliases } = await admin.from("country_aliases").select("iso2,alias").limit(5000);
      const lower = message.toLowerCase();
      const hit = (aliases || []).find((a) => lower.includes((a.alias || "").toLowerCase()));
      if (hit) detected.countryIso2 = hit.iso2;
    }

    if (!detected.product) {
      const { data: productSynonyms } = await admin.from("product_synonyms").select("term,product_id").limit(5000);
      const lower = message.toLowerCase();
      const hit = (productSynonyms || []).find((p) => lower.includes((p.term || "").toLowerCase()));
      if (hit?.product_id) {
        const { data: prod } = await admin.from("products").select("canonical_name").eq("id", hit.product_id).maybeSingle();
        detected.product = prod?.canonical_name;
      }
    }

    const ragQuery = [message, detected.product, detected.countryIso2, detected.hs6, requestContext.incoterm, requestContext.paymentTerms]
      .filter(Boolean)
      .join(" ");

    const { data: chunkRows } = await admin
      .from("kb_chunks")
      .select("id,content,document_id")
      .ilike("content", `%${ragQuery.slice(0, 80)}%`)
      .limit(4);

    const sources = [] as Array<{ document_title?: string; chunk_id?: string }>;
    const ragSnippets = [] as string[];
    for (const chunk of chunkRows || []) {
      ragSnippets.push(chunk.content.slice(0, 300));
      const { data: doc } = await admin.from("kb_documents").select("title").eq("id", chunk.document_id).maybeSingle();
      sources.push({ document_title: doc?.title || "Document", chunk_id: chunk.id });
    }

    const missingQuestions = [
      !detected.countryIso2 ? "Quel pays de destination visez-vous ?" : null,
      !detected.product ? "Quel est le produit exact ?" : null,
      !detected.hs6 ? "Avez-vous déjà un code HS (4 à 6 chiffres) ?" : null,
    ].filter(Boolean).slice(0, 2) as string[];

    const prompt = [
      "Tu es un copilote export humain, concret et empathique.",
      "Réponds en français clair, structuré en actions courtes.",
      "N'invente jamais une règle: si incertain, indique la limite.",
      `Message utilisateur: ${message}`,
      `Contexte détecté: pays=${detected.countryIso2 ?? "?"}; produit=${detected.product ?? "?"}; hs=${detected.hs6 ?? "?"}`,
      `Contexte fourni: incoterm=${requestContext.incoterm ?? "?"}; paiement=${requestContext.paymentTerms ?? "?"}`,
      ragSnippets.length ? `Extraits base de connaissance:\n- ${ragSnippets.join("\n- ")}` : "Aucun extrait KB pertinent.",
      missingQuestions.length ? `Si des infos manquent, pose ces questions max 2:\n- ${missingQuestions.join("\n- ")}` : "",
      "Format attendu: 1) synthèse 2) 3 actions 3) prochaines questions si nécessaire.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const llm = await callOpenAI(prompt, previousResponseId);

    await admin.from("chat_messages").insert([
      { session_id: sessionId, user_id: user.id, role: "user", content: message },
      { session_id: sessionId, user_id: user.id, role: "assistant", content: llm.reply },
    ]);

    await admin
      .from("chat_sessions")
      .update({ last_response_id: llm.responseId ?? previousResponseId ?? null })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    return Response.json(
      {
        session_id: sessionId,
        reply: llm.reply,
        detected_context: detected,
        follow_up_questions: missingQuestions,
        sources,
        remaining: DAILY_LIMIT - (current + 1),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
