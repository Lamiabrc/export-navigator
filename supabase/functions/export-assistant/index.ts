// supabase/functions/export-assistant/index.ts
// Edge Function: export-assistant
// Objectif : répondre avec (1) base documentaire vectorisée (RAG) + (2) "live data" depuis tes tables (products, clients, sales, cost_lines/costs, etc.)
// Sécurité : exige un JWT (Authorization: Bearer <access_token>) + option allowlist emails via env ALLOWED_EMAILS

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

type DromCode = "GP" | "MQ" | "GF" | "RE" | "YT" | "UNKNOWN";
type ComCode = "BL" | "MF" | "SPM" | "UNKNOWN";

type DestinationKey =
  | "UE"
  | "HORS_UE"
  | "MONACO"
  | "PTOM_NOUVELLE_CALEDONIE"
  | `DROM_${DromCode}`
  | `COM_${ComCode}`;

type AssistantRequest = {
  question: string;
  destination?: DestinationKey | string | null;
  incoterm?: string | null;
  transport_mode?: string | null;

  // optionnel (si tu veux pointer des objets précis)
  client_id?: string | null;
  product_ids?: string[] | null;

  // optionnel : pour orienter la recherche dans les tables
  territory_code?: string | null; // ex: "GP"
  date_from?: string | null; // "YYYY-MM-DD"
  date_to?: string | null; // "YYYY-MM-DD"

  // doc RAG
  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
    export_zone?: string | null;
    incoterm?: string | null;
  };
  match_count?: number;
  strict_docs_only?: boolean;

  // data
  include_live_data?: boolean; // default true
  max_rows_per_table?: number; // default 25
};

type RagCitation = {
  document_id: string;
  title: string;
  published_at: string | null;
  chunk_index: number;
  similarity: number;
};

type DataSource =
  | { table: "products"; id: string }
  | { table: "clients"; id: string }
  | { table: "sales"; id: string }
  | { table: "cost_lines" | "costs"; id: string };

function nowISODate() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso: string, deltaDays: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function normalizeIncoterm(raw?: string | null) {
  const x = (raw ?? "").trim().toUpperCase();
  return x || null;
}

function normalizeDestination(raw?: string | null): DestinationKey {
  const x = (raw ?? "").toUpperCase().trim();
  if (!x) return "HORS_UE";

  // codes directs
  if (x === "UE" || x.includes("EU") || x.includes("EUROPE")) return "UE";
  if (x.includes("MONACO")) return "MONACO";
  if (x.includes("NOUVELLE") || x.includes("CALEDONIE") || x === "NC") return "PTOM_NOUVELLE_CALEDONIE";

  // DOM/COM codes
  const mapExact: Record<string, DestinationKey> = {
    GP: "DROM_GP",
    MQ: "DROM_MQ",
    GF: "DROM_GF",
    RE: "DROM_RE",
    YT: "DROM_YT",
    BL: "COM_BL",
    MF: "COM_MF",
    SPM: "COM_SPM",
  };
  if (mapExact[x]) return mapExact[x];

  // noms
  if (x.includes("GUADELOUPE")) return "DROM_GP";
  if (x.includes("MARTINIQUE")) return "DROM_MQ";
  if (x.includes("GUYANE")) return "DROM_GF";
  if (x.includes("REUNION") || x.includes("RÉUNION")) return "DROM_RE";
  if (x.includes("MAYOTTE")) return "DROM_YT";
  if (x.includes("SAINT-BARTH") || x.includes("ST BARTH") || x.includes("BARTHELEMY") || x.includes("BARTHÉLEMY")) return "COM_BL";
  if (x.includes("SAINT-MARTIN")) return "COM_MF";
  if (x.includes("MIQUELON")) return "COM_SPM";

  // generic
  if (x.startsWith("DROM_")) return x as DestinationKey;
  if (x.startsWith("COM_")) return x as DestinationKey;
  if (x.includes("DROM") || x.includes("OUTRE")) return "DROM_UNKNOWN";

  return "HORS_UE";
}

function destinationToTerritoryCode(dest: DestinationKey): string | null {
  if (dest.startsWith("DROM_")) return dest.slice("DROM_".length);
  if (dest.startsWith("COM_")) return dest.slice("COM_".length);
  if (dest === "MONACO") return "FR";
  if (dest === "UE") return "UE";
  return null;
}

function pickFirst(arr: string[]) {
  return arr.find(Boolean) ?? "";
}

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function compactNumber(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function moneyEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

// Extraction "best effort" de tokens utiles
function extractTokens(question: string) {
  const q = question.trim();

  // HS codes / EAN / codes numériques
  const nums = Array.from(q.matchAll(/\b\d{4,14}\b/g)).map((m) => m[0]);

  // mots (pour ilike)
  const words = q
    .toLowerCase()
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !["avec", "pour", "dans", "comme", "quoi", "comment", "quel", "quels", "quelle", "quelles", "prix", "taux", "omr", "octroi"].includes(w))
    .slice(0, 6);

  return { nums: nums.slice(0, 8), words };
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

async function chatOpenAI(apiKey: string, model: string, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Fallback KB (quand OpenAI ou docs indisponibles)
function kbForDestination(destination: DestinationKey) {
  const commonDocs = [
    "Facture commerciale (mentions complètes) + packing list",
    "Document transport (AWB/BL/CMR) + preuve d’expédition/livraison",
    "HS code + origine + valeur (au moins en interne)",
    "Certificats/attestations conformité selon produit/destination (si DM : IFU/étiquetage/traçabilité)",
  ];

  const base = {
    documents_checklist: commonDocs,
    transport_customs_basics: [
      "Clarifier Incoterm + lieu : qui paie transport/assurance/taxes/dédouanement ?",
      "Verrouiller HS + origine + valeur : causes n°1 de blocages/coûts à l’import.",
      "Toujours exiger preuves de transport + livraison.",
    ],
    taxes_and_costs_basics: [
      "Ne pas annoncer un taux fixe sans validation : taxes varient (destination, HS, incoterm, statut client).",
      "Définir l’importateur de référence (IOR) et qui supporte taxes/droits (DAP vs DDP).",
      "Séparer ventes / charges / taxes (TVA, OM/OMR, droits) dans ton pilotage.",
    ],
    risks_and_pitfalls: [
      "Incoterm flou → litiges et surcoûts",
      "HS/origine/valeur incohérents → retards + taxes imprévues",
      "Docs incomplets → blocage",
    ],
    next_steps: [
      "Confirmer destination + incoterm + lieu",
      "Valider HS + origine + valeur + IOR",
      "Préparer pack documentaire + preuves",
      "Verrouiller qui dédouane / qui paie taxes",
    ],
  };

  if (destination.startsWith("DROM_") || destination.startsWith("COM_")) {
    return {
      ...base,
      taxes_and_costs_basics: [
        "Métropole → Outre-mer : sécuriser preuves + traitement fiscal selon cas.",
        "Anticiper Octroi de mer (OM/OMR) si DROM : qui paie ? selon incoterm / contrat.",
        ...base.taxes_and_costs_basics,
      ],
    };
  }
  if (destination === "UE") {
    return {
      ...base,
      taxes_and_costs_basics: [
        "UE : pas de dédouanement ; focus TVA intracom (statut client + preuve transport).",
        ...base.taxes_and_costs_basics,
      ],
    };
  }
  return {
    ...base,
    taxes_and_costs_basics: [
      "Hors UE : export souvent HT si preuve d’export ; taxes/droits payés à l’import selon pays.",
      "DDP hors UE : attention IOR/immatriculation (risque de blocage si non cadré).",
      ...base.taxes_and_costs_basics,
    ],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // ---- ENV ----
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  const EMB_MODEL = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
  const CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-4.1-mini";

  const ALLOWED_EMAILS_RAW = (Deno.env.get("ALLOWED_EMAILS") ?? "").trim(); // ex: "lamia@..., patrick@..."
  const ALLOWED_EMAILS = ALLOWED_EMAILS_RAW
    ? new Set(ALLOWED_EMAILS_RAW.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))
    : null;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "Missing supabase env" });

  // ---- AUTH: require Bearer token ----
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return json(401, { error: "Missing Authorization Bearer token" });

  // Service-role client (DB + auth.getUser(jwt))
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json(401, { error: "Invalid session" });

  const userEmail = (userData.user.email || "").toLowerCase();
  if (ALLOWED_EMAILS && !ALLOWED_EMAILS.has(userEmail)) {
    return json(403, { error: "Forbidden" });
  }

  // ---- BODY ----
  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const question = (body?.question ?? "").trim();
  if (!question) return json(400, { error: "question is required" });

  const destination = normalizeDestination(body.destination ?? null);
  const incoterm = normalizeIncoterm(body.incoterm);
  const transportMode = (body.transport_mode ?? null)?.trim() ?? null;

  const includeLiveData = body.include_live_data !== false;
  const maxRows = Math.min(Math.max(body.max_rows_per_table ?? 25, 5), 80);

  // dates
  const today = nowISODate();
  const dateTo = (body.date_to ?? today).slice(0, 10);
  const dateFrom = (body.date_from ?? addDaysISO(dateTo, -30)).slice(0, 10);

  const tokens = extractTokens(question);

  // ---- DATA: fetch live rows (best effort) ----
  let client: any = null;
  let products: any[] = [];
  let sales: any[] = [];
  let costs: any[] = [];
  const dataSources: DataSource[] = [];
  let liveDataError: string | null = null;

  const territoryHint =
    (body.territory_code ?? null) ||
    destinationToTerritoryCode(destination) ||
    null;

  if (includeLiveData) {
    try {
      // ---- CLIENT ----
      if (body.client_id) {
        const { data, error } = await admin.from("clients").select("*").eq("id", body.client_id).maybeSingle();
        if (error) throw error;
        client = data ?? null;
        if (client?.id) dataSources.push({ table: "clients", id: client.id });
      } else if (tokens.words.length) {
        // recherche simple sur libelle_client / code_ets / ville
        const w = tokens.words[0];
        const { data, error } = await admin
          .from("clients")
          .select("*")
          .or(`libelle_client.ilike.%${w}%,code_ets.ilike.%${w}%,ville.ilike.%${w}%`)
          .limit(5);
        if (!error && data?.length) {
          client = data[0];
          if (client?.id) dataSources.push({ table: "clients", id: client.id });
        }
      }

      // ---- PRODUCTS ----
      if (body.product_ids?.length) {
        const { data, error } = await admin.from("products").select("*").in("id", body.product_ids).limit(maxRows);
        if (error) throw error;
        products = data ?? [];
      } else {
        // priorité : HS / EAN / codes numériques
        const nums = tokens.nums;

        // recherche HS probable (4,6,8,10) ou EAN(13)
        let hsCandidates = nums.filter((n) => [4, 6, 8, 10].includes(n.length));
        if (!hsCandidates.length) hsCandidates = nums.filter((n) => n.length >= 4 && n.length <= 10);

        // recherche code_article / ean / hs_code / hs4
        if (hsCandidates.length) {
          const n = hsCandidates[0];
          const { data, error } = await admin
            .from("products")
            .select("*")
            .or(
              [
                `hs_code.eq.${n}`,
                `hs4.eq.${n.slice(0, 4)}`,
                `code_article.eq.${n}`,
                `sku.eq.${n}`,
                `code_acl13_ou_ean13.eq.${n}`,
              ].join(",")
            )
            .limit(maxRows);
          if (!error && data?.length) products = data;
        }

        // sinon recherche texte (libellé)
        if (!products.length && tokens.words.length) {
          const w = tokens.words[0];
          const { data, error } = await admin
            .from("products")
            .select("*")
            .or(`libelle_article.ilike.%${w}%,label.ilike.%${w}%,name.ilike.%${w}%`)
            .limit(maxRows);
          if (!error && data?.length) products = data;
        }
      }

      for (const p of products) {
        if (p?.id) dataSources.push({ table: "products", id: p.id });
      }

      // ---- SALES ----
      try {
        let salesQ = admin
          .from("sales")
          .select("id,sale_date,territory_code,amount_ht,amount_ttc,client_id")
          .gte("sale_date", dateFrom)
          .lte("sale_date", dateTo)
          .order("sale_date", { ascending: false })
          .limit(2000);

        if (territoryHint && territoryHint !== "UE") salesQ = salesQ.eq("territory_code", territoryHint);
        if (client?.id) salesQ = salesQ.eq("client_id", client.id);

        const { data, error } = await salesQ;
        if (!error) sales = data ?? [];
      } catch {
        // ignore (table peut ne pas avoir client_id, etc.)
        const { data, error } = await admin
          .from("sales")
          .select("id,sale_date,territory_code,amount_ht,amount_ttc")
          .gte("sale_date", dateFrom)
          .lte("sale_date", dateTo)
          .order("sale_date", { ascending: false })
          .limit(2000);
        if (!error) sales = data ?? [];
      }

      for (const s of sales.slice(0, 200)) {
        if (s?.id) dataSources.push({ table: "sales", id: s.id });
      }

      // ---- COSTS (cost_lines fallback -> costs) ----
      const loadCosts = async (table: "cost_lines" | "costs") => {
        const { data, error } = await admin
          .from(table)
          .select("id,date,destination,amount,cost_type")
          .gte("date", dateFrom)
          .lte("date", dateTo)
          .order("date", { ascending: false })
          .limit(5000);
        if (error) throw error;
        return data ?? [];
      };

      try {
        costs = await loadCosts("cost_lines");
      } catch {
        costs = await loadCosts("costs");
      }

      for (const c of costs.slice(0, 200)) {
        if (c?.id) dataSources.push({ table: (c?.table as any) ?? "cost_lines", id: c.id });
      }
    } catch (e) {
      liveDataError = String(e?.message || e);
    }
  }

  // ---- Build "data context" (compact, pour le LLM) ----
  const salesTotalHt = sales.reduce((s, r) => s + (Number(r.amount_ht) || 0), 0);
  const salesTotalTtc = sales.reduce((s, r) => s + (Number(r.amount_ttc) || 0), 0);

  const costsTotal = costs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const marginEst = salesTotalHt - costsTotal;
  const marginPct = salesTotalHt > 0 ? (marginEst / salesTotalHt) * 100 : null;

  const byTerritory: Record<string, { ca_ht: number; ca_ttc: number; costs: number; count_sales: number; count_costs: number }> = {};
  for (const s of sales) {
    const code = (s.territory_code || "FR") as string;
    byTerritory[code] ||= { ca_ht: 0, ca_ttc: 0, costs: 0, count_sales: 0, count_costs: 0 };
    byTerritory[code].ca_ht += Number(s.amount_ht) || 0;
    byTerritory[code].ca_ttc += Number(s.amount_ttc) || 0;
    byTerritory[code].count_sales += 1;
  }
  for (const c of costs) {
    const code = (c.destination || "FR") as string;
    byTerritory[code] ||= { ca_ht: 0, ca_ttc: 0, costs: 0, count_sales: 0, count_costs: 0 };
    byTerritory[code].costs += Number(c.amount) || 0;
    byTerritory[code].count_costs += 1;
  }

  const topTerritories = Object.entries(byTerritory)
    .sort((a, b) => b[1].ca_ht - a[1].ca_ht)
    .slice(0, 6)
    .map(([code, v]) => ({
      code,
      ca_ht: v.ca_ht,
      ca_ttc: v.ca_ttc,
      costs: v.costs,
      margin: v.ca_ht - v.costs,
      margin_pct: v.ca_ht > 0 ? ((v.ca_ht - v.costs) / v.ca_ht) * 100 : null,
      count_sales: v.count_sales,
      count_costs: v.count_costs,
    }));

  const productSummary = products.slice(0, 12).map((p) => {
    const name = p.libelle_article ?? p.label ?? p.name ?? p.code_article ?? p.sku ?? p.id;
    const hs = p.hs_code ?? p.hs4 ?? null;
    return {
      id: p.id,
      name,
      hs,
      sku: p.sku ?? p.code_article ?? null,
      ean13: p.code_acl13_ou_ean13 ?? null,
    };
  });

  const clientSummary = client
    ? {
        id: client.id,
        name: client.libelle_client ?? client.raison_sociale ?? client.id,
        code: client.code_ets ?? null,
        ville: client.ville ?? null,
        pays: client.pays ?? null,
        drom_code: client.drom_code ?? null,
      }
    : null;

  const liveDataContext =
    includeLiveData
      ? [
          `LIVE DATA (période ${dateFrom} → ${dateTo})`,
          `- Totaux ventes: CA HT=${moneyEUR(salesTotalHt)} | CA TTC=${moneyEUR(salesTotalTtc)} | nb ventes=${compactNumber(sales.length)}`,
          `- Totaux coûts: ${moneyEUR(costsTotal)} | nb lignes coûts=${compactNumber(costs.length)}`,
          `- Marge estimée: ${moneyEUR(marginEst)}${marginPct === null ? "" : ` (${marginPct.toFixed(1)}%)`}`,
          clientSummary ? `- Client: ${clientSummary.name} (id=${clientSummary.id})` : `- Client: (non spécifié)`,
          productSummary.length
            ? `- Produits (extraits):\n${productSummary.map((p) => `  • ${p.name} | hs=${p.hs ?? "n/a"} | sku=${p.sku ?? "n/a"} | id=${p.id}`).join("\n")}`
            : `- Produits: (aucun match)`,
          topTerritories.length
            ? `- Top territoires (CA HT):\n${topTerritories
                .map(
                  (t) =>
                    `  • ${t.code} | CA HT=${moneyEUR(t.ca_ht)} | coûts=${moneyEUR(t.costs)} | marge=${moneyEUR(t.margin)}${
                      t.margin_pct === null ? "" : ` (${t.margin_pct.toFixed(1)}%)`
                    } | ventes=${t.count_sales}`,
                )
                .join("\n")}`
            : `- Territoires: (aucune donnée)`,
          liveDataError ? `- liveDataError: ${liveDataError}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  // ---- DOCS RAG ----
  const matchCount = body.match_count ?? 8;
  const filter = body.doc_filter ?? {};
  let citations: RagCitation[] = [];
  let docAnswer: string | null = null;
  let ragError: string | null = null;

  // IMPORTANT: RAG = docs; Live data = tables.
  // Tu peux décider : (a) demander au modèle d'abord d'utiliser les docs, sinon data, sinon fallback.
  const wantsDocsOnly = !!body.strict_docs_only;

  if (OPENAI_API_KEY) {
    // RAG docs-first
    try {
      const queryEmbedding = await embedQueryOpenAI(OPENAI_API_KEY, EMB_MODEL, question);

      const { data: matches, error: mErr } = await admin.rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        match_count: matchCount,
        filter_doc_type: filter.doc_type ?? null,
        filter_tags: filter.tags ?? null,
        filter_export_zone: filter.export_zone ?? null,
        filter_incoterm: filter.incoterm ?? incoterm ?? null,
      });

      if (mErr) throw new Error(mErr.message);

      const rows = (matches ?? []) as any[];

      const docContext = rows
        .slice(0, matchCount)
        .map(
          (r, i) =>
            `#${i + 1} ${r.title} (${r.doc_type ?? "doc"}, ${r.published_at ?? "n/a"}) [chunk ${r.chunk_index}]\n${r.content}`,
        )
        .join("\n\n---\n\n");

      citations = rows.slice(0, matchCount).map((r) => ({
        document_id: r.document_id,
        title: r.title,
        published_at: r.published_at ?? null,
        chunk_index: r.chunk_index,
        similarity: r.similarity,
      }));

      // Prompt
      const system = [
        "Tu es l’assistant Export Navigator.",
        "Tu as potentiellement 2 sources: (A) EXTRaits DOCUMENTAIRES (RAG) et (B) LIVE DATA (tables internes).",
        "Règles:",
        "- Si tu utilises des infos issues des extraits DOCUMENTAIRES: cite (titre + chunk).",
        "- Si tu utilises des infos issues des LIVE DATA: cite l'id et la table quand tu donnes un chiffre ou un fait.",
        "- Si l’info n’est pas disponible: dis-le clairement et demande la donnée manquante.",
        "- Réponse en français, structurée, actionnable (checklist + risques + next steps).",
        "- Ne révèle pas de clés/API ni de détails techniques inutiles.",
      ].join("\n");

      const userMsg = [
        `QUESTION:\n${question}`,
        "",
        `CONTEXTE OPÉRATIONNEL:\n- destination=${destination}\n- incoterm=${incoterm ?? "n/a"}\n- transport=${transportMode ?? "n/a"}\n- territory_hint=${territoryHint ?? "n/a"}\n- période=${dateFrom} → ${dateTo}`,
        "",
        includeLiveData && liveDataContext ? `LIVE DATA:\n${liveDataContext}` : "LIVE DATA: (désactivé)",
        "",
        citations.length ? `EXTRAITS DOCUMENTS:\n${docContext}` : "EXTRAITS DOCUMENTS: (aucun match)",
        "",
        "Contraintes:",
        "- Si strict_docs_only=true: n'utilise QUE les extraits documents.",
        "- Sinon: privilégie d'abord les extraits documents, puis complète avec LIVE DATA si pertinent.",
      ].join("\n");

      docAnswer = await chatOpenAI(OPENAI_API_KEY, CHAT_MODEL, [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ]);
    } catch (e) {
      ragError = String(e?.message || e);
    }
  }

  // ---- Decide response mode ----
  // Cas 1: réponse via LLM (docs + éventuellement data)
  if (docAnswer && docAnswer.trim()) {
    return json(200, {
      ok: true,
      mode: citations.length ? (includeLiveData ? "docs_rag+live_data" : "docs_rag") : (includeLiveData ? "live_data_only_llm" : "llm_no_docs"),
      destination,
      incoterm,
      transport_mode: transportMode,
      answer: docAnswer.trim(),
      citations,
      data_sources: includeLiveData ? dataSources.slice(0, 400) : [],
      live_data: includeLiveData
        ? {
            period: { from: dateFrom, to: dateTo },
            totals: {
              sales_ht: salesTotalHt,
              sales_ttc: salesTotalTtc,
              costs: costsTotal,
              margin: marginEst,
              margin_pct: marginPct,
            },
            top_territories: topTerritories,
            client: clientSummary,
            products: productSummary,
          }
        : null,
      debug: { ragError: ragError ?? null, liveDataError: liveDataError ?? null, user: { email: userEmail } },
    });
  }

  // Cas 2: strict docs only demandé
  if (wantsDocsOnly) {
    return json(200, {
      ok: true,
      mode: "docs_only",
      destination,
      incoterm,
      transport_mode: transportMode,
      answer:
        "Je ne trouve pas la réponse dans la base documentaire disponible (ou elle n’est pas accessible). " +
        "Ajoute/importe les documents pertinents dans la Reference Library (PDF) puis relance.",
      citations: [],
      data_sources: [],
      debug: { ragError: ragError ?? "No docs / no matches", liveDataError: liveDataError ?? null, user: { email: userEmail } },
    });
  }

  // Cas 3: fallback KB + résumé data (si dispo)
  const kb = kbForDestination(destination);

  const fallbackAnswerParts = [
    `Je n’ai pas pu m’appuyer sur la base documentaire (ou je n’ai pas trouvé d’extraits pertinents).`,
    includeLiveData
      ? `J’ai toutefois accès à tes données (tables). Sur ${dateFrom} → ${dateTo}: CA HT=${moneyEUR(salesTotalHt)}, coûts=${moneyEUR(costsTotal)}, marge≈${moneyEUR(marginEst)}${
          marginPct === null ? "" : ` (${marginPct.toFixed(1)}%)`
        }.`
      : `LIVE DATA désactivé.`,
    `Voici une synthèse opérationnelle (fallback) pour ${destination}${incoterm ? ` / ${incoterm}` : ""}.`,
  ];

  return json(200, {
    ok: true,
    mode: includeLiveData ? "fallback_kb+live_data" : "fallback_kb",
    destination,
    incoterm,
    transport_mode: transportMode,
    answer: fallbackAnswerParts.join(" "),
    kb,
    citations: [],
    data_sources: includeLiveData ? dataSources.slice(0, 400) : [],
    live_data: includeLiveData
      ? {
          period: { from: dateFrom, to: dateTo },
          totals: {
            sales_ht: salesTotalHt,
            sales_ttc: salesTotalTtc,
            costs: costsTotal,
            margin: marginEst,
            margin_pct: marginPct,
          },
          top_territories: topTerritories,
          client: clientSummary,
          products: productSummary,
        }
      : null,
    debug: { ragError: ragError ?? "No docs / no matches", liveDataError: liveDataError ?? null, user: { email: userEmail } },
  });
});
