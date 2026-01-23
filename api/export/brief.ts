import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const HIGH_RISK = new Set(["RU", "IR", "KP", "SY", "BY"]);

function safeJson(req: VercelRequest) {
  if (!req.body) return null;
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

function normalizeHs(input?: string) {
  if (!input) return "";
  return String(input).replace(/[^0-9]/g, "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

async function fetchWitsDuty(destIso2: string, hsInput: string) {
  const hs = normalizeHs(hsInput);
  if (hs.length < 4) return null;
  const hs6 = hs.slice(0, 6);
  const url = `https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/${destIso2}/partner/ALL/product/${hs6}/year/2022/datatype/reported?format=JSON`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return null;
  const json = await res.json();
  const series = json?.dataSets?.[0]?.series;
  if (!series) return null;
  const firstKey = Object.keys(series)[0];
  const obs = series[firstKey]?.observations;
  const obsKey = obs && Object.keys(obs)[0];
  const value = obs && obs[obsKey]?.[0];
  const rate = Number(value);
  if (!Number.isFinite(rate)) return null;
  return rate;
}

function buildDocsFallback() {
  return [
    "Commercial invoice",
    "Packing list",
    "Transport document",
    "Export declaration",
    "Certificate of origin",
  ];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};
  const hsInput = normalizeHs(body.hsInput);
  const productText = String(body.productText || "").trim();
  const destinationIso2 = String(body.destinationIso2 || "").trim().toUpperCase();
  const value = Number(body.value || 0);
  const currency = String(body.currency || "EUR").trim();
  const incoterm = String(body.incoterm || "DAP").trim().toUpperCase();
  const mode = String(body.mode || "").trim();

  if (!destinationIso2) return res.status(400).json({ error: "destinationIso2 required" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  let dutyRate: number | null = null;
  let vatRate: number | null = null;
  let docs: string[] = buildDocsFallback();
  const sources: string[] = [];

  if (sb) {
    const [dutyRes, vatRes, docsRes] = await Promise.all([
      sb.from("duty_rate_mock").select("country,hs_prefix,rate"),
      sb.from("vat_rate_mock").select("country,rate"),
      sb.from("docs_mock").select("country,docs"),
    ]);

    const dutyRows = (dutyRes.data || []) as Array<{ country: string; hs_prefix: string; rate: number }>;
    const vatRows = (vatRes.data || []) as Array<{ country: string; rate: number }>;
    const docsRows = (docsRes.data || []) as Array<{ country: string; docs: string[] }>;

    const prefix = hsInput.slice(0, 4);
    const dutyRow = dutyRows.find((r) => r.country === destinationIso2 && r.hs_prefix === prefix);
    dutyRate = dutyRow?.rate ?? null;
    vatRate = vatRows.find((r) => r.country === destinationIso2)?.rate ?? null;
    const docRow = docsRows.find((r) => r.country === destinationIso2);
    if (docRow?.docs?.length) docs = docRow.docs;
  }

  const witsRate = await fetchWitsDuty(destinationIso2, hsInput).catch(() => null);
  if (witsRate !== null) {
    dutyRate = witsRate;
    sources.push("WITS / UNCTAD TRAINS");
  } else if (dutyRate !== null) {
    sources.push("Mock duty rates");
  }

  if (vatRate !== null) sources.push("Mock VAT rates");
  if (docs.length) sources.push("Rules engine docs");

  const duty = dutyRate !== null ? value * (dutyRate / 100) : 0;
  const taxes = vatRate !== null ? value * (vatRate / 100) : 0;
  const total = duty + taxes;

  const risks = [
    {
      title: "HS incomplet",
      level: hsInput.length < 4 ? "high" : "low",
      message: hsInput.length < 4 ? "HS incomplet: risque de droits incorrects." : "HS suffisant pour estimation.",
    },
    {
      title: "Sanctions pays",
      level: HIGH_RISK.has(destinationIso2) ? "high" : "medium",
      message: HIGH_RISK.has(destinationIso2)
        ? "Pays sous sanctions: verifier restrictions et licences."
        : "Verifier les listes de sanctions UE/ONU/OFAC.",
    },
    {
      title: "Coherence incoterm",
      level: incoterm === "DDP" && mode === "air" ? "medium" : "low",
      message: "Confirmer qui supporte droits/TVA selon incoterm.",
    },
  ];

  const complianceScore = Math.max(40, 100 - (hsInput.length < 4 ? 25 : 0) - (HIGH_RISK.has(destinationIso2) ? 20 : 5));
  const confidence = witsRate !== null ? "high" : dutyRate !== null ? "medium" : "low";

  const result = {
    estimate: { duty, taxes, total, currency },
    documents: docs.slice(0, 5),
    risks,
    complianceScore,
    updatedAt: nowIso(),
    confidence,
    sources,
  };

  let simulationId: string | null = null;
  if (sb) {
    const { data } = await sb
      .from("simulations")
      .insert({
        email: null,
        hs_input: hsInput || null,
        destination: destinationIso2,
        payload: { hsInput, productText, destinationIso2, value, currency, incoterm, mode },
        result,
      })
      .select("id")
      .single();
    simulationId = data?.id || null;
  }

  return res.status(200).json({ ...result, simulationId });
}
