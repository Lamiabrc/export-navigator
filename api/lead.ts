import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "./_supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const email = String(body?.email || "").trim().toLowerCase();
    const consent = Boolean(body?.consent);
    const simulationId = body?.simulationId ? String(body.simulationId) : null;
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!email || !EMAIL_RE.test(email)) return json(res, 400, { ok: false, error: "Email invalide" });
    if (!consent) return json(res, 400, { ok: false, error: "Consentement requis" });

    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert({
        email,
        consent: true,
        simulation_id: simulationId,
        metadata,
        source_page: String(body?.source_page || ""),
        user_agent: req.headers["user-agent"] || "",
      })
      .select("id")
      .single();

    if (error) return json(res, 500, { ok: false, error: error.message });

    // Option : abonner à la newsletter (service role -> OK même si RLS interdit update)
    await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert({ email, status: "active", tags: ["lead-magnet"] }, { onConflict: "email" });

    return json(res, 200, { ok: true, leadId: data?.id ?? null });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "Erreur serveur" });
  }
}
