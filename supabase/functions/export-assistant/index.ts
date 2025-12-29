import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type AssistantRequest = {
  message?: string;
  context?: Record<string, unknown>;
};

type DestinationKey =
  | "DROM_GUADELOUPE"
  | "DROM_MARTINIQUE"
  | "DROM_REUNION"
  | "DROM_GUYANE"
  | "DROM_MAYOTTE"
  | "UE"
  | "HORS_UE"
  | "UNKNOWN";

type Sections = {
  regulatory_basics: string[];
  vat_tax_basics: string[];
  transport_customs_basics: string[];
  invoicing_required_mentions: string[];
  documents_checklist: string[];
  distribution_notes: string[];
  risks_and_pitfalls: string[];
  watch_regulatory: string[];
  watch_competitive: string[];
  next_steps: string[];
};

type AssistantResponse = {
  ok: boolean;
  mode: "openai" | "fallback";
  destination: DestinationKey;
  destination_confidence: number;
  summary: string;
  sections: Sections;
  questions: string[];
  actionsSuggested?: string[];
  detail?: string;
};

const WHITELIST = new Set<string>([
  "https://export-navigator-orli.vercel.app",
  "https://export-navigator-phi.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null) {
  const allowOrigin =
    origin && WHITELIST.has(origin)
      ? origin
      : "https://export-navigator-orli.vercel.app";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

function detectDestination(text: string): { key: DestinationKey; confidence: number } {
  const t = text.toLowerCase();
  const match = (pattern: RegExp) => pattern.test(t);

  const dromGuad = /(guadeloupe|pointe[- ]?a[- ]?pitre|basse[- ]?terre|\b971\b|\bgpe\b)/;
  const dromMart = /(martinique|fort[- ]?de[- ]?france|\b972\b|\bmtq\b)/;
  const dromReu = /(réunion|reunion|saint[- ]?denis|\b974\b|\breu\b)/;
  const dromGuy = /(guyane|cayenne|\b973\b|\bguf\b)/;
  const dromMay = /(mayotte|mamoudzou|\b976\b|\bmyt\b)/;

  if (match(dromGuad)) return { key: "DROM_GUADELOUPE", confidence: 0.9 };
  if (match(dromMart)) return { key: "DROM_MARTINIQUE", confidence: 0.9 };
  if (match(dromReu)) return { key: "DROM_REUNION", confidence: 0.9 };
  if (match(dromGuy)) return { key: "DROM_GUYANE", confidence: 0.9 };
  if (match(dromMay)) return { key: "DROM_MAYOTTE", confidence: 0.9 };

  const ue = /(ue\b|union européenne|europe|france|allemagne|espagne|italie|belgique|pays[- ]?bas|luxembourg|portugal|autriche|irlande|finlande|su[eè]de|danemark|pologne|tch[eè]que|slovaquie|hongrie|roumanie|bulgarie|croatie|slov[eé]nie|lituanie|lettonie|estonie|gr[eè]ce|chypre|malte)/;
  const horsUe = /(suisse|uk\b|royaume[- ]?uni|norv[eè]ge|islande|usa|états[- ]?unis|canada|maroc|tunisie|alg[eé]rie|turquie|arabie|emirats|chine|japon|cor[eé]e|singapour|australie|br[eé]sil|mexique)/;

  if (match(horsUe)) return { key: "HORS_UE", confidence: 0.75 };
  if (match(ue)) return { key: "UE", confidence: 0.7 };

  return { key: "UNKNOWN", confidence: 0.4 };
}

function kbForDestination(destination: DestinationKey) {
  const commonRegulatory = [
    "Dispositifs médicaux Classe I : vérifier statut, UDI/étiquetage, IFU/notice, langue, exigences importateur/distributeur.",
    "Toujours vérifier exigences locales (autorité sanitaire, enregistrement/notification, obligations post-market).",
    "Vérifier mentions fabricant, adresse, lot, référence, conditions stockage, pictogrammes.",
  ];

  const commonDocs = [
    "Facture commerciale + packing list",
    "Incoterm clair (DAP/DDP/EXW etc.)",
    "Preuve d’expédition (CMR/BL/AWB)",
    "Déclaration origine si nécessaire",
    "Certificat conformité / déclaration UE selon cas",
  ];

  const commonTransport = [
    "Choisir incoterm + responsabilité (assurance, dédouanement, TVA)",
    "Vérifier HS code, valeur en douane, origine",
    "Transitaire : vérifier formalités export + import",
  ];

  const commonRisks = [
    "Mauvais HS code → taxes/retards",
    "Mentions facture incomplètes → blocage douane",
    "Langue/étiquetage non conformes → refus mise sur marché",
    "Incoterm mal choisi → surcoûts TVA/droits",
  ];

  const commonWatchReg = [
    "Suivre évolutions MDR/IVDR, exigences import/export",
    "Surveiller contraintes douanières (sanctions, restrictions, documents)",
  ];

  const commonWatchComp = [
    "Prix concurrents / marketplaces",
    "Distributeurs locaux / appels d’offres",
    "Tendances remboursement / circuits distribution",
  ];

  const base = {
    regulatory_basics: commonRegulatory,
    vat_tax_basics: [
      "TVA / droits : dépend destination + incoterm + statut importateur. Ne pas figer un taux sans vérification.",
      "Si DDP : risque d’immatriculation TVA locale / représentant fiscal selon pays.",
      "À valider avec transitaire / fiscaliste / RA qualité selon cas",
    ],
    transport_customs_basics: commonTransport,
    documents_checklist: commonDocs,
    distribution_notes: [
      "Identifier importateur/distributeur et leurs obligations (traçabilité, vigilance).",
      "Contrat distribution : responsabilités (réclamations, vigilance, stockage).",
    ],
    risks_and_pitfalls: commonRisks,
    watch_regulatory: commonWatchReg,
    watch_competitive: commonWatchComp,
  };

  if (destination.startsWith("DROM_")) {
    return {
      ...base,
      vat_tax_basics: [
        "DROM : règles spécifiques TVA/octroi de mer possibles selon territoire et flux.",
        "Vérifier exonérations / justificatifs d’export / preuve d’expédition.",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "DROM : anticiper délais, contraintes transport, preuve livraison.",
        "Vérifier formalités spécifiques (octroi de mer / documents).",
        ...commonTransport,
      ],
    };
  }

  if (destination === "UE") {
    return {
      ...base,
      vat_tax_basics: [
        "UE : livraisons intracommunautaires / acquisitions : règles TVA selon statut client + preuve transport.",
        "Vérifier numéro TVA intracom et mentions facture (autoliquidation le cas échéant).",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "UE : pas de dédouanement, mais preuve expédition + conformité MDR (langue, étiquetage).",
        ...commonTransport,
      ],
    };
  }

  if (destination === "HORS_UE") {
    return {
      ...base,
      vat_tax_basics: [
        "Hors UE : export généralement exonéré côté vendeur (si preuve export). Import taxes/droits côté pays destination.",
        "DDP hors UE : attention immatriculation TVA locale / IOR (Importer of Record).",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "Hors UE : dédouanement export + import, documents et éventuels contrôles.",
        ...commonTransport,
      ],
    };
  }

  return base;
}

function buildInvoiceChecklist(destination: DestinationKey): string[] {
  const base = [
    "Coordonnées vendeur/acheteur, adresses complètes",
    "Numéro et date facture",
    "Description produit (référence, lot si applicable), quantité",
    "Valeur unitaire et totale, devise",
    "Incoterm + lieu (ex: DAP Fort-de-France)",
    "Conditions de paiement",
  ];

  if (destination === "UE") {
    return [
      ...base,
      "N° TVA intracom du client (si applicable)",
      "Mention TVA intracom / autoliquidation si applicable",
      "Preuve de transport intracom",
    ];
  }

  if (destination.startsWith("DROM_")) {
    return [
      ...base,
      "Mention export/DROM selon procédure interne",
      "Justificatifs pour exonération si applicable",
      "À valider avec transitaire / fiscaliste / RA qualité selon cas",
    ];
  }

  if (destination === "HORS_UE") {
    return [
      ...base,
      "HS code recommandé sur facture (si possible)",
      "Pays d’origine des marchandises",
      "Conditions d’export (exonération TVA si preuve export)",
      "À valider avec transitaire / fiscaliste / RA qualité selon cas",
    ];
  }

  return base;
}

function buildCompetitiveQueries(destination: DestinationKey): string[] {
  switch (destination) {
    case "UE":
      return [
        "distributeur dispositifs médicaux orthèses prix UE",
        "tendances marketplace orthèses Europe",
        "concurrents ORLIMAN orthèses UE",
      ];
    case "HORS_UE":
      return [
        "distributeur dispositifs médicaux orthèses import",
        "exigences importateur dispositifs médicaux pays cible",
        "concurrents orthèses prix pays cible",
      ];
    default:
      return [
        "octroi de mer orthèses DROM",
        "distributeur orthèses Martinique Guadeloupe Réunion",
        "concurrents orthèses DROM",
      ];
  }
}

function buildQuestions(
  destination: DestinationKey,
  context: Record<string, unknown> | undefined,
  message: string
): string[] {
  const qs: string[] = [];

  qs.push("Quelle destination exacte (pays/île/ville) et quel incoterm souhaitez-vous (DAP ou DDP) ?");
  qs.push("Avez-vous le HS code et l’origine (UE/non UE) des produits ?");
  qs.push("Le client est-il un professionnel (B2B) avec n° TVA / importateur identifié ?");

  // Ajustements légers selon destination
  if (destination.startsWith("DROM_")) {
    qs.push("Souhaitez-vous gérer l’octroi de mer / formalités locales via transitaire ?");
  } else if (destination === "UE") {
    qs.push("Disposez-vous de preuves de transport pour l’exonération / régime TVA intracom ?");
  } else if (destination === "HORS_UE") {
    qs.push("Qui est l’Importer of Record (IOR) et qui paye droits/taxes à l’import ?");
  }

  // Si contexte manque, demander infos
  if (!context || Object.keys(context).length === 0) {
    qs.push("Pouvez-vous préciser le type de produit (référence, classe DM, notice/étiquetage existants) ?");
  }

  // Eviter trop de questions
  return qs.slice(0, 6);
}

function buildFallback(message: string, context: Record<string, unknown> | undefined): AssistantResponse {
  const { key, confidence } = detectDestination(message || "");
  const kb = kbForDestination(key);

  return {
    ok: true,
    mode: "fallback",
    destination: key,
    destination_confidence: confidence,
    summary:
      "Mode fallback : je te propose une checklist opérationnelle (destination détectée automatiquement).",
    sections: {
      regulatory_basics: kb.regulatory_basics,
      vat_tax_basics: kb.vat_tax_basics,
      transport_customs_basics: kb.transport_customs_basics,
      invoicing_required_mentions: buildInvoiceChecklist(key),
      documents_checklist: kb.documents_checklist,
      distribution_notes: kb.distribution_notes,
      risks_and_pitfalls: kb.risks_and_pitfalls,
      watch_regulatory: kb.watch_regulatory,
      watch_competitive: [...kb.watch_competitive, ...buildCompetitiveQueries(key)].slice(0, 12),
      next_steps: [
        "Confirmer destination et incoterm (DAP vs DDP)",
        "Valider HS code + origine pour calcul taxes",
        "Compléter mentions facture et docs (facture, packing list, preuve expédition)",
        "Vérifier exigences réglementaires/langues (MDR/Swissmedic, IFU locales)",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
    },
    questions: buildQuestions(key, context, message),
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // ✅ Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers,
      });
    }

    const { message, context }: AssistantRequest = await req.json().catch(() => ({}));
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers,
      });
    }

    const { key: destination, confidence } = detectDestination(message);
    const kb = kbForDestination(destination);
    const invoice = buildInvoiceChecklist(destination);
    const questions = buildQuestions(destination, context, message);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      const fb = buildFallback(message, context);
      fb.detail = "OPENAI_API_KEY manquant : fallback utilisé";
      return new Response(JSON.stringify(fb), { status: 200, headers });
    }

    const prompt = [
      "Tu es un assistant Export (DROM/UE/Hors UE) pour dispositifs médicaux Classe I (ORLIMAN).",
      "Réponds en bullet points, sections exigées : regulatory_basics, vat_tax_basics, transport_customs_basics, invoicing_required_mentions, documents_checklist, distribution_notes, risks_and_pitfalls, watch_regulatory, watch_competitive, next_steps.",
      "Inclure un summary, destination détectée, et jusqu’à 3 questions si info critique manque.",
      "Ne donne pas de taux exacts si incertains, parle en 'taux variables', propose vérification. Ton opérationnel.",
      `Destination détectée: ${destination} (confiance ${confidence}).`,
      `Contexte: ${JSON.stringify(context || {}, null, 2)}`,
      `Question: ${message}`,
      "Toujours ajouter : 'À valider avec transitaire / fiscaliste / RA qualité selon cas' pour les points fiscaux/douaniers/réglementaires.",
    ].join("\n");

    const body = {
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Assistant export DROM/UE/Hors UE, dispositifs médicaux Classe I. Réponses structurées, opérationnelles, bullet points.",
        },
        { role: "user", content: prompt },
      ],
    };

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!completion.ok) {
      const errText = await completion.text();
      const fb = buildFallback(message, context);
      fb.detail = `OpenAI error ${completion.status}: ${errText}`;
      return new Response(JSON.stringify(fb), { status: 200, headers });
    }

    const data = await completion.json();
    const answer: string = data.choices?.[0]?.message?.content ?? "";

    const sections: Sections = {
      regulatory_basics: kb.regulatory_basics,
      vat_tax_basics: kb.vat_tax_basics,
      transport_customs_basics: kb.transport_customs_basics,
      invoicing_required_mentions: invoice,
      documents_checklist: kb.documents_checklist,
      distribution_notes: kb.distribution_notes,
      risks_and_pitfalls: kb.risks_and_pitfalls,
      watch_regulatory: kb.watch_regulatory,
      watch_competitive: [...kb.watch_competitive, ...buildCompetitiveQueries(destination)].slice(0, 12),
      next_steps: [
        "Confirmer destination et incoterm (DAP vs DDP)",
        "Valider HS code + origine pour calcul taxes",
        "Compléter mentions facture et docs (facture, packing list, preuve expédition)",
        "Vérifier exigences réglementaires/langues (MDR/Swissmedic, IFU locales)",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
    };

    const response: AssistantResponse = {
      ok: true,
      mode: "openai",
      destination,
      destination_confidence: confidence,
      summary: answer || "Réponse IA",
      sections,
      questions,
    };

    return new Response(JSON.stringify(response), { status: 200, headers });
  } catch (error) {
    const fb = buildFallback("", {});
    fb.detail = `Server error: ${String(error)}`;
    return new Response(JSON.stringify(fb), { status: 500, headers });
  }
});
