import type { VercelRequest, VercelResponse } from "@vercel/node";

import { allowCors, json, readJson, supabaseAdmin } from "../src/server/http.js";

type BusinessContactRequest = {
  opportunityId?: string;
  firstName?: string;
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, limit = 4000) {
  return String(value || "").trim().slice(0, limit);
}

function cleanEmail(value: unknown) {
  return cleanText(value, 254).toLowerCase();
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const method = String(req.method || "").toUpperCase();
  if (method === "GET") {
    return json(res, 200, {
      ok: true,
      endpoint: "/api/business-contact",
      methods: ["POST"],
    });
  }

  if (method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const body = await readJson<BusinessContactRequest>(req);
    const opportunityId = cleanText(body.opportunityId, 80);
    const firstName = cleanText(body.firstName || body.name, 160);
    const email = cleanEmail(body.email);
    const company = cleanText(body.company, 200);
    const phone = cleanText(body.phone, 64);
    const message = cleanText(body.message, 4000);

    if (!UUID_RE.test(opportunityId)) {
      return json(res, 400, { ok: false, error: "invalid_opportunity_id" });
    }
    if (!firstName || !EMAIL_RE.test(email)) {
      return json(res, 400, { ok: false, error: "invalid_contact_identity" });
    }
    if (message.length < 12) {
      return json(res, 400, { ok: false, error: "message_too_short" });
    }

    const admin = supabaseAdmin();
    const { data: opportunity, error: opportunityError } = await admin
      .from("business_opportunities")
      .select("id,user_id,company_name,title,contact_email,contact_name")
      .eq("id", opportunityId)
      .maybeSingle();

    if (opportunityError) {
      return json(res, 500, {
        ok: false,
        error: "opportunity_lookup_failed",
        detail: String(opportunityError.message || opportunityError),
      });
    }

    if (!opportunity?.id || !opportunity?.user_id) {
      return json(res, 404, { ok: false, error: "opportunity_unavailable" });
    }

    const { data: created, error: insertError } = await admin
      .from("business_relations")
      .insert({
        owner_user_id: String(opportunity.user_id),
        opportunity_id: String(opportunity.id),
        opportunity_title: cleanText(opportunity.title, 240) || null,
        direction: "inbound",
        relation_source: "board_request",
        relation_status: "new",
        company_name: company || firstName,
        contact_name: firstName,
        contact_email: email,
        contact_phone: phone || null,
        message,
        notes: `Demande entrante depuis le coin business vers ${cleanText(opportunity.company_name, 200) || "une opportunite"}`,
      })
      .select("id,created_at")
      .single();

    if (insertError) {
      return json(res, 500, {
        ok: false,
        error: "relation_insert_failed",
        detail: String(insertError.message || insertError),
      });
    }

    return json(res, 200, {
      ok: true,
      id: created?.id || null,
      created_at: created?.created_at || null,
      delivered_to: {
        company_name: cleanText(opportunity.company_name, 200) || null,
        contact_name: cleanText(opportunity.contact_name, 200) || null,
        contact_email: cleanText(opportunity.contact_email, 254) || null,
      },
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
