import { detectCountryFromShortInput } from "./countryInput";

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
    /(?:produit|marchandise)\s*[:\-]\s*(.+?)(?:$|[,.!?;])/i,
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

  const followUps: string[] = [];
  if (!country) {
    followUps.push("Quel est le pays de destination exact (et pays de transit si applicable) ?");
  }
  if (!product && !hs) {
    followUps.push("Quel est le produit exact (nom commercial + composition/usage) ?");
  }
  if (!hs) {
    followUps.push("Avez-vous deja un code HS (6 ou 8 chiffres) ?");
  }
  if (!incoterm) {
    followUps.push("Quel Incoterm est prevu (EXW, FCA, FOB, CIF, DAP, DDP...) ?");
  }
  followUps.push("Quel est le mode de transport et la valeur approximative de l'envoi ?");
  if (followUps.length < 3) {
    followUps.push("Quel mode de paiement client est prevu (avance, CAD, credoc, OA) ?");
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
      ? `Regle generale immediate: appliquez les regles export/import vers ${country}, puis confirmez HS et Incoterm pour fiabiliser droits, taxes et documents.`
      : "Regle generale immediate: il faut confirmer la destination pour valider TVA, formalites douane et restrictions pays.",
    `Question prioritaire: ${firstQuestion}`,
    extraQuestions.length ? `Ensuite:\n- ${extraQuestions.join("\n- ")}` : null,
    "Une fois ces points donnes, je fournis une reponse exploitable (checklist, risques, actions).",
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
  const q = question.trim();
  const lower = q.toLowerCase();
  const links: Array<{ title: string; url: string; origin: "internet" }> = [
    {
      title: "Recherche web ciblee",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${q} reglementation export`)}`,
      origin: "internet",
    },
  ];

  if (/(incoterm|fob|dap|ddp|cif|cip|exw|fca)/i.test(lower)) {
    links.push({
      title: "Guide ICC Incoterms",
      url: "https://iccwbo.org/business-solutions/incoterms-rules/",
      origin: "internet",
    });
  }

  if (/(douane|droit|tarif|taric|hs|code hs|tva)/i.test(lower)) {
    links.push(
      {
        title: "Douane francaise",
        url: "https://www.douane.gouv.fr/",
        origin: "internet",
      },
      {
        title: "Taric UE",
        url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp",
        origin: "internet",
      }
    );
  }

  if (/(sanction|embargo|restriction|compliance|conformite)/i.test(lower)) {
    links.push({
      title: "EU Sanctions Map",
      url: "https://www.sanctionsmap.eu/",
      origin: "internet",
    });
  }

  const deduped = new Map<string, { title: string; url: string; origin: "internet" }>();
  for (const item of links) deduped.set(item.url, item);
  return Array.from(deduped.values()).slice(0, 4);
}
