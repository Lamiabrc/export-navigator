import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AssistantRequest = {
  question: string;

  destination?: string | null;     // ex: "GP" ou "Guadeloupe"
  territory_code?: string | null;  // filtre global éventuel
  incoterm?: string | null;
  transport_mode?: string | null;

  date_from?: string | null; // YYYY-MM-DD
  date_to?: string | null;   // YYYY-MM-DD

  include_tables?: boolean;
  match_count?: number;
  strict_docs_only?: boolean;

  // optionnel, si tu ajoutes plus tard des sélecteurs
  client_id?: string | null;
  product_ids?: string[] | null;

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

function normalizeHS(v: any) {
  return String(v ?? "").trim().replace(/[^\d]/g, "");
}

function extractHsCodes(text: string) {
  const found = new Set<string>();
  const re = /\b\d{4,10}\b/g;
  for (const m of text.match(re) ?? []) found.add(m);
  return Array.from(found).slice(0, 8);
}

const TERR_MAP: Array<{ code: string; keys: string[] }> = [
  { code: "GP", keys: ["GP", "GUADELOUPE"] },
  { code: "MQ", keys: ["MQ", "MARTINIQUE"] },
  { code: "GF", keys: ["GF", "GUYANE"] },
  { code: "RE", keys: ["RE", "REUNION", "RÉUNION"] },
  { code: "YT", keys: ["YT", "MAYOTTE"] },
  { code: "BL", keys: ["BL", "SAINT-BARTHELEMY", "SAINT BARTH", "SAINT-BARTH", "ST BARTH"] },
  { code: "MF", keys: ["MF", "SAINT-MARTIN", "ST MARTIN"] },
  { code: "SPM", keys: ["SPM", "SAINT-PIERRE", "SAINT-PIERRE-ET-MIQUELON", "MIQUELON"] },
  { code: "FR", keys: ["FR", "FRANCE", "METROPOLE", "MÉTROPOLE"] },
];

function normalizeTerritory(raw?: string | null): string | null {
  const x = (raw ?? "").toUpperCase().trim();
  if (!x) return null;
  for (const t of TERR_MAP) {
    if (t.keys.some((k) => x === k || x.includes(k))) return t.code;
  }
  // si l’utilisateur tape déjà un code
  if (/^[A-Z]{2,3}$/.test(x)) return x;
  return null;
}

function computeExportZone(territoryCode: string | null, destinationRaw?: string | null) {
  const x = (destinationRaw ?? "").toUpperCase();
  if (x.includes("UE") || x.includes("EU")) return "UE";
  if (x.includes("MONACO")) return "MONACO";
  if (x.includes("NOUVELLE") || x.includes("CALEDONIE") || x.includes("NC")) return "PTOM_NOUVELLE_CALEDONIE";
  if (territoryCode && ["GP", "MQ", "GF", "RE", "YT", "BL", "MF", "SPM"].includes(territoryCode)) return "DROM_COM";
  return "HORS_UE";
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

function money(n: number) {
  const v = Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
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

  // (optionnel) vérifier user (JWT)
  // Si tu veux verrouiller l’accès, décommente et ajoute une whitelist email
  // const authHeader = req.headers.get("Authorization") || "";
  // const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  // if (!jwt) return json(401, { error: "Missing Authorization" });
  // const { data: uData, error: uErr } = await supabase.auth.getUser(jwt);
  // if (uErr || !uData?.user) return json(401, { error: "Invalid user session" });

  const incoterm = (body.incoterm ?? null)?.toUpperCase() ?? null;

  const territoryFromDestination = normalizeTerritory(body.destination ?? null);
  const territory = normalizeTerritory(body.territory_code ?? null) ?? territoryFromDestination;
  const exportZone = computeExportZone(territory, body.destination ?? null);

  const includeTables = body.include_tables !== false; // default true
  const dateFrom = body.date_from ?? null;
  const dateTo = body.date_to ?? null;

  // -----------------------------
  // 1) TABLES: products / clients / sales / costs
  // -----------------------------
  const tableSections: Record<string, string[]> = {};
  const hsCodes = extractHsCodes(question);

  let productsBrief: any[] = [];
  let clientsBrief: any[] = [];
  let salesBrief: any = null;
  let costsBrief: any = null;

  async function safeProductsLookup() {
    // Heuristique simple: si HS codes présents => match par HS ; sinon search texte sur libellé
    const q = question.slice(0, 120);

    // essayer de limiter le payload
    const baseSelect = "id,code_article,libelle_article,hs_code,hs4";

    if (hsCodes.length) {
      const hs10 = hsCodes.map(normalizeHS).filter(Boolean);
      const hs4 = hs10.map((h) => h.slice(0, 4)).filter((h) => h.length === 4);

      // On tente d'abord hs_code IN, puis hs4 IN
      let { data, error } = await supabase.from("products").select(baseSelect).in("hs_code", hs10).limit(12);
      if (error) {
        // fallback hs4
        const r2 = await supabase.from("products").select(baseSelect).in("hs4", hs4).limit(12);
        data = r2.data ?? [];
      }
      return data ?? [];
    }

    // fallback texte
    const { data } = await supabase
      .from("products")
      .select(baseSelect)
      .ilike("libelle_article", `%${q}%`)
      .limit(12);

    return data ?? [];
  }

  async function safeClientsLookup() {
    const q = question.slice(0, 80);
    const sel = "id,code_ets,libelle_client,email,ville,pays,export_zone,drom_code";

    // Heuristique: si la question contient "PHARMACIE" / "CLIENT" / un nom long => tente ilike
    const shouldSearch =
      /pharmacie|client|sarl|sas|sa\b|eurl|gmbh|spa/i.test(question) || q.length >= 10;

    if (!shouldSearch) return [];

    const { data } = await supabase
      .from("clients")
      .select(sel)
      .ilike("libelle_client", `%${q}%`)
      .limit(8);

    return data ?? [];
  }

  async function safeSalesSummary() {
    if (!dateFrom || !dateTo) return null;

    const { data, error } = await supabase
      .from("sales")
      .select("territory_code,amount_ht,amount_ttc,sale_date")
      .gte("sale_date", dateFrom)
      .lte("sale_date", dateTo)
      .limit(5000);

    if (error) return { error: error.message };

    const rows = data ?? [];
    const agg: Record<string, { count: number; ht: number; ttc: number }> = {};
    for (const r of rows as any[]) {
      const code = String(r.territory_code ?? "FR");
      if (territory && code !== territory) continue;
      agg[code] ||= { count: 0, ht: 0, ttc: 0 };
      agg[code].count += 1;
      agg[code].ht += Number(r.amount_ht || 0);
      agg[code].ttc += Number(r.amount_ttc || 0);
    }

    const list = Object.entries(agg)
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.ht - a.ht)
      .slice(0, 8);

    return { total_rows: rows.length, by_territory: list };
  }

  async function safeCostsSummary() {
    if (!dateFrom || !dateTo) return null;

    // cost_lines -> fallback costs
    const run = async (table: "cost_lines" | "costs") => {
      const { data, error } = await supabase
        .from(table)
        .select("destination,amount,cost_type,date")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .limit(5000);
      return { data: data ?? [], error: error?.message ?? null };
    };

    let res = await run("cost_lines");
    if (res.error) res = await run("costs");

    const rows = res.data as any[];
    const agg: Record<string, { count: number; amount: number }> = {};
    for (const r of rows) {
      const code = String(r.destination ?? "FR");
      if (territory && code !== territory) continue;
      agg[code] ||= { count: 0, amount: 0 };
      agg[code].count += 1;
      agg[code].amount += Number(r.amount || 0);
    }

    const list = Object.entries(agg)
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return { source_error: res.error, by_territory: list };
  }

  if (includeTables) {
    try {
      // si client_id/product_ids envoyés, on priorise
      if (body.client_id) {
        const { data } = await supabase.from("clients").select("*").eq("id", body.client_id).maybeSingle();
        if (data) clientsBrief = [data];
      } else {
        clientsBrief = await safeClientsLookup();
      }

      if (body.product_ids?.length) {
        const { data } = await supabase.from("products").select("id,code_article,libelle_article,hs_code,hs4").in("id", body.product_ids);
        productsBrief = data ?? [];
      } else {
        productsBrief = await safeProductsLookup();
      }

      salesBrief = await safeSalesSummary();
      costsBrief = await safeCostsSummary();

      if (productsBrief.length) {
        tableSections["Produits (table products)"] = productsBrief.map((p: any) => {
          const code = p.code_article ?? p.id;
          const label = p.libelle_article ?? "";
          const hs = p.hs_code ?? p.hs4 ?? "";
          return `${code} — ${label}${hs ? ` (HS: ${hs})` : ""}`;
        });
      }

      if (clientsBrief.length) {
        tableSections["Clients (table clients)"] = clientsBrief.slice(0, 8).map((c: any) => {
          const name = c.libelle_client ?? c.id;
          const drom = c.drom_code ? ` • drom=${c.drom_code}` : "";
          const zone = c.export_zone ? ` • zone=${c.export_zone}` : "";
          return `${name}${zone}${drom}`;
        });
      }

      if (salesBrief?.by_territory?.length) {
        tableSections["Ventes (table sales)"] = salesBrief.by_territory.map((t: any) => {
          return `${t.code}: ${t.count} vente(s) • CA HT ${money(t.ht)} • CA TTC ${money(t.ttc)}`;
        });
      }

      if (costsBrief?.by_territory?.length) {
        tableSections["Coûts (cost_lines/costs)"] = costsBrief.by_territory.map((t: any) => {
          return `${t.code}: ${t.count} ligne(s) • Total ${money(t.amount)}`;
        });
      }
    } catch (e) {
      tableSections["Tables (warning)"] = [`Erreur lecture tables: ${String(e)}`];
    }
  }

  // -----------------------------
  // 2) DOCS RAG (comme avant)
  // -----------------------------
  const matchCount = body.match_count ?? 8;
  const filter = body.doc_filter ?? {};

  let citations: any[] = [];
  let docContext = "";
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
      docContext = rows
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
    } catch (e) {
      ragError = String(e);
    }
  }

  if (body.strict_docs_only && (!docContext || !citations.length)) {
    return json(200, {
      ok: true,
      mode: "docs_only",
      answer:
        "Je ne trouve pas la réponse dans la base documentaire disponible (ou elle n’est pas accessible). " +
        "Ajoute les documents pertinents dans la Reference Library (PDF) puis relance.",
      citations: [],
      sections: includeTables ? tableSections : {},
      debug: { territory, exportZone, incoterm, ragError: ragError ?? "No docs / no matches" },
    });
  }

  // -----------------------------
  // 3) LLM final (docs + tables)
  // -----------------------------
  const system =
    "Tu es l’assistant Export Navigator. Tu réponds de façon opérationnelle et concrète.\n" +
    "Tu peux utiliser:\n" +
    "- les EXTRaits de documents (si fournis)\n" +
    "- le résumé TABLES internes (si fourni)\n" +
    "Si une info n’est pas présente, dis-le clairement.\n" +
    "Rends une réponse courte + une checklist + 3 actions suggérées.\n";

  const user =
    `Question:\n${question}\n\n` +
    `Contexte:\n` +
    `- export_zone=${exportZone}\n` +
    `- territory=${territory ?? "n/a"}\n` +
    `- destination_raw=${body.destination ?? "n/a"}\n` +
    `- incoterm=${incoterm ?? "n/a"}\n` +
    `- transport=${body.transport_mode ?? "n/a"}\n` +
    (dateFrom && dateTo ? `- période=${dateFrom} → ${dateTo}\n` : "") +
    (hsCodes.length ? `- HS détectés=${hsCodes.join(", ")}\n` : "") +
    `\nTABLES (résumé):\n${Object.entries(tableSections)
      .map(([k, lines]) => `## ${k}\n- ${lines.join("\n- ")}`)
      .join("\n\n") || "n/a"}\n\n` +
    `DOCS (extraits):\n${docContext || "n/a"}\n\n` +
    "Format attendu:\n" +
    "1) Réponse (5-10 lignes)\n" +
    "2) Checklist\n" +
    "3) Actions suggérées (3)\n" +
    "4) Si tu cites des docs, indique titre + chunk.\n";

  let finalAnswer = "";
  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant");
    finalAnswer = await chatOpenAI(OPENAI_API_KEY, CHAT_MODEL, system, user);
  } catch (e) {
    // fallback si pas d’OpenAI
    finalAnswer =
      "Je ne peux pas appeler le modèle IA pour le moment. " +
      "Je te renvoie les éléments internes disponibles (tables) et tu peux préciser la question.";
  }

  const actionsSuggested = [
    "Confirmer HS + valeur + origine (source interne) avant annonce client",
    "Vérifier incoterm + importateur (IOR) + qui paie OM/TVA/droits",
    "Contrôler pièces: facture/packing + preuve transport + règles OM/OMR",
  ];

  return json(200, {
    ok: true,
    mode: citations.length ? (includeTables ? "tables+docs_rag" : "docs_rag") : includeTables ? "tables_only" : "no_docs",
    answer: finalAnswer,
    sections: tableSections,
    actionsSuggested,
    citations,
    debug: { territory, exportZone, incoterm, ragError: ragError ?? null },
  });
});
