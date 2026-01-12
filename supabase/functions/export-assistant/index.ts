// supabase/functions/export-assistant/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AssistantRequest = {
  question: string;
  destination?: string | null;
  incoterm?: string | null;
  transport_mode?: string | null;

  // optionnel: pour analyses chiffrées
  date_from?: string | null; // YYYY-MM-DD
  date_to?: string | null;   // YYYY-MM-DD

  client_id?: string | null;
  product_ids?: string[] | null;

  match_count?: number;
  strict_docs_only?: boolean;

  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
    export_zone?: string | null;
    incoterm?: string | null;
  };
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

function normalizeText(v: any) {
  return String(v ?? "").trim();
}

function upper(v: any) {
  const s = normalizeText(v);
  return s ? s.toUpperCase() : "";
}

function detectTerritoryCode(raw?: string | null) {
  const x = upper(raw);
  if (!x) return null;

  // codes directs
  const codes = ["FR", "GP", "MQ", "GF", "RE", "YT", "BL", "MF", "SPM"];
  if (codes.includes(x)) return x;

  // noms
  if (x.includes("GUADELOUPE")) return "GP";
  if (x.includes("MARTINIQUE")) return "MQ";
  if (x.includes("GUYANE")) return "GF";
  if (x.includes("REUNION") || x.includes("RÉUNION")) return "RE";
  if (x.includes("MAYOTTE")) return "YT";
  if (x.includes("BARTHELEMY") || x.includes("BARTH")) return "BL";
  if (x.includes("SAINT-MARTIN") || x.includes("ST MARTIN")) return "MF";
  if (x.includes("MIQUELON") || x.includes("PIERRE")) return "SPM";
  if (x.includes("METRO") || x.includes("FRANCE")) return "FR";

  return null;
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

async function chatOpenAI(apiKey: string, model: string, messages: { role: string; content: string }[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function compactJSON(obj: any, maxLen = 2500) {
  const s = JSON.stringify(obj);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
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

  // Exiger un user token (invoke depuis ton app)
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { ok: false, error: "Missing Authorization bearer token" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const question = normalizeText(body?.question);
  if (!question) return json(400, { ok: false, error: "question is required" });

  const territoryCode = detectTerritoryCode(body.destination ?? null);
  const incoterm = upper(body.incoterm ?? null) || null;
  const transportMode = normalizeText(body.transport_mode ?? null) || null;

  const matchCount = body.match_count ?? 8;
  const filter = body.doc_filter ?? {};

  // ----------------------------
  // 1) DATA LIVE (tables)
  // ----------------------------
  // produits
  let products: any[] = [];
  try {
    if (body.product_ids?.length) {
      const { data } = await supabase.from("products").select("*").in("id", body.product_ids).limit(20);
      products = data ?? [];
    } else {
      // recherche soft dans products via question
      const q = question.slice(0, 80);
      const { data } = await supabase
        .from("products")
        .select("*")
        .or(
          `code_article.ilike.%${q}%,libelle_article.ilike.%${q}%,hs_code.ilike.%${q}%,hs4.ilike.%${q}%`
        )
        .limit(8);
      products = data ?? [];
    }
  } catch {
    products = [];
  }

  // clients
  let clients: any[] = [];
  try {
    if (body.client_id) {
      const { data } = await supabase.from("clients").select("*").eq("id", body.client_id).limit(1);
      clients = data ?? [];
    } else {
      const q = question.slice(0, 80);
      const { data } = await supabase.from("clients").select("*").or(`libelle_client.ilike.%${q}%,email.ilike.%${q}%`).limit(5);
      clients = data ?? [];
    }
  } catch {
    clients = [];
  }

  // ventes / coûts (agrégé)
  const dateFrom = body.date_from || null;
  const dateTo = body.date_to || null;

  let salesAgg: any = null;
  let costsAgg: any = null;

  try {
    let sQ = supabase.from("sales").select("id,sale_date,territory_code,amount_ht,amount_ttc").limit(5000);
    if (dateFrom) sQ = sQ.gte("sale_date", dateFrom);
    if (dateTo) sQ = sQ.lte("sale_date", dateTo);
    if (territoryCode) sQ = sQ.eq("territory_code", territoryCode);

    const { data: sData } = await sQ;
    const rows = (sData || []) as any[];

    const totalHt = rows.reduce((a, r) => a + (Number(r.amount_ht) || 0), 0);
    const totalTtc = rows.reduce((a, r) => a + (Number(r.amount_ttc) || 0), 0);
    const count = rows.length;

    salesAgg = { count, totalHt, totalTtc, top5: rows.slice(0, 5) };
  } catch {
    salesAgg = null;
  }

  try {
    // cost_lines sinon costs
    const tryTables = ["cost_lines", "costs"];
    let tableUsed: string | null = null;
    let cData: any[] = [];

    for (const t of tryTables) {
      const q = supabase.from(t).select("id,date,destination,amount,cost_type").limit(5000);
      let qq = q;
      if (dateFrom) qq = qq.gte("date", dateFrom);
      if (dateTo) qq = qq.lte("date", dateTo);
      if (territoryCode) qq = qq.eq("destination", territoryCode);

      const { data, error } = await qq;
      if (!error) {
        tableUsed = t;
        cData = (data || []) as any[];
        break;
      }
    }

    const total = cData.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const byType: Record<string, number> = {};
    cData.forEach((r) => {
      const k = normalizeText(r.cost_type || "unknown");
      byType[k] = (byType[k] || 0) + (Number(r.amount) || 0);
    });

    costsAgg = { table: tableUsed, count: cData.length, total, byType };
  } catch {
    costsAgg = null;
  }

  const dataContext = {
    territoryCode,
    incoterm,
    transportMode,
    products_preview: products.slice(0, 8),
    clients_preview: clients.slice(0, 5),
    sales_agg: salesAgg,
    costs_agg: costsAgg,
  };

  // ----------------------------
  // 2) DOCS RAG
  // ----------------------------
  let citations: any[] = [];
  let docsContext = "";
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
      docsContext = rows
        .map(
          (r, i) =>
            `#${i + 1} ${r.title} (${r.doc_type ?? "doc"}, ${r.published_at ?? "n/a"}) [chunk ${r.chunk_index}]\n${r.content}`,
        )
        .join("\n\n---\n\n");

      citations = rows.map((r) => ({
        document_id: r.document_id,
        title: r.title,
        published_at: r.published_at,
        chunk_index: r.chunk_index,
        similarity: r.similarity,
      }));
    } catch (e: any) {
      ragError = e?.message || String(e);
      docsContext = "";
      citations = [];
    }
  } else {
    ragError = "OPENAI_API_KEY missing";
  }

  // ----------------------------
  // 3) Réponse LLM (hybride)
  // ----------------------------
  if (!OPENAI_API_KEY) {
    return json(200, {
      ok: true,
      mode: "no_openai_fallback",
      answer:
        "OPENAI_API_KEY manquant: je ne peux pas raisonner via LLM. " +
        "J’ai quand même récupéré un aperçu des données internes (produits/clients/ventes/coûts).",
      summary: "Configurer OPENAI_API_KEY + lancer l’ingestion docs pour activer le RAG.",
      sections: {
        "Données internes (aperçu)": [compactJSON(dataContext, 2000)],
      },
      citations: [],
      debug: { territoryCode, incoterm, ragError },
    });
  }

  // strict docs only
  if (body.strict_docs_only && !docsContext) {
    return json(200, {
      ok: true,
      mode: "docs_only",
      answer:
        "Je ne trouve pas la réponse dans la base documentaire (ou les documents ne sont pas chunkés/embeddés). " +
        "Lance ingest-reference-docs sur le bucket reference-docs puis réessaie.",
      summary: "Aucune source documentaire exploitable actuellement.",
      sections: {
        "Données internes (aperçu)": [compactJSON(dataContext, 2000)],
      },
      citations: [],
      debug: { territoryCode, incoterm, ragError },
    });
  }

  const system = [
    "Tu es l’assistant Export Navigator (Orliman).",
    "Tu dois exploiter 2 sources :",
    "1) Données internes (tables produits/clients/ventes/coûts) fournies en JSON",
    "2) Extraits documentaires (PDF chunkés) si disponibles",
    "",
    "Règles:",
    "- Si tu n’as pas l’info dans les extraits, dis-le clairement (ne pas inventer).",
    "- Pour les données internes: tu peux conclure des choses à partir des agrégats (ex: CA total, coûts total) mais indique que c’est basé sur les données internes.",
    "- Réponse courte et actionnable.",
    "- Termine par: 2-4 questions de clarification si nécessaire.",
    "",
    "Format de sortie: texte normal (pas JSON).",
  ].join("\n");

  const user = [
    `Question: ${question}`,
    ``,
    `Contexte (données internes):`,
    compactJSON(dataContext, 7000),
    ``,
    `Extraits documents (si vides => docs indisponibles):`,
    docsContext || "(aucun extrait pertinent)",
    ``,
    `Consigne: propose aussi des actions (ex: vérifier HS/origine/IOR, OM/OMR, TVA, incoterm, preuves transport).`,
  ].join("\n");

  let answer = "";
  try {
    answer = await chatOpenAI(OPENAI_API_KEY, CHAT_MODEL, [
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
  } catch (e: any) {
    return json(200, {
      ok: true,
      mode: "llm_error_fallback",
      answer: "Erreur LLM. Je peux quand même te donner un aperçu des données internes récupérées.",
      summary: "Erreur appel OpenAI.",
      sections: {
        "Données internes (aperçu)": [compactJSON(dataContext, 2000)],
      },
      citations,
      debug: { territoryCode, incoterm, ragError, llmError: e?.message || String(e) },
    });
  }

  return json(200, {
    ok: true,
    mode: docsContext ? "hybrid_rag" : "hybrid_no_docs",
    destination: territoryCode,
    answer: answer.trim(),
    summary: null,
    questions: null,
    actionsSuggested: null,
    sections: {
      "Données internes (aperçu)": [compactJSON(dataContext, 2000)],
      ...(docsContext ? { "Sources documentaires": ["Extraits utilisés: voir citations"] } : {}),
    },
    citations,
    debug: { territoryCode, incoterm, ragError },
  });
});
