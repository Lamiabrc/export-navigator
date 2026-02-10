import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AssistantRequest = {
  question: string;

  destination?: string | null;
  origin?: string | null;
  incoterm?: string | null;
  transport_mode?: string | null;

  match_count?: number;
  strict_docs_only?: boolean; // si true => pas de fallback canned si aucun KB/doc
  doc_filter?: {
    doc_type?: string | null;
    tags?: string[] | null;
  };

  lang?: "fr" | "en" | null;
};

type Citation = { title: string; chunk_index: number; similarity?: number; published_at?: string };
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

type KBHit = {
  slug: string;
  language: "fr" | "en";
  title: string;
  summary: string;
  body_md: string;
  tags: string[] | null;
  actions: string[] | null;
  followups: string[] | null;
  updated_at: string | null;
  rank: number | null;
};

type DocMatch = {
  document_id: string;
  title: string;
  doc_type: string | null;
  published_at: string | null;
  chunk_index: number;
  content: string;
};

type RssItem = {
  title: string;
  link: string;
  summary?: string | null;
  published_at?: string | null;
  source?: string | null;
  category?: string | null;
  territory?: string | null;
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

function detectLanguage(question: string): "fr" | "en" {
  const q = question.trim();
  if (!q) return "fr";
  if (/[Ã Ã¢Ã§Ã©Ã¨ÃªÃ«Ã®Ã¯Ã´Ã¹Ã»Ã¼Ã¿Å“Ã¦]/i.test(q)) return "fr";

  const text = stripAccents(q).toLowerCase();
  const padded = ` ${text.replace(/\s+/g, " ")} `;

  const frWords = [" le ", " la ", " les ", " des ", " du ", " de ", " un ", " une ", " pour ", " comment ", " quels ", " quelles ", " douane ", " tva ", " droit "];
  const enWords = [" the ", " and ", " of ", " to ", " for ", " how ", " what ", " which ", " customs ", " vat ", " duty ", " import ", " export "];

  const frScore = frWords.reduce((acc, w) => acc + (padded.includes(w) ? 1 : 0), 0);
  const enScore = enWords.reduce((acc, w) => acc + (padded.includes(w) ? 1 : 0), 0);

  return enScore > frScore ? "en" : "fr";
}

function normalizeIncoterm(raw?: string | null) {
  const v = normStr(raw).toUpperCase().replace(/[^A-Z]/g, "");
  const ALL = new Set(["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"]);
  if (ALL.has(v)) return v;
  // si lâ€™utilisateur lâ€™a mis dans la question
  const q = normalizeIncotermFromText(raw ?? "");
  return q;
}
function normalizeIncotermFromText(text: string) {
  const up = normStr(text).toUpperCase();
  const m = up.match(/\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/);
  return m ? m[1] : null;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function toLines(md: string) {
  return md.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
}

function extractHsCandidates(text: string) {
  const matches = text.match(/\b\d{4,10}\b/g) || [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

async function searchKB(supabase: any, question: string, lang: "fr" | "en", limit: number) {
  const { data, error } = await supabase.rpc("kb_search", { q: question, lang, lim: limit });
  if (error) return { rows: [] as KBHit[], error: error.message };
  return { rows: (data ?? []) as KBHit[], error: null as string | null };
}

async function hasTable(supabase: any, table: string) {
  try {
    const { error } = await supabase.from(table).select("*").limit(1);
    return !error;
  } catch {
    return false;
  }
}

function normalizeTerritory(input: string) {
  const raw = stripAccents(String(input || "").toUpperCase());
  if (!raw) return "";
  if (/\bEU\b|\bUE\b|UNION EUROPEENNE|EUROPEAN UNION/.test(raw)) return "EU";
  if (/\bUS\b|\bUSA\b|ETATS-UNIS|UNITED STATES|AMERICA/.test(raw)) return "US";
  if (/\bUK\b|\bGB\b|ROYAUME-UNI|UNITED KINGDOM|BRITAIN|ENGLAND/.test(raw)) return "UK";
  if (/\bGLOBAL\b|\bWORLD\b|MONDE|INTERNATIONAL/.test(raw)) return "GLOBAL";
  return "";
}

function inferTerritory(destination: string | null, question: string) {
  const combined = `${destination ?? ""} ${question ?? ""}`.trim();
  if (!combined) return null;

  const normalized = normalizeTerritory(combined);
  if (normalized) return normalized;

  const upper = combined.toUpperCase();
  const iso = upper.match(/\b[A-Z]{2}\b/)?.[0] ?? "";
  if (!iso) return null;

  const EU_ISO = new Set([
    "AT",
    "BE",
    "BG",
    "CY",
    "CZ",
    "DE",
    "DK",
    "EE",
    "ES",
    "FI",
    "FR",
    "GR",
    "HR",
    "HU",
    "IE",
    "IT",
    "LT",
    "LU",
    "LV",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SE",
    "SI",
    "SK",
  ]);

  if (EU_ISO.has(iso)) return "EU";
  if (iso === "US") return "US";
  if (iso === "GB" || iso === "UK") return "UK";
  return iso;
}

function formatShortDate(value?: string | null) {
  if (!value) return null;
  try {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

async function fetchRssItems(supabase: any, territory: string | null, limit: number) {
  const exists = await hasTable(supabase, "regulatory_items");
  if (!exists) return [] as RssItem[];

  const baseSelect = "title,summary,url,published_at,created_at,category,zone,regulatory_feeds(name)";

  let data: any[] | null = null;
  let error: any = null;

  const orderBy = (q: any) =>
    q
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

  if (territory) {
    const q = orderBy(supabase.from("regulatory_items").select(baseSelect).eq("zone", territory));
    const res = await q;
    data = res.data;
    error = res.error;
  }

  if (error && territory) {
    const altSelect = "title,summary,url,published_at,created_at,category,territory,regulatory_feeds(name)";
    const q = orderBy(supabase.from("regulatory_items").select(altSelect).eq("territory", territory));
    const res = await q;
    data = res.data;
    error = res.error;
  }

  if (error || !data) {
    const q = orderBy(supabase.from("regulatory_items").select(baseSelect));
    const res = await q;
    data = res.data;
    error = res.error;
  }

  if (error || !data) return [] as RssItem[];

  return (data || [])
    .map((row: any) => ({
      title: String(row?.title || "Sans titre"),
      link: String(row?.url || "").trim(),
      summary: row?.summary ?? null,
      published_at: row?.published_at || row?.created_at || null,
      source: row?.regulatory_feeds?.name ?? null,
      category: row?.category ?? null,
      territory: row?.territory ?? row?.zone ?? null,
    }))
    .filter((it: RssItem) => Boolean(it.link));
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

async function searchDocsMaybe(supabase: any, question: string, matchCount: number) {
  // Optionnel: seulement si table document_chunks existe
  const exists = await hasTable(supabase, "document_chunks");
  if (!exists) return { matches: [] as DocMatch[], error: "document_chunks not found" };

  const keywords = pickKeywords(question, 6);
  if (!keywords.length) return { matches: [] as DocMatch[], error: null as string | null };

  const or = keywords.map((k) => `content.ilike.%${k}%`).join(",");

  const { data, error } = await supabase
    .from("document_chunks")
    .select("document_id,title,doc_type,published_at,chunk_index,content")
    .or(or)
    .limit(clamp(matchCount, 1, 20));

  if (error) return { matches: [] as DocMatch[], error: error.message };
  return { matches: (data ?? []) as DocMatch[], error: null as string | null };
}

/** Fallback encyclopÃ©die minimal si aucun article KB ne matche */
function fallbackAnswer(lang: "fr" | "en") {
  return lang === "fr"
    ? {
        answer:
          "Je peux tâ€™aider (encyclopÃ©die import/export). Pour une rÃ©ponse prÃ©cise, donne : **pays dâ€™import**, **produit (description + HS si possible)**, **valeur**, **Incoterm**, **mode de transport**.\n\n" +
          "Exemple : â€œJe vends [produit] de [origine] vers [destination] en [mode] Incoterm [xxx], valeur [â‚¬]. Quels documents + obligations + taxes ?â€",
        questions: ["Quel pays de destination ?", "Quel produit (matiÃ¨re + usage) ?", "Valeur + Incoterm + mode transport ?"],
        actionsSuggested: ["Donner 4 infos : pays + produit + valeur + incoterm.", "Ajouter des articles FR/EN dans kb_articles pour enrichir lâ€™encyclopÃ©die."],
      }
    : {
        answer:
          "I can help (import/export encyclopedia). For a precise answer, share: **import country**, **product (description + HS if possible)**, **value**, **Incoterm**, **transport mode**.\n\n" +
          "Example: â€œI sell [product] from [origin] to [destination] by [mode] under Incoterm [xxx], value [â‚¬]. What documents + obligations + taxes apply?â€",
        questions: ["Destination country?", "Product (material + use)?", "Value + Incoterm + transport mode?"],
        actionsSuggested: ["Provide 4 inputs: country + product + value + incoterm.", "Add FR/EN articles to kb_articles to enrich the encyclopedia."],
      };
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

  const language: "fr" | "en" = body.lang ?? detectLanguage(question);
  const matchCount = clamp(Number(body.match_count ?? 6), 1, 20);
  const strictDocsOnly = Boolean(body.strict_docs_only);

  const destination = normStr(body.destination ?? "") || null;
  const origin = normStr(body.origin ?? "") || null;
  const transport_mode = normStr(body.transport_mode ?? "") || null;
  const incoterm = normalizeIncoterm(body.incoterm ?? null) ?? normalizeIncotermFromText(question);

  const hsCandidates = extractHsCandidates(question);

  const allowRss = !strictDocsOnly;
  const territory = allowRss ? inferTerritory(destination, question) : null;
  const rssItems = allowRss ? await fetchRssItems(supabase, territory, clamp(matchCount, 3, 8)) : [];
  const rssLines = rssItems.map((it) => {
    const date = formatShortDate(it.published_at);
    const parts = [it.title];
    if (date) parts.push(date);
    if (it.source) parts.push(it.source);
    return `${parts.join(" - ")} — ${it.link}`;
  });
  const rssPreview =
    rssItems.length > 0
      ? (language === "fr" ? "Veille RSS recente:" : "Recent RSS watch:") +
        "\n" +
        rssItems
          .slice(0, 3)
          .map((it, idx) => `${idx + 1}. ${it.title} — ${it.link}`)
          .join("\n")
      : "";

  // 1) KB search (encyclopÃ©die)
  const kb = await searchKB(supabase, question, language, matchCount);
  const best = kb.rows?.[0] ?? null;

  // 2) Docs (optionnel) pour enrichir
  const docs = await searchDocsMaybe(supabase, question, matchCount);
  const citations: Citation[] = (docs.matches ?? []).slice(0, matchCount).map((d) => ({
    title: d.title,
    chunk_index: d.chunk_index,
    published_at: d.published_at ?? undefined,
  }));

  const docContext = (docs.matches ?? [])
    .slice(0, matchCount)
    .map((d, i) => {
      const head = `#${i + 1} ${d.title} (${d.doc_type ?? "doc"}, ${d.published_at ?? "n/a"}) [chunk ${d.chunk_index}]`;
      const excerpt = String(d.content ?? "").slice(0, 900);
      return `${head}\n${excerpt}`;
    })
    .join("\n\n---\n\n");

  if (strictDocsOnly && !docContext) {
    const msg =
      language === "fr"
        ? "Je ne trouve pas de correspondance dans les documents indexÃ©s. Reformule avec pays + produit (HS) + Incoterm, ou ajoute des documents."
        : "I couldn't find a match in the indexed documents. Rephrase with country + product (HS) + Incoterm, or add more documents.";
    const resp: AssistantResponse = {
      ok: true,
      mode: "docs_only_no_match",
      language: language,
      destination,
      origin,
      incoterm,
      transport_mode,
      answer: msg,
      questions:
        language === "fr"
          ? ["Quel pays de destination ?", "Quel produit (matiÃ¨re + usage) ?", "Valeur et Incoterm ?"]
          : ["Destination country?", "Product (material + use)?", "Value and Incoterm?"],
      actionsSuggested:
        language === "fr"
          ? ["Ajouter des guides (fiches pays/produits) dans kb_articles.", "Indexer des documents dans document_chunks."]
          : ["Add guides (country/product sheets) to kb_articles.", "Index documents into document_chunks."],
      citations: [],
      debug: { kb_error: kb.error ?? null, docs_error: docs.error ?? null },
    };
    return json(200, resp);
  }

  // 3) RÃ©ponse KB prioritaire
  if (best) {
    const sections: AssistantSections = {};
    sections[best.title] = toLines(best.body_md);

    if (docContext) {
      sections[language === "fr" ? "Extraits documentaires pertinents" : "Relevant document excerpts"] = toLines(docContext);
    }
    if (rssLines.length) {
      sections[language === "fr" ? "Veille RSS recente" : "Recent RSS watch"] = rssLines;
    }

    const detected: string[] = [];
    if (incoterm) detected.push(`Incoterm: ${incoterm}`);
    if (destination) detected.push(`${language === "fr" ? "Destination" : "Destination"}: ${destination}`);
    if (origin) detected.push(`${language === "fr" ? "Origine" : "Origin"}: ${origin}`);
    if (transport_mode) detected.push(`${language === "fr" ? "Transport" : "Transport"}: ${transport_mode}`);
    if (hsCandidates.length) detected.push(`HS: ${hsCandidates.slice(0, 3).join(", ")}`);
    if (detected.length) sections[language === "fr" ? "DonnÃ©es dÃ©tectÃ©es" : "Detected inputs"] = detected;

    const resp: AssistantResponse = {
      ok: true,
      mode: docContext ? "kb_plus_docs" : "kb_only",
      language,
      destination,
      origin,
      incoterm,
      transport_mode,
      answer: best.body_md + (rssPreview ? `\n\n${rssPreview}` : ""),
      summary: best.title,
      sections,
      questions: (best.followups ?? []).slice(0, 6),
      actionsSuggested: (best.actions ?? []).slice(0, 8),
      citations: citations.length ? citations : [],
      debug: { kb_rank: best.rank ?? null, kb_error: kb.error ?? null, docs_error: docs.error ?? null, kb_slug: best.slug },
    };
    return json(200, resp);
  }

  // 4) docs-only si dispo
  if (docContext) {
    const intro =
      language === "fr"
        ? "Je nâ€™ai pas (encore) de fiche encyclopÃ©die parfaite, mais voici les extraits les plus pertinents + une checklist."
        : "I donâ€™t (yet) have a perfect encyclopedia article, but here are the most relevant excerpts + a checklist.";

    const sections: AssistantSections = {};
    sections[language === "fr" ? "RÃ©ponse rapide" : "Quick answer"] = [
      intro,
      "",
      language === "fr"
        ? "âœ… Checklist : pays export/import, produit (HS + description), valeur, incoterm, mode transport, qui dÃ©douane."
        : "âœ… Checklist: export/import countries, product (HS + description), value, incoterm, transport mode, who clears customs.",
    ];
    sections[language === "fr" ? "Extraits documentaires" : "Document excerpts"] = toLines(docContext);
    if (rssLines.length) {
      sections[language === "fr" ? "Veille RSS recente" : "Recent RSS watch"] = rssLines;
    }

    const resp: AssistantResponse = {
      ok: true,
      mode: "docs_no_kb",
      language,
      destination,
      origin,
      incoterm,
      transport_mode,
      answer:
        sections[language === "fr" ? "RÃ©ponse rapide" : "Quick answer"].join("\n") +
        (rssPreview ? `\n\n${rssPreview}` : ""),
      sections,
      questions:
        language === "fr"
          ? ["Quel pays dâ€™import ?", "Quel produit (matiÃ¨re + usage) ?", "As-tu un HS code ?"]
          : ["Which import country?", "What product (material + use)?", "Do you have an HS code?"],
      actionsSuggested:
        language === "fr"
          ? ["Ajouter des articles FR/EN dans kb_articles (Incoterms, documents, taxes, conformitÃ©)."]
          : ["Add FR/EN articles to kb_articles (Incoterms, documents, taxes, compliance)."],
      citations,
      debug: { kb_error: kb.error ?? null, docs_error: docs.error ?? null },
    };
    return json(200, resp);
  }

  // 5) fallback ultime
  const fb = fallbackAnswer(language);
  const fallbackSections: AssistantSections = {};
  if (rssLines.length) {
    fallbackSections[language === "fr" ? "Veille RSS recente" : "Recent RSS watch"] = rssLines;
  }
  const resp: AssistantResponse = {
    ok: true,
    mode: "fallback_no_kb_no_docs",
    language,
    destination,
    origin,
    incoterm,
    transport_mode,
    answer: fb.answer + (rssPreview ? `\n\n${rssPreview}` : ""),
    questions: fb.questions,
    actionsSuggested: fb.actionsSuggested,
    sections: Object.keys(fallbackSections).length ? fallbackSections : undefined,
    citations: [],
    debug: { kb_error: kb.error ?? null, docs_error: docs.error ?? null },
  };
  return json(200, resp);
});

