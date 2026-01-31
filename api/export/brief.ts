import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "../_supabase";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const destinationIso2 = String(body?.destinationIso2 || "").toUpperCase();
    const currency = String(body?.currency || "EUR").toUpperCase();
    const incoterm = String(body?.incoterm || "DAP").toUpperCase();
    const mode = String(body?.mode || "sea").toLowerCase();

    const value = Number(body?.value || 0);
    const hsInput = body?.hsInput ? String(body.hsInput) : null;
    const productText = body?.productText ? String(body.productText) : null;

    if (!destinationIso2) return json(res, 400, { ok: false, error: "destinationIso2 requis" });

    // ⚠️ Calcul indicatif (MVP) : duty/taxes = 0, score "basique"
    const duty = 0;
    const taxes = 0;
    const total = clamp(value + duty + taxes, 0, 1e12);

    const documents = [
      "Facture commerciale",
      "Packing list",
      "Document de transport",
      "Déclaration export (selon cas)",
    ];

    const risks = [
      { title: "Classification", level: "medium", message: "Vérifier le code HS exact (évite erreur de taux/document)." },
      { title: "Sanctions", level: "medium", message: "Contrôler les restrictions pays/parties prenantes." },
    ];

    const complianceScore = 55; // MVP
    const confidence = "low";
    const sources = ["Règles internes (MVP)"];
    const updatedAt = new Date().toISOString();

    const { data: sim, error } = await supabaseAdmin
      .from("export_simulations")
      .insert({
        hs_input: hsInput,
        product_text: productText,
        destination_iso2: destinationIso2,
        value_amount: value,
        currency,
        incoterm,
        transport_mode: mode,
        weight_kg: body?.weightKg ?? null,
        insurance_amount: body?.insurance ?? null,
        duty,
        taxes,
        total,
        documents,
        risks,
        compliance_score: complianceScore,
        confidence,
        sources,
      })
      .select("id")
      .single();

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, {
      ok: true,
      estimate: { duty, taxes, total, currency },
      documents,
      risks,
      complianceScore,
      updatedAt,
      confidence,
      sources,
      simulationId: sim?.id ?? null,
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "Erreur serveur" });
  }
}
