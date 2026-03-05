import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type ChatIngestPayload = {
  channel?: string;
  source?: string | null;
  client_session_id?: string | null;
  question?: string;
  answer?: string;
  mode?: string | null;
  context?: Record<string, unknown> | null;
};

const ALLOWED_CHANNELS = new Set([
  "support_widget",
  "assistant_page",
  "home_copilot",
  "copilote_page",
  "control_tower_assistant",
]);

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function trySupabaseAdmin() {
  try {
    return supabaseAdmin();
  } catch {
    return null;
  }
}

async function resolveOptionalUserId(req: VercelRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  const admin = trySupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return String(data.user.id);
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson<ChatIngestPayload>(req);
    const question = cleanText(body?.question, 12000);
    const answer = cleanText(body?.answer, 12000);
    if (!question || !answer) {
      return json(res, 400, { ok: false, error: "question_and_answer_required" });
    }

    const channelRaw = cleanText(body?.channel, 80);
    const channel = ALLOWED_CHANNELS.has(channelRaw) ? channelRaw : "assistant_page";
    const source = cleanText(body?.source, 80) || null;
    const clientSessionId = cleanText(body?.client_session_id, 120) || null;
    const mode = cleanText(body?.mode, 120) || null;
    const context =
      body?.context && typeof body.context === "object" && !Array.isArray(body.context)
        ? body.context
        : {};

    const userId = await resolveOptionalUserId(req);
    const admin = trySupabaseAdmin();
    if (!admin) {
      return json(res, 200, { ok: true, ingested: false, reason: "supabase_unavailable" });
    }

    const { error } = await admin.from("chat_events").insert({
      user_id: userId,
      channel,
      source,
      client_session_id: clientSessionId,
      question,
      answer,
      mode,
      context_json: context,
    });

    if (error) {
      return json(res, 200, {
        ok: true,
        ingested: false,
        reason: "insert_failed",
        error: String(error.message || "chat_events_insert_failed"),
      });
    }

    return json(res, 200, { ok: true, ingested: true });
  } catch (err: any) {
    return json(res, 200, {
      ok: true,
      ingested: false,
      reason: "chat_ingest_failed",
      error: String(err?.message || "chat_ingest_failed"),
    });
  }
});
