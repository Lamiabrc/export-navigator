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

function asOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "oui", "pro", "taxable", "assujetti"].includes(normalized)) return true;
  if (["false", "0", "no", "non", "not_taxable", "non_assujetti"].includes(normalized)) return false;
  return null;
}

function buildOverrides(payload: AskPayload) {
  const context = asObject(payload.context);
  const explicit = asObject(payload.overrides);

  return {
    flow: asOptionalText(explicit.flow ?? context.flow ?? context.direction),
    goods_or_services: asOptionalText(
      explicit.goods_or_services ??
      explicit.goodsOrServices ??
      context.goods_or_services ??
      context.goodsOrServices
    ),
    origin: asOptionalText(explicit.origin ?? explicit.from ?? context.origin ?? context.from),
    destination: asOptionalText(explicit.destination ?? explicit.to ?? context.destination ?? context.to),
    hs6: asOptionalText(explicit.hs6 ?? context.hs6 ?? context.hs_code ?? context.product_hs),
    product: asOptionalText(explicit.product ?? context.product ?? context.product_text ?? context.description),
    usage: asOptionalText(explicit.usage ?? context.usage ?? context.end_use),
    incoterm: asOptionalText(explicit.incoterm ?? context.incoterm),
    payment: asOptionalText(explicit.payment ?? explicit.payment_term ?? context.payment ?? context.payment_term),
    transport: asOptionalText(explicit.transport ?? explicit.transport_mode ?? context.transport ?? context.transport_mode),
    currency: asOptionalText(explicit.currency ?? context.currency),
    value: asOptionalText(explicit.value ?? explicit.amount ?? context.value ?? context.amount),
    buyer: asOptionalText(explicit.buyer ?? explicit.buyer_name ?? context.buyer ?? context.buyer_name),
    seller: asOptionalText(explicit.seller ?? explicit.seller_name ?? context.seller ?? context.seller_name),
    buyer_is_taxable: asOptionalBoolean(
      explicit.buyer_is_taxable ??
      explicit.buyerIsTaxable ??
      context.buyer_is_taxable ??
      context.buyerIsTaxable
    ),
    buyer_vat: asOptionalText(explicit.buyer_vat ?? explicit.buyerVat ?? context.buyer_vat ?? context.buyerVat),
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
