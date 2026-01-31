import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "./_supabase";

type LeadPayload = {
  email: string;
  consent: boolean;
  simulationId?: string | null;
  metadata?: Record<string, unknown>;
};

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readJson<LeadPayload>(req);

    const email = String(body?.email || "").trim();
    const consent = Boolean(body?.consent);
    const simulationId = body?.simulationId ?? null;
    const metadata = (body?.metadata || {}) as Record<string, unknown>;

    if (!email) return json(res, 400, { ok: false, error: "email_required" });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("upsert_lead", {
      p_email: email,
      p_consent: consent,
      p_simulation_id: simulationId,
      p_metadata: metadata,
    });

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, { ok: true, leadId: data ?? null });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "lead_failed" });
  }
});
