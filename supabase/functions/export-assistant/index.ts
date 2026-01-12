import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DestinationKey =
  | "UE"
  | "HORS_UE"
  | "MONACO"
  | "PTOM_NOUVELLE_CALEDONIE"
  | `DROM_${string}`; // ex: DROM_GP, DROM_MQ, DROM_RE...

type AssistantSections = Record<string, string[]>;

type AssistantRequest = {
  question: string;
  destination?: DestinationKey | string | null;
  incoterm?: string | null;
  transport_mode?: string | null;

  client_id?: string | null;
  product_ids?: string[] | null;

  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
    export_zone?: string | null;
    incoterm?: string | null;
  };

  match_count?: number;
  strict_docs_only?: boolean;
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function normalizeStr(s: string) {
  // Uppercase + strip accents
  return s
    .toUpperCase()
    .normalize("NFD")
    // deno-lint-ignore no-control-regex
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeDestination(raw?: string | null): DestinationKey {
  const x = normalizeStr(String(raw ?? ""));

  if (!x) return "HORS_UE";

  // Direct codes
  if (x === "UE" || x.includes("EUROPEENNE") || x.includes("EUROPE") || x.includes("INTRA")) return "UE";
  if (x === "FR" || x.includes("METROPOLE") || x.includes("FRANCE")) return "UE"; // pour simplifier les règles
  if (x.includes("MONACO")) return "MONACO";
  if (x.includes("NOUVELLE") || x.includes("CALEDONIE") || x === "NC") return "PTOM_NOUVELLE_CALEDONIE";

  // Outre-mer (codes)
  const directMap: Record<string, DestinationKey> = {
    GP: "DROM_GP",
    MQ: "DROM_MQ",
    GF: "DROM_GF",
    RE: "DROM_RE",
    YT: "DROM_YT",
    BL: "DROM_BL",
    MF: "DROM_MF",
    SPM: "DROM_SPM",
  };
  if (directMap[x]) return directMap[x];

  // Outre-mer (noms)
  if (x.includes("GUADELOUPE")) return "DROM_GP";
  if (x.includes("MARTINIQUE")) return "DROM_MQ";
  if (x.includes("GUYANE")) return "DROM_GF";
  if (x.includes("REUNION") || x.includes("LA REUNION")) return "DROM_RE";
  if (x.includes("MAYOTTE")) return "DROM_YT";
  if (x.includes("SAINT-BARTHELEMY") || x.includes("ST BART") || x.includes("BARTHELEMY")) return "DROM_BL";
  if (x.includes("SAINT-MARTIN") || x.includes("ST MARTIN")) return "DROM_MF";
  if (x.includes("SAINT-PIERRE") || x.includes("MIQUELON") || x.includes("SPM")) return "DROM_SPM";

  // Mentions génériques
  if (x.startsWith("DROM_")) return x as DestinationKey;
  if (x.includes("DOM") || x.includes("DROM") || x.includes("OUTRE-MER") || x.includes("OUTRE MER")) return "DROM_OUTRE_MER";

  return "HORS_UE";
}

function normalizeIncoterm(raw?: string | null) {
  const v = normalizeStr(String(raw ?? ""));
  if (!v) return null;
  // tolère "DAP - Pointe-à-Pitre"
  const m = v.match(/\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FOB|CFR|CIF)\b/);
  return m?.[1] ?? null;
}

function buildKbSections(destination: DestinationKey) {
  const commonRegulatory = [
    "Dispositifs médicaux : vérifier statut, étiquetage, notice/IFU, langue exigée, traçabilité, vigilance.",
    "Vérifier si un importateur/distributeur local est requis (responsabilités, réclamations, vigilance).",
    "Ne jamais figer une exigence réglementaire sans vérifier la règle locale (autorité + exigences de mise sur le marché).",
  ];

  const commonTransport = [
    "Clarifier Incoterm + lieu (EXW/FCA/DAP/DDP...) : qui paie transport, assurance, taxes/droits, dédouanement ?",
    "Toujours verrouiller HS code + origine + valeur : causes n°1 de blocages/coûts à l’import.",
    "Preuve de transport (AWB/BL/CMR) + packing list propre (poids, volumes, nb colis).",
  ];

  const commonDocs = [
    "Facture commerciale (mentions complètes) + packing list",
    "Document transport (AWB/BL/CMR) + preuve d’expédition/livraison",
    "Origine (si utile) + HS code (au moins en interne)",
    "Certificats/attestations de conformité selon produit et destination",
  ];

  const commonRisks = [
    "Incoterm flou → litiges et surcoûts (transport/taxes/droits)",
    "HS/origine/valeur incohérents → retards, taxes imprévues, contrôles",
    "Documents incomplets → blocage douane/transporteur",
    "Étiquetage/notice non conforme → refus distribution/mise sur le marché",
  ];

  const taxesBase = [
    "Ne pas annoncer de taux fixe sans validation : taxes/droits/TVA varient selon destination, incoterm, statut client, classification.",
    "Point clé : définir l’importateur de référence (IOR) et qui supporte taxes/droits (DAP vs DDP).",
    "En interne : séparer ventes, charges (transport/assurance), OM/OMR, TVA, droits.",
  ];

  const sections: AssistantSections = {
    "Réglementaire – bases": commonRegulatory,
    "Transport & douane – bases": commonTransport,
    "Documents – checklist": commonDocs,
    "Risques fréquents": commonRisks,
    "Prochaines étapes": [
      "Confirmer destination exacte + incoterm + lieu",
      "Valider HS code + origine + valeur + IOR",
      "Préparer pack documentaire (facture/packing/transport/conformité) + preuves",
      "Verrouiller qui paie taxes/droits et qui dédouane (client/transitaire/vous)",
    ],
  };

  if (String(destination).startsWith("DROM_")) {
    sections["Taxes & coûts – focus Outre-mer"] = [
      "Métropole → Outre-mer : sécuriser preuves d’expédition/livraison + traitement fiscal selon cas.",
      "Octroi de mer (OM/OMR) : taxe spécifique Outre-mer, à anticiper (qui paie ? selon incoterm).",
      ...taxesBase,
    ];
    return sections;
  }

  if (destination === "UE") {
    sections["Taxes & coûts – focus UE"] = [
      "UE : pas de dédouanement ; focus TVA intracom (statut client + preuve transport) + conformité/étiquetage/langue.",
      ...taxesBase,
    ];
    return sections;
  }

  if (destination === "MONACO") {
    sections["Taxes & coûts – focus Monaco"] = [
      "Monaco : traitement souvent proche France (à valider selon cas réel : B2B/B2C, lieu livraison, preuves).",
      ...taxesBase,
    ];
    return sections;
  }

  if (destination === "PTOM_NOUVELLE_CALEDONIE") {
    sections["Taxes & coûts – focus Nouvelle-Calédonie"] = [
      "Nouvelle-Calédonie (PTOM) : flux souvent traité comme ‘hors UE’ côté formalités.",
      "Point clé : IOR + taxes/droits à l’arrivée (DAP vs DDP).",
      ...taxesBase,
    ];
    return sections;
  }

  sections["Taxes & coûts – focus Hors UE"] = [
    "Hors UE : export souvent HT si preuve d’export ; taxes/droits payés à l’import selon pays.",
    "DDP hors UE : attention immatriculation/IOR (risque de blocage si non cadré).",
    ...taxesBase,
  ];
  return sections;
}

async function embedQueryOpenAI(apiKey: string, model: string, text: string) {
  // Embeddings endpoint (OpenAI) :contentReference[oaicite:4]{index=4}
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data[0].embedding as number[];
}

async function respondOpenAI_JSON(apiKey: string, model: string, system: string, user: string) {
  // Responses API recommended over Chat Completions :contentReference[oaicite:5]{index=5}
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      // JSON mode (force valid JSON) :contentReference[oaicite:6]{index=6}
      text: { format: { type: "json_object" } },
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  const raw =
    data.output_text ??
    data.output?.map((o: any) => o.content?.map((c: any) => c.text).join("")).join("\n") ??
    "";

  return String(raw || "").trim();
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function truncateContext(chunks: any[], maxChars = 12000) {
  let out = "";
  for (let i = 0; i < chunks.length; i++) {
    const r = chunks[i];
    const block =
      `#${i + 1} ${r.title} (${r.doc_type ?? "doc"}, ${r.published_at ?? "n/a"}) [chunk ${r.chunk_index}]\n` +
      `${String(r.content ?? "")}` +
      `\n`;
    if ((out + "\n---\n" + block).length > maxChars) break;
    out += (out ? "\n---\n" : "") + block;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const EMB_MODEL = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
  const CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-4.1-mini";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { ok: false, error: "Missing supabase env" });

  // ✅ Auth: refuse if no valid JWT
  const token = getBearerToken(req);
  if (!token) return json(401, { ok: false, error: "Missing Authorization Bearer token" });
  if (!SUPABASE_ANON_KEY) return json(500, { ok: false, error: "Missing SUPABASE_ANON_KEY for auth check" });

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !authData?.user) return json(401, { ok: false, error: "Unauthorized" });

  // Service client for DB reads (bypass RLS, so keep auth check above)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const question = (body?.question ?? "").trim();
  if (!question) return json(400, { ok: false, error: "question is required" });

  const destination = normalizeDestination(body.destination ?? null);
  const incoterm = normalizeIncoterm(body.incoterm ?? null);
  const transportMode = (body.transport_mode ?? null)?.toString().trim() || null;

  // Optional DB enrichment
  let client: any = null;
  if (body.client_id) {
    const { data } = await supabase.from("clients").select("*").eq("id", body.client_id).maybeSingle();
    client = data ?? null;
  }

  let products: any[] = [];
  if (body.product_ids?.length) {
    const { data } = await supabase.from("products").select("*").in("id", body.product_ids);
    products = data ?? [];
  }

  const matchCount = body.match_count ?? 8;
  const filter = body.doc_filter ?? {};

  let citations: any[] = [];
  let ragError: string | null = null;

  // RAG
  if (OPENAI_API_KEY) {
    try {
      const queryEmbedding = await embedQueryOpenAI(OPENAI_API_KEY, EMB_MODEL, question);

      const { data: matches, error: mErr } = await supabase.rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        match_count: matchCount,
        filter_doc_type: filter.doc_type ?? null,
        filter_tags: filter.tags ?? null,
        filter_export_zone: filter.export_zone ?? null,
        filter_incoterm: filter.incoterm ?? incoterm ?? null,
      });

      if (mErr) throw new Error(mErr.message);

      const rows = (matches ?? []) as any[];
      const context = truncateContext(rows, 12000);

      if (rows.length && context) {
        const system =
          "Tu es l’assistant Export Navigator.\n" +
          "Règles:\n" +
          "1) Tu réponds UNIQUEMENT à partir des extraits fournis.\n" +
          "2) Si l’info n’est pas dans les extraits, tu dis: \"Je ne trouve pas l’information dans les extraits fournis.\" et tu demandes la pièce manquante.\n" +
          "3) Tu produis une réponse JSON valide avec les clés:\n" +
          "   - answer (string)\n" +
          "   - summary (string)\n" +
          "   - actionsSuggested (string[])\n" +
          "   - questions (string[])\n" +
          "   - sections (object: { titre: string[] })\n" +
          "4) Tu cites les sources dans l’answer sous forme: (Titre #chunk).\n";

        const user =
          `Question:\n${question}\n\n` +
          `Contexte:\n- destination=${destination}\n- incoterm=${incoterm ?? "n/a"}\n- transport_mode=${transportMode ?? "n/a"}\n` +
          (client ? `- client=${client.libelle_client ?? client.id}\n` : "") +
          (products.length ? `- produits=${products.map((p) => p.name ?? p.id).slice(0, 12).join(", ")}\n` : "") +
          `\nExtraits documents:\n${context}\n`;

        const raw = await respondOpenAI_JSON(OPENAI_API_KEY, CHAT_MODEL, system, user);
        const parsed = safeJsonParse(raw);

        citations = rows.map((r) => ({
          document_id: r.document_id,
          title: r.title,
          published_at: r.published_at,
          chunk_index: r.chunk_index,
          similarity: r.similarity,
        }));

        if (parsed?.answer) {
          return json(200, {
            ok: true,
            mode: "docs_rag",
            destination,
            incoterm,
            transport_mode: transportMode,
            answer: String(parsed.answer),
            summary: String(parsed.summary ?? ""),
            actionsSuggested: Array.isArray(parsed.actionsSuggested) ? parsed.actionsSuggested : [],
            questions: Array.isArray(parsed.questions) ? parsed.questions : [],
            sections: parsed.sections && typeof parsed.sections === "object" ? parsed.sections : {},
            citations,
            debug: { ragError: null },
          });
        }

        // fallback if parsing failed
        return json(200, {
          ok: true,
          mode: "docs_rag",
          destination,
          incoterm,
          transport_mode: transportMode,
          answer: raw || "Je ne trouve pas l’information dans les extraits fournis.",
          summary: "",
          actionsSuggested: [],
          questions: [],
          sections: {},
          citations,
          debug: { ragError: null, parseError: true },
        });
      }
    } catch (e) {
      ragError = String(e);
    }
  } else {
    ragError = "Missing OPENAI_API_KEY";
  }

  // Docs-only strict
  if (body.strict_docs_only) {
    return json(200, {
      ok: true,
      mode: "docs_only",
      destination,
      incoterm,
      transport_mode: transportMode,
      answer:
        "Je ne trouve pas la réponse dans la base documentaire disponible (ou elle n’est pas accessible). " +
        "Ajoute les documents pertinents dans la Reference Library puis relance.",
      summary: "",
      actionsSuggested: ["Ajouter un document (PDF/markdown) dans la base documentaire", "Relancer la question"],
      questions: ["Quel document interne contient la règle/taux attendu ?", "Quel est le HS code et la valeur ?"],
      sections: {},
      citations: [],
      debug: { ragError },
    });
  }

  // Fallback KB (standardised as sections)
  const sections = buildKbSections(destination);

  return json(200, {
    ok: true,
    mode: "fallback_kb",
    destination,
    incoterm,
    transport_mode: transportMode,
    answer:
      `Je n’ai pas pu m’appuyer sur la base documentaire (ou je n’ai pas trouvé d’extraits pertinents). ` +
      `Voici un cadrage opérationnel (fallback) pour ${destination}${incoterm ? ` / ${incoterm}` : ""}.`,
    summary: "Fallback KB (sans citations). Ajoute des documents pour obtenir des réponses sourcées.",
    actionsSuggested: [
      "Ajouter un mémo Incoterms + responsabilités (IOR, taxes/douane)",
      "Ajouter un mémo OM/OMR par territoire + exemples",
      "Ajouter des exemples de factures + preuves transport acceptées",
    ],
    questions: [
      "Quel HS code exact ?",
      "Qui est l’importateur (IOR) et qui paie taxes/droits selon l’incoterm ?",
      "Valeur HT, transport, assurance ?",
    ],
    sections,
    citations: [],
    debug: { ragError },
  });
});
