import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "./_supabase.js";

type LeadPayload = {
  email?: string;
  consent?: boolean;
  simulationId?: string | null;
  metadata?: Record<string, unknown>;
};

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson<LeadPayload>(req);
    const email = String(body?.email || "").trim();
    if (!email) {
      return json(res, 400, { ok: false, error: "email_required" });
    }

    const payload = {
      p_email: email,
      p_consent: Boolean(body?.consent),
      p_simulation_id: body?.simulationId ?? null,
      p_metadata: body?.metadata ?? {},
    };

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("mpl_insert_lead", payload);
    if (error) {
      console.error("[api/lead] rpc error", error);
      return json(res, 500, { ok: false, error: error.message || "lead_rpc_failed" });
    }

    return json(res, 200, { ok: true, leadId: data ?? null });
  } catch (err: any) {
    console.error("[api/lead] error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "lead_failed" });
  }
});
