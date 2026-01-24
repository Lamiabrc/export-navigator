import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const HIGH_RISK = new Set(["RU", "IR", "KP", "SY", "BY"]);

// UE (pour détecter intra-UE)
const EU_MEMBERS = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

// Accords / cadres utiles (indications — la préférence tarifaire dépend des règles d’origine)
type Agreement = {
  name: string;
  inForceSince?: string;
  note?: string;
  proofHint?: string;
  link?: string; // ok dans le code
};

const AGREEMENTS: Record<string, Agreement> = {
  GB: {
    name: "Accord UE–Royaume-Uni (TCA)",
    inForceSince: "2021",
    note: "Préférences possibles (droits réduits/0) si règles d’origine respectées.",
    proofHint: "Souvent via 'statement on origin' / déclaration d’origine (à valider selon cas).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-uk-trade-and-cooperation-agreement",
  },
  CH: {
    name: "Accords UE–Suisse (Pan-Euro-Med / origine préférentielle)",
    note: "Préférences possibles selon règles d’origine (convention Pan-Euro-Med).",
    proofHint: "Preuve d’origine selon régime applicable (déclaration / certificat selon cas).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/switzerland",
  },
  CA: {
    name: "Accord UE–Canada (CETA)",
    note: "Préférences possibles selon règles d’origine.",
    proofHint: "Preuve d’origine / déclaration selon le cadre (à valider).",
    link: "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/canada_en",
  },
  JP: {
    name: "Accord UE–Japon (EPA)",
    note: "Préférences possibles selon règles d’origine.",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/japan_en",
  },
  KR: {
    name: "Accord UE–Corée du Sud",
    note: "Préférences possibles selon règles d’origine.",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/south-korea_en",
  },
  SG: {
    name: "Accord UE–Singapour",
    inForceSince: "2019",
    note: "Préférences possibles selon règles d’origine.",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-singapore-free-trade-agreement",
  },
  VN: {
    name: "Accord UE–Vietnam",
    inForceSince: "2020",
    note: "Préférences possibles selon règles d’origine.",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-vietnam-free-trade-agreement",
  },
  NZ: {
    name: "Accord UE–Nouvelle-Zélande",
    inForceSince: "2024",
    note: "Préférences possibles selon règles d’origine.",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-new-zealand-free-trade-agreement",
  },
  CL: {
    name: "Accord UE–Chili (Interim Trade Agreement – ITA)",
    inForceSince: "2025",
    note: "Préférences possibles selon règles d’origine.",
    proofHint: "Preuve d’origine selon le cadre (à valider).",
    link: "https://trade.ec.europa.eu/access-to-markets/en/content/eu-chile-interim-trade-agreement",
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

  // NOTE: WITS fonctionne surtout pour des estimations; l’API peut évoluer.
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
  return ["Commercial invoice", "Packing list", "Transport document", "Export declaration", "Certificate of origin"];
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
  sources: string[];
}) {
  const { destinationIso2, hsInput, productText, incoterm, mode } = params;
  const notes: Array<{ title: string; items: string[] }> = [];

  const isIntraEU = EU_MEMBERS.has(destinationIso2);

  // 1) Contexte pays / traité
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
        title: "Traité / accord applicable (indication)",
        items: [
          `${ag.name}${ag.inForceSince ? ` — en vigueur depuis ${ag.inForceSince}` : ""}.`,
          ag.note || "Préférences possibles selon règles d’origine.",
          ag.proofHint || "Prévoir la preuve d’origine selon les règles applicables.",
          ag.link ? `Référence : ${ag.link}` : "",
        ].filter(Boolean),
      });
    } else {
      notes.push({
        title: "Traités & préférences (à vérifier)",
        items: [
          "Selon le pays, des accords peuvent exister : la préférence tarifaire dépend du produit et de l’origine.",
          "Pour vérifier rapidement (pays + HS + documents), demander une validation express.",
          "Référence : https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/negotiations-and-agreements_en",
        ],
      });
    }
  }

  // 2) Points de vigilance “scénario”
  const hv = HIGH_RISK.has(destinationIso2);
  const items: string[] = [];

  if (hv) {
    items.push("Pays à vigilance élevée (sanctions / restrictions possibles) : vérifier licences, listes et interdictions.");
  } else {
    items.push("Vérifier listes de sanctions (UE/ONU/OFAC) selon produit, client et destination finale.");
  }

  if (!hsInput || hsInput.length < 4) {
    items.push("HS incomplet : risque de droits/contrôles incorrects → compléter idéalement à 6 chiffres.");
  } else {
    items.push("HS suffisant pour une estimation (idéalement 6 chiffres pour plus de précision).");
  }

  if (incoterm === "DDP") {
    items.push("Incoterm DDP : confirmer qui paie droits & taxes à l’import et comment tu refactures/justifies.");
  } else if (incoterm === "EXW") {
    items.push("Incoterm EXW : responsabilités export/transitaire à clarifier (risque documentaire).");
  } else {
    items.push("Incoterm : confirmer la répartition responsabilités (droits, taxes, assurance, transport).");
  }

  if (mode) items.push(`Mode transport : ${mode} — vérifier contraintes et documents transport.`);

  if (productText) {
    items.push("Produit saisi en texte : la classification HS peut nécessiter confirmation (risque de mauvaise taxe).");
  }

  notes.push({ title: "Spécificités & vigilance", items });

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

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  const isIntraEU = EU_MEMBERS.has(destinationIso2);

  let dutyRate: number | null = null;
  let vatRate: number | null = null;
  let docs: string[] = isIntraEU ? buildDocsIntraEU() : buildDocsFallback();
  const sources: string[] = [];

  if (isIntraEU) {
    // Intra-UE : on neutralise les droits/taxes “import” (ce n’est pas de l’import)
    dutyRate = 0;
    vatRate = 0;
    sources.push("Règle intra-UE (pas de droits de douane)");
  }

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

    // seulement si pas intra-UE
    if (!isIntraEU) {
      const dutyRow = dutyRows.find((r) => r.country === destinationIso2 && r.hs_prefix === prefix);
      dutyRate = dutyRow?.rate ?? dutyRate;
      vatRate = vatRows.find((r) => r.country === destinationIso2)?.rate ?? vatRate;

      const docRow = docsRows.find((r) => r.country === destinationIso2);
      if (docRow?.docs?.length) docs = docRow.docs;
    }
  }

  // WITS uniquement si hors UE (sinon ce serait trompeur)
  if (!isIntraEU) {
    const witsRate = await fetchWitsDuty(destinationIso2, hsInput).catch(() => null);
    if (witsRate !== null) {
      dutyRate = witsRate;
      sources.push("WITS / UNCTAD TRAINS (estimation)");
    } else if (dutyRate !== null) {
      sources.push("Mock duty rates");
    }
  }

  if (vatRate !== null && !isIntraEU) sources.push("Mock VAT rates");
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
      title: "Cohérence incoterm",
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
  ];

  const complianceScore = Math.max(
    40,
    100
      - (hsInput.length < 4 ? 25 : 0)
      - (HIGH_RISK.has(destinationIso2) ? 20 : 5)
      - (isIntraEU ? 0 : 0)
  );

  const confidence =
    isIntraEU
      ? "high"
      : sources.includes("WITS / UNCTAD TRAINS (estimation)")
        ? "high"
        : dutyRate !== null
          ? "medium"
          : "low";

  // ✅ NEW : countryNotes (traités / spécificités)
  const countryNotes = buildCountryNotes({
    destinationIso2,
    hsInput,
    productText,
    incoterm,
    mode,
    sources,
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
