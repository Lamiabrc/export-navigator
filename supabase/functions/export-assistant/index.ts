// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type AssistantRequest = {
  message?: string;
  context?: Record<string, unknown>;
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  try {
    const { message, context }: AssistantRequest = await req.json();

    if (!message || typeof message !== "string") {
      return jsonResponse(400, { error: "message is required" });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return jsonResponse(500, { error: "OPENAI_API_KEY not set in secrets" });
    }

    const prompt = [
      "Tu es un assistant Export (DROM/UE/Hors UE) pour Orliman.",
      "Réponds en français, style opérationnel.",
      "Inclusions : suggestion HS code, incoterm, check-list docs, vigilance TVA/OM/OMR.",
      "N'invente pas de taux. Si données manquantes, demande des précisions.",
      `Contexte: ${JSON.stringify(context || {}, null, 2)}`,
      `Question utilisateur: ${message}`,
    ].join("\n");

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Assistant export DROM/UE/Hors UE pour contrôle facture et veille." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    };

    const completion = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!completion.ok) {
      const errText = await completion.text();
      return jsonResponse(completion.status, { error: "openai_error", detail: errText });
    }

    const data = await completion.json();
    const answer: string = data.choices?.[0]?.message?.content ?? "";

    return jsonResponse(200, {
      answer,
      actionsSuggested: [],
      citations: [],
    });
  } catch (error) {
    return jsonResponse(500, { error: "unexpected_error", detail: `${error}` });
  }
});
