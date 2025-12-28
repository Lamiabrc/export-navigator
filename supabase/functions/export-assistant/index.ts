import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type AssistantRequest = {
  message?: string;
  context?: Record<string, unknown>;
};

type AssistantResponse = {
  ok: boolean;
  mode: "openai" | "fallback";
  destination: string;
  summary: string;
  next_steps: string[];
  regulatory_basics: string[];
  invoicing_export_basics: string[];
  distribution_notes: string[];
  watchlist_queries: string[];
  actionsSuggested?: string[];
  citations?: string[];
  error?: string;
  detail?: string;
};

const ALLOWED_ORIGINS = new Set<string>([
  "https://export-navigator-phi.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://export-navigator-phi.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

const DESTINATION_KB: Record<
  string,
  {
    regulatory_basics: string[];
    labeling_languages: string[];
    logistics_customs_tax: string[];
    invoicing_required_mentions: string[];
    distribution_notes: string[];
    risks_and_pitfalls: string[];
  }
> = {
  DROM: {
    regulatory_basics: [
      "Dispositifs médicaux Classe I : marquage CE/MDR, traçabilité, IFU en français.",
      "Expédition vers Outre-mer : formalités transport + régime fiscal spécifique (octroi de mer / TVA locale potentielle).",
      "Toujours valider avec transitaire + fiscaliste pour la taxation locale.",
    ],
    labeling_languages: ["Français obligatoire"],
    logistics_customs_tax: [
      "HS code requis pour OM/OMR + douane éventuelle.",
      "Incoterm et mode transport à préciser sur la facture.",
      "EORI si flux export, poids/colis pour transporteurs.",
    ],
    invoicing_required_mentions: [
      "Vendeur/acheteur + adresses, SIRET/VAT/EORI si applicable.",
      "Numéro facture, date, devise, quantités, références, description produit.",
      "HS code (si connu), pays d’origine, poids/colis, incoterm, mode transport.",
      "Mention TVA/Taxation selon régime Outre-mer (à confirmer avec transitaire).",
    ],
    distribution_notes: [
      "Pharmacies, orthopédistes, distributeurs locaux, établissements de santé, marketplaces locales.",
    ],
    risks_and_pitfalls: [
      "HS manquant → OM/OMR incorrect.",
      "Incoterm flou → qui paie transport/taxes.",
      "Documentation manquante (IFU FR, traçabilité).",
    ],
  },
  BELGIQUE: {
    regulatory_basics: [
      "UE : MDR, marquage CE, UDI si applicable. Pas d’AR supplémentaire pour fabricant UE.",
      "Surveille PMS/PMCF selon classe.",
    ],
    labeling_languages: ["Français", "Néerlandais (recommandé)", "Allemand (si pertinent)"],
    logistics_customs_tax: [
      "Intra-UE : pas de douane, mais besoin de VAT intracom pour B2B.",
      "Incoterm/mode transport pour clarifier le payeur.",
    ],
    invoicing_required_mentions: [
      "Numéro TVA intracom (vendeur/acheteur), incoterm, mode transport, origine, HS si dispo.",
      "Numéro facture, date, devise, quantités, références, description produit.",
    ],
    distribution_notes: ["Pharmacies, orthopédistes, hôpitaux, distributeurs Benelux."],
    risks_and_pitfalls: [
      "Langues d’étiquetage non conformes (FR+NL).",
      "TVA intracom non indiquée en B2B.",
    ],
  },
  SUISSE: {
    regulatory_basics: [
      "Hors UE : importer via importateur CH, vérifier Swissmedic/exigences locales.",
      "Traçabilité/étiquetage adaptés, équivalents MDR à vérifier.",
    ],
    labeling_languages: ["Allemand", "Français", "Italien (selon régions)"],
    logistics_customs_tax: [
      "Export hors UE : incoterm, douane, origine, HS code requis.",
      "Conseiller appui transitaire + importateur CH pour droits/taxes.",
    ],
    invoicing_required_mentions: [
      "Incoterm + mode transport, origine, HS code, poids/colis.",
      "Coordonnées vendeurs/acheteurs, TVA si besoin, numéro facture/date/devise/quantités.",
    ],
    distribution_notes: ["Pharmacies, orthopédistes, distributeurs CH, hôpitaux."],
    risks_and_pitfalls: [
      "Importateur CH manquant.",
      "Langues d’étiquetage limitées.",
      "Droits/taxes non anticipés.",
    ],
  },
  UE_AUTRE: {
    regulatory_basics: ["MDR + marquage CE, UDI si applicable.", "Pas d’AR supplémentaire pour fabricant UE."],
    labeling_languages: ["Langue locale du pays (ex: ES, IT, DE, PT, NL...)."],
    logistics_customs_tax: ["Intra-UE : pas de douane, mention TVA intracom B2B.", "Incoterm/mode transport à préciser."],
    invoicing_required_mentions: [
      "TVA intracom (vendeur/acheteur) pour B2B.",
      "Numéro facture, date, devise, quantités, références, description produit.",
      "Incoterm, mode transport, origine, HS code si dispo.",
    ],
    distribution_notes: ["Pharmacies, orthopédistes, hôpitaux, distributeurs locaux."],
    risks_and_pitfalls: ["Langue d’étiquetage manquante", "TVA intracom non indiquée", "Incoterm flou"],
  },
  INCONNU: {
    regulatory_basics: ["Destination inconnue : valider MDR/étiquetage, vérifier exigences locales."],
    labeling_languages: ["Langue locale du pays cible."],
    logistics_customs_tax: ["Incoterm/mode transport/HS code nécessaires pour douane/taxes."],
    invoicing_required_mentions: ["Mentions facture export standard : incoterm, origine, HS, poids/colis, références."],
    distribution_notes: ["Identifier distributeurs locaux (pharmacies, orthopédistes, hôpitaux)."],
    risks_and_pitfalls: ["Données insuffisantes pour calculs de taxes et mentions légales."],
  },
};

function detectDestination(text: string): string {
  const t = text.toLowerCase();
  if (/guadeloupe/.test(t)) return "DROM_GUADELOUPE";
  if (/martinique/.test(t)) return "DROM_MARTINIQUE";
  if (/réunion|reunion/.test(t)) return "DROM_REUNION";
  if (/guyane/.test(t)) return "DROM_GUYANE";
  if (/mayotte/.test(t)) return "DROM_MAYOTTE";
  if (/drom|dom ?tom|outre[- ]?mer/.test(t)) return "DROM";
  if (/belgique|belgium|be\b/.test(t)) return "BELGIQUE";
  if (/suisse|switzerland|ch\b/.test(t)) return "SUISSE";
  if (
    /(espagne|spain|portugal|italie|italy|allemagne|germany|pays-bas|netherlands|hollande|luxembourg|autriche|austria|ireland|irlande)/.test(
      t,
    )
  )
    return "UE_AUTRE";
  return "INCONNU";
}

function buildInvoiceChecklist(destinationKey: string): string[] {
  const common = [
    "Coordonnées vendeur/acheteur, adresses complètes",
    "Numéro facture, date, devise, quantités, références produit",
    "Description produit, prix unitaire, total HT",
    "Incoterm + lieu, mode de transport",
    "Pays d’origine, HS code si connu",
    "Poids/colis, conditions de paiement, assurance",
    "Numéro de lot/traçabilité si applicable",
  ];

  if (destinationKey.startsWith("DROM")) {
    return [...common, "Mention régime fiscal Outre-mer (OM/OMR/TVA à confirmer avec transitaire)"];
  }
  if (destinationKey === "BELGIQUE" || destinationKey === "UE_AUTRE") {
    return [...common, "TVA intracom (vendeur/acheteur) pour B2B"];
  }
  if (destinationKey === "SUISSE") {
    return [...common, "Export hors UE : douane + origine, incoterm, HS code, appui transitaire/importateur CH"];
  }
  return common;
}

function buildWatchlistQueries(destinationKey: string): string[] {
  return [
    "reglementation MDR dispositifs medicaux classe I pays " + destinationKey,
    "douane export dispositif medical HS code orthese " + destinationKey,
    "remboursement orthese attelle " + destinationKey,
    "concurrents orthese attelle medicale " + destinationKey,
    "distributeur medical orthopedie " + destinationKey,
    "prix orthese attelle e-commerce " + destinationKey,
    "transitaire medical " + destinationKey + " incoterm DAP DDP",
    "Swissmedic import dispositif medical" + (destinationKey === "SUISSE" ? "" : ""),
  ];
}

function fallbackResponse(message: string, context: any): AssistantResponse {
  const destinationKey = detectDestination(`${message} ${JSON.stringify(context || {})}`);
  const kb = DESTINATION_KB[destinationKey.startsWith("DROM") ? "DROM" : destinationKey] ?? DESTINATION_KB.INCONNU;

  return {
    ok: true,
    mode: "fallback",
    destination: destinationKey,
    summary: "Réponse générique (mode sans OpenAI) pour dispositif médical Classe I Orliman.",
    next_steps: [
      "Vérifier HS code et incoterm choisis",
      "Compléter les mentions facture (incoterm, origine, HS, poids/colis)",
      "Valider exigences réglementaires locales (langues, importateur le cas échéant)",
      "Consulter transitaire/fiscaliste pour taxes et OM/OMR/TVA",
    ],
    regulatory_basics: kb.regulatory_basics,
    invoicing_export_basics: buildInvoiceChecklist(destinationKey.startsWith("DROM") ? "DROM" : destinationKey),
    distribution_notes: kb.distribution_notes,
    watchlist_queries: buildWatchlistQueries(destinationKey),
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  // Préflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
    }

    const { message, context }: AssistantRequest = await req.json().catch(() => ({}));
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), { status: 400, headers });
    }

    const destinationKey = detectDestination(`${message} ${JSON.stringify(context || {})}`);
    const kb = DESTINATION_KB[destinationKey.startsWith("DROM") ? "DROM" : destinationKey] ?? DESTINATION_KB.INCONNU;

    // Si pas de clé OpenAI -> fallback immédiat
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      const fb = fallbackResponse(message, context);
      fb.detail = "OPENAI_API_KEY manquant : fallback utilisé";
      return new Response(JSON.stringify(fb), { status: 200, headers });
    }

    const prompt = [
      "Tu es un assistant Export (DROM/UE/Hors UE) pour Orliman, dispositifs médicaux Classe I.",
      "Réponds en français, style opérationnel, concis.",
      "Propose HS code, incoterm, check-list docs, vigilance TVA/OM/OMR sans inventer de taux.",
      "Inclure : summary, next_steps (liste), regulatory_basics, invoicing_export_basics, distribution_notes, watchlist_queries.",
      `Destination détectée: ${destinationKey}.`,
      `Contexte: ${JSON.stringify(context || {}, null, 2)}`,
      `Question: ${message}`,
    ].join("\n");

    const body = {
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "Assistant export DROM/UE/Hors UE pour contrôle facture et veille. Ne divulgue jamais de clés." },
        { role: "user", content: prompt },
      ],
    };

    const completion = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!completion.ok) {
      const errText = await completion.text();
      const fb = fallbackResponse(message, context);
      fb.detail = `OpenAI error ${completion.status}: ${errText}`;
      return new Response(JSON.stringify(fb), { status: 200, headers });
    }

    const data = await completion.json();
    const answer: string = data.choices?.[0]?.message?.content ?? "";

    const response: AssistantResponse = {
      ok: true,
      mode: "openai",
      destination: destinationKey,
      summary: answer || "Réponse IA",
      next_steps: [
        "Valider HS code et incoterm",
        "Compléter mentions facture (origine, HS, poids/colis, incoterm, mode transport)",
        "Vérifier exigences réglementaires locales (langues, importateur si hors UE)",
      ],
      regulatory_basics: kb.regulatory_basics,
      invoicing_export_basics: buildInvoiceChecklist(destinationKey.startsWith("DROM") ? "DROM" : destinationKey),
      distribution_notes: kb.distribution_notes,
      watchlist_queries: buildWatchlistQueries(destinationKey),
      actionsSuggested: [],
      citations: [],
    };

    return new Response(JSON.stringify(response), { status: 200, headers });
  } catch (e) {
    const fb = fallbackResponse("", {});
    fb.detail = `Server error: ${String(e)}`;
    return new Response(JSON.stringify(fb), { status: 500, headers });
  }
});
