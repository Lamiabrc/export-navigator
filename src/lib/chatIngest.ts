import { supabase } from "@/integrations/supabase/client";

export type ChatIngestParams = {
  channel: "support_widget" | "assistant_page" | "home_copilot" | "copilote_page" | "control_tower_assistant";
  source?: string | null;
  clientSessionId?: string | null;
  question: string;
  answer: string;
  mode?: string | null;
  context?: Record<string, unknown> | null;
};

export async function ingestChatExchange(params: ChatIngestParams) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    await fetch("/api/chat-ingest", {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: params.channel,
        source: params.source ?? null,
        client_session_id: params.clientSessionId ?? null,
        question: params.question,
        answer: params.answer,
        mode: params.mode ?? null,
        context: params.context ?? {},
      }),
    });
  } catch {
    // Best effort telemetry; never block UI.
  }
}
