import { allowCors, json, readBodyJson, supabaseAdmin } from "./_supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: any, res: any) {
  if (allowCors(req, res)) return;

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readBodyJson(req);

    const email = String(body?.email || "").trim().toLowerCase();
    const consent = Boolean(body?.consent);
    const simulationId = body?.simulationId ? String(body.simulationId) : null;
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!email || !EMAIL_RE.test(email)) {
      return json(res, 400, { ok: false, error: "Email invalide" });
    }
    if (!consent) {
      return json(res, 400, { ok: false, error: "Consentement requis" });
    }

    const { data, error } = await supabaseAdmin.rpc("record_lead", {
      p_email: email,
      p_consent: consent,
      p_simulation_id: simulationId,
      p_metadata: metadata,
    });

    if (error) {
      return json(res, 500, { ok: false, error: error.message });
    }

    return json(res, 200, { ok: true, leadId: data ?? null });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "lead failed" });
  }
}
