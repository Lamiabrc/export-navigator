import { allowCors, json, readBodyJson, supabaseAdmin } from "../_supabase";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default async function handler(req: any, res: any) {
  if (allowCors(req, res)) return;

  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readBodyJson(req);

    const hsInput = body?.hsInput ? String(body.hsInput).trim() : null;
    const productText = body?.productText ? String(body.productText).trim() : null;
    const destinationIso2 = body?.destinationIso2 ? String(body.destinationIso2).trim().toUpperCase() : null;

    const value = Number(body?.value || 0);
    const currency = String(body?.currency || "EUR");
    const incoterm = String(body?.incoterm || "DAP");
    const mode = String(body?.mode || "sea");

    if (!destinationIso2) return json(res, 400, { ok: false, error: "destinationIso2 requis" });
    if (!hsInput && !productText) return json(res, 400, { ok: false, error: "hsInput ou productText requis" });

    // Estimation indicative (tu brancheras plus tard des sources officielles)
    const baseDutyRate = hsInput ? 0.04 : 0.06;
    const duty = clamp(value * baseDutyRate, 0, 1e12);
    const taxes = clamp((value + duty) * 0.2, 0, 1e12);
    const total = value + duty + taxes;

    const documents = [
      "Facture commerciale",
      "Packing list",
      "Document transport (AWB / B/L / CMR)",
      "Justificatif d'origine (selon accord/règles)",
      "Déclaration export (selon cas)",
    ];

    const risks = [
      {
        title: "Sanctions & restrictions",
        level: "high" as const,
        message: "Vérifier sanctions, biens à double usage, restrictions sectorielles selon destination.",
      },
      {
        title: "Documents & origine",
        level: "medium" as const,
        message: "L’éligibilité préférentielle dépend du produit + origine + preuve documentaire.",
      },
      {
        title: "Incoterm & responsabilités",
        level: "low" as const,
        message: `Incoterm ${incoterm} : sécuriser la répartition des coûts/risques (assurance, transport, formalités).`,
      },
    ];

    const complianceScore = clamp((hsInput ? 70 : 55) + (value > 0 ? 10 : 0), 0, 100);

    const brief = {
      estimate: { duty, taxes, total, currency },
      documents,
      risks,
      complianceScore,
      updatedAt: new Date().toISOString(),
      confidence: hsInput ? ("medium" as const) : ("low" as const),
      sources: ["MPL rules (indicatif)"],
    };

    // Sauvegarde simulation Supabase (renvoie simulationId)
    const { data: simId, error } = await supabaseAdmin.rpc("save_simulation", {
      p_email: null,
      p_payload: body ?? {},
      p_result: brief,
      p_score: complianceScore,
      p_destination_iso2: destinationIso2,
      p_hs_input: hsInput,
    });

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, { ok: true, data: { ...brief, simulationId: simId ?? null } });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "brief failed" });
  }
}
