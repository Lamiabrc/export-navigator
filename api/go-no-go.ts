import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type GoNoGoPayload = {
  country?: string;
  product_desc?: string;
  hs_code?: string | null;
  incoterm?: string | null;
  payment_method?: string | null;
  value_amount?: number | string | null;
  currency?: string | null;
  route?: string | null;
  client?: string | null;
};

type SubscriptionPlan = "FREE" | "PRO_ONLINE" | "PROSPECTION" | "PRO_VISIO" | "PILOTAGE_HEBDO";

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO_ONLINE: 1,
  PROSPECTION: 1,
  PRO_VISIO: 2,
  PILOTAGE_HEBDO: 3,
};

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function requireUser(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { ok: false, error: "missing_auth_bearer" });
    return null;
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    json(res, 401, { ok: false, error: "invalid_auth", detail: error?.message || null });
    return null;
  }
  return { user: data.user, token };
}

const normalizePlanToken = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s+/-]+/g, "_")
    .replace(/_+/g, "_");

const mapBillingPlan = (planValue: unknown): SubscriptionPlan | null => {
  if (!planValue || typeof planValue !== "string") return null;
  const token = normalizePlanToken(planValue);
  if (token === "ONLINE" || token === "PRO_ONLINE") return "PRO_ONLINE";
  if (token === "VISIO" || token === "PRO_VISIO") return "PRO_VISIO";
  if (token === "PROSPECTION" || token === "PROSPECTING") return "PROSPECTION";
  if (token === "PILOTAGE" || token === "PILOTAGE_HEBDO") return "PILOTAGE_HEBDO";
  if (token === "FREE") return "FREE";
  return null;
};

async function resolvePlan(userId: string) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("billing_subscriptions")
    .select("plan,status,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const statusOk = data?.status === "active" || data?.status === "trialing";
  if (!statusOk) return { plan: "FREE" as SubscriptionPlan, isPro: false };

  const mapped = mapBillingPlan(data?.plan) ?? "FREE";
  return { plan: mapped, isPro: PLAN_RANK[mapped] >= PLAN_RANK.PRO_ONLINE };
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

const HIGH_RISK = new Set(["RU", "IR", "KP", "SY", "CU", "SD", "SS", "BY", "AF", "MM"]);
const MED_RISK = new Set(["CN", "TR", "AE", "SA", "IQ", "NG", "PK", "VE", "UA", "DZ"]);

function normalizeCountry(input: string) {
  const raw = input.trim().toUpperCase();
  if (raw.length === 2) return raw;
  const map: Record<string, string> = {
    FRANCE: "FR",
    GERMANY: "DE",
    ALLEMAGNE: "DE",
    ESPAGNE: "ES",
    SPAIN: "ES",
    ITALIE: "IT",
    ITALY: "IT",
    USA: "US",
    "ETATS-UNIS": "US",
    "ETATS UNIS": "US",
    UNITEDSTATES: "US",
    CANADA: "CA",
    CHINE: "CN",
    CHINA: "CN",
    TURQUIE: "TR",
  };
  const key = raw.replace(/[^A-Z]/g, "");
  return map[key] || raw.slice(0, 2);
}

function computeCompliance(country: string, hsCode?: string | null) {
  const iso = normalizeCountry(country);
  let score = HIGH_RISK.has(iso) ? 85 : MED_RISK.has(iso) ? 55 : 25;
  if (!hsCode) score += 10;
  return clamp(score);
}

function computePayment(method?: string | null) {
  if (!method) return 50;
  const m = method.toLowerCase();
  if (m.includes("open") || m.includes("compte ouvert")) return 80;
  if (m.includes("letter") || m.includes("credit") || m.includes("lc") || m.includes("credoc")) return 35;
  if (m.includes("dp") || m.includes("da") || m.includes("remise documentaire")) return 55;
  if (m.includes("advance") || m.includes("prepay") || m.includes("acompte")) return 25;
  if (m.includes("virement")) return 50;
  return 45;
}

function computeLogistics(incoterm?: string | null) {
  const term = (incoterm || "").toUpperCase();
  if (!term) return 45;
  if (term === "DDP") return 70;
  if (["DAP", "DPU", "CIF", "CIP"].includes(term)) return 55;
  if (["FOB", "FCA", "CPT", "CIP"].includes(term)) return 45;
  if (["EXW"].includes(term)) return 35;
  return 45;
}

function computeDocuments(incoterm?: string | null, hsCode?: string | null, valueAmount?: number | null) {
  let score = 30;
  if (!hsCode) score += 20;
  if (!incoterm) score += 20;
  if (valueAmount && valueAmount > 100000) score += 10;
  return clamp(score);
}

function pickRecommendations(scores: Record<string, number>) {
  const recs: string[] = [];
  if (scores.compliance >= 60) {
    recs.push("Verifier sanctions, embargos et besoin de licence avant engagement.");
  }
  if (scores.payment >= 60) {
    recs.push("Securiser le paiement (acompte + credit documentaire ou assurance credit).");
  }
  if (scores.logistics >= 60) {
    recs.push("Verrouiller incoterm, assurance et responsabilites logistiques.");
  }
  if (scores.documents >= 60) {
    recs.push("Valider la check-list documentaire (facture, packing, origine, conformite).");
  }

  const fallback = [
    "Confirmer les parties prenantes et references client avant production.",
    "Preparer un planning export: production, douane, transport, livraison.",
    "Valider les couts cachés (douanes, taxes, compliance, banque).",
  ];

  while (recs.length < 3) {
    const next = fallback.shift();
    if (!next) break;
    if (!recs.includes(next)) recs.push(next);
  }
  return recs.slice(0, 3);
}

function buildChecklist() {
  return [
    "Facture commerciale",
    "Packing list / liste de colisage",
    "Contrat ou bon de commande",
    "Incoterm confirme + responsabilites",
    "Certificat d'origine (si requis)",
    "Licence export / screening sanctions",
    "Assurance transport",
    "Instructions de paiement (LC, DP/DA, acompte)",
  ];
}

function buildMessages(payload: GoNoGoPayload, decisionLabel: string) {
  const country = payload.country || "ce pays";
  const product = payload.product_desc || payload.hs_code || "le produit";
  const client = (payload.client || "").trim();
  const clientLabel = client ? ` ${client}` : "";

  const clientMsg =
    `Bonjour${clientLabel},\n\n` +
    `Suite a votre demande d'export vers ${country}, voici les points a confirmer rapidement pour avancer: ` +
    `conformite du produit (${product}), modalites de paiement et incoterm. ` +
    `Nous pouvons vous proposer un plan d'action sous 24h.\n\n` +
    `Merci`;

  const internalMsg =
    `Bonjour,\n\n` +
    `Decision Go/No-Go (${decisionLabel}) pour export vers ${country}. ` +
    `Verifier sanctions, paiement et docs avant confirmation client. ` +
    `Priorite: caler l'incoterm et le mode de paiement.\n\n` +
    `Merci`;

  return { client: clientMsg, internal: internalMsg };
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req, res);
    if (!auth) return;

    const body = await readJson<GoNoGoPayload>(req);
    const country = String(body?.country || "").trim();
    const productDesc = String(body?.product_desc || "").trim();
    const hsCode = String(body?.hs_code || "").trim() || null;

    if (!country) return json(res, 400, { ok: false, error: "country_required" });
    if (!productDesc && !hsCode) return json(res, 400, { ok: false, error: "product_required" });

    const { plan, isPro } = await resolvePlan(auth.user.id);

    const admin = supabaseAdmin();
    if (!isPro) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const { count } = await admin
        .from("go_no_go_assessments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .gte("created_at", start.toISOString());

      const used = typeof count === "number" ? count : 0;
      const limit = 2;
      if (used >= limit) {
        return json(res, 402, {
          ok: false,
          error: "quota_exceeded",
          limit,
          period: "month",
          plan,
        });
      }
    }

    const valueAmountRaw = body?.value_amount;
    const valueAmount = valueAmountRaw === null || valueAmountRaw === undefined ? null : Number(valueAmountRaw);
    const paymentMethod = body?.payment_method ? String(body.payment_method) : null;
    const incoterm = body?.incoterm ? String(body.incoterm) : null;

    const compliance = computeCompliance(country, hsCode);
    const payment = computePayment(paymentMethod);
    const logistics = computeLogistics(incoterm);
    const documents = computeDocuments(incoterm, hsCode, valueAmount);

    const riskScore = clamp(
      Math.round(compliance * 0.35 + payment * 0.25 + logistics * 0.2 + documents * 0.2)
    );

    const decisionLabel = riskScore >= 70 ? "NO-GO" : riskScore >= 45 ? "GO avec reserves" : "GO";

    const breakdown = {
      compliance,
      payment,
      logistics,
      documents,
    };

    const recommendations = pickRecommendations(breakdown);
    const checklist = buildChecklist();
    const messages = buildMessages(body, decisionLabel);

    const assessmentPayload = {
      user_id: auth.user.id,
      country,
      product_desc: productDesc || hsCode || "",
      hs_code: hsCode,
      incoterm,
      payment_method: paymentMethod,
      value_amount: Number.isFinite(valueAmount) ? valueAmount : null,
      currency: body?.currency ? String(body.currency) : null,
      risk_score: riskScore,
      risk_breakdown: breakdown,
      recommendations,
      checklist,
      messages,
    };

    const { data: assessment, error: insertError } = await admin
      .from("go_no_go_assessments")
      .insert(assessmentPayload)
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("[api/go-no-go] insert error", insertError);
      return json(res, 500, { ok: false, error: "db_insert_failed", detail: insertError.message });
    }

    try {
      await admin.from("tool_runs").insert({
        user_id: auth.user.id,
        tool_name: "go_no_go",
        input_json: body,
        output_json: {
          decision: decisionLabel,
          risk_score: riskScore,
          risk_breakdown: breakdown,
          recommendations,
          checklist,
          messages,
        },
      });
    } catch (e) {
      console.error("[api/go-no-go] tool_runs insert failed", e);
    }

    return json(res, 200, {
      ok: true,
      assessment_id: assessment?.id ?? null,
      decision: decisionLabel,
      risk_score: riskScore,
      risk_breakdown: breakdown,
      recommendations,
      checklist,
      messages,
      can_export: isPro,
      plan,
    });
  } catch (err: any) {
    console.error("[api/go-no-go] error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "go_no_go_failed" });
  }
});
