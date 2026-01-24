import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const HIGH_RISK = new Set(["RU", "IR", "KP", "SY", "BY"]);

const EU_MEMBERS = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

type Agreement = {
  name: string;
  note: string;
  proofHint?: string;
  link?: string;
};

// ⚠️ On reste sur des accords “très stables / connus” pour éviter les erreurs.
// Pour une couverture parfaite “par pays”, on mettra ça en table Supabase (trade_agreements).
const AGREEMENTS: Record<string, Agreement> = {
  GB: {
    name: "Accord UE–Royaume-Uni (TCA)",
    note: "Préférences possibles si règles d’origine respectées (selon produit).",
    proofHint: "Prévoir une preuve/déclaration d’origine selon le cadre.",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-uk-trade-and-cooperation-agreement",
  },
  CH: {
    name: "Accords UE–Suisse",
    note: "Préférences possibles selon règles d’origine (selon produit).",
    proofHint: "Preuve d’origine selon le régime applicable (à valider).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/switzerland",
  },
  CA: {
    name: "Accord UE–Canada (CETA)",
    note: "Préférences possibles selon règles d’origine (selon produit).",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/canada_en",
  },
  JP: {
    name: "Accord UE–Japon (EPA)",
    note: "Préférences possibles selon règles d’origine (selon produit).",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/japan_en",
  },
  KR: {
    name: "Accord UE–Corée du Sud",
    note: "Préférences possibles selon règles d’origine (selon produit).",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/south-korea_en",
  },
  SG: {
    name: "Accord UE–Singapour",
    note: "Préférences possibles selon règles d’origine (selon produit).",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-singapore-free-trade-agreement",
  },
  VN: {
    name: "Accord UE–Vietnam",
    note: "Préférences possibles selon règles d’origine (selon produit).",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-vietnam-free-trade-agreement",
  },
  US: {
    name: "États-Unis (pas d’accord préférentiel général)",
    note: "Droits de douane applicables selon HS + règles US (selon produit).",
    proofHint: "Vérifier exigences (étiquetage, normes, licences) selon produit.",
  },
};

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

function buildCountryNotes(params: {
  destinationIso2: string;
  hsInput: string;
  productText: string;
  incoterm: string;
  mode: string;
}) {
  const { destinationIso2, hsInput, productText, incoterm, mode } = params;
  const notes: Array<{ title: string; items: string[] }> = [];

  const isIntraEU = EU_MEMBERS.has(destinationIso2);

  // Traité / cadre pays
  if (isIntraEU) {
    notes.push({
      title: "Spécificité UE (intra-UE)",
      items: [
        "Destination dans l’UE : pas de droits de douane (ce n’est pas une exportation au sens douanier).",
        "Vérifier TVA intracom, mentions de facture et preuve de livraison (selon ton schéma).",
      ],
    });
  } else {
    const ag = AGREEMENTS[destinationIso2];
    if (ag) {
      notes.push({
        title: "Traité / cadre applicable (indication)",
        items: [
          ag.name,
          ag.note,
          ag.proofHint || "Prévoir la preuve d’origine selon les règles applicables.",
          ag.link ? `Référence : ${ag.link}` : "",
        ].filter(Boolean),
      });
    } else {
      notes.push({
        title: "Traités & préférences (à vérifier)",
        items: [
          "Selon le pays, des accords peuvent exister : la préférence dépend du produit et de l’origine.",
          "Référence officielle UE : https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/negotiations-and-agreements_en",
          "Pour une validation rapide (pays + HS + docs), demander une validation express.",
        ],
      });
    }
  }

  // Vigilance “scénario”
  const v: string[] = [];
  if (HIGH_RISK.has(destinationIso2)) {
    v.push("Pays à vigilance élevée (sanctions / restrictions possibles) : vérifier licences, listes et interdictions.");
  } else {
    v.push("Vérifier listes de sanctions (UE/ONU/OFAC) selon produit, client et destination finale.");
  }

  if (!hsInput || hsInput.length < 4) v.push("HS incomplet : risque de droits incorrects → compléter idéalement à 6 chiffres.");
  else v.push("HS suffisant pour estimation (6 chiffres recommandé).");

  if (incoterm === "DDP") v.push("Incoterm DDP : confirmer qui paie droits & taxes à l’import + justification/refacturation.");
  else if (incoterm === "EXW") v.push("Incoterm EXW : responsabilités export/transitaire à clarifier (risque documentaire).");
  else v.push("Incoterm : confirmer répartition responsabilités (droits, taxes, assurance, transport).");

  if (mode) v.push(`Mode transport : ${mode} — vérifier contraintes et documents transport.`);
  if (productText) v.push("Produit saisi en texte : la classification HS peut nécessiter confirmation.");

  notes.push({ title: "Spécificités & vigilance", items: v });

  // Limite actuelle (transparent & pro)
  notes.push({
    title: "Limite de l’estimation",
    items: [
      "Les taxes à l’import (TVA locale/équivalent) dépendent du régime du pays et du scénario (incoterm, dédouanement, statut importateur).",
      "Pour un chiffrage robuste (droits + taxes + frais) : audit / validation express recommandée.",
    ],
  });

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

  // Supabase optionnel (uniquement si tu veux stocker simulations)
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  let dutyRate: number | null = null;
  let vatRate: number | null = null; // volontairement null tant qu'on n'a pas de vraie source fiable
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
      ? [
          {
            title: "Intra-UE",
            level: "low",
            message: "Flux intra-UE : règles TVA/mentions/preuves plutôt que droits de douane.",
          },
        ]
      : []),
    ...(vatRate === null && !isIntraEU
      ? [
          {
            title: "Taxes import non estimées",
            level: "medium",
            message: "Taxes à l’import dépendantes du régime local et du scénario (incoterm/importateur).",
          },
        ]
      : []),
  ];

  const complianceScore = Math.max(
    40,
    100 - (hsInput.length < 4 ? 25 : 0) - (HIGH_RISK.has(destinationIso2) ? 20 : 5)
  );

  const confidence =
    isIntraEU ? "high" : sources.includes("WITS / UNCTAD TRAINS (estimation)") ? "high" : dutyRate !== null ? "medium" : "low";

  const countryNotes = buildCountryNotes({
    destinationIso2,
    hsInput,
    productText,
    incoterm,
    mode,
  });

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

  // SimulationId : on renvoie toujours un ID (utile pour relier le lead)
  let simulationId: string | null = randomUUID();

  // Sauvegarde si table "simulations" existe (sinon on ignore proprement)
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
      // table absente ou autre souci : on garde le simulationId généré
    }
  }

  return res.status(200).json({ ...result, simulationId });
}
