import type { VercelRequest, VercelResponse } from "@vercel/node";

import { allowCors, json, readJson } from "../src/server/supabaseAdmin.js";
import { chatHandler } from "./chat.js";

type AskPayload = {
  question?: string;
  message?: string;
  lang?: string | null;
  session_id?: string | null;
  thread_id?: string | null;
  context?: Record<string, unknown> | null;
  overrides?: Record<string, unknown> | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function buildOverrides(payload: AskPayload) {
  const context = asObject(payload.context);
  const explicit = asObject(payload.overrides);

  return {
    origin: asOptionalText(explicit.origin ?? context.origin),
    destination: asOptionalText(explicit.destination ?? context.destination),
    hs6: asOptionalText(explicit.hs6 ?? context.hs6 ?? context.hs_code ?? context.product_hs),
    incoterm: asOptionalText(explicit.incoterm ?? context.incoterm),
    payment: asOptionalText(explicit.payment ?? explicit.payment_term ?? context.payment ?? context.payment_term),
    transport: asOptionalText(explicit.transport ?? explicit.transport_mode ?? context.transport ?? context.transport_mode),
    currency: asOptionalText(explicit.currency ?? context.currency),
    contract_type: asOptionalText(explicit.contract_type ?? context.contract_type),
  };
}

export async function askHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const body = await readJson<AskPayload>(req);
  const message = String(body?.question ?? body?.message ?? "").trim();
  if (!message) {
    return json(res, 400, { ok: false, error: "question_required" });
  }

  const mappedBody = {
    message,
    lang: asOptionalText(body?.lang),
    thread_id: asOptionalText(body?.thread_id ?? body?.session_id ?? asObject(body?.context).session_id),
    overrides: buildOverrides(body),
  };

  (req as unknown as { body: unknown }).body = mappedBody;
  return chatHandler(req, res);
}

export default allowCors(askHandler);
