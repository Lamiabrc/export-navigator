export type GuidedFallback = {
  answer: string;
  followUpQuestions: string[];
};

function detectFlow(question: string): "export" | "import" | "trade" {
  const q = question.toLowerCase();
  if (/\bimport|importer|importation\b/.test(q) && !/\bexport|exporter|exportation\b/.test(q)) return "import";
  if (/\bexport|exporter|exportation\b/.test(q)) return "export";
  return "trade";
}

function detectCountry(question: string) {
  const q = question.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/\bjapon|japan\b/, "Japon"],
    [/\ballemagne|germany\b/, "Allemagne"],
    [/\busa|etats?-unis|united states\b/, "USA"],
    [/\bturquie|turkey\b/, "Turquie"],
    [/\bchine|china\b/, "Chine"],
    [/\bmaroc|morocco\b/, "Maroc"],
    [/\bcoree|korea\b/, "Coree"],
    [/\bcanada\b/, "Canada"],
    [/\bespagne|spain\b/, "Espagne"],
    [/\bitalie|italy\b/, "Italie"],
    [/\bbelgique|belgium\b/, "Belgique"],
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
  const q = question.trim();
  const patterns = [
    /exporter?\s+(?:des|de|du|d')\s+(.+?)\s+(?:vers|au|en)\s+/i,
    /importer?\s+(?:des|de|du|d')\s+(.+?)\s+(?:depuis|de)\s+/i,
  ];
  for (const p of patterns) {
    const m = q.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
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
  if (followUps.length < 3) {
    followUps.push("Quel est le mode de transport et la valeur approximative de l'envoi ?");
  }

  const flowLabel = flow === "export" ? "export" : flow === "import" ? "import" : "operation internationale";
  const objective = `${flowLabel} ${product || (hs ? `produit HS ${hs}` : "produit non precise")} ${country ? `vers ${country}` : ""}`.trim();
  const firstQuestion = followUps[0];
  const extraQuestions = followUps.slice(1, 3);

  const answer = [
    `D'accord, j'ai compris votre demande: ${objective}.`,
    `Je vois deja ${country ? `le pays (${country})` : "une partie du contexte"}, mais il manque des infos critiques (${hs ? "HS OK" : "HS manquant"}, ${incoterm ? `incoterm ${incoterm}` : "incoterm manquant"}).`,
    `Question prioritaire: ${firstQuestion}`,
    extraQuestions.length ? `Ensuite:\n- ${extraQuestions.join("\n- ")}` : null,
    "Des que vous repondez, je vous donne une reponse precise et directement actionnable.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    answer,
    followUpQuestions: followUps.slice(0, 3),
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
