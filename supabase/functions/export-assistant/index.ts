import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AssistantRequest = {
  question: string;

  // contexte UI
  destination?: string | null; // "Guadeloupe" ou "GP"
  incoterm?: string | null;
  transport_mode?: string | null;

  // contexte DB (optionnel)
  client_id?: string | null;
  product_ids?: string[] | null;

  // période (optionnel) pour stats ventes/coûts
  from?: string | null; // YYYY-MM-DD
  to?: string | null;   // YYYY-MM-DD

  // RAG
  match_count?: number;
  strict_docs_only?: boolean;
  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
    export_zone?: string | null;
    incoterm?: string | null;
    territory_code?: string | null;
    destination?: string | null;
  };
};

type RagMatch = {
  document_id: string;
  title: string;
  doc_type: string | null;
  published_at: string | null;
  chunk_index: number;
  content: string;
  similarity: number;
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

function normStr(x: any) {
  return String(x ?? "").trim();
}

function normalizeIncoterm(x?: string | null) {
  const v = normStr(x).toUpperCase();
  return v || null;
}

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const TERRITORY_ALIASES: Record<string, string> = {
  FR: "FR",
  METROPOLE: "FR",
  "MÉTROPOLE": "FR",
  FRANCE: "FR",

  GP: "GP",
  GUADELOUPE: "GP",

  MQ: "MQ",
  MARTINIQUE: "MQ",

  GF: "GF",
  GUYANE: "GF",
  "GUYANE FRANCAISE": "GF",
  "GUYANE FRANÇAISE": "GF",

  RE: "RE",
  REUNION: "RE",
  "RÉUNION": "RE",

  YT: "YT",
  MAYOTTE: "YT",

  BL: "BL",
  "SAINT BARTHELEMY": "BL",
  "SAINT-BARTHELEMY": "BL",
  "SAINT BARTHELEMY ": "BL",
  "SAINT BARTH": "BL",
  "SAINT-BARTH": "BL",

  MF: "MF",
  "SAINT MARTIN": "MF",
  "SAINT-MARTIN": "MF",

  SPM: "SPM",
  "SAINT PIERRE ET MIQUELON": "SPM",
  "SAINT-PIERRE-ET-MIQUELON": "SPM",
};

function normalizeTerritoryCode(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = stripAccents(raw).toUpperCase().trim();
  // si "Guadeloupe" -> "GUADELOUPE"
  if (TERRITORY_ALIASES[cleaned]) return TERRITORY_ALIASES[cleaned];
  // si l’utilisateur met "DROM_GP" etc.
  if (cleaned.startsWith("DROM_")) return cleaned.slice(5);
  // fallback: si c’est déjà un code
  if (/^[A-Z]{2,3}$/.test(cleaned)) return cleaned;
  return null;
}

function classifyExportZone(territoryCode: string | null) {
  if (!territoryCode) return null;
  const drom = new Set(["GP", "MQ", "GF", "RE", "YT"]);
  const com = new Set(["BL", "MF", "SPM"]);
  if (territoryCode === "FR") return "METROPOLE";
  if (drom.has(territoryCode)) return "DROM";
  if (com.has(territoryCode)) return "COM";
  return "AUTRE";
}

function extractHsCandidates(text: string) {
  const matches = text.match(/\b\d{4,10}\b/g) || [];
  // uniq
  return Array.from(new Set(matches.map((m) => m.trim())));
}

async function embedOpenAI(apiKey: string, model: string, input: string | string[]) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data.map((d: any) => d.embedding as number[]);
}

async function chatOpenAI(apiKey: string, model: string, system: string, user: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
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

  // ✅ service role: accès tables + docs (plus simple pour toi maintenant)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const question = normStr(body?.question);
  if (!question) return json(400, { error: "question is required" });

  const territoryCode = normalizeTerritoryCode(body.destination ?? null);
  const exportZone = classifyExportZone(territoryCode);
  const incoterm = normalizeIncoterm(body.incoterm ?? null);

  // période par défaut : 30 jours
  const today = new Date();
  const dTo = body.to ? new Date(body.to) : today;
  const dFrom = body.from
    ? new Date(body.from)
    : new Date(dTo.getTime() - 30 * 24 * 60 * 60 * 1000);

  const from = dFrom.toISOString().slice(0, 10);
  const to = dTo.toISOString().slice(0, 10);

  // -------------------------
  // 1) DB context (produits / clients / ventes / coûts / taxes)
  // -------------------------
  const hsCandidates = extractHsCandidates(question);
  const hs4FromQuestion = hsCandidates.length ? hsCandidates[0].slice(0, 4) : null;

  // client
  let client: any = null;
  if (body.client_id) {
    const { data } = await supabase.from("clients").select("*").eq("id", body.client_id).maybeSingle();
    client = data ?? null;
  }

  // produits: si product_ids fournis -> ceux-là, sinon recherche légère par HS / mots-clés
  let products: any[] = [];
  if (body.product_ids?.length) {
    const { data } = await supabase.from("products").select("*").in("id", body.product_ids);
    products = data ?? [];
  } else {
    // recherche “safe” : HS d’abord
    if (hs4FromQuestion) {
      const { data } = await supabase
        .from("products")
        .select("id,code_article,libelle_article,hs_code,hs4")
        .eq("hs4", hs4FromQuestion)
        .limit(25);
      products = data ?? [];
    } else {
      // sinon: essayer un mot-clé simple (plus long mot)
      const tokens = stripAccents(question)
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((t) => t.length >= 5 && !["comment", "pourquoi", "quelle", "quels", "quelles", "export", "incoterm"].includes(t));

      const term = tokens.sort((a, b) => b.length - a.length)[0] ?? null;
      if (term) {
        const { data } = await supabase
          .from("products")
          .select("id,code_article,libelle_article,hs_code,hs4")
          .or(`code_article.ilike.%${term}%,libelle_article.ilike.%${term}%`)
          .limit(25);
        products = data ?? [];
      }
    }
  }

  // ventes / coûts : agrégats simples
  const { data: salesRows } = await supabase
    .from("sales")
    .select("territory_code,amount_ht,amount_ttc,sale_date")
    .gte("sale_date", from)
    .lte("sale_date", to)
    .limit(5000);

  const { data: costRows, error: costErr } = await supabase
    .from("cost_lines")
    .select("destination,amount,cost_type,date")
    .gte("date", from)
    .lte("date", to)
    .limit(5000);

  // fallback si cost_lines absente -> costs
  let costs = costRows ?? [];
  if (costErr) {
    const { data: costsFallback } = await supabase
      .from("costs")
      .select("destination,amount,cost_type,date")
      .gte("date", from)
      .lte("date", to)
      .limit(5000);
    costs = costsFallback ?? [];
  }

  // agrégation
  const aggSales: Record<string, { ca_ht: number; ca_ttc: number; lignes: number }> = {};
  for (const r of salesRows ?? []) {
    const code = normStr((r as any).territory_code) || "FR";
    aggSales[code] ||= { ca_ht: 0, ca_ttc: 0, lignes: 0 };
    aggSales[code].ca_ht += Number((r as any).amount_ht ?? 0);
    aggSales[code].ca_ttc += Number((r as any).amount_ttc ?? 0);
    aggSales[code].lignes += 1;
  }

  const aggCosts: Record<string, { total: number; lignes: number }> = {};
  for (const r of costs ?? []) {
    const code = normStr((r as any).destination) || "FR";
    aggCosts[code] ||= { total: 0, lignes: 0 };
    aggCosts[code].total += Number((r as any).amount ?? 0);
    aggCosts[code].lignes += 1;
  }

  // OM/OMR (si territoire DROM et HS connu)
  let omRateRow: any = null;
  if (territoryCode && ["GP", "MQ", "GF", "RE", "YT"].includes(territoryCode)) {
    const hs4 =
      (products?.[0]?.hs4 ? String(products[0].hs4) : null) ??
      hs4FromQuestion;

    if (hs4) {
      const { data } = await supabase
        .from("om_rates")
        .select("*")
        .eq("territory_code", territoryCode)
        .eq("hs4", String(hs4).slice(0, 4))
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle();
      omRateRow = data ?? null;
    }
  }

  // -------------------------
  // 2) RAG documents (document_chunks)
  // -------------------------
  const matchCount = body.match_count ?? 8;
  const strictDocsOnly = Boolean(body.strict_docs_only);

  let ragMatches: RagMatch[] = [];
  let ragError: string | null = null;

  if (OPENAI_API_KEY) {
    try {
      const [qEmb] = await embedOpenAI(OPENAI_API_KEY, EMB_MODEL, question);

      const f = body.doc_filter ?? {};
      const { data, error } = await supabase.rpc("match_document_chunks", {
        query_embedding: qEmb,
        match_count: matchCount,
        filter_doc_type: f.doc_type ?? null,
        filter_tags: f.tags ?? null,
        filter_export_zone: f.export_zone ?? exportZone ?? null,
        filter_incoterm: f.incoterm ?? incoterm ?? null,
      });

      if (error) throw new Error(error.message);
      ragMatches = (data ?? []) as RagMatch[];
    } catch (e: any) {
      ragError = String(e?.message || e);
    }
  } else {
    ragError = "OPENAI_API_KEY manquant";
  }

  const docsContext = ragMatches
    .slice(0, matchCount)
    .map(
      (r, i) =>
        `#${i + 1} ${r.title} (${r.doc_type ?? "doc"}, ${r.published_at ?? "n/a"}) [chunk ${r.chunk_index} | sim=${Number(r.similarity).toFixed(3)}]\n${r.content}`,
    )
    .join("\n\n---\n\n");

  const citations = ragMatches.map((r) => ({
    document_id: r.document_id,
    title: r.title,
    published_at: r.published_at,
    chunk_index: r.chunk_index,
    similarity: r.similarity,
  }));

  // -------------------------
  // 3) Réponse IA (docs + tables)
  // -------------------------
  if (strictDocsOnly && !docsContext) {
    return json(200, {
      ok: true,
      mode: "docs_only",
      answer:
        "Je ne trouve pas la réponse dans les documents indexés. " +
        "Tes PDFs sont probablement non extraits/non chunkés. Lance parse+chunk+embed puis relance.",
      citations: [],
      debug: { territoryCode, exportZone, incoterm, ragError },
    });
  }

  // fallback sans OpenAI
  if (!OPENAI_API_KEY) {
    return json(200, {
      ok: true,
      mode: "no_openai_fallback",
      answer:
        "OPENAI_API_KEY manquant. Je peux afficher des données brutes, mais pas générer une réponse IA.",
      db_context: {
        territoryCode,
        exportZone,
        incoterm,
        from,
        to,
        client: client ? { id: client.id, libelle_client: client.libelle_client } : null,
        products_count: products?.length ?? 0,
        sales_summary: aggSales,
        costs_summary: aggCosts,
        om_rate: omRateRow,
      },
      citations,
      debug: { ragError },
    });
  }

  const system =
    "Tu es l’assistant IA Export d’Orliman (Export Navigator). " +
    "Tu as 2 types de sources: (1) DONNÉES INTERNES (tables Supabase: produits, ventes, clients, coûts, om_rates) " +
    "et (2) DOCUMENTS (extraits PDF). " +
    "Règles: " +
    "- Priorise DOCUMENTS quand ils répondent clairement; sinon utilise DONNÉES INTERNES. " +
    "- Ne JAMAIS inventer un taux ou une règle: si absent des sources, dire 'info non disponible dans les sources'. " +
    "- Réponds en FR, court, actionnable, structuré en points." +
    "- Termine par 2-4 questions de précision si nécessaire." +
    "Format de sortie STRICT: renvoie un JSON valide avec les clés: " +
    "`answer` (string), `sections` (object titre -> string[]), `questions` (string[]), `actionsSuggested` (string[]).";

  const dbContext = {
    territoryCode,
    exportZone,
    destination_raw: body.destination ?? null,
    incoterm,
    transport_mode: body.transport_mode ?? null,
    period: { from, to },
    client: client
      ? {
          id: client.id,
          libelle_client: client.libelle_client,
          email: client.email ?? null,
          pays: client.pays ?? null,
          export_zone: client.export_zone ?? null,
          drom_code: client.drom_code ?? null,
        }
      : null,
    products: (products ?? []).slice(0, 12).map((p: any) => ({
      id: p.id,
      code_article: p.code_article ?? null,
      libelle_article: p.libelle_article ?? p.name ?? null,
      hs_code: p.hs_code ?? null,
      hs4: p.hs4 ?? null,
    })),
    sales_summary: aggSales,
    costs_summary: aggCosts,
    om_rate: omRateRow
      ? {
          territory_code: omRateRow.territory_code,
          hs4: omRateRow.hs4,
          om_rate: omRateRow.om_rate,
          omr_rate: omRateRow.omr_rate,
          year: omRateRow.year,
          source: omRateRow.source ?? null,
        }
      : null,
  };

  const user =
    `QUESTION:\n${question}\n\n` +
    `CONTEXTE UI:\n- destination=${body.destination ?? "n/a"} (code=${territoryCode ?? "n/a"})\n- export_zone=${exportZone ?? "n/a"}\n- incoterm=${incoterm ?? "n/a"}\n- transport=${body.transport_mode ?? "n/a"}\n- période stats=${from} -> ${to}\n\n` +
    `DONNÉES INTERNES (JSON):\n${JSON.stringify(dbContext, null, 2)}\n\n` +
    `DOCUMENTS (extraits):\n${docsContext || "(aucun extrait pertinent trouvé)"}\n\n` +
    `Consignes:\n- Si tu cites un doc: mentionne (Titre + chunk_index).\n- Si tu cites une donnée interne: mentionne la table (ex: products/sales/clients/om_rates).\n`;

  let raw = "";
  try {
    raw = await chatOpenAI(OPENAI_API_KEY, CHAT_MODEL, system, user);
  } catch (e: any) {
    return json(200, {
      ok: true,
      mode: "openai_error_fallback",
      answer: "Erreur IA. Je te renvoie le contexte interne disponible.",
      db_context: dbContext,
      citations,
      debug: { territoryCode, exportZone, incoterm, ragError: ragError ?? null, openai: String(e?.message || e) },
    });
  }

  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed.answer !== "string") {
    // fallback si le modèle ne respecte pas le JSON
    return json(200, {
      ok: true,
      mode: "model_non_json",
      answer: raw || "Réponse vide.",
      citations,
      debug: { territoryCode, exportZone, incoterm, ragError },
    });
  }

  return json(200, {
    ok: true,
    mode: docsContext ? "docs_plus_db" : "db_only",
    ...parsed,
    citations,
    debug: { territoryCode, exportZone, incoterm, ragError },
  });
});
