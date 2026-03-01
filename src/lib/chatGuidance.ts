import { detectCountryFromShortInput } from "./countryInput";
import {
  countryNameFromIso2,
  detectGlobalTradeIntent,
  extractCountriesFromText,
} from "./copilot/officialLinks";

export type GuidedFallback = {
  answer: string;
  followUpQuestions: string[];
  blocks?: {
    summary: string[];
    checklist: Array<{ label: string; required: boolean }>;
    risks: string[];
    actions: string[];
  };
};

function detectFlow(question: string): "export" | "import" | "trade" {
  const q = normalize(question);
  if (/\bimport|importer|importation|importateur\b/.test(q) && !/\bexport|exporter|exportation|exportateur\b/.test(q)) return "import";
  if (/\bexport|exporter|exportation|exportateur\b/.test(q)) return "export";
  return "trade";
}

function detectCountry(question: string) {
  const shortDetected = detectCountryFromQuestion(question);
  if (shortDetected) return shortDetected;

  const detectedIso2 = extractCountriesFromText(question, 1)[0] || null;
  if (detectedIso2) return countryNameFromIso2(detectedIso2, "fr");

  const q = normalize(question);
  const map: Array<[RegExp, string]> = [
    [/\bportugal\b/, "Portugal"],
    [/\bjapon|japan\b/, "Japon"],
    [/\ballemagne|germany\b/, "Allemagne"],
    [/\bespagne|spain\b/, "Espagne"],
    [/\bitalie|italy\b/, "Italie"],
    [/\bbelgique|belgium\b/, "Belgique"],
    [/\bpays[-\s]?bas|netherlands|hollande\b/, "Pays-Bas"],
    [/\busa|etats?-unis|united states\b/, "USA"],
    [/\bturquie|turkey\b/, "Turquie"],
    [/\bchine|china\b/, "Chine"],
    [/\bmaroc|morocco\b/, "Maroc"],
    [/\bcoree|korea\b/, "Coree"],
    [/\bcanada\b/, "Canada"],
  ];
  for (const [re, label] of map) {
    if (re.test(q)) return label;
  }
  return null;
}

function detectIncoterm(question: string) {
  const m = question.toUpperCase().match(/\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/);
  return m?.[1] ?? null;
}

function detectHs(question: string) {
  const m = question.match(/\b\d{6,10}\b/);
  return m?.[0] ?? null;
}

function detectProduct(question: string) {
  const q = normalize(question);
  const compact = q.replace(/\s+/g, " ").trim();
  if (!compact) return null;

  const roleMatch = compact.match(/\b(?:exportateur|importateur)\s+(?:de|d)\s+([a-z0-9][a-z0-9\s-]{2,60})\b/i);
  if (roleMatch?.[1]) {
    return cleanupProduct(roleMatch[1]);
  }

  const simpleVerbMatch = compact.match(/\b(?:j ?exporte|nous exportons|j ?importe|nous importons)\s+(?:des|de|du|d)\s+([a-z0-9][a-z0-9\s-]{2,60})\b/i);
  if (simpleVerbMatch?.[1]) {
    return cleanupProduct(simpleVerbMatch[1]);
  }

  const patterns = [
    /exporter?\s+(?:des|de|du|d')\s+(.+?)\s+(?:vers|au|en)\s+/i,
    /importer?\s+(?:des|de|du|d')\s+(.+?)\s+(?:depuis|de)\s+/i,
    /(?:produit|marchandise)\s*[:-]\s*(.+?)(?:$|[,.!?;])/i,
  ];
  for (const p of patterns) {
    const m = compact.match(p);
    if (m?.[1]) return cleanupProduct(m[1]);
  }

  const knownProducts = [
    "banane",
    "bananes",
    "cacao",
    "cafe",
    "textile",
    "cosmetique",
    "vin",
    "fromage",
    "chaussure",
    "batterie",
    "pharmaceutique",
  ];
  const known = knownProducts.find((item) => new RegExp(`\\b${item}\\b`, "i").test(compact));
  if (known) return cleanupProduct(known);

  return null;
}

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupProduct(value: string) {
  return String(value || "")
    .replace(/\b(vers|au|aux|en|depuis|de|du|d)\b.*$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function detectCountryFromQuestion(question: string) {
  const country = detectCountryFromShortInput(question);
  return country || null;
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function formatObjective(params: {
  flow: "export" | "import" | "trade";
  product: string | null;
  hs: string | null;
  country: string | null;
}) {
  const flowLabel = params.flow === "export" ? "export" : params.flow === "import" ? "import" : "operation internationale";
  const productLabel = params.product || (params.hs ? `produit HS ${params.hs}` : "produit a preciser");
  const destinationLabel = params.country ? `vers ${params.country}` : "destination a confirmer";
  return `${flowLabel} ${productLabel} (${destinationLabel})`;
}

export function buildGuidedFallback(question: string): GuidedFallback {
  const flow = detectFlow(question);
  const country = detectCountry(question);
  const incoterm = detectIncoterm(question);
  const hs = detectHs(question);
  const product = detectProduct(question);
  const isGlobalIntent = detectGlobalTradeIntent({ question, product });

  const countryQuestion = "Quel est le pays de destination exact (et pays de transit si applicable) ?";
  const productQuestion = "Quel est le produit exact (nom commercial + composition/usage) ?";
  const hsQuestion = "Avez-vous deja un code HS (6 ou 8 chiffres) ?";
  const incotermQuestion = "Quel Incoterm est prevu (EXW, FCA, FOB, CIF, DAP, DDP...) ?";
  const transportQuestion = "Quel est le mode de transport et la valeur approximative de l'envoi ?";
  const paymentQuestion = "Quel mode de paiement client est prevu (avance, CAD, credoc, OA) ?";

  const followUps: string[] = [];

  // Regle de priorisation demandee:
  // 1) produit detecte sans pays => demander pays en premier
  // 2) pays detecte sans produit/HS => demander produit en premier
  if ((product || hs) && !country) {
    followUps.push(countryQuestion);
  } else if (country && !product && !hs) {
    followUps.push(productQuestion);
  } else {
    if (!country) followUps.push(countryQuestion);
    if (!product && !hs) followUps.push(productQuestion);
  }

  if (!hs) followUps.push(hsQuestion);
  if (!incoterm) followUps.push(incotermQuestion);
  followUps.push(transportQuestion);
  if (followUps.length < 3) {
    followUps.push(paymentQuestion);
  }
  const prioritizedFollowUps = uniqueList(followUps).slice(0, 3);

  const objective = formatObjective({ flow, product, hs, country });
  const firstQuestion = prioritizedFollowUps[0];
  const extraQuestions = prioritizedFollowUps.slice(1, 3);

  const summary = uniqueList([
    `Contexte pris en compte: ${objective}.`,
    country ? `Pays detecte: ${country}.` : "Pays non detecte: sans destination, les regles TVA/douane restent indicatives.",
    product || hs
      ? `Produit detecte: ${product || `HS ${hs}`}.`
      : "Produit non detecte: la classification HS reste a confirmer.",
  ]).slice(0, 3);

  const checklist = [
    { label: country ? `Pays destination: ${country}` : "Pays de destination", required: true },
    { label: product ? `Produit: ${product}` : "Produit exact (composition/usage)", required: true },
    { label: hs ? `HS: ${hs}` : "Code HS 6 chiffres", required: true },
    { label: incoterm ? `Incoterm: ${incoterm}` : "Incoterm + lieu", required: true },
    { label: "Mode de transport + valeur facture", required: true },
  ].slice(0, 5);

  const risks = uniqueList([
    !country ? "Decision export incomplete sans pays de destination." : "",
    !hs ? "Risque droits/taxes faux sans HS6." : "",
    !incoterm ? "Risque de litige sur transfert des risques/couts sans Incoterm." : "",
    product && /banane|cacao|cafe|agri|aliment/i.test(normalize(product))
      ? "Verifier exigences phytosanitaires/sanitaires du pays importateur."
      : "",
  ]).slice(0, 4);

  const actions = uniqueList([
    firstQuestion ? `Repondez d'abord: ${firstQuestion}` : "",
    extraQuestions[0] ? `Puis: ${extraQuestions[0]}` : "",
    extraQuestions[1] ? `Ensuite: ${extraQuestions[1]}` : "",
    "Des reception des infos, je fournis checklist documentaire + risques + prochaines actions.",
  ]).slice(0, 4);

  const answer = [
    `Demande comprise: ${objective}.`,
    country
      ? `Decision provisoire: sous conditions. Priorite douane/Incoterm puis classification HS pour ${country}.`
      : "Decision provisoire: sous conditions. Donnez d'abord le pays destination pour fiabiliser la reponse.",
    `Question prioritaire: ${firstQuestion}`,
    extraQuestions.length ? `Puis:\n- ${extraQuestions.join("\n- ")}` : null,
    isGlobalIntent ? "Option: activez la veille pays si vous suivez le marche mondial du produit." : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    answer,
    followUpQuestions: prioritizedFollowUps,
    blocks: {
      summary,
      checklist,
      risks,
      actions,
    },
  };
}

export function buildResearchLinks(question: string) {
  const isGlobalIntent = detectGlobalTradeIntent({
    question,
    product: detectProduct(question),
  });

  const links: Array<{ title: string; url: string; origin: "internet" }> = [
    {
      title: "Ouvrir la page veille",
      url: "/veille",
      origin: "internet",
    },
    {
      title: "S'inscrire pour la veille",
      url: "/register?next=%2Fapp%2Fcentre-veille%2Freglementation",
      origin: "internet",
    },
    {
      title: "Voir les tarifs",
      url: "/pricing#plans",
      origin: "internet",
    },
    {
      title: "Control Tower (carte pays)",
      url: "/app/control-tower",
      origin: "internet",
    },
  ];

  if (isGlobalIntent) {
    links.push({
      title: "Centre veille reglementaire",
      url: "/app/centre-veille/reglementation",
      origin: "internet",
    });
  }

  return links.slice(0, 5);
}
