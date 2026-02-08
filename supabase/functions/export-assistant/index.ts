import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AssistantRequest = {
  question: string;

  // contexte UI (optionnel)
  destination?: string | null;
  origin?: string | null;
  incoterm?: string | null;
  transport_mode?: string | null;

  // recherche
  match_count?: number;
  strict_docs_only?: boolean;
  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
  };

  // override langue (optionnel)
  lang?: "fr" | "en" | null;
};

type Citation = {
  title: string;
  chunk_index: number;
  similarity?: number;
  published_at?: string;
};

type AssistantSections = Record<string, string[]>;

type AssistantResponse = {
  ok: boolean;
  mode: string;
  language: "fr" | "en";

  destination?: string | null;
  origin?: string | null;
  incoterm?: string | null;
  transport_mode?: string | null;

  answer: string;
  summary?: string;
  questions?: string[];
  actionsSuggested?: string[];
  sections?: AssistantSections;
  citations?: Citation[];

  debug?: any;
  error?: string;
};

type DocMatch = {
  document_id: string;
  title: string;
  doc_type: string | null;
  published_at: string | null;
  chunk_index: number;
  content: string;
};

type KBRow = {
  slug: string;
  language: "fr" | "en";
  title: string;
  summary: string | null;
  body_md: string;
  tags: string[] | null;
  actions: string[] | null;
  followups: string[] | null;
  updated_at: string | null;
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

function stripAccents(s: string) {
  try {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

function normalizeIncoterm(raw?: string | null) {
  const v = normStr(raw).toUpperCase().replace(/[^A-Z]/g, "");
  const ALL = new Set(["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"]);
  return ALL.has(v) ? v : (v ? v : null);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function detectLanguage(question: string): "fr" | "en" {
  const q = question.trim();
  if (!q) return "fr";
  if (/[àâçéèêëîïôùûüÿœæ]/i.test(q)) return "fr";

  const text = stripAccents(q).toLowerCase();
  const padded = ` ${text.replace(/\s+/g, " ")} `;

  const frWords = [" le ", " la ", " les ", " des ", " du ", " de ", " un ", " une ", " pour ", " comment ", " quels ", " quelles ", " douane ", " tva ", " droit "];
  const enWords = [" the ", " and ", " of ", " to ", " for ", " how ", " what ", " which ", " customs ", " vat ", " duty ", " import ", " export "];

  const frScore = frWords.reduce((acc, w) => acc + (padded.includes(w) ? 1 : 0), 0);
  const enScore = enWords.reduce((acc, w) => acc + (padded.includes(w) ? 1 : 0), 0);

  return enScore > frScore ? "en" : "fr";
}

function extractHsCandidates(text: string) {
  const matches = text.match(/\b\d{4,10}\b/g) || [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

function pickKeywords(question: string, max = 6) {
  const stopFr = new Set(["comment", "pourquoi", "quelle", "quelles", "quels", "quoi", "avec", "sans", "dans", "sur", "vers", "afin", "plus", "moins", "vous", "nous", "export", "import"]);
  const stopEn = new Set(["how", "why", "what", "which", "with", "without", "into", "from", "to", "for", "your", "our", "export", "import"]);

  const raw = stripAccents(question).toLowerCase();
  const tokens = raw.split(/[^a-z0-9]+/g).filter(Boolean);

  const kept = tokens
    .filter((t) => t.length >= 4)
    .filter((t) => !(stopFr.has(t) || stopEn.has(t)))
    .slice(0, 30);

  kept.sort((a, b) => b.length - a.length);

  const uniq: string[] = [];
  for (const t of kept) {
    if (!uniq.includes(t)) uniq.push(t);
    if (uniq.length >= max) break;
  }
  return uniq;
}

function toLines(md: string) {
  return md.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
}

// --------- Mini fallback interne (si la table kb_articles est vide)
type KBEntry = {
  id: string;
  tags: string[];
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  followups_fr: string[];
  followups_en: string[];
  actions_fr: string[];
  actions_en: string[];
};

const FALLBACK_KB: KBEntry[] = [
  {
    id: "incoterms_overview",
    tags: ["incoterm", "incoterms", "delivery", "risk", "cost", "transport"],
    title_fr: "Incoterms® 2020 : définition et utilité",
    title_en: "Incoterms® 2020: definition and why they matter",
    body_fr:
      "Les Incoterms® (ICC) définissent **qui supporte les coûts**, **où le risque est transféré**, et **qui fait quelles formalités** (export/import).\n\n" +
      "✅ Ils ne définissent pas le transfert de propriété, ni le prix, ni le paiement.\n\n" +
      "Tous modes : EXW, FCA, CPT, CIP, DAP, DPU, DDP\nMaritime : FAS, FOB, CFR, CIF\n\n" +
      "Bon réflexe : préciser un **lieu nommé** (ex: “FCA Le Havre”, “DAP Berlin”).",
    body_en:
      "Incoterms® (ICC) define **who pays which costs**, **where risk transfers**, and **who handles export/import formalities**.\n\n" +
      "✅ They do NOT define transfer of title/ownership, price, or payment terms.\n\n" +
      "Any mode: EXW, FCA, CPT, CIP, DAP, DPU, DDP\nSea: FAS, FOB, CFR, CIF\n\n" +
      "Best practice: always name the **exact place** (e.g., “FCA Le Havre”, “DAP Berlin”).",
    followups_fr: ["Pays de destination ?", "Mode de transport ?", "Incoterm envisagé ?"],
    followups_en: ["Destination country?", "Transport mode?", "Which Incoterm?"],
    actions_fr: ["Choisir 2 Incoterms et comparer risques/coûts.", "Ajouter le lieu nommé partout (contrat/proforma)."],
    actions_en: ["Pick 2 Incoterms and compare risk/cost split.", "Add the named place everywhere (contract/proforma)."],
  },
];

function scoreFallbackKB(entry: KBEntry, q: string): number {
  const text = stripAccents(q).toLowerCase();
  let s = 0;
  for (const tag of entry.tags) if (text.includes(stripAccents(tag).toLowerCase())) s += 2;
  for (const k of pickKeywords(q, 6)) if (text.includes(k)) s += 1;
  const inc = normalizeIncoterm(q);
  if (inc && (entry.body_fr.includes(inc) || entry.body_en.includes(inc))) s += 2;
  return s;
}

function buildFromFallbackKB(lang: "fr" | "en", entry: KBEntry) {
  const title = lang === "fr" ? entry.title_fr : entry.title_en;
  const body = lang === "fr" ? entry.body_fr : entry.body_en;
  const questions = lang === "fr" ? entry.followups_fr : entry.followups_en;
  const actions = lang === "fr" ? entry.actions_fr : entry.actions_en;

  const sections: AssistantSections = {};
  sections[title] = toLines(body);

  return { summary: title, answer: body, sections, questions, actionsSuggested: actions };
}

// --------- Recherche KB en base (kb_articles)
async function searchKBArticles(supabase: any, question: string, lang: "fr" | "en", limit: number) {
  // 1) FTS (websearch)
  try {
    const { data, error } = await supabase
      .from("kb_articles")
      .select("slug,language,title,summary,body_md,tags,actions,followups,updated_at")
      .eq("enabled", true)
      .eq("language", lang)
      .textSearch("search_vector", question, {
        type: "websearch",
        config: lang === "fr" ? "french" : "english",
      })
      .limit(limit);

    if (!error && Array.isArray(data) && data.length) {
      return { rows: data as KBRow[], error: null as string | null, mode: "fts" as const };
    }
    if (error) {
      return { rows: [] as KBRow[], error: error.message, mode: "fts" as const };
    }
  } catch (e: any) {
    // ignore -> fallback ilike
  }

  // 2) Fallback ILIKE sur keywords
  const keywords = pickKeywords(question, 6);
  if (!keywords.length) return { rows: [] as KBRow[], error: null as string | null, mode: "ilike" as const };

  const or = keywords.map((k) => `title.ilike.%${k}%`).concat(keywords.map((k) => `body_md.ilike.%${k}%`)).join(",");

  const { data: data2, error: error2 } = await supabase
    .from("kb_articles")
    .select("slug,language,title,summary,body_md,tags,actions,followups,updated_at")
    .eq("enabled", true)
    .eq("language", lang)
    .or(or)
    .limit(limit);

  return { rows: (data2 ?? []) as KBRow[], error: error2?.message ?? null, mode: "ilike" as const };
}

function scoreKBRow(row: KBRow, q: string): number {
  const text = stripAccents(q).toLowerCase();
  let s = 0;
  const tags = row.tags ?? [];
  for (const tag of tags) if (text.includes(stripAccents(tag).toLowerCase())) s += 2;
  for (const k of pickKeywords(q, 6)) if (text.includes(k)) s += 1;
  const inc = normalizeIncoterm(q);
  if (inc && row.body_md.includes(inc)) s += 2;
  return s;
}

function buildFromKBRow(lang: "fr" | "en", row: KBRow) {
  const sections: AssistantSections = {};
  sections[row.title] = toLines(row.body_md);

  const questions =
    (row.followups ?? []).filter(Boolean).slice(0, 6);

  const actionsSuggested =
    (row.actions ?? []).filter(Boolean).slice(0, 8);

  return {
    summary: row.title,
    answer: row.body_md,
    sections,
    questions,
    actionsSuggested,
  };
}

// --------- Recherche docs (document_chunks) sans embeddings
async function searchDocs(supabase: any, question: string, matchCount: number, filter?: AssistantRequest["doc_filter"]) {
  const keywords = pickKeywords(question, 6);
  if (!keywords.length) return { matches: [] as DocMatch[], error: null as string | null };

  const or = keywords.map((k) => `content.ilike.%${k}%`).join(",");

  try {
    let q = supabase
      .from("document_chunks")
      .select("document_id,title,doc_type,published_at,chunk_index,content")
      .or(or)
      .limit(clamp(matchCount, 1, 20));

    if (filter?.doc_type) q = q.eq("doc_type", filter.doc_type);
    // tags : si tu as tags (text[]) dans document_chunks, tu peux décommenter :
    // if (filter?.tags?.length) q = q.contains("tags", filter.tags);

    const { data, error } = await q;
    if (error) return { matches: [] as DocMatch[], error: error.message };
    return { matches: (data ?? []) as DocMatch[], error: null as string | null };
  } catch (e: any) {
    return { matches: [] as DocMatch[], error: String(e?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { ok: false, error: "Missing supabase env" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const question = normStr(body?.question);
  if (!question) return json(400, { ok: false, error: "question is required" });

  const lang: "fr" | "en" = body.lang ?? detectLanguage(question);

  const matchCount = clamp(Number(body.match_count ?? 6), 1, 20);
  const strictDocsOnly = Boolean(body.strict_docs_only);

  const incoterm = normalizeIncoterm(body.incoterm ?? null) ?? normalizeIncoterm(question);
  const destination = normStr(body.destination ?? "") || null;
  const origin = normStr(body.origin ?? "") || null;
  const transport_mode = normStr(body.transport_mode ?? "") || null;

  const hsCandidates = extractHsCandidates(question);

  // 1) KB base (kb_articles)
  const kbSearch = await searchKBArticles(supabase, question, lang, matchCount);
  let kbRows = kbSearch.rows ?? [];

  // re-rank local
  if (kbRows.length > 1) {
    kbRows = kbRows
      .map((r) => ({ r, s: scoreKBRow(r, question) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.r);
  }

  const kbBest = kbRows[0] ?? null;

  // 2) Docs (optionnel)
  const { matches: docMatches, error: docsError } = await searchDocs(supabase, question, matchCount, body.doc_filter);

  const citations: Citation[] = (docMatches ?? []).slice(0, matchCount).map((d) => ({
    title: d.title,
    chunk_index: d.chunk_index,
    similarity: undefined,
    published_at: d.published_at ?? undefined,
  }));

  const docContext = (docMatches ?? [])
    .slice(0, matchCount)
    .map((d, i) => {
      const head = `#${i + 1} ${d.title} (${d.doc_type ?? "doc"}, ${d.published_at ?? "n/a"}) [chunk ${d.chunk_index}]`;
      const excerpt = String(d.content ?? "").slice(0, 1200);
      return `${head}\n${excerpt}`;
    })
    .join("\n\n---\n\n");

  // strict_docs_only => pas de KB si aucun doc
  if (strictDocsOnly && !docContext) {
    const msg =
      lang === "fr"
        ? "Je ne trouve pas de correspondance dans les documents indexés. Reformule avec pays + produit (HS) + Incoterm, ou ajoute des documents dans la base."
        : "I couldn't find a match in the indexed documents. Rephrase with country + product (HS) + Incoterm, or add more documents to the knowledge base.";
    const resp: AssistantResponse = {
      ok: true,
      mode: "docs_only_no_match",
      language: lang,
      destination,
      origin,
      incoterm,
      transport_mode,
      answer: msg,
      questions:
        lang === "fr"
          ? ["Quel pays de destination ?", "Quel produit (matière + usage) ?", "Valeur et Incoterm ?"]
          : ["Destination country?", "Product (material + use)?", "Value and Incoterm?"],
      actionsSuggested:
        lang === "fr"
          ? ["Ajouter/Indexer des guides et fiches pays/produits.", "Utiliser des mots-clés plus précis (HS, pays, incoterm)."]
          : ["Add/index guides and country/product sheets.", "Use more specific keywords (HS, country, incoterm)."],
      citations: [],
      debug: { docsError: docsError ?? null, kbError: kbSearch.error ?? null, kbMode: kbSearch.mode },
    };
    return json(200, resp);
  }

  // 3) Réponse à partir de KB (db) si dispo
  if (kbBest) {
    const built = buildFromKBRow(lang, kbBest);

    const sections: AssistantSections = { ...(built.sections ?? {}) };

    // Extraits docs si présents
    if (docContext) {
      sections[lang === "fr" ? "Extraits documentaires pertinents" : "Relevant document excerpts"] = toLines(docContext);
    }

    // Inputs détectés
    const detected: string[] = [];
    if (incoterm) detected.push(`Incoterm: ${incoterm}`);
    if (destination) detected.push(`${lang === "fr" ? "Destination" : "Destination"}: ${destination}`);
    if (origin) detected.push(`${lang === "fr" ? "Origine" : "Origin"}: ${origin}`);
    if (transport_mode) detected.push(`${lang === "fr" ? "Transport" : "Transport"}: ${transport_mode}`);
    if (hsCandidates.length) detected.push(`HS: ${hsCandidates.slice(0, 3).join(", ")}`);
    if (detected.length) sections[lang === "fr" ? "Données détectées" : "Detected inputs"] = detected;

    // Sources officielles (génériques monde)
    sections[lang === "fr" ? "Sources recommandées (officielles)" : "Recommended official sources"] =
      lang === "fr"
        ? [
            "ICC – Incoterms® 2020 (règles officielles).",
            "WCO – Harmonized System (HS) – principes de classification.",
            "Tarif douanier officiel du pays d’import.",
            "Autorités douanières export/import (procédures).",
          ]
        : [
            "ICC – Incoterms® 2020 (official rules).",
            "WCO – Harmonized System (HS) – classification principles.",
            "Import-country official tariff database.",
            "Export/import customs authorities (procedures).",
          ];

    const resp: AssistantResponse = {
      ok: true,
      mode: docContext ? "kb_db_plus_docs" : "kb_db_only",
      language: lang,
      destination,
      origin,
      incoterm,
      transport_mode,
      answer: built.answer,
      summary: built.summary,
      sections,
      questions: built.questions,
      actionsSuggested: built.actionsSuggested,
      citations: citations.length ? citations : [],
      debug: { docsError: docsError ?? null, kbError: kbSearch.error ?? null, kbMode: kbSearch.mode, kbSlug: kbBest.slug },
    };
    return json(200, resp);
  }

  // 4) si pas de KB db, fallback KB interne
  const fb = FALLBACK_KB
    .map((e) => ({ e, s: scoreFallbackKB(e, question) }))
    .sort((a, b) => b.s - a.s)[0];

  const fbHit = fb && fb.s >= 3 ? fb.e : null;

  if (fbHit) {
    const built = buildFromFallbackKB(lang, fbHit);
    const sections: AssistantSections = { ...(built.sections ?? {}) };
    if (docContext) sections[lang === "fr" ? "Extraits documentaires pertinents" : "Relevant document excerpts"] = toLines(docContext);

    const resp: AssistantResponse = {
      ok: true,
      mode: docContext ? "fallback_kb_plus_docs" : "fallback_kb_only",
      language: lang,
      destination,
      origin,
      incoterm,
      transport_mode,
      answer: built.answer,
      summary: built.summary,
      sections,
      questions: built.questions,
      actionsSuggested: built.actionsSuggested,
      citations: citations.length ? citations : [],
      debug: { docsError: docsError ?? null, kbError: kbSearch.error ?? null, kbMode: kbSearch.mode },
    };
    return json(200, resp);
  }

  // 5) si docs trouvés mais pas KB => réponse doc-based sans IA
  if (docContext) {
    const intro =
      lang === "fr"
        ? "Je n’ai pas de fiche encyclopédie parfaite pour ta question, mais voici les extraits les plus pertinents + une checklist pour agir."
        : "I don’t have a perfect encyclopedia article for your question, but here are the most relevant excerpts + a practical checklist.";

    const sections: AssistantSections = {};
    sections[lang === "fr" ? "Réponse rapide" : "Quick answer"] = [
      intro,
      "",
      lang === "fr"
        ? "✅ Checklist : pays export/import, produit (HS + description), valeur, incoterm, mode transport, qui dédouane."
        : "✅ Checklist: export/import countries, product (HS + description), value, incoterm, transport mode, who clears customs.",
    ];

    sections[lang === "fr" ? "Extraits documentaires" : "Document excerpts"] = toLines(docContext);

    const resp: AssistantResponse = {
      ok: true,
      mode: "docs_no_kb",
      language: lang,
      destination,
      origin,
      incoterm,
      transport_mode,
      answer: sections[lang === "fr" ? "Réponse rapide" : "Quick answer"].join("\n"),
      sections,
      questions:
        lang === "fr"
          ? ["Quel pays d’import ?", "Quel produit (matière + usage) ?", "As-tu un HS code ?"]
          : ["Which import country?", "What product (material + use)?", "Do you have an HS code?"],
      actionsSuggested:
        lang === "fr"
          ? ["Donner HS + pays pour une réponse plus précise.", "Ajouter des fiches pays/produits à l’encyclopédie."]
          : ["Provide HS + country for a more precise answer.", "Add country/product sheets to the encyclopedia."],
      citations,
      debug: { docsError: docsError ?? null, kbError: kbSearch.error ?? null, kbMode: kbSearch.mode },
    };
    return json(200, resp);
  }

  // 6) fallback ultime
  const fallbackAnswer =
    lang === "fr"
      ? "Je peux t’aider (encyclopédie import/export). Pour une réponse précise, donne : **pays d’import**, **produit (description + HS si possible)**, **valeur**, **Incoterm**, **mode de transport**.\n\nDémarre par : “Je vends [produit] de [pays origine] vers [pays destination] en [mode] Incoterm [xxx], valeur [€]. Quelles obligations & documents ?”"
      : "I can help (import/export encyclopedia). For precision, share: **import country**, **product (description + HS if possible)**, **value**, **Incoterm**, **transport mode**.\n\nStart with: “I sell [product] from [origin] to [destination] by [mode] under Incoterm [xxx], value [€]. What obligations & documents apply?”";

  const resp: AssistantResponse = {
    ok: true,
    mode: "fallback_no_kb_no_docs",
    language: lang,
    destination,
    origin,
    incoterm,
    transport_mode,
    answer: fallbackAnswer,
    questions:
      lang === "fr"
        ? ["Quel pays de destination ?", "Quel produit (matière + usage) ?", "Valeur + Incoterm + mode transport ?"]
        : ["Destination country?", "Product (material + use)?", "Value + Incoterm + transport mode?"],
    actionsSuggested:
      lang === "fr"
        ? ["Donner 4 infos : pays + produit + valeur + incoterm.", "Ajouter des articles à kb_articles (FR/EN)."]
        : ["Provide 4 inputs: country + product + value + incoterm.", "Add articles to kb_articles (FR/EN)."],
    citations: [],
    debug: { docsError: docsError ?? null, kbError: kbSearch.error ?? null, kbMode: kbSearch.mode },
  };

  return json(200, resp);
});
