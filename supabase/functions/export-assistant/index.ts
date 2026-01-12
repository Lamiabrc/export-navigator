// supabase/functions/export-assistant/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AssistantRequest = {
  question: string;

  // peut être "Guadeloupe", "GP", "DROM_GP", "UE", etc.
  destination?: string | null;
  incoterm?: string | null;
  transport_mode?: string | null;

  // optionnels : si UI les passe
  client_id?: string | null;
  product_ids?: string[] | null;

  // période optionnelle (ISO date "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ssZ")
  date_from?: string | null;
  date_to?: string | null;

  // docs filters
  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
    export_zone?: string | null;
    incoterm?: string | null;
  };

  match_count?: number;
  strict_docs_only?: boolean;

  // pour désactiver live-data si besoin
  include_live_data?: boolean;
};

type Citation = {
  document_id: string;
  title: string;
  published_at: string | null;
  chunk_index: number;
  similarity: number;
};

type TableFact = {
  table: string;
  kind:
    | "client"
    | "products"
    | "sales_agg"
    | "costs_agg"
    | "tax_om"
    | "vat"
    | "tax_extra"
    | "doc_index_health";
  payload: any;
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

function isMissingTableError(e: any) {
  const code = String(e?.code || "");
  const msg = String(e?.message || "").toLowerCase();
  // Postgres: 42P01 = undefined_table
  return code === "42P01" || msg.includes("does not exist") || msg.includes("undefined_table");
}

function normalizeHS(v: any) {
  return String(v ?? "").trim().replace(/[^\d]/g, "");
}

function extractHsCandidates(question: string) {
  // récupère des suites de 4 à 10 chiffres pouvant ressembler à des HS codes
  const raw = (question.match(/\b\d{4,10}\b/g) || []).map(normalizeHS);
  // dédoublonne
  return Array.from(new Set(raw)).slice(0, 6);
}

function defaultRange30d() {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromD = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = fromD.toISOString().slice(0, 10);
  return { from, to };
}

function normalizeDestination(raw?: string | null) {
  const x = (raw ?? "").trim().toUpperCase();

  // DROM codes
  const map: Record<string, { code: string; label: string; zone: string }> = {
    GP: { code: "GP", label: "Guadeloupe", zone: "DROM" },
    GUADELOUPE: { code: "GP", label: "Guadeloupe", zone: "DROM" },
    MQ: { code: "MQ", label: "Martinique", zone: "DROM" },
    MARTINIQUE: { code: "MQ", label: "Martinique", zone: "DROM" },
    GF: { code: "GF", label: "Guyane", zone: "DROM" },
    GUYANE: { code: "GF", label: "Guyane", zone: "DROM" },
    RE: { code: "RE", label: "Réunion", zone: "DROM" },
    RÉUNION: { code: "RE", label: "Réunion", zone: "DROM" },
    REUNION: { code: "RE", label: "Réunion", zone: "DROM" },
    YT: { code: "YT", label: "Mayotte", zone: "DROM" },
    MAYOTTE: { code: "YT", label: "Mayotte", zone: "DROM" },

    BL: { code: "BL", label: "Saint-Barthélemy", zone: "COM" },
    "SAINT-BARTHÉLEMY": { code: "BL", label: "Saint-Barthélemy", zone: "COM" },
    "SAINT BARTHÉLEMY": { code: "BL", label: "Saint-Barthélemy", zone: "COM" },
    "SAINT BARTHELEMY": { code: "BL", label: "Saint-Barthélemy", zone: "COM" },

    MF: { code: "MF", label: "Saint-Martin", zone: "COM" },
    "SAINT-MARTIN": { code: "MF", label: "Saint-Martin", zone: "COM" },
    "SAINT MARTIN": { code: "MF", label: "Saint-Martin", zone: "COM" },

    SPM: { code: "SPM", label: "Saint-Pierre-et-Miquelon", zone: "COM" },
    "SAINT-PIERRE-ET-MIQUELON": { code: "SPM", label: "Saint-Pierre-et-Miquelon", zone: "COM" },
    "SAINT PIERRE ET MIQUELON": { code: "SPM", label: "Saint-Pierre-et-Miquelon", zone: "COM" },

    FR: { code: "FR", label: "Métropole", zone: "FR" },
    FRANCE: { code: "FR", label: "Métropole", zone: "FR" },
    METROPOLE: { code: "FR", label: "Métropole", zone: "FR" },
    MÉTROPOLE: { code: "FR", label: "Métropole", zone: "FR" },

    UE: { code: "UE", label: "Union Européenne", zone: "UE" },
    EU: { code: "UE", label: "Union Européenne", zone: "UE" },

    MONACO: { code: "MONACO", label: "Monaco", zone: "MONACO" },
    NC: { code: "NC", label: "Nouvelle-Calédonie", zone: "PTOM" },
    "NOUVELLE-CALEDONIE": { code: "NC", label: "Nouvelle-Calédonie", zone: "PTOM" },
    "NOUVELLE CALÉDONIE": { code: "NC", label: "Nouvelle-Calédonie", zone: "PTOM" },
    "NOUVELLE CALEDONIE": { code: "NC", label: "Nouvelle-Calédonie", zone: "PTOM" },
  };

  // formats déjà normalisés
  if (x.startsWith("DROM_")) {
    const code = x.replace("DROM_", "");
    if (map[code]) return map[code];
    return { code, label: x, zone: "DROM" };
  }

  if (map[x]) return map[x];

  // fallback (hors UE)
  return { code: "HORS_UE", label: raw ?? "Hors UE", zone: "HORS_UE" };
}

async function embedQueryOpenAI(apiKey: string, model: string, text: string) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data?.[0]?.embedding as number[];
}

async function chatOpenAI(apiKey: string, model: string, system: string, user: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function pickKeywords(question: string) {
  // simple : mots > 3 chars, on enlève stopwords mini
  const stop = new Set(["pour", "avec", "sans", "dans", "vers", "chez", "quoi", "comment", "combien", "taxe", "tva", "octroi", "mer", "om", "omr"]);
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 4 && !stop.has(w))
    )
  ).slice(0, 6);
}

async function getDocIndexHealth(supabase: any) {
  // on mesure si l’index est utilisable
  const facts: TableFact[] = [];
  try {
    const { count: docsCount } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true });
    const { count: chunksCount } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true });

    const ok = (chunksCount || 0) >= 20; // seuil simple : en dessous, c’est “quasi vide”
    facts.push({
      table: "documents/document_chunks",
      kind: "doc_index_health",
      payload: { documents: docsCount || 0, chunks: chunksCount || 0, ok },
    });
  } catch {
    facts.push({
      table: "documents/document_chunks",
      kind: "doc_index_health",
      payload: { documents: null, chunks: null, ok: false, note: "unable_to_count" },
    });
  }
  return facts;
}

async function searchClients(supabase: any, question: string) {
  // tente match sur libellé client
  const keywords = pickKeywords(question);
  if (!keywords.length) return [];

  // on construit un OR ilike
  const or = keywords.map((k) => `libelle_client.ilike.%${k}%`).join(",");
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .or(or)
    .limit(5);

  if (error) return [];
  return data ?? [];
}

async function searchProducts(supabase: any, question: string) {
  // heuristiques : EAN13 / SKU / mots clés sur libellé
  const ean = (question.match(/\b\d{13}\b/g) || [])[0] || null;
  if (ean) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or(`code_acl13_ou_ean13.eq.${ean},ean13.eq.${ean}`)
      .limit(5);
    if (!error && data?.length) return data;
  }

  const keywords = pickKeywords(question);
  if (!keywords.length) return [];

  const or = keywords
    .map((k) => `libelle_article.ilike.%${k}%`)
    .concat(keywords.map((k) => `label.ilike.%${k}%`))
    .concat(keywords.map((k) => `name.ilike.%${k}%`))
    .join(",");

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .or(or)
    .limit(8);

  if (error) return [];
  return data ?? [];
}

async function getSalesAgg(supabase: any, territoryCode: string | null, from: string, to: string) {
  // agrégat simple via select puis reduce (évite SQL raw)
  const q = supabase
    .from("sales")
    .select("id,sale_date,territory_code,amount_ht,amount_ttc")
    .gte("sale_date", from)
    .lte("sale_date", to)
    .limit(5000);

  if (territoryCode && territoryCode !== "FR" && territoryCode !== "UE" && territoryCode !== "HORS_UE") {
    q.eq("territory_code", territoryCode);
  }

  const { data, error } = await q;
  if (error) return { rows: 0, total_ht: 0, total_ttc: 0, by_territory: {} };

  const rows = data ?? [];
  const by: Record<string, { rows: number; ht: number; ttc: number }> = {};

  let totalHt = 0;
  let totalTtc = 0;

  for (const r of rows) {
    const code = (r.territory_code || "FR").toString();
    by[code] ||= { rows: 0, ht: 0, ttc: 0 };
    by[code].rows += 1;
    by[code].ht += Number(r.amount_ht || 0);
    by[code].ttc += Number(r.amount_ttc || 0);
    totalHt += Number(r.amount_ht || 0);
    totalTtc += Number(r.amount_ttc || 0);
  }

  return { rows: rows.length, total_ht: totalHt, total_ttc: totalTtc, by_territory: by };
}

async function getCostsAgg(supabase: any, destinationCode: string | null, from: string, to: string) {
  const tryTables = ["cost_lines", "costs"];
  let tableUsed: string | null = null;
  let data: any[] = [];
  for (const t of tryTables) {
    const q = supabase
      .from(t)
      .select("id,date,destination,amount,cost_type")
      .gte("date", from)
      .lte("date", to)
      .limit(5000);

    if (destinationCode && destinationCode !== "FR" && destinationCode !== "UE" && destinationCode !== "HORS_UE") {
      q.eq("destination", destinationCode);
    }

    const res = await q;
    if (!res.error) {
      tableUsed = t;
      data = res.data ?? [];
      break;
    }
    if (!isMissingTableError(res.error)) {
      // autre erreur => on stop
      break;
    }
  }

  const byType: Record<string, number> = {};
  let total = 0;
  for (const r of data) {
    const k = (r.cost_type || "autre").toString();
    byType[k] = (byType[k] || 0) + Number(r.amount || 0);
    total += Number(r.amount || 0);
  }

  return { table: tableUsed, rows: data.length, total, by_type: byType };
}

function firstExistingKey(obj: any, candidates: string[]) {
  if (!obj) return null;
  const keys = new Set(Object.keys(obj));
  for (const c of candidates) if (keys.has(c)) return c;
  return null;
}

async function pickFirstWorkingTable(supabase: any, tables: string[]) {
  for (const t of tables) {
    const res = await supabase.from(t).select("*").limit(1);
    if (!res.error) return { table: t, sample: (res.data || [])[0] ?? null };
    if (!isMissingTableError(res.error)) throw res.error;
  }
  throw new Error("no_accessible_table");
}

function percentFormat(raw: any) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  const v = n > 0 && n <= 1 ? n * 100 : n;
  const rounded = Math.round(v * 100) / 100;
  return `${rounded}%`;
}

function extractRateFromRow(row: any) {
  const v =
    row?.om_rate ??
    row?.omr_rate ??
    row?.taux_om ??
    row?.taux ??
    row?.rate ??
    row?.octroi_rate ??
    row?.om ??
    null;
  return percentFormat(v);
}

async function getTaxContext(supabase: any, territoryCode: string, hsList: string[]) {
  const facts: TableFact[] = [];

  if (!territoryCode || !hsList.length) return facts;

  // 1) OM / Octroi (octroi_rates puis om_rates)
  try {
    const picked = await pickFirstWorkingTable(supabase, ["octroi_rates", "om_rates"]);
    const t = picked.table;
    const sample = picked.sample;

    const territoryCol = firstExistingKey(sample, ["territory_code", "drom_code", "destination", "ile", "territory"]);
    const hsCol = firstExistingKey(sample, ["hs_code", "hs", "hs6", "hs8", "hs10", "hs4"]);

    if (territoryCol && hsCol) {
      // si table en hs4/hs6 etc -> match par préfixe
      const hsColLower = hsCol.toLowerCase();
      const hsLen =
        hsColLower.includes("hs4") ? 4 :
        hsColLower.includes("hs6") ? 6 :
        hsColLower.includes("hs8") ? 8 :
        hsColLower.includes("hs10") ? 10 : 0;

      const hsFilter = hsLen ? Array.from(new Set(hsList.map((h) => normalizeHS(h).slice(0, hsLen)))) : hsList;

      const res = await supabase
        .from(t)
        .select("*")
        .eq(territoryCol as any, territoryCode)
        .in(hsCol as any, hsFilter as any)
        .limit(200);

      if (!res.error) {
        const rows = res.data ?? [];
        facts.push({
          table: t,
          kind: "tax_om",
          payload: {
            territory_code: territoryCode,
            hs_query: hsList,
            matches: rows.slice(0, 20).map((r: any) => ({
              hs: r[hsCol],
              rate: extractRateFromRow(r),
              raw: r,
            })),
          },
        });
      }
    }
  } catch {
    // ignore
  }

  // 2) VAT
  try {
    const pickedVat = await pickFirstWorkingTable(supabase, ["vat_rates", "vat_rates_v2"]);
    const t = pickedVat.table;
    const sample = pickedVat.sample;
    const territoryCol = firstExistingKey(sample, ["territory_code", "destination", "zone", "drom_code", "territory"]);
    if (territoryCol) {
      const res = await supabase
        .from(t)
        .select("*")
        .eq(territoryCol as any, territoryCode)
        .limit(50);
      if (!res.error) {
        facts.push({ table: t, kind: "vat", payload: { territory_code: territoryCode, rows: res.data ?? [] } });
      }
    }
  } catch {
    // ignore
  }

  // 3) Taxes extra
  try {
    const pickedTax = await pickFirstWorkingTable(supabase, ["tax_rules_extra"]);
    const t = pickedTax.table;
    const sample = pickedTax.sample;
    const territoryCol = firstExistingKey(sample, ["territory_code", "destination", "zone", "drom_code", "territory"]);
    if (territoryCol) {
      const res = await supabase
        .from(t)
        .select("*")
        .eq(territoryCol as any, territoryCode)
        .limit(200);
      if (!res.error) {
        facts.push({ table: t, kind: "tax_extra", payload: { territory_code: territoryCode, rows: res.data ?? [] } });
      }
    }
  } catch {
    // ignore
  }

  return facts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  const EMB_MODEL = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
  const CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-4.1-mini";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "Missing supabase env (SUPABASE_URL / SERVICE_ROLE)" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const question = String(body?.question ?? "").trim();
  if (!question) return json(400, { ok: false, error: "question is required" });

  const destinationInfo = normalizeDestination(body.destination ?? null);
  const incoterm = (body.incoterm ?? null)?.toString().trim().toUpperCase() || null;

  const { from: defFrom, to: defTo } = defaultRange30d();
  const dateFrom = (body.date_from ?? defFrom).toString().slice(0, 10);
  const dateTo = (body.date_to ?? defTo).toString().slice(0, 10);

  const includeLive = body.include_live_data !== false;

  const matchCount = body.match_count ?? 8;
  const filter = body.doc_filter ?? {};

  const facts: TableFact[] = [];
  const citations: Citation[] = [];

  // 0) Healthcheck index docs
  const docHealthFacts = await getDocIndexHealth(supabase);
  facts.push(...docHealthFacts);
  const docIndexOk = Boolean(docHealthFacts?.[0]?.payload?.ok);

  // 1) Live data (clients/products/sales/costs/taxes)
  let client: any = null;
  let products: any[] = [];

  let salesAgg: any = null;
  let costsAgg: any = null;

  let taxFacts: TableFact[] = [];

  const hsCandidates = extractHsCandidates(question);

  if (includeLive) {
    try {
      if (body.client_id) {
        const { data } = await supabase.from("clients").select("*").eq("id", body.client_id).maybeSingle();
        client = data ?? null;
      } else {
        const maybe = await searchClients(supabase, question);
        if (maybe?.length) client = maybe[0];
        if (maybe?.length) facts.push({ table: "clients", kind: "client", payload: { matches: maybe.slice(0, 5) } });
      }

      if (body.product_ids?.length) {
        const { data } = await supabase.from("products").select("*").in("id", body.product_ids);
        products = data ?? [];
      } else {
        const maybe = await searchProducts(supabase, question);
        products = maybe ?? [];
        if (products.length) facts.push({ table: "products", kind: "products", payload: { matches: products.slice(0, 8) } });
      }

      salesAgg = await getSalesAgg(
        supabase,
        destinationInfo.code === "HORS_UE" || destinationInfo.code === "UE" ? null : destinationInfo.code,
        dateFrom,
        dateTo,
      );
      facts.push({ table: "sales", kind: "sales_agg", payload: { date_from: dateFrom, date_to: dateTo, destination: destinationInfo.code, ...salesAgg } });

      costsAgg = await getCostsAgg(
        supabase,
        destinationInfo.code === "HORS_UE" || destinationInfo.code === "UE" ? null : destinationInfo.code,
        dateFrom,
        dateTo,
      );
      facts.push({ table: costsAgg?.table || "cost_lines/costs", kind: "costs_agg", payload: { date_from: dateFrom, date_to: dateTo, destination: destinationInfo.code, ...costsAgg } });

      // taxes : utile surtout si DROM + HS
      if (destinationInfo.zone === "DROM" && hsCandidates.length) {
        taxFacts = await getTaxContext(supabase, destinationInfo.code, hsCandidates);
        facts.push(...taxFacts);
      }
    } catch {
      // on ne bloque pas l'assistant si live-data échoue
    }
  }

  // 2) RAG docs-first (si index OK + OPENAI dispo)
  let docAnswer: string | null = null;
  let ragError: string | null = null;

  if (OPENAI_API_KEY && docIndexOk) {
    try {
      const enrichedQuery =
        `${question}\n` +
        `Destination: ${destinationInfo.label} (${destinationInfo.code})\n` +
        `Zone: ${destinationInfo.zone}\n` +
        `Incoterm: ${incoterm ?? "n/a"}\n` +
        (hsCandidates.length ? `HS candidates: ${hsCandidates.join(", ")}\n` : "");

      const queryEmbedding = await embedQueryOpenAI(OPENAI_API_KEY, EMB_MODEL, enrichedQuery);

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
            `[#DOC${i + 1}] ${r.title} (${r.doc_type ?? "doc"}, ${r.published_at ?? "n/a"}) [chunk ${r.chunk_index}]\n${r.content}`,
        )
        .join("\n\n---\n\n");

      // si pas de context, on laisse docAnswer null
      if (rows.length) {
        const system =
          "Tu es l’assistant Export Navigator (Orliman). " +
          "Tu réponds de façon opérationnelle, courte, structurée. " +
          "Quand tu affirmes une règle ou un taux, tu cites la source. " +
          "Sources possibles : extraits DOC (références #DOCx + chunk) et faits issus des tables (références [TABLE:...]). " +
          "Si une info n’est pas présente, tu dis clairement ce qui manque.";

        const liveBrief =
          includeLive
            ? [
                `Faits tables (résumé):`,
                client ? `- Client trouvé: ${client.libelle_client ?? client.name ?? client.id}` : `- Client: n/a`,
                products?.length ? `- Produits (top): ${products.slice(0, 6).map((p: any) => p.libelle_article ?? p.label ?? p.name ?? p.id).join(" | ")}` : `- Produits: n/a`,
                salesAgg ? `- Ventes: ${salesAgg.rows} lignes, total HT=${Math.round(salesAgg.total_ht)} EUR` : `- Ventes: n/a`,
                costsAgg ? `- Coûts: ${costsAgg.rows} lignes, total=${Math.round(costsAgg.total)} EUR` : `- Coûts: n/a`,
                taxFacts?.length ? `- Taxes DROM/HS: ${taxFacts.map((t) => t.kind).join(", ")}` : `- Taxes DROM/HS: n/a`,
              ].join("\n")
            : "Faits tables: désactivé.";

        const user =
          `Question:\n${question}\n\n` +
          `Contexte:\n- destination=${destinationInfo.label} (${destinationInfo.code})\n- incoterm=${incoterm ?? "n/a"}\n- période=${dateFrom} → ${dateTo}\n\n` +
          `${liveBrief}\n\n` +
          `Extraits documents:\n${context}\n\n` +
          "Contraintes de réponse:\n" +
          "1) Donne une réponse en 3 sections: (A) Décision / Qui fait quoi (B) Checklist documents (C) Risques + next steps.\n" +
          "2) Cite au moins 1 source DOC si tu utilises les documents (ex: #DOC2 chunk 5).\n" +
          "3) Si tu utilises les tables (produits/ventes/coûts), mentionne [TABLE:products] / [TABLE:sales] etc.\n";

        docAnswer = await chatOpenAI(OPENAI_API_KEY, CHAT_MODEL, system, user);

        rows.forEach((r: any) => {
          citations.push({
            document_id: r.document_id,
            title: r.title,
            published_at: r.published_at ?? null,
            chunk_index: r.chunk_index,
            similarity: r.similarity,
          });
        });
      }
    } catch (e) {
      ragError = String(e);
      docAnswer = null;
    }
  } else if (!docIndexOk) {
    ragError = "Document index not ready (document_chunks too low).";
  } else if (!OPENAI_API_KEY) {
    ragError = "OPENAI_API_KEY missing.";
  }

  // 3) Fallback “smart” (mais basé sur tes tables)
  const fallback =
    `Je ne peux pas m’appuyer correctement sur la base documentaire pour l’instant.\n\n` +
    `Raison probable: index documentaire insuffisant (chunks ~ 0) ou pas de clé OPENAI.\n\n` +
    `✅ Ce que je peux déjà exploiter: tes tables (produits/clients/ventes/coûts) + tes taux OM/TVA si dispo.\n\n` +
    `Prochaine action: relancer l’ingestion PDF → création de chunks + embeddings, sinon le RAG ne trouvera rien.`;

  const mode =
    docAnswer && citations.length
      ? "docs_rag_plus_tables"
      : body.strict_docs_only
        ? "docs_only_unavailable"
        : "tables_plus_fallback";

  if (docAnswer && citations.length) {
    return json(200, {
      ok: true,
      mode,
      destination: destinationInfo.code,
      answer: docAnswer,
      citations,
      table_facts: facts,
      debug: {
        destination: destinationInfo,
        incoterm,
        hs_candidates: hsCandidates,
        date_from: dateFrom,
        date_to: dateTo,
        rag_error: ragError ?? null,
        doc_index_ok: docIndexOk,
      },
    });
  }

  if (body.strict_docs_only) {
    return json(200, {
      ok: true,
      mode,
      destination: destinationInfo.code,
      answer:
        "Je ne trouve pas la réponse dans la base documentaire disponible (ou elle n’est pas indexée). " +
        "Action: ré-ingérer les PDFs (chunks + embeddings), puis relancer.",
      citations: [],
      table_facts: facts,
      debug: {
        destination: destinationInfo,
        incoterm,
        hs_candidates: hsCandidates,
        date_from: dateFrom,
        date_to: dateTo,
        rag_error: ragError ?? null,
        doc_index_ok: docIndexOk,
      },
    });
  }

  return json(200, {
    ok: true,
    mode,
    destination: destinationInfo.code,
    answer: fallback,
    citations: [],
    table_facts: facts,
    debug: {
      destination: destinationInfo,
      incoterm,
      hs_candidates: hsCandidates,
      date_from: dateFrom,
      date_to: dateTo,
      rag_error: ragError ?? null,
      doc_index_ok: docIndexOk,
    },
  });
});
