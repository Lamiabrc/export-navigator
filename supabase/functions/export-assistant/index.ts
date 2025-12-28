import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type AssistantRequest = {
  message?: string;
  context?: Record<string, unknown>;
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
  citations?: string[];
  error?: string;
  detail?: string;
};

type DestinationKey =
  | "DROM_GUADELOUPE"
  | "DROM_MARTINIQUE"
  | "DROM_REUNION"
  | "DROM_GUYANE"
  | "DROM_MAYOTTE"
  | "BELGIQUE"
  | "SUISSE"
  | "UE_AUTRE"
  | "INCONNU";

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

const WHITELIST = new Set<string>([
  "https://export-navigator-phi.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && WHITELIST.has(origin) ? origin : "https://export-navigator-phi.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (match(/belgique|belgium|bruxelles|\bbe\b/)) return { key: "BELGIQUE", confidence: 0.8 };
  if (match(/suisse|switzerland|geneve|lausanne|zurich|\bch\b/)) return { key: "SUISSE", confidence: 0.8 };
  if (
    match(
      /(allemagne|germany|espagne|spain|italie|italy|pays[- ]bas|netherlands|hollande|luxembourg|portugal|autriche|austria|irlande|ireland|pologne|poland)/,
    )
  )
    return { key: "UE_AUTRE", confidence: 0.6 };
  if (match(/drom|dom[- ]?tom|outre[- ]?mer/)) return { key: "UE_AUTRE", confidence: 0.5 };

  return { key: "INCONNU", confidence: 0.2 };
}

type KBEntry = {
  regulatory_basics: string[];
  vat_tax_basics: string[];
  transport_customs_basics: string[];
  invoicing_required_mentions: string[];
  documents_checklist: string[];
  distribution_notes: string[];
  risks_and_pitfalls: string[];
  watch_regulatory: string[];
  watch_competitive: string[];
};

const KB_DROM: KBEntry = {
  regulatory_basics: [
    "DM Classe I : marquage CE/MDR, doc technique, PMS, traçabilité lot, IFU FR.",
    "DROM hors territoire TVA UE : règles spécifiques export.",
  ],
  vat_tax_basics: [
    "Expédition métropole -> DROM assimilée export : TVA métropole généralement exonérée (preuve expédition).",
    "Import DROM : TVA locale possible (ex: info publique 8,5% Guadeloupe/Martinique/Réunion), Guyane/Mayotte : TVA indiquée comme temporairement non applicable dans sources publiques.",
    "Octroi de mer + octroi de mer régional : taux variables par département/produit (peuvent être élevés).",
    "À valider avec transitaire / fiscaliste / RA qualité selon cas.",
  ],
  transport_customs_basics: [
    "Incoterm DAP (client paie taxes à l’arrivée) ou DDP (vendeur paie, plus complexe).",
    "Formalités export + déclaration douane import DROM avec HS code.",
    "Prévoir délais aériens/maritimes, SAV/retours coûteux, stock tampon.",
  ],
  invoicing_required_mentions: [
    "Vendeur/acheteur, adresses, SIRET/VAT/EORI si applicables.",
    "Numéro/date facture, devise, références produits, description claire (DM Classe I), quantités, PU, total.",
    "Incoterm + lieu, mode transport, nb colis, poids brut/net.",
    "Origine, HS code si connu, valeur/assurance.",
    "Mention expédition export métropole (TVA exonérée) + avertissement taxes locales DOM (OM/TVA) selon incoterm.",
  ],
  documents_checklist: [
    "Facture commerciale, packing list, preuve d’expédition/export.",
    "Déclaration douane import DROM avec HS code.",
    "IFU FR, traçabilité lots/UDI si applicable.",
  ],
  distribution_notes: [
    "Pharmacies, orthopédistes, magasins matériel médical, cliniques/hôpitaux, distributeurs locaux, e-commerce.",
  ],
  risks_and_pitfalls: [
    "HS/OM manquants → taxation surprise.",
    "Incoterm flou (DAP vs DDP) → qui paie taxes.",
    "Délais transport et retours SAV coûteux.",
  ],
  watch_regulatory: [
    "octroi de mer taux Guadeloupe orthèses dispositifs médicaux",
    "octroi de mer taux Martinique orthèses dispositifs médicaux",
    "TVA DOM expédition métropole exonération facture mention",
    "dédouanement DROM incoterm DAP DDP dispositifs médicaux",
    "IFU français dispositifs médicaux DROM exigences",
  ],
  watch_competitive: [
    "marché orthopédie pharmacie Guadeloupe distributeur matériel médical",
    "prix attelle genou articulée Guadeloupe",
    "attelles genou concurrence Martinique orthèses",
    "ORLIMAN concurrents attelles minerves Réunion",
    "appel d’offres orthopédie hôpital DROM",
  ],
};

const KB_BELGIQUE: KBEntry = {
  regulatory_basics: [
    "UE : MDR CE, obligations opérateurs (distributeur/importateur).",
    "Étiquetage/IFU : FR + NL recommandés (DE selon zone).",
  ],
  vat_tax_basics: [
    "B2B intra-UE : TVA intracom selon n° TVA client (autoliquidation/HT possible).",
    "B2C : TVA selon règles vente à distance/OSS si applicable.",
    "À valider avec transitaire / fiscaliste / RA qualité selon cas.",
  ],
  transport_customs_basics: [
    "Pas de douane intra-UE, mais incoterm/conditions de livraison indispensables.",
    "Preuves de livraison/conformité transport.",
  ],
  invoicing_required_mentions: [
    "Coordonnées vendeur/acheteur, n° TVA intracom (B2B), date/numéro facture, devise.",
    "Références/description produit (ex: orthèse genou Classe I), quantités, PU, total.",
    "Incoterm + lieu, mode transport, nb colis/poids, origine, HS si connu.",
  ],
  documents_checklist: [
    "Facture, preuve livraison, éventuellement attestation TVA intracom (B2B), IFU multilingue (FR/NL).",
  ],
  distribution_notes: ["Distributeurs Benelux, pharmacies, orthopédistes, hôpitaux, e-commerce."],
  risks_and_pitfalls: ["Langues (NL), pression prix, concurrence locale."],
  watch_regulatory: [
    "étiquetage dispositif médical FR NL Belgique",
    "MDR vigilance Belgique distributeur importateur",
    "UDI dispositifs médicaux Belgique",
  ],
  watch_competitive: [
    "distributeur orthopédie Belgique attelles",
    "prix attelle genou articulée Belgique",
    "orthèses genou concurrence Belgique",
    "ORLIMAN concurrents attelles Benelux",
    "pharmacie orthopédie Belgique marché",
  ],
};

const KB_SUISSE: KBEntry = {
  regulatory_basics: [
    "Suisse (hors UE) : MedDO/Swissmedic. Rôles: importateur CH, CH-REP (mandataire) pour fabricants étrangers selon cas.",
    "Enregistrement opérateurs (CHRN), traçabilité/UDI selon catégorie, surveillance marché.",
  ],
  vat_tax_basics: [
    "Export hors UE : déclaration export + import CH, taxes import selon règles CH.",
    "Incoterm critique (DAP vs DDP).",
    "À valider avec transitaire / fiscaliste / RA qualité selon cas.",
  ],
  transport_customs_basics: [
    "Dédouanement import CH : HS code, valeur, origine, incoterm, transport.",
    "Coordination avec importateur CH pour obligations/notifications.",
  ],
  invoicing_required_mentions: [
    "Coordonnées vendeur/acheteur, date/numéro facture, devise.",
    "Description produit (DM Classe I), quantités, PU, total.",
    "Incoterm + lieu, mode transport, nb colis/poids, origine, HS code, assurance.",
    "Mention : taxes/droits à l’import CH (selon incoterm).",
  ],
  documents_checklist: [
    "Facture commerciale, packing list, déclaration export, documents import CH (via transitaire/importateur).",
    "IFU multilingue (FR/DE/IT selon zone), traçabilité lot/UDI si applicable.",
  ],
  distribution_notes: [
    "Importateur/distributeur suisse, réseaux spécialisés, pharmacies, hôpitaux, e-commerce.",
  ],
  risks_and_pitfalls: ["Dépendance importateur, règles CH évolutives, coûts conformité/retours."],
  watch_regulatory: [
    "Swissmedic CH-REP importer obligations MedDO",
    "CHRN registration importer medical devices",
    "Swissmedic vigilance dispositifs médicaux",
  ],
  watch_competitive: [
    "marché orthopédie Suisse distributeur",
    "prix attelle genou Suisse",
    "concurrence orthèses Suisse",
    "ORLIMAN concurrents Suisse attelles",
    "hôpitaux Suisse appel d’offres orthopédie",
  ],
};

const KB_UE_AUTRE: KBEntry = {
  regulatory_basics: [
    "MDR + CE, obligations opérateurs, vigilance/traçabilité.",
    "Langue locale pour étiquetage/IFU.",
  ],
  vat_tax_basics: [
    "TVA intra-UE selon B2B/B2C, règles de vente à distance/OSS si B2C.",
    "À valider avec transitaire / fiscaliste / RA qualité selon cas.",
  ],
  transport_customs_basics: [
    "Pas de douane intra-UE, mais incoterm/livraison et preuve transport.",
  ],
  invoicing_required_mentions: [
    "Coordonnées vendeur/acheteur, n° TVA intracom (B2B), date/numéro facture, devise.",
    "Description produit, quantités, PU, total, incoterm/lieu, transport, origine, HS si connu.",
  ],
  documents_checklist: [
    "Facture, preuve livraison, TVA intracom (B2B), IFU langue locale.",
  ],
  distribution_notes: ["Distributeurs locaux, pharmacies, orthopédistes, hôpitaux, e-commerce."],
  risks_and_pitfalls: ["Langue locale, TVA intracom, incoterm flou."],
  watch_regulatory: [
    "étiquetage dispositif médical langue locale",
    "MDR obligations distributeur importateur UE",
    "UDI dispositif médical UE",
  ],
  watch_competitive: [
    "prix attelle genou [pays]",
    "distributeur orthopédie [pays]",
    "orthèses concurrence [pays]",
    "ORLIMAN concurrents attelles [pays]",
    "appel d’offres orthopédie [pays]",
  ],
};

const KB_INCONNU: KBEntry = {
  regulatory_basics: ["Destination inconnue : appliquer MDR/étiquetage langue locale, vérifier exigences pays."],
  vat_tax_basics: ["Vérifier régime TVA/douane du pays. À valider avec transitaire / fiscaliste / RA qualité selon cas."],
  transport_customs_basics: ["Incoterm/mode transport/HS code nécessaires pour douane/taxes."],
  invoicing_required_mentions: [
    "Mentions facture export standard : incoterm, origine, HS, poids/colis, références produit, identifiants vendeur/acheteur.",
  ],
  documents_checklist: ["Facture, packing list, preuves transport, IFU/étiquetage adaptés."],
  distribution_notes: ["Identifier distributeurs locaux (pharmacies, orthopédistes, hôpitaux)."],
  risks_and_pitfalls: ["Données insuffisantes pour taxes/mentions légales."],
  watch_regulatory: ["réglementation dispositif médical [pays]", "TVA import dispositifs médicaux [pays]"],
  watch_competitive: ["concurrence orthèses [pays]", "distributeur médical [pays]"],
};

function kbForDestination(dest: DestinationKey): KBEntry {
  if (dest.startsWith("DROM")) return KB_DROM;
  if (dest === "BELGIQUE") return KB_BELGIQUE;
  if (dest === "SUISSE") return KB_SUISSE;
  if (dest === "UE_AUTRE") return KB_UE_AUTRE;
  return KB_INCONNU;
}

function buildInvoiceChecklist(dest: DestinationKey): string[] {
  const common = [
    "Vendeur/acheteur + adresses, identifiants (SIRET, TVA intracom, EORI si applicable)",
    "Date + numéro facture + devise",
    "Références produits, description claire (ex: orthèse genou articulée – DM Classe I), quantités, PU, total",
    "Incoterm + lieu, mode transport, nb colis, poids brut/net",
    "Pays d’origine, HS code si connu, valeur, assurance",
    "Conditions de paiement",
    "Traçabilité (lot/UDI si demandé par client/distributeur)",
  ];

  if (dest === "BELGIQUE" || dest === "UE_AUTRE") {
    return [...common, "TVA intracom (B2B) selon n° TVA client, preuve de livraison"];
  }
  if (dest === "SUISSE") {
    return [...common, "Export hors UE : mention douane/import CH, taxes import selon incoterm, importateur CH le cas échéant"];
  }
  if (dest.startsWith("DROM")) {
    return [
      ...common,
      "Mention expédition métropole assimilée export (TVA métropole exonérée) + avertissement taxes locales DOM (OM/TVA) selon incoterm",
    ];
  }
  return common;
}

function buildQuestions(dest: DestinationKey, context: any, message: string): string[] {
  const qs: string[] = [];
  if (dest === "INCONNU") qs.push("Destination précise ?");
  if (!context?.b2b && /facture|tva|prix/i.test(message)) qs.push("Client B2B/B2C ? N° TVA intracom (si UE/B2B) ?");
  if (!context?.incoterm) qs.push("Incoterm souhaité (DAP ou DDP) / qui paie taxes à l’arrivée ?");
  return qs.slice(0, 3);
}

function buildCompetitiveQueries(dest: DestinationKey): string[] {
  const base = [
    "orthèses genou concurrence",
    "distributeur orthopédie",
    "prix attelle genou articulée",
    "ORLIMAN concurrents attelles",
    "appel d’offres orthopédie",
  ];
  return base.map((q) => `${q} ${dest}`);
}

function buildFallback(message: string, context: any): AssistantResponse {
  const { key, confidence } = detectDestination(`${message} ${JSON.stringify(context || {})}`);
  const kb = kbForDestination(key);
  const invoice = buildInvoiceChecklist(key);
  const questions = buildQuestions(key, context, message);

  const sections: Sections = {
    regulatory_basics: kb.regulatory_basics,
    vat_tax_basics: kb.vat_tax_basics,
    transport_customs_basics: kb.transport_customs_basics,
    invoicing_required_mentions: invoice,
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
  };

  return {
    ok: true,
    mode: "fallback",
    destination: key,
    destination_confidence: confidence,
    summary: "Réponse fallback basée sur la base de connaissances interne.",
    sections,
    questions,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

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

    const { key: destination, confidence } = detectDestination(`${message} ${JSON.stringify(context || {})}`);
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
        { role: "system", content: "Assistant export DROM/UE/Hors UE pour contrôle facture et veille, style opérationnel en bullet points." },
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
