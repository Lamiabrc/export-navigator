import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GoNoGoForm = {
  role?: string;
  country?: string;
  product?: string;
  hsCode?: string;
  objective?: string;
};

function buildResult(form: GoNoGoForm) {
  const risk = Math.min(90, Math.max(15, Math.round(Math.random() * 70)));
  const verdict = risk < 40 ? "GO" : risk < 65 ? "GO sous conditions" : "NO-GO";
  return {
    verdict,
    score_risque: risk,
    actions: [
      "Vérifier conformité douanière et documents pays cible.",
      "Sécuriser paiement (acompte + garantie).",
      "Confirmer logistique/incoterm avant engagement commercial.",
    ],
    action_prioritaire: "Valider la check-list conformité avant envoi du devis final.",
    checklist: ["HS validé", "Incoterm validé", "Mode paiement validé", "Documents export prêts"],
    email_draft: `Bonjour,\n\nSuite à l'analyse ${verdict}, voici les points à traiter...`,
    form,
    mode: "public",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const sbUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const sbAdmin = createClient(url, service);

    const { case_id, form = {}, org_id } = await req.json().catch(() => ({}));
    const result = buildResult(form);

    const { data: userData } = await sbUser.auth.getUser();
    const uid = userData.user?.id;

    if (uid) {
      const { data: access } = await sbAdmin.rpc("has_pro_access", { uid });
      const hasAccess = Boolean(access);

      if (hasAccess) {
        result.mode = "pro";

        if (case_id) {
          await sbAdmin.from("case_events").insert({ case_id, event_type: "analysis", payload: result });
        } else if (org_id) {
          const { data: one } = await sbAdmin
            .from("export_cases")
            .select("id")
            .eq("org_id", org_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (one?.id) {
            await sbAdmin.from("case_events").insert({ case_id: one.id, event_type: "analysis", payload: result });
          }
        }
      }
    }

    return Response.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
