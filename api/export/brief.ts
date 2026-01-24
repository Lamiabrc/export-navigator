import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const HIGH_RISK = new Set(["RU", "IR", "KP", "SY", "BY"]);

const EU_MEMBERS = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

const SEA_ONLY_INCOTERMS = new Set(["FAS", "FOB", "CFR", "CIF"]);

function safeJson(req: VercelRequest) {
  if (!req.body) return null;
  try {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return null;
  }
}

function normalizeHs(input?: string) {
  if (!input) return "";
  return String(input).replace(/[^0-9]/g, "").trim();
}

function nowIso() {
  return new Date().toISOString();
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
  v.push(HIGH_RISK.has(destinationIso2)
    ? "Pays à vigilance élevée (sanctions / restrictions possibles) : vérifier licences, listes et interdictions."
    : "Vérifier listes de sanctions (UE/ONU/OFAC) selon produit, client et destination finale."
  );

  v.push(hsInput.length < 4
    ? "HS incomplet : risque de droits incorrects → compléter idéalement à 6 chiffres."
    : "HS suffisant pour estimation (6 chiffres recommandé)."
  );

  if (SEA_ONLY_INCOTERMS.has(incoterm) && mode !== "sea") {
    v.push(`${incoterm} est maritime uniquement : incohérence incoterm/transport.`);
  }

  notes.push({ title: "Vigilance", items: v });
  return notes;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = safeJson(req) || {};

  const hsInput = normalizeHs(body.hsInput);
  const productText = String(body.productText || "").trim();
  const destinationIso2 = normalizeIso2(body.destinationIso2);
  const value = Number(body.value || 0);
  const currency = String(body.currency || "EUR").trim().toUpperCase();
  const incoterm = String(body.incoterm || "DAP").trim().toUpperCase();
  const mode = normalizeMode(body.mode);

  if (!destinationIso2 || destinationIso2.length !== 2) return res.status(400).json({ error: "destinationIso2 required (ISO2)" });

  const isIntraEU = EU_MEMBERS.has(destinationIso2);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  const sources: string[] = [];
  let dutyRate: number | null = null;

  // Taxes import : trop variable => on ne “fabrique” pas une TVA locale.
  // Intra-UE: 0 (douane), hors UE: 0 mais risque “à confirmer”.
  const vatRate: number | null = isIntraEU ? 0 : null;

  // Docs = base + doc transport selon mode
  const docsBase = buildDocsBase(isIntraEU);
  const docs = Array.from(new Set([...docsBase, transportDocForMode(mode)]));

  // Duty via WITS (hors UE) si HS >= 4
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

  // ✅ countryNotes depuis Supabase si table existe, sinon fallback
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

  // Persist simulation (optionnel)
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
