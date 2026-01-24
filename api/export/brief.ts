import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const HIGH_RISK = new Set(["RU", "IR", "KP", "SY", "BY"]);

const EU_MEMBERS = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

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

function buildDocsIntraEU() {
  return [
    "Facture (mentions TVA / intracom)",
    "Preuve d’expédition / livraison",
    "Vérification TVA intracom (client, n° TVA, mentions)",
    "Obligations statistiques (selon cas)",
  ];
}

// Fallback “intelligent” si country_notes non renseigné
function buildCountryNotesFallback(destinationIso2: string, hsInput: string, productText: string, incoterm: string, mode: string) {
  const isIntraEU = EU_MEMBERS.has(destinationIso2);
  const notes: Array<{ title: string; items: string[] }> = [];

  if (isIntraEU) {
    notes.push({
      title: "Spécificité UE (intra-UE)",
      items: [
        "Destination dans l’UE : pas de droits de douane (ce n’est pas une exportation au sens douanier).",
        "Vérifier TVA intracom, mentions de facture et preuve de livraison (selon ton schéma).",
      ],
    });
  } else {
    notes.push({
      title: "Traités & préférences (à vérifier)",
      items: [
        "Selon le pays, des accords peuvent exister : la préférence dépend du produit et de l’origine.",
        "Pour une validation “zéro surprise” : demander une validation express (HS + pays + documents).",
      ],
    });
  }

  const v: string[] = [];
  if (HIGH_RISK.has(destinationIso2)) v.push("Pays à vigilance élevée (sanctions / restrictions possibles) : vérifier licences, listes et interdictions.");
  else v.push("Vérifier listes de sanctions (UE/ONU/OFAC) selon produit, client et destination finale.");

  if (!hsInput || hsInput.length < 4) v.push("HS incomplet : risque de droits incorrects → compléter idéalement à 6 chiffres.");
  else v.push("HS suffisant pour estimation (6 chiffres recommandé).");

  if (incoterm === "DDP") v.push("Incoterm DDP : confirmer qui paie droits & taxes à l’import + justification/refacturation.");
  else if (incoterm === "EXW") v.push("Incoterm EXW : responsabilités export/transitaire à clarifier (risque documentaire).");
  else v.push("Incoterm : confirmer répartition responsabilités (droits, taxes, assurance, transport).");

  if (mode) v.push(`Mode transport : ${mode} — vérifier contraintes et documents transport.`);
  if (productText) v.push("Produit saisi en texte : la classification HS peut nécessiter confirmation.");

  notes.push({ title: "Spécificités & vigilance", items: v });
  return notes;
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

  const isIntraEU = EU_MEMBERS.has(destinationIso2);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  let dutyRate: number | null = null;
  let vatRate: number | null = null; // volontairement non-fiable hors UE -> on laisse à 0 si inconnu
  let docs: string[] = isIntraEU ? buildDocsIntraEU() : buildDocsFallback();
  const sources: string[] = [];

  if (isIntraEU) {
    dutyRate = 0;
    vatRate = 0;
    sources.push("Règle intra-UE (pas de droits de douane)");
  } else {
    const witsRate = await fetchWitsDuty(destinationIso2, hsInput).catch(() => null);
    if (witsRate !== null) {
      dutyRate = witsRate;
      sources.push("WITS / UNCTAD TRAINS (estimation)");
    } else {
      dutyRate = null;
      sources.push("Estimation interne (fallback)");
    }
  }

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
    ...(isIntraEU
      ? [{ title: "Intra-UE", level: "low", message: "Flux intra-UE : règles TVA/mentions/preuves plutôt que droits de douane." }]
      : []),
  ];

  const complianceScore = Math.max(
    40,
    100 - (hsInput.length < 4 ? 25 : 0) - (HIGH_RISK.has(destinationIso2) ? 20 : 5)
  );

  const confidence =
    isIntraEU ? "high" : sources.includes("WITS / UNCTAD TRAINS (estimation)") ? "high" : dutyRate !== null ? "medium" : "low";

  // ✅ countryNotes depuis Supabase (si table dispo), sinon fallback
  let countryNotes: Array<{ title: string; items: string[] }> = buildCountryNotesFallback(
    destinationIso2,
    hsInput,
    productText,
    incoterm,
    mode
  );

  if (sb) {
    try {
      const { data, error } = await sb
        .from("country_notes")
        .select("notes")
        .eq("iso2", destinationIso2)
        .maybeSingle();

      if (!error && data?.notes) {
        // notes attendu = array {title, items[]}
        countryNotes = data.notes as any;
        sources.push("Country notes (Supabase)");
      }
    } catch {
      // si table absente ou autre : on garde fallback
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
  };

  // SimulationId : on renvoie toujours un ID utile pour relier le lead
  let simulationId: string | null = randomUUID();

  if (sb) {
    try {
      const { data, error } = await sb
        .from("simulations")
        .insert({
          id: simulationId,
          email: null,
          hs_input: hsInput || null,
          destination: destinationIso2,
          payload: { hsInput, productText, destinationIso2, value, currency, incoterm, mode },
          result,
        })
        .select("id")
        .single();

      if (!error && data?.id) simulationId = data.id;
    } catch {
      // table absente ou souci : on garde l'id généré
    }
  }

  return res.status(200).json({ ...result, simulationId });
}
