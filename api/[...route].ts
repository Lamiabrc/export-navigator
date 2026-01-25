import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";
import { normalizeSheet, type RawOperationRow } from "../src/lib/parsers/operationsSheet";

const FALLBACK_ALERTS = [
  {
    id: "al-1",
    title: "Mise a jour sanctions (UE)",
    message: "Verifier les restrictions sur certains pays sensibles.",
    severity: "high",
    country: "RU",
    hsPrefix: null,
    detectedAt: new Date().toISOString(),
    source: "EU",
  },
  {
    id: "al-2",
    title: "Evolution taxes import US",
    message: "Certaines lignes HS 3004 impactees par un relevement de droits.",
    severity: "medium",
    country: "US",
    hsPrefix: "3004",
    detectedAt: new Date().toISOString(),
    source: "WITS",
  },
];

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

const HIGH_RISK = new Set(["RU", "IR", "KP", "SY", "BY"]);
const EU_MEMBERS = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);
const SEA_ONLY_INCOTERMS = new Set(["FAS", "FOB", "CFR", "CIF"]);

const OFAC_CSV_URL = "https://sanctionslist.ofac.treas.gov/api/PublicationPreview/exports/SDN.csv";
const UN_LEGACY_HTML = "https://unsolprodfiles.blob.core.windows.net/publiclegacyxmlfiles/EN/consolidatedLegacyByNAME.html";
const EU_PDF_URL = "https://www.sanctionsmap.eu/api/v1/pdf/regime?id[]=26&lang=en";

const GRAPH_TOKEN = process.env.GRAPH_TOKEN;
const GRAPH_SITE_PATH = process.env.GRAPH_SITE_PATH;
const GRAPH_FILE_PATH = process.env.GRAPH_FILE_PATH;
const GRAPH_SHEET_NAME = process.env.GRAPH_SHEET_NAME || "Feuil1";

const ALLOWED_ORIGINS = new Set<string>([
  "https://export-navigator-orli.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

type GraphRangeResponse = {
  values?: (string | number | boolean | null)[][];
};

function safeJson(req: VercelRequest) {
  if (!req.body) return null;
  try {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return null;
  }
}

function escapeHtml(input: string) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    emirats: "AE",
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

function normalizeIso2(input?: string) {
  return String(input || "").trim().toUpperCase();
}

function normalizeMode(input?: string) {
  const raw = String(input || "").trim().toLowerCase();
  const map: Record<string, string> = {
    air: "air",
    aérien: "air",
    avion: "air",
    sea: "sea",
    maritime: "sea",
    mer: "sea",
    road: "road",
    route: "road",
    camion: "road",
    rail: "rail",
    train: "rail",
    courier: "courier",
    express: "courier",
    colis: "courier",
    multimodal: "multimodal",
  };
  return map[raw] || (raw ? raw : "multimodal");
}

function buildDocsBase(isIntraEU: boolean) {
  if (isIntraEU) {
    return [
      "Facture (mentions TVA / intracom)",
      "Preuve d’expédition / livraison",
      "Vérification TVA intracom (client, n° TVA, mentions)",
      "Obligations statistiques (selon cas)",
    ];
  }
  return ["Commercial invoice", "Packing list", "Export declaration", "Certificate of origin"];
}

function transportDocForMode(mode: string) {
  switch (mode) {
    case "sea":
      return "Bill of Lading (BL)";
    case "air":
      return "Air Waybill (AWB)";
    case "road":
      return "CMR (lettre de voiture)";
    case "rail":
      return "CIM/SMGS (document ferroviaire)";
    case "courier":
      return "Express waybill + CN22/CN23 (selon cas)";
    default:
      return "Transport document (multimodal)";
  }
}

function nowIso() {
  return new Date().toISOString();
}

function incotermSummary(incoterm: string) {
  const seller: string[] = [];
  const buyer: string[] = [];
  let insuranceHint: string | undefined;

  switch (incoterm) {
    case "EXW":
      seller.push("Met à disposition (site vendeur)");
      buyer.push("Enlèvement", "Export (souvent)", "Transport principal", "Import (droits/taxes)");
      break;
    case "FCA":
      seller.push("Remet au transporteur", "Export (souvent)");
      buyer.push("Transport principal", "Import (droits/taxes)");
      break;
    case "CPT":
      seller.push("Paie transport jusqu’au lieu convenu", "Export (souvent)");
      buyer.push("Risque transféré tôt", "Import (droits/taxes)");
      break;
    case "CIP":
      seller.push("Paie transport + assurance", "Export (souvent)");
      buyer.push("Import (droits/taxes)");
      insuranceHint = "CIP : assurance généralement forte (à valider contractuellement).";
      break;
    case "DAP":
      seller.push("Livre au lieu convenu", "Paie transport principal");
      buyer.push("Import (droits/taxes)", "Dédouanement import");
      break;
    case "DPU":
      seller.push("Livre ET décharge au lieu convenu", "Paie transport principal");
      buyer.push("Import (droits/taxes)", "Dédouanement import");
      break;
    case "DDP":
      seller.push("Livre + gère import (droits/taxes)", "Risque conformité élevé");
      buyer.push("Réception");
      break;
    case "FAS":
      seller.push("Met la marchandise le long du navire (port)");
      buyer.push("Chargement à bord", "Transport", "Import (droits/taxes)");
      break;
    case "FOB":
      seller.push("Charge à bord (port)", "Export (souvent)");
      buyer.push("Transport", "Import (droits/taxes)");
      break;
    case "CFR":
      seller.push("Paie fret maritime (sans assurance)");
      buyer.push("Assurance (si souhaitée)", "Import (droits/taxes)");
      break;
    case "CIF":
      seller.push("Paie fret maritime + assurance minimale");
      buyer.push("Import (droits/taxes)");
      insuranceHint = "CIF : assurance souvent minimale (à ajuster si besoin).";
      break;
  }

  return { seller, buyer, insuranceHint, seaOnly: SEA_ONLY_INCOTERMS.has(incoterm) };
}

function buildCountryNotesFallback(destinationIso2: string, hsInput: string, incoterm: string, mode: string) {
  const notes: Array<{ title: string; items: string[] }> = [];
  const isIntraEU = EU_MEMBERS.has(destinationIso2);

  if (isIntraEU) {
    notes.push({
      title: "Spécificité UE (intra-UE)",
      items: [
        "Destination dans l’UE : pas de droits de douane (ce n’est pas une exportation douanière).",
        "Vérifier TVA intracom, mentions facture et preuves de livraison.",
      ],
    });
  } else {
    notes.push({
      title: "Traités / préférences",
      items: [
        "Des accords peuvent exister selon le pays : la préférence tarifaire dépend du produit et des règles d’origine.",
        "Pour confirmer : validation express recommandée (HS + origine + docs).",
      ],
    });
  }

  const v: string[] = [];
  v.push(
    HIGH_RISK.has(destinationIso2)
      ? "Pays à vigilance élevée (sanctions / restrictions possibles) : vérifier licences, listes et interdictions."
      : "Vérifier listes de sanctions (UE/ONU/OFAC) selon produit, client et destination finale."
  );

  v.push(
    hsInput.length < 4
      ? "HS incomplet : risque de droits incorrects → compléter idéalement à 6 chiffres."
      : "HS suffisant pour estimation (6 chiffres recommandé)."
  );

  if (SEA_ONLY_INCOTERMS.has(incoterm) && mode !== "sea") {
    v.push(`${incoterm} est maritime uniquement : incohérence incoterm/transport.`);
  }

  notes.push({ title: "Vigilance", items: v });
  return notes;
}

function checksum(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://export-navigator-orli.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-client-info, apikey"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function headersToObjects(rows: (string | number | boolean | null)[][]): RawOperationRow[] {
  if (!rows || rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => asString(h));

  return dataRows
    .filter((r) => r && r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
    .map((row) => {
      const obj: Record<string, string | number | null> = {};
      headers.forEach((key, idx) => {
        if (!key) return;
        const cell = row[idx];
        obj[key] = (cell === undefined ? null : (cell as any)) ?? null;
      });
      return obj as RawOperationRow;
    });
}

function requireGraphConfig() {
  if (!GRAPH_TOKEN) {
    throw new Error("Missing GRAPH_TOKEN (Microsoft Graph bearer token).");
  }
  if (!GRAPH_SITE_PATH) {
    throw new Error("Missing GRAPH_SITE_PATH (e.g. mplfr.sharepoint.com:/sites/ADV274:).");
  }
  if (!GRAPH_FILE_PATH) {
    throw new Error("Missing GRAPH_FILE_PATH (e.g. /Documents/Exports/file.xlsx).");
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function handleExportBrief(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};

  const hsInput = normalizeHs(body.hsInput);
  const productText = String(body.productText || "").trim();
  const destinationIso2 = normalizeIso2(body.destinationIso2);
  const value = Number(body.value || 0);
  const currency = String(body.currency || "EUR").trim().toUpperCase();
  const incoterm = String(body.incoterm || "DAP").trim().toUpperCase();
  const mode = normalizeMode(body.mode);

  if (!destinationIso2 || destinationIso2.length !== 2) {
    return res.status(400).json({ error: "destinationIso2 required (ISO2)" });
  }

  const isIntraEU = EU_MEMBERS.has(destinationIso2);
  const sb = getSupabase();

  const sources: string[] = [];
  let dutyRate: number | null = null;

  const vatRate: number | null = isIntraEU ? 0 : null;
  const docsBase = buildDocsBase(isIntraEU);
  const docs = Array.from(new Set([...docsBase, transportDocForMode(mode)]));

  if (isIntraEU) {
    dutyRate = 0;
    sources.push("Règle intra-UE (pas de droits de douane)");
  } else {
    const witsRate = await fetchWitsDuty(destinationIso2, hsInput).catch(() => null);
    if (witsRate !== null) {
      dutyRate = witsRate;
      sources.push("WITS / UNCTAD TRAINS (estimation)");
    }
  }

  const duty = dutyRate !== null ? value * (dutyRate / 100) : 0;
  const taxes = vatRate !== null ? value * (vatRate / 100) : 0;
  const total = duty + taxes;

  const incoherentSeaOnly = SEA_ONLY_INCOTERMS.has(incoterm) && mode !== "sea";

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
        ? "Pays sous sanctions: vérifier restrictions, interdictions et licences."
        : "Vérifier les listes de sanctions UE/ONU/OFAC.",
    },
    {
      title: "Incoterm / transport",
      level: incoherentSeaOnly ? "high" : incoterm === "DDP" ? "high" : "low",
      message: incoherentSeaOnly
        ? `${incoterm} est maritime uniquement : choisir Maritime ou un incoterm tous modes (EXW/FCA/CPT/CIP/DAP/DPU/DDP).`
        : incoterm === "DDP"
          ? "DDP : vendeur gère import (droits/taxes) → attention conformité et capacité d’importer localement."
          : "Cohérence incoterm/transport OK.",
    },
    ...(vatRate === null && !isIntraEU
      ? [{
          title: "Taxes import non estimées",
          level: "medium" as const,
          message: "Taxes à l’import dépendantes du régime local + importateur + incoterm. À valider.",
        }]
      : []),
  ] as Array<{ title: string; level: "low" | "medium" | "high"; message: string }>;

  const complianceScore =
    Math.max(
      40,
      100
        - (hsInput.length < 4 ? 25 : 0)
        - (HIGH_RISK.has(destinationIso2) ? 20 : 5)
        - (incoherentSeaOnly ? 20 : 0)
        - (incoterm === "DDP" ? 10 : 0)
    );

  const confidence =
    isIntraEU
      ? "high"
      : dutyRate !== null
        ? "high"
        : hsInput.length >= 4
          ? "medium"
          : "low";

  const incSummary = incotermSummary(incoterm);

  let countryNotes = buildCountryNotesFallback(destinationIso2, hsInput, incoterm, mode);
  if (sb) {
    try {
      const { data, error } = await sb.from("country_notes").select("notes").eq("iso2", destinationIso2).maybeSingle();
      if (!error && data?.notes) {
        countryNotes = data.notes as any;
        sources.push("Country notes (Supabase)");
      }
    } catch {
      // ignore
    }
  }

  const result = {
    estimate: { duty, taxes, total, currency },
    documents: docs.slice(0, 6),
    risks,
    complianceScore,
    updatedAt: nowIso(),
    confidence,
    sources,
    countryNotes,
    incotermSummary: incSummary,
  };

  let simulationId: string | null = null;
  if (sb) {
    try {
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
    } catch {
      // ignore
    }
  }

  return res.status(200).json({ ...result, simulationId });
}

async function handleHsSearch(req: VercelRequest, res: VercelResponse, url: URL) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const q = (url.searchParams.get("q") || "").trim();
  if (!q || q.length < 2) return res.status(200).json({ items: [] });

  const sb = getSupabase();
  if (!sb) return res.status(500).json({ error: "Supabase env missing" });

  const isNumericQuery = /[0-9]/.test(q);
  const limit = 12;

  try {
    if (isNumericQuery) {
      const prefix = q.replace(/[^0-9]/g, "");
      if (prefix.length < 2) return res.status(200).json({ items: [] });

      const { data, error } = await sb
        .from("hs_codes")
        .select("code,description_fr,description_en,updated_at")
        .ilike("code", `${prefix}%`)
        .order("code", { ascending: true })
        .limit(limit);

      if (error) return res.status(500).json({ error: error.message });

      const items = (data || []).map((row: any) => ({
        code: String(row.code || ""),
        label: `${row.code} - ${row.description_fr || row.description_en || ""}`.trim().replace(/\s+-\s+$/, ""),
      }));

      return res.status(200).json({ items });
    }

    const { data, error } = await sb
      .from("hs_codes")
      .select("code,description_fr,description_en,updated_at")
      .textSearch("keywords", q, { config: "french" })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    const items = (data || []).map((row: any) => ({
      code: String(row.code || ""),
      label: `${row.code} - ${row.description_fr || row.description_en || ""}`.trim().replace(/\s+-\s+$/, ""),
    }));

    return res.status(200).json({ items });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Search failed" });
  }
}

async function handleLead(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};
  const email = String(body.email || "").trim().toLowerCase();
  const consent = Boolean(body.consent);
  const source = String(body.source || "lead_magnet");
  const simulationId = body.simulationId ? String(body.simulationId) : null;
  const metadata = body.metadata || {};

  if (!email) return res.status(400).json({ error: "email required" });

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true, leadId: null });

  const { data, error } = await sb
    .from("leads")
    .insert({ email, source, consent_bool: consent, metadata_json: metadata })
    .select("id")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (simulationId) {
    await sb.from("simulations").update({ email }).eq("id", simulationId);
  }

  return res.status(200).json({ ok: true, leadId: data?.id || null });
}

async function handleLeads(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};
  const email = String(body.email || "").trim().toLowerCase();
  const consent = Boolean(body.consent_newsletter ?? body.consent);
  const offerType = String(body.offer_type || "lead_magnet");
  const message = String(body.message || "");
  const context = body.context || body.metadata || {};

  if (!email) return res.status(400).json({ error: "email required" });

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true });

  const { error } = await sb.from("leads").insert({
    email,
    consent_newsletter: consent,
    offer_type: offerType,
    message,
    context_json: context,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function handleContact(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};

  const email = String(body.email || "").trim().toLowerCase();
  const consent = Boolean(body.consent ?? body.consent_newsletter ?? false);
  const simulationId = body.simulationId ? String(body.simulationId) : null;
  const metadata = body.metadata ?? null;

  const offerType = String(body.offer_type || body.offerType || "lead").trim();
  const message = String(body.message || "").trim();
  const context = body.context || body.context_json || {};

  if (!email) return res.status(400).json({ error: "email required" });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid email" });

  const sb = getSupabase();
  let dbWarning: string | null = null;
  if (sb) {
    try {
      const { error } = await sb.from("leads").insert({
        email,
        consent,
        consent_newsletter: consent,
        simulation_id: simulationId,
        metadata,
        offer_type: offerType,
        message,
        context_json: context,
        source: body.source || "lead_magnet",
      });

      if (error) throw error;
    } catch (e: any) {
      try {
        const { error } = await sb.from("leads").insert({
          email,
          consent_newsletter: consent,
          offer_type: offerType,
          message,
          context_json: { ...context, simulationId, metadata },
        });
        if (error) throw error;
        dbWarning = "Leads table schema is partial (fallback insert used).";
      } catch (e2: any) {
        return res.status(500).json({
          error: "db insert failed",
          details: e2?.message || "Unable to insert lead",
        });
      }
    }
  } else {
    dbWarning = "Supabase not configured. Lead not stored.";
  }

  const contactTo = "lamia.brechet@outlook.fr";
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM || "MPL Export <onboarding@resend.dev>";

  let mailWarning: string | null = null;
  let mailSent = false;

  if (resendKey) {
    const subject = `Lead MPL - ${offerType.toUpperCase()}${simulationId ? ` - ${simulationId}` : ""}`;
    const html = `
      <h2>Nouveau lead MPL</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Consentement:</strong> ${consent ? "Oui" : "Non"}</p>
      <p><strong>Offre:</strong> ${escapeHtml(offerType)}</p>
      <p><strong>Simulation ID:</strong> ${escapeHtml(simulationId || "-")}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message || "(vide)").replace(/\n/g, "<br/>")}</p>
      <p><strong>Metadata:</strong></p>
      <pre style="background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(
        JSON.stringify(metadata ?? {}, null, 2)
      )}</pre>
      <p><strong>Contexte:</strong></p>
      <pre style="background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(
        JSON.stringify(context ?? {}, null, 2)
      )}</pre>
    `;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [contactTo],
          subject,
          html,
          reply_to: email,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        mailWarning = text || response.statusText;
      } else {
        mailSent = true;
      }
    } catch (err: any) {
      mailWarning = err?.message || "email send failed";
    }
  } else {
    mailWarning = "missing RESEND_API_KEY";
  }

  return res.status(200).json({
    ok: mailSent,
    mailWarning,
    dbWarning,
  });
}

async function handlePdf(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const payload = safeJson(req) || {};
  const title = String(payload.title || "Rapport export");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 12,
    color = rgb(0.1, 0.15, 0.25),
    bold = false,
  ) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
  };

  page.drawRectangle({ x: 0, y: 815, width: 595, height: 27, color: rgb(0.1, 0.2, 0.45) });
  page.drawRectangle({ x: 0, y: 812, width: 595, height: 3, color: rgb(0.85, 0.12, 0.12) });
  drawText("MPL Conseil Export", 40, 822, 12, rgb(1, 1, 1), true);
  drawText(title, 40, 785, 16, rgb(0.07, 0.18, 0.37), true);
  drawText(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, 40, 768, 10, rgb(0.4, 0.45, 0.55));

  const lines: string[] = [];
  if (payload.destination) lines.push(`Destination: ${payload.destination}`);
  if (payload.incoterm) lines.push(`Incoterm: ${payload.incoterm}`);
  if (payload.value && payload.currency) lines.push(`Valeur: ${payload.value} ${payload.currency}`);
  if (payload.score) lines.push(`Score conformite: ${payload.score}/100`);

  let y = 740;
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 70, borderWidth: 1, borderColor: rgb(0.85, 0.88, 0.92) });
  drawText("Contexte", 48, y + 50, 11, rgb(0.1, 0.2, 0.4), true);
  y += 32;
  for (const line of lines) {
    drawText(line, 48, y, 11);
    y -= 16;
  }

  if (payload.result?.landedCost) {
    y -= 24;
    drawText("Estimation landed cost", 40, y, 12, rgb(0.1, 0.1, 0.4), true);
    y -= 20;
    drawText(
      `Duty estime: ${payload.result.landedCost.duty?.toFixed?.(0) ?? payload.result.landedCost.duty}`,
      40,
      y,
      11,
    );
    y -= 16;
    drawText(
      `Taxes estimees: ${payload.result.landedCost.taxes?.toFixed?.(0) ?? payload.result.landedCost.taxes}`,
      40,
      y,
      11,
    );
    y -= 16;
    drawText(
      `Total: ${payload.result.landedCost.total?.toFixed?.(0) ?? payload.result.landedCost.total} ${payload.result.landedCost.currency}`,
      40,
      y,
      11,
      rgb(0.1, 0.2, 0.35),
      true,
    );
  }

  if (Array.isArray(payload.lines)) {
    y -= 24;
    drawText("Lignes facture", 40, y, 12, rgb(0.1, 0.1, 0.4), true);
    y -= 18;
    payload.lines.slice(0, 10).forEach((l: any) => {
      const row = `${l.description || ""} | qty ${l.qty || 0} | ${l.price || 0} | HS ${l.hs || ""}`;
      drawText(row, 40, y, 10);
      y -= 14;
    });
  }

  y -= 24;
  drawText("Disclaimer", 40, y, 11, rgb(0.4, 0.45, 0.55), true);
  y -= 14;
  drawText("Estimation indicative. A valider avec les sources officielles et votre declarant.", 40, y, 9, rgb(0.45, 0.5, 0.6));

  const pdfBytes = await pdf.save();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=mpl-rapport-export.pdf");
  return res.status(200).send(Buffer.from(pdfBytes));
}

async function handlePrefs(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};
  const email = String(body.email || "").trim().toLowerCase();
  const countries = Array.isArray(body.countries) ? body.countries : [];
  const hsCodes = Array.isArray(body.hsCodes) ? body.hsCodes : [];

  if (!email) return res.status(400).json({ error: "email required" });

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true });

  const { error } = await sb.from("user_prefs").upsert({
    email,
    countries_json: countries,
    hs_json: hsCodes,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function handleAlerts(req: VercelRequest, res: VercelResponse, url: URL) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const email = url.searchParams.get("email");
  const sb = getSupabase();
  if (!sb) {
    return res.status(200).json({ updatedAt: new Date().toISOString(), alerts: FALLBACK_ALERTS });
  }

  let countryFilters: string[] = [];
  let hsFilters: string[] = [];

  if (email) {
    const { data: prefs } = await sb.from("user_prefs").select("countries_json,hs_json").eq("email", email).maybeSingle();
    if (prefs?.countries_json) countryFilters = prefs.countries_json as string[];
    if (prefs?.hs_json) hsFilters = prefs.hs_json as string[];
  }

  let query = sb
    .from("alerts")
    .select("id,title,message,severity,country_iso2,hs_prefix,detected_at,source")
    .order("detected_at", { ascending: false })
    .limit(20);

  if (countryFilters.length) query = query.in("country_iso2", countryFilters);
  if (hsFilters.length) query = query.in("hs_prefix", hsFilters);

  const { data, error } = await query;
  if (error || !data) {
    return res.status(200).json({ updatedAt: new Date().toISOString(), alerts: FALLBACK_ALERTS });
  }

  const alerts = data.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    severity: a.severity,
    country: a.country_iso2,
    hsPrefix: a.hs_prefix,
    detectedAt: a.detected_at,
    source: a.source,
  }));

  return res.status(200).json({ updatedAt: new Date().toISOString(), alerts });
}

async function handleAuditRequest(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};
  const email = String(body.email || "").trim().toLowerCase();

  if (!email) return res.status(400).json({ error: "email required" });

  const payload = {
    company: body.company || null,
    email,
    destination: body.destination || null,
    incoterm: body.incoterm || null,
    value: body.value || null,
    currency: body.currency || null,
    lines_count: body.lines_count || null,
    notes: body.notes || null,
    context_json: body.context || null,
  };

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true });

  const { error } = await sb.from("audit_requests").insert(payload);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}

async function handleEstimate(req: VercelRequest, res: VercelResponse) {
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

  const sb = getSupabase();
  if (sb) {
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
  if (sb) {
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

async function handleSyncOperations(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    requireGraphConfig();

    const sheet = encodeURIComponent(GRAPH_SHEET_NAME);

    const url =
      `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_PATH}` +
      `/drive/root:${GRAPH_FILE_PATH}:/workbook/worksheets('${sheet}')` +
      `/usedRange(valuesOnly=true)?$top=5000`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GRAPH_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({
        error: "Graph error",
        status: r.status,
        detail,
        url,
      });
    }

    const data = (await r.json()) as GraphRangeResponse;
    const rawRows = headersToObjects(data.values ?? []);
    const normalized = normalizeSheet(rawRows);

    return res.status(200).json({
      ok: true,
      sheet: GRAPH_SHEET_NAME,
      sourceRows: rawRows.length,
      normalizedRows: normalized.length,
      data: normalized,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Unexpected error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

async function insertSnapshot(sb: any, source: string, payload: unknown, hash: string) {
  await sb.from("raw_snapshots").insert({ source, payload, checksum: hash });
}

async function upsertEntity(sb: any, entity: any) {
  await sb.from("sanctions_entities").upsert(entity, { onConflict: "entity_key" });
}

async function logChange(sb: any, source: string, hash: string, previousHash?: string | null) {
  await sb.from("change_log").insert({
    source,
    entity_key: source,
    change_type: previousHash ? "update" : "insert",
    summary: previousHash ? "Source mise a jour" : "Nouvelle source ajoutee",
    severity: "medium",
    old_hash: previousHash || null,
    new_hash: hash,
  });
}

async function refreshOfac(sb: any) {
  const run = await sb.from("ingestion_runs").insert({ source: "OFAC", status: "running" }).select("id").single();
  const runId = run.data?.id;

  const text = await fetch(OFAC_CSV_URL).then((r) => r.text());
  const hash = checksum(text);

  const prev = await sb
    .from("raw_snapshots")
    .select("checksum")
    .eq("source", "OFAC")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev.data?.checksum !== hash) {
    await insertSnapshot(sb, "OFAC", { csv: text.slice(0, 200000) }, hash);
    await logChange(sb, "OFAC", hash, prev.data?.checksum || null);
  }

  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0] || "");
  const nameIdx = header.findIndex((h) => h.toLowerCase() === "name");
  const programIdx = header.findIndex((h) => h.toLowerCase() === "program");
  const countryIdx = header.findIndex((h) => h.toLowerCase() === "country");

  let rows = 0;
  for (const line of lines.slice(1, 2000)) {
    const cols = parseCsvLine(line);
    const name = cols[nameIdx] || cols[0];
    if (!name) continue;
    rows += 1;
    const entityKey = `OFAC:${name}`;
    await upsertEntity(sb, {
      entity_key: entityKey,
      list_name: "OFAC",
      name,
      program: cols[programIdx] || null,
      country: cols[countryIdx] || null,
      identifiers: {},
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }

  await sb.from("ingestion_runs").update({ status: "ok", ended_at: new Date().toISOString(), rows, checksum: hash }).eq("id", runId);
}

async function refreshUn(sb: any) {
  const run = await sb.from("ingestion_runs").insert({ source: "UN", status: "running" }).select("id").single();
  const runId = run.data?.id;

  const html = await fetch(UN_LEGACY_HTML).then((r) => r.text());
  const hash = checksum(html);
  const prev = await sb
    .from("raw_snapshots")
    .select("checksum")
    .eq("source", "UN")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev.data?.checksum !== hash) {
    await insertSnapshot(sb, "UN", { html: html.slice(0, 200000) }, hash);
    await logChange(sb, "UN", hash, prev.data?.checksum || null);
  }

  const names = Array.from(new Set(html.match(/<tr[^>]*>\s*<td[^>]*>([^<]{3,120})<\/td>/gi)?.map((m) => m.replace(/<[^>]+>/g, "").trim()) || []));
  let rows = 0;
  for (const name of names.slice(0, 2000)) {
    if (!name) continue;
    rows += 1;
    const entityKey = `UN:${name}`;
    await upsertEntity(sb, {
      entity_key: entityKey,
      list_name: "UN",
      name,
      aliases: null,
      program: null,
      country: null,
      identifiers: {},
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }

  await sb.from("ingestion_runs").update({ status: "ok", ended_at: new Date().toISOString(), rows, checksum: hash }).eq("id", runId);
}

async function refreshEu(sb: any) {
  const run = await sb.from("ingestion_runs").insert({ source: "EU", status: "running" }).select("id").single();
  const runId = run.data?.id;

  const buf = await fetch(EU_PDF_URL).then((r) => r.arrayBuffer());
  const hash = checksum(Buffer.from(buf).toString("base64"));
  const prev = await sb
    .from("raw_snapshots")
    .select("checksum")
    .eq("source", "EU")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev.data?.checksum !== hash) {
    await insertSnapshot(sb, "EU", { pdf_hash: hash }, hash);
    await logChange(sb, "EU", hash, prev.data?.checksum || null);
  }

  await sb.from("ingestion_runs").update({ status: "ok", ended_at: new Date().toISOString(), rows: 1, checksum: hash }).eq("id", runId);
}

async function handleRefreshSources(req: VercelRequest, res: VercelResponse, url: URL) {
  const token = req.headers["x-refresh-token"] || url.searchParams.get("token");
  if (!process.env.REFRESH_TOKEN || token !== process.env.REFRESH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sb = getSupabase();
  if (!sb) return res.status(500).json({ error: "Supabase env missing" });

  try {
    await refreshOfac(sb);
    await refreshUn(sb);
    await refreshEu(sb);
    return res.status(200).json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Refresh failed" });
  }
}

async function handleNewsletterSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  return res.status(200).json({ ok: true, message: "Newsletter send pipeline not configured (MVP)." });
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname.replace(/^\/api\/?/, "");

  switch (path) {
    case "export/brief":
      return handleExportBrief(req, res);
    case "hs/search":
      return handleHsSearch(req, res, url);
    case "lead":
      return handleLead(req, res);
    case "leads":
      return handleLeads(req, res);
    case "contact":
      return handleContact(req, res);
    case "pdf":
      return handlePdf(req, res);
    case "prefs":
      return handlePrefs(req, res);
    case "alerts":
      return handleAlerts(req, res, url);
    case "audit-request":
      return handleAuditRequest(req, res);
    case "estimate":
      return handleEstimate(req, res);
    case "sync-operations":
      return handleSyncOperations(req, res);
    case "jobs/refresh-sources":
      return handleRefreshSources(req, res, url);
    case "newsletter/send":
      return handleNewsletterSend(req, res);
    default:
      return res.status(404).json({ error: "Not found" });
  }
}

