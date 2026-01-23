import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_DUTY = [
  { country: "US", hs_prefix: "3004", rate: 4.5 },
  { country: "US", hs_prefix: "8708", rate: 3.2 },
  { country: "CN", hs_prefix: "8504", rate: 6.8 },
  { country: "GB", hs_prefix: "3304", rate: 2.1 },
];

const DEFAULT_VAT = [
  { country: "US", rate: 0 },
  { country: "DE", rate: 19 },
  { country: "ES", rate: 21 },
  { country: "GB", rate: 20 },
  { country: "CN", rate: 13 },
];

const DEFAULT_DOCS = [
  { country: "US", docs: ["Commercial invoice", "Packing list", "Certificate of origin", "Export declaration", "Transport document"] },
  { country: "DE", docs: ["Facture commerciale", "Packing list", "EORI", "CMR/AWB", "Declaration export"] },
  { country: "CN", docs: ["Commercial invoice", "Packing list", "BL/AWB", "Export declaration", "Certificate of origin"] },
];

function safeJson(req: VercelRequest) {
  if (!req.body) return null;
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

function normalizeHs(input?: string) {
  if (!input) return "";
  return String(input).replace(/[^0-9]/g, "").trim();
}

function iso2ForCountry(input?: string) {
  if (!input) return "";
  const cleaned = input.trim().toLowerCase();
  const map: Record<string, string> = {
    "united states": "US",
    usa: "US",
    "etats-unis": "US",
    germany: "DE",
    allemagne: "DE",
    spain: "ES",
    espagne: "ES",
    "united kingdom": "GB",
    uk: "GB",
    china: "CN",
    chine: "CN",
    canada: "CA",
    uae: "AE",
    "emirats": "AE",
    japan: "JP",
    japon: "JP",
    india: "IN",
    inde: "IN",
  };
  return map[cleaned] || cleaned.slice(0, 2).toUpperCase();
}

function pickRate<T extends { country: string; hs_prefix?: string; rate?: number; docs?: string[] }>(
  list: T[],
  country: string,
  hs: string,
) {
  const prefix4 = hs.slice(0, 4);
  const byHs = list.find((r) => r.country === country && r.hs_prefix === prefix4);
  if (byHs && typeof byHs.rate === "number") return byHs.rate;
  const byCountry = list.find((r) => r.country === country && typeof r.rate === "number");
  return byCountry?.rate ?? 2.5;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};
  const hsInput = normalizeHs(body.hsInput);
  const productText = String(body.productText || "").trim();
  const destination = String(body.destination || "").trim();
  const currency = String(body.currency || "EUR").trim();
  const incoterm = String(body.incoterm || "DAP").trim();
  const value = Number(body.value || 0);
  const transportMode = String(body.transportMode || "").trim();

  const countryCode = iso2ForCountry(destination);

  let dutyRates = DEFAULT_DUTY;
  let vatRates = DEFAULT_VAT;
  let docsRates = DEFAULT_DOCS;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const [dutyRes, vatRes, docsRes] = await Promise.all([
      sb.from("duty_rate_mock").select("country,hs_prefix,rate"),
      sb.from("vat_rate_mock").select("country,rate"),
      sb.from("docs_mock").select("country,docs"),
    ]);
    if (dutyRes.data) dutyRates = dutyRes.data as typeof DEFAULT_DUTY;
    if (vatRes.data) vatRates = vatRes.data as typeof DEFAULT_VAT;
    if (docsRes.data) docsRates = docsRes.data as typeof DEFAULT_DOCS;
  }

  const dutyRate = pickRate(dutyRates, countryCode, hsInput);
  const vatRate = pickRate(vatRates as any, countryCode, hsInput);
  const duty = value * (dutyRate / 100);
  const taxes = value * (vatRate / 100);
  const total = duty + taxes;

  const docs =
    docsRates.find((d) => d.country === countryCode)?.docs ||
    ["Commercial invoice", "Packing list", "Transport document", "Export declaration", "Certificate of origin"];

  const risks = [
    {
      title: "HS incomplet",
      level: hsInput.length < 4 ? "high" : "low",
      message: hsInput.length < 4 ? "HS incomplet: risques de droits incorrects." : "HS valide sur 4+ chiffres.",
    },
    {
      title: "Sanctions/embargo",
      level: ["RU", "IR", "KP", "SY"].includes(countryCode) ? "high" : "medium",
      message: "Verifier les listes de sanctions et restrictions pays.",
    },
    {
      title: "Coherence incoterm",
      level: incoterm === "DDP" && transportMode === "air" ? "medium" : "low",
      message: "Confirmer qui supporte droits/TVA selon incoterm.",
    },
  ];

  const result = {
    landedCost: { duty, taxes, total, currency, dutyRate, vatRate },
    docs: docs.slice(0, 5),
    risks,
    updatedAt: new Date().toISOString(),
    disclaimer: "Estimation indicative. A valider avec les sources officielles.",
  };

  let simulationId: string | null = null;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.from("simulations").insert({
      hs_input: hsInput || null,
      product_text: productText || null,
      destination,
      incoterm,
      value,
      currency,
      result_json: result,
    }).select("id").single();
    if (!error && data?.id) simulationId = data.id;
  }

  return res.status(200).json({ ...result, simulationId });
}
