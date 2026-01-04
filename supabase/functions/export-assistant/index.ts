
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DestinationKey =
  | "UE"
  | "HORS_UE"
  | "MONACO"
  | "PTOM_NOUVELLE_CALEDONIE"
  | `DROM_${string}`;

type AssistantRequest = {
  question: string;

  // contexte optionnel (pour enrichir la réponse)
  destination?: DestinationKey | string | null;
  incoterm?: string | null;

  client_id?: string | null;
  product_ids?: string[] | null;

  // filtre docs
  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
    export_zone?: string | null;
    incoterm?: string | null;
  };

  // options
  match_count?: number;
  strict_docs_only?: boolean; // true => pas de fallback KB
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeDestination(raw?: string | null): DestinationKey {
  const x = (raw ?? "").toUpperCase().trim();
  if (!x) return "HORS_UE";
  if (x === "UE" || x.includes("EU")) return "UE";
  if (x.includes("MONACO")) return "MONACO";
  if (x.includes("NOUVELLE") || x.includes("CALEDONIE") || x.includes("NC")) return "PTOM_NOUVELLE_CALEDONIE";
  if (x.startsWith("DROM_")) return x as DestinationKey;
  if (x.includes("DROM")) return "DROM_OUTRE-MER";
  return "HORS_UE";
}

/**
 * ==== TON "KB destination" (fallback) ====
 * (reprend la logique de ton snippet, sans la partie "invoice" et en orientant ventes/charges/OM/taxes)
 */
function kbForDestination(destination: DestinationKey) {
  const commonRegulatory = [
    "Dispositifs médicaux : vérifier statut, étiquetage, notice/IFU, langue exigée, traçabilité, vigilance.",
    "Vérifier si un importateur/distributeur local est requis (responsabilités, réclamations, vigilance).",
    "Ne jamais figer une exigence réglementaire sans vérifier la règle locale (autorité sanitaire + exigences de mise sur le marché).",
  ];

  const commonTransport = [
    "Clarifier l’Incoterm + le lieu (EXW/FCA/DAP/DDP...) : qui paie transport, assurance, taxes/droits, dédouanement ?",
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

  const base = {
    regulatory_basics: commonRegulatory,
    taxes_and_costs_basics: [
      "Ne pas annoncer de taux fixe sans validation : taxes/droits/TVA varient selon destination, incoterm, statut client, classification.",
      "Point clé : définir qui est l’importateur de référence (IOR) et qui supporte taxes/droits (DAP vs DDP).",
      "Pour ta logique interne : ventes, charges (transport, assurance), OM/OMR, TVA, droits → doivent être séparés.",
    ],
    transport_customs_basics: commonTransport,
    documents_checklist: commonDocs,
    risks_and_pitfalls: commonRisks,
    next_steps: [
      "Confirmer destination exacte + incoterm + lieu",
      "Valider HS code + origine + valeur + IOR",
      "Préparer pack documentaire (facture/packing/transport/conformité) + preuves",
      "Verrouiller qui paie taxes/droits et qui dédouane (client/transitaire/vous)",
    ],
  };

  if (destination.startsWith("DROM_")) {
    return {
      ...base,
      taxes_and_costs_basics: [
        "Métropole → DROM : flux à sécuriser (preuves d’expédition/livraison + traitement fiscal selon cas).",
        "Octroi de mer (OM/OMR) : taxe spécifique DROM, à anticiper (qui paie ? selon incoterm).",
        ...base.taxes_and_costs_basics,
      ],
    };
  }

  if (destination === "MONACO") {
    return {
      ...base,
      taxes_and_costs_basics: [
        "Monaco : traitement souvent proche France (à valider selon cas réel : B2B/B2C, lieu livraison, preuves).",
        ...base.taxes_and_costs_basics,
      ],
    };
  }

  if (destination === "UE") {
    return {
      ...base,
      taxes_and_costs_basics: [
        "UE : pas de dédouanement ; focus TVA intracom (statut client + preuve transport) + conformité/étiquetage/langue.",
        ...base.taxes_and_costs_basics,
      ],
    };
  }

  if (destination === "PTOM_NOUVELLE_CALEDONIE") {
    return {
      ...base,
      taxes_and_costs_basics: [
        "Nouvelle-Calédonie (PTOM) : flux à traiter comme ‘hors UE’ côté formalités (souvent).",
        "Point clé : IOR + taxes/droits à l’arrivée (DAP vs DDP).",
        ...base.taxes_and_costs_basics,
      ],
    };
  }

  // HORS_UE
  return {
    ...base,
    taxes_and_costs_basics: [
      "Hors UE : export souvent HT si preuve d’export ; taxes/droits payés à l’import selon pays.",
      "DDP hors UE : attention immatriculation/IOR (risque de blocage si non cadré).",
      ...base.taxes_and_costs_basics,
    ],
  };
}

async function embedQueryOpenAI(apiKey: string, model: string, text: string) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data[0].embedding as number[];
}

async function chatOpenAI(apiKey: string, model: string, system: string, user: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  const EMB_MODEL = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
  const CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-4.1-mini";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "Missing supabase env" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const question = (body?.question ?? "").trim();
  if (!question) return json(400, { error: "question is required" });

  const destination = normalizeDestination(body.destination ?? null);
  const incoterm = (body.incoterm ?? null)?.toUpperCase() ?? null;

  // --- Enrichissement DB (optionnel)
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

  // --- 1) RAG docs-first si OPENAI dispo + RPC dispo
  const matchCount = body.match_count ?? 8;
  const filter = body.doc_filter ?? {};

  let citations: any[] = [];
  let docAnswer: string | null = null;
  let ragError: string | null = null;

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

      const context = rows
        .map(
          (r, i) =>
            `#${i + 1} ${r.title} (${r.doc_type ?? "doc"}, ${r.published_at ?? "n/a"}) [chunk ${r.chunk_index}]\n${r.content}`,
        )
        .join("\n\n---\n\n");

      const system =
        "Tu es l’assistant Export Navigator. Réponds uniquement à partir des extraits de documents fournis. " +
        "Si l’information n’est pas présente dans les extraits, dis-le clairement. " +
        "Réponse courte, structurée en points. Cite tes sources (titre + chunk).";

      const user =
        `Question:\n${question}\n\n` +
        `Contexte opérationnel:\n- destination=${destination}\n- incoterm=${incoterm ?? "n/a"}\n` +
        (client ? `- client=${client.libelle_client ?? client.id}\n` : "") +
        (products.length ? `- produits=${products.map((p) => p.name ?? p.id).slice(0, 12).join(", ")}\n` : "") +
        `\nExtraits documents:\n${context}\n\n` +
        "Important: ne parle pas de 'facture' comme objet principal; parle plutôt ventes/charges/OM/taxes.";

      docAnswer = await chatOpenAI(OPENAI_API_KEY, CHAT_MODEL, system, user);

      citations = rows.map((r) => ({
        document_id: r.document_id,
        title: r.title,
        published_at: r.published_at,
        chunk_index: r.chunk_index,
        similarity: r.similarity,
      }));
    } catch (e) {
      ragError = String(e);
    }
  }

  // --- 2) Fallback KB si RAG indispo / vide (sauf si strict_docs_only)
  if (docAnswer && citations.length) {
    return json(200, {
      ok: true,
      mode: "docs_rag",
      answer: docAnswer,
      citations,
      debug: { destination, incoterm, ragError: ragError ?? null },
    });
  }

  if (body.strict_docs_only) {
    return json(200, {
      ok: true,
      mode: "docs_only",
      answer:
        "Je ne trouve pas la réponse dans la base documentaire disponible (ou elle n’est pas accessible). " +
        "Ajoute les documents pertinents dans la Reference Library (PDF) puis relance.",
      citations: [],
      debug: { destination, incoterm, ragError: ragError ?? "No docs / no matches" },
    });
  }

  // --- KB fallback (destination)
  const kb = kbForDestination(destination);

  return json(200, {
    ok: true,
    mode: "fallback_kb",
    answer:
      `Je n’ai pas pu m’appuyer sur la base documentaire (ou je n’ai pas trouvé d’extraits pertinents). ` +
      `Voici une synthèse opérationnelle (fallback) pour ${destination}${incoterm ? ` / ${incoterm}` : ""}.`,
    kb,
    citations: [],
    debug: { destination, incoterm, ragError: ragError ?? "No docs / no matches" },
  });
});
