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

  // RAG (sans embeddings)
  match_count?: number;
  strict_docs_only?: boolean; // si true => pas de réponse "canned" si aucun doc/KB trouvé
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
  // Heuristique simple + fiable sans dépendance :
  const q = question.trim();
  if (!q) return "fr";

  // accents => FR
  if (/[àâçéèêëîïôùûüÿœæ]/i.test(q)) return "fr";

  const text = stripAccents(q).toLowerCase();
  const frWords = ["le", "la", "les", "des", "du", "de", "un", "une", "pour", "comment", "quels", "quelles", "quoi", "est", "sont", "avec", "sans", "douane", "tva", "droit"];
  const enWords = ["the", "and", "of", "to", "for", "how", "what", "which", "is", "are", "with", "without", "customs", "vat", "duty", "import", "export"];

  const score = (arr: string[]) => arr.reduce((acc, w) => acc + (text.includes(` ${w} `) ? 1 : 0), 0);

  // entourer d'espaces pour éviter les faux positifs
  const padded = ` ${text.replace(/\s+/g, " ")} `;
  const frScore = frWords.reduce((acc, w) => acc + (padded.includes(` ${w} `) ? 1 : 0), 0);
  const enScore = enWords.reduce((acc, w) => acc + (padded.includes(` ${w} `) ? 1 : 0), 0);

  return enScore > frScore ? "en" : "fr";
}

function extractHsCandidates(text: string) {
  const matches = text.match(/\b\d{4,10}\b/g) || [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

function pickKeywords(question: string, max = 6) {
  const stopFr = new Set(["comment", "pourquoi", "quelle", "quelles", "quels", "quoi", "avec", "sans", "dans", "sur", "vers", "chez", "afin", "plus", "moins", "vous", "nous", "export", "import"]);
  const stopEn = new Set(["how", "why", "what", "which", "with", "without", "into", "from", "to", "for", "your", "our", "export", "import"]);

  const raw = stripAccents(question).toLowerCase();
  const tokens = raw.split(/[^a-z0-9]+/g).filter(Boolean);

  const kept = tokens
    .filter((t) => t.length >= 4)
    .filter((t) => !(stopFr.has(t) || stopEn.has(t)))
    .slice(0, 30);

  // garder les plus longs
  kept.sort((a, b) => b.length - a.length);

  const uniq: string[] = [];
  for (const t of kept) {
    if (!uniq.includes(t)) uniq.push(t);
    if (uniq.length >= max) break;
  }
  return uniq;
}

/**
 * "Réponses toutes faites" = mini encyclopédie.
 * Tu peux enrichir facilement ce tableau : ajoute des entrées, tags, contenu FR/EN.
 */
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

const KB: KBEntry[] = [
  {
    id: "incoterms_overview",
    tags: ["incoterm", "incoterms", "livraison", "risk", "cost", "transport"],
    title_fr: "Incoterms® 2020 : définition et utilité",
    title_en: "Incoterms® 2020: definition and why they matter",
    body_fr:
      "Les Incoterms® (ICC) définissent **qui supporte les coûts**, **où le risque est transféré**, et **qui fait quelles formalités** (export/import) pour une vente internationale.\n\n" +
      "✅ **Ils ne définissent pas** le transfert de propriété, ni le prix, ni les modalités de paiement.\n\n" +
      "Les 11 règles Incoterms® 2020 :\n" +
      "- **Tous modes** : EXW, FCA, CPT, CIP, DAP, DPU, DDP\n" +
      "- **Maritime / voies navigables** : FAS, FOB, CFR, CIF\n\n" +
      "🔎 Bon réflexe : toujours préciser un **lieu nommé** (ex: “FCA Le Havre” / “DAP Berlin”).",
    body_en:
      "Incoterms® (ICC) define **who pays which costs**, **where risk transfers**, and **who handles export/import formalities** in an international sale.\n\n" +
      "✅ **They do NOT** define transfer of title/ownership, price, or payment terms.\n\n" +
      "The 11 Incoterms® 2020 rules:\n" +
      "- **Any mode**: EXW, FCA, CPT, CIP, DAP, DPU, DDP\n" +
      "- **Sea/inland waterways**: FAS, FOB, CFR, CIF\n\n" +
      "🔎 Best practice: always name the **exact place** (e.g., “FCA Le Havre” / “DAP Berlin”).",
    followups_fr: ["Quel est le pays de destination ?", "Quel mode de transport (route/air/mer) ?", "Quel Incoterm envisagé ?"],
    followups_en: ["What is the destination country?", "Which transport mode (road/air/sea)?", "Which Incoterm are you considering?"],
    actions_fr: ["Choisir 2 Incoterms candidats et comparer risques/coûts.", "Ajouter le lieu nommé dans le contrat et la facture proforma."],
    actions_en: ["Pick 2 candidate Incoterms and compare risk/cost split.", "Add the named place in contract and proforma invoice."],
  },

  {
    id: "incoterm_choice",
    tags: ["choose incoterm", "choisir incoterm", "container", "fob", "fca", "dap", "ddp"],
    title_fr: "Comment choisir un Incoterm (méthode simple)",
    title_en: "How to choose an Incoterm (simple method)",
    body_fr:
      "Méthode rapide en 3 questions :\n" +
      "1) **Qui contrôle le transport principal** (et veut négocier les coûts) ?\n" +
      "2) **Qui accepte le risque** pendant le transport principal ?\n" +
      "3) **Qui gère l’import** (droits, taxes, dédouanement) ?\n\n" +
      "Raccourcis pratiques :\n" +
      "- Si tu vends en conteneur : privilégie souvent **FCA** plutôt que FOB.\n" +
      "- Si tu veux livrer chez le client sans gérer l’import : **DAP**.\n" +
      "- Si tu gères aussi l’import (forte complexité) : **DDP** (attention risques & responsabilités).",
    body_en:
      "Fast method using 3 questions:\n" +
      "1) **Who controls the main carriage** (and wants to negotiate freight)?\n" +
      "2) **Who carries the main-transport risk**?\n" +
      "3) **Who handles import clearance** (duties, taxes, brokerage)?\n\n" +
      "Practical shortcuts:\n" +
      "- For containers: often **FCA** is better than FOB.\n" +
      "- Deliver to buyer’s site but buyer imports: **DAP**.\n" +
      "- If seller also imports: **DDP** (high responsibility—use with care).",
    followups_fr: ["Vente en conteneur ou non ?", "Qui choisit le transitaire ?", "Client veut-il que tu gères l’import ?"],
    followups_en: ["Container shipment or not?", "Who chooses the freight forwarder?", "Does the buyer ask you to handle import?"],
    actions_fr: ["Valider l’Incoterm avec le transitaire.", "Écrire clairement lieu nommé + point de transfert de risque."],
    actions_en: ["Confirm with the freight forwarder.", "Write the named place + risk transfer point clearly."],
  },

  {
    id: "hs_code_basics",
    tags: ["hs", "hs code", "tariff", "classification", "douane", "classification tarifaire"],
    title_fr: "HS code : comment le trouver et pourquoi c’est critique",
    title_en: "HS code: how to find it and why it’s critical",
    body_fr:
      "Le **HS code** (Système Harmonisé) sert à déterminer : droits de douane, restrictions, documents, contrôles.\n\n" +
      "Bon process :\n" +
      "1) Décrire précisément le produit (matière, fonction, usage).\n" +
      "2) Chercher le code dans le tarif douanier du pays d’import.\n" +
      "3) Vérifier les notes de section/chapitre + exclusions.\n\n" +
      "⚠️ La classification peut varier en détail selon les pays (au-delà des 6 premiers chiffres).",
    body_en:
      "The **HS code** (Harmonized System) drives duties, restrictions, documents and controls.\n\n" +
      "Good process:\n" +
      "1) Describe the product precisely (material, function, use).\n" +
      "2) Check the importing country’s tariff database.\n" +
      "3) Verify section/chapter notes and exclusions.\n\n" +
      "⚠️ Classification detail can differ by country beyond the first 6 digits.",
    followups_fr: ["Quel est le produit (matière + usage) ?", "Pays d’import ?", "As-tu déjà un code 4/6 chiffres ?"],
    followups_en: ["What is the product (material + use)?", "Import country?", "Do you already have a 4/6-digit code?"],
    actions_fr: ["Préparer une fiche produit complète.", "Vérifier le tarif du pays d’import et les contrôles associés."],
    actions_en: ["Prepare a complete product sheet.", "Check import-country tariff and related controls."],
  },

  {
    id: "export_documents_basics",
    tags: ["documents", "export documents", "packing list", "invoice", "transport", "douane export"],
    title_fr: "Documents export : la checklist essentielle",
    title_en: "Export documents: essential checklist",
    body_fr:
      "Checklist minimale (selon pays/produit) :\n" +
      "- **Facture commerciale** (ou proforma)\n" +
      "- **Packing list**\n" +
      "- **Document de transport** (CMR / AWB / B/L…)\n" +
      "- **Déclaration export** (si applicable)\n" +
      "- **Certificat d’origine** (si demandé)\n" +
      "- **Assurance transport** (selon Incoterm)\n\n" +
      "Ensuite : licences, contrôles, marquages, conformité produit selon le pays.",
    body_en:
      "Minimum checklist (depends on country/product):\n" +
      "- **Commercial invoice** (or proforma)\n" +
      "- **Packing list**\n" +
      "- **Transport document** (CMR / AWB / B/L…)\n" +
      "- **Export declaration** (if applicable)\n" +
      "- **Certificate of origin** (if required)\n" +
      "- **Cargo insurance** (depending on Incoterm)\n\n" +
      "Then: licenses, controls, markings, product compliance requirements by country.",
    followups_fr: ["Quel pays de destination ?", "Quel HS code / type de produit ?", "Quel Incoterm ?"],
    followups_en: ["Destination country?", "HS code / product type?", "Which Incoterm?"],
    actions_fr: ["Valider la checklist avec transitaire/douane.", "Créer un pack documentaire standard réutilisable."],
    actions_en: ["Validate the checklist with forwarder/customs broker.", "Create a reusable standard doc pack."],
  },

  {
    id: "duties_and_vat_basics",
    tags: ["duties", "customs duties", "vat", "tva", "droits de douane", "taxes", "import"],
    title_fr: "Droits & taxes à l’import : comment ça se calcule",
    title_en: "Import duties & taxes: how they are calculated",
    body_fr:
      "En général, les droits/taxes d’import se calculent à partir de :\n" +
      "- la **valeur en douane** (souvent valeur marchandise + transport/assurance jusqu’à l’entrée du pays)\n" +
      "- le **HS code** (taux)\n" +
      "- l’**origine** (préférentielle ou non)\n\n" +
      "⚠️ Les règles exactes varient selon le pays : donne-moi pays d’import + HS + valeur + Incoterm pour une réponse précise.",
    body_en:
      "In most countries, import duties/taxes depend on:\n" +
      "- the **customs value** (often goods value + freight/insurance up to entry)\n" +
      "- the **HS code** (rate)\n" +
      "- the **origin** (preferential or not)\n\n" +
      "⚠️ Exact rules vary by country—share import country + HS + value + Incoterm for a precise answer.",
    followups_fr: ["Pays d’import ?", "Valeur marchandise + transport ?", "Origine du produit ?"],
    followups_en: ["Import country?", "Goods value + freight?", "Product origin?"],
    actions_fr: ["Rassembler HS + origine + valeur + incoterm.", "Identifier la base taxable et la valeur en douane."],
    actions_en: ["Collect HS + origin + value + incoterm.", "Identify the taxable base and customs value."],
  },

  {
    id: "sanctions_screening",
    tags: ["sanctions", "embargo", "restricted", "compliance", "dual use", "export control"],
    title_fr: "Sanctions & export control : les réflexes de conformité",
    title_en: "Sanctions & export controls: key compliance checks",
    body_fr:
      "Réflexes de base avant d’exporter :\n" +
      "1) Vérifier le **pays de destination** (embargos/mesures)\n" +
      "2) Vérifier les **parties** (client, bénéficiaire final)\n" +
      "3) Vérifier le **produit** (HS/contrôles/usage)\n" +
      "4) Vérifier l’**usage final** (civil/militaire, dual-use)\n\n" +
      "⚠️ Je peux aider à structurer la vérification, mais ce n’est pas un avis juridique : donne pays + produit + usage final.",
    body_en:
      "Core checks before exporting:\n" +
      "1) Screen the **destination country** (embargo measures)\n" +
      "2) Screen **parties** (buyer, end-user)\n" +
      "3) Screen the **product** (HS/controls/end use)\n" +
      "4) Validate the **end-use** (civil/military, dual-use)\n\n" +
      "⚠️ I can help structure checks but this isn’t legal advice—share country + product + end-use.",
    followups_fr: ["Pays de destination ?", "Produit (HS si possible) ?", "Usage final / client final ?"],
    followups_en: ["Destination country?", "Product (HS if possible)?", "End-use / end-user?"],
    actions_fr: ["Mettre en place un questionnaire KYC export.", "Tracer la décision (audit trail)."],
    actions_en: ["Implement an export KYC questionnaire.", "Keep an audit trail of decisions."],
  },
];

function scoreKB(entry: KBEntry, q: string): number {
  const text = stripAccents(q).toLowerCase();
  let s = 0;
  for (const tag of entry.tags) {
    const t = stripAccents(tag).toLowerCase();
    if (text.includes(t)) s += 2;
  }
  // bonus sur mots clés
  const kws = pickKeywords(q, 6);
  for (const k of kws) {
    if (text.includes(k)) s += 1;
  }
  // bonus incoterms
  const inc = normalizeIncoterm(q);
  if (inc && (entry.body_fr.includes(inc) || entry.body_en.includes(inc))) s += 2;
  return s;
}

function buildFromKB(lang: "fr" | "en", entry: KBEntry): Pick<AssistantResponse, "answer" | "sections" | "questions" | "actionsSuggested" | "summary"> {
  const title = lang === "fr" ? entry.title_fr : entry.title_en;
  const body = lang === "fr" ? entry.body_fr : entry.body_en;
  const questions = lang === "fr" ? entry.followups_fr : entry.followups_en;
  const actions = lang === "fr" ? entry.actions_fr : entry.actions_en;

  const sections: AssistantSections = {};
  sections[title] = body.split("\n").filter((l) => l.trim().length > 0);

  return {
    summary: title,
    answer: body,
    sections,
    questions,
    actionsSuggested: actions,
  };
}

/**
 * Recherche documents (sans embeddings) dans document_chunks.
 * On fait une recherche "ilike" multi-mots, limitée.
 * Si tu as un vrai index FTS + tsvector, on pourra l’améliorer.
 */
async function searchDocs(supabase: any, question: string, matchCount: number, filter?: AssistantRequest["doc_filter"]) {
  const keywords = pickKeywords(question, 6);
  if (!keywords.length) return { matches: [] as DocMatch[], error: null as string | null };

  // construire un OR content.ilike.%kw%
  const orParts = keywords.map((k) => `content.ilike.%${k}%`);
  const or = orParts.join(",");

  try {
    let q = supabase
      .from("document_chunks")
      .select("document_id,title,doc_type,published_at,chunk_index,content")
      .or(or)
      .limit(clamp(matchCount, 1, 20));

    if (filter?.doc_type) q = q.eq("doc_type", filter.doc_type);
    // tags : si tu as une colonne tags (text[]), tu peux décommenter :
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

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "Missing supabase env" });
  }

  // service role pour accéder à la base documentaire
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

  const incoterm = normalizeIncoterm(body.incoterm ?? null) ?? normalizeIncoterm(question);
  const destination = normStr(body.destination ?? "") || null;
  const origin = normStr(body.origin ?? "") || null;
  const transport_mode = normStr(body.transport_mode ?? "") || null;

  const matchCount = clamp(Number(body.match_count ?? 6), 1, 20);
  const strictDocsOnly = Boolean(body.strict_docs_only);

  const hsCandidates = extractHsCandidates(question);

  // 1) essayer KB “toute faite”
  const scored = KB
    .map((e) => ({ e, s: scoreKB(e, question) }))
    .sort((a, b) => b.s - a.s);

  const best = scored[0];
  const kbHit = best && best.s >= 3 ? best.e : null;

  // 2) recherche docs (optionnel)
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
      const excerpt = String(d.content ?? "").slice(0, 1200); // éviter réponses énormes
      return `${head}\n${excerpt}`;
    })
    .join("\n\n---\n\n");

  // si strict_docs_only => on refuse les "canned" si rien trouvé en docs
  if (strictDocsOnly && !docContext) {
    const msg =
      lang === "fr"
        ? "Je ne trouve pas de réponse dans la base documentaire indexée (documents). Reformule avec pays + produit (HS) + Incoterm, ou ajoute des documents dans la base."
        : "I couldn't find a match in the indexed document base. Rephrase with country + product (HS) + Incoterm, or add more documents to the knowledge base.";
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
          ? ["Ajouter/Indexer des documents (guides, procédures, fiches pays).", "Utiliser des mots-clés plus précis (HS, pays, incoterm)."]
          : ["Add/index documents (guides, procedures, country sheets).", "Use more specific keywords (HS, country, incoterm)."],
      citations: [],
      debug: { docsError: docsError ?? null },
    };
    return json(200, resp);
  }

  // 3) construire réponse finale : priorité KB, enrichissement avec extraits docs si disponibles
  if (kbHit) {
    const built = buildFromKB(lang, kbHit);

    // enrichir avec docs trouvés (sans halluciner) : on ajoute une section "Extraits utiles"
    const sections: AssistantSections = { ...(built.sections ?? {}) };

    if (docContext) {
      const label = lang === "fr" ? "Extraits documentaires pertinents" : "Relevant document excerpts";
      sections[label] = docContext.split("\n").filter((l) => l.trim().length > 0);
    }

    // ajouter une mini-section "Données détectées"
    const detectedLabel = lang === "fr" ? "Données détectées" : "Detected inputs";
    const detected: string[] = [];
    if (incoterm) detected.push(`Incoterm: ${incoterm}`);
    if (destination) detected.push(`${lang === "fr" ? "Destination" : "Destination"}: ${destination}`);
    if (origin) detected.push(`${lang === "fr" ? "Origine" : "Origin"}: ${origin}`);
    if (transport_mode) detected.push(`${lang === "fr" ? "Transport" : "Transport"}: ${transport_mode}`);
    if (hsCandidates.length) detected.push(`HS: ${hsCandidates.slice(0, 3).join(", ")}`);
    if (detected.length) sections[detectedLabel] = detected;

    // sources recommandées (génériques, mondiales)
    const sourcesLabel = lang === "fr" ? "Sources recommandées (officielles)" : "Recommended official sources";
    sections[sourcesLabel] =
      lang === "fr"
        ? [
            "ICC – Incoterms® 2020 (règles officielles).",
            "WCO – Harmonized System (HS) – principes de classification.",
            "Tarif douanier du pays d’import (base officielle).",
            "Autorité douanière du pays d’export et d’import (procédures).",
          ]
        : [
            "ICC – Incoterms® 2020 (official rules).",
            "WCO – Harmonized System (HS) – classification principles.",
            "Import-country official tariff database.",
            "Export/import customs authorities (procedures).",
          ];

    const resp: AssistantResponse = {
      ok: true,
      mode: docContext ? "kb_plus_docs" : "kb_only",
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
      debug: { docsError: docsError ?? null, kb_id: kbHit.id },
    };
    return json(200, resp);
  }

  // 4) si pas de KB hit, mais docs trouvés => répondre "doc-based" (sans IA)
  if (docContext) {
    const intro =
      lang === "fr"
        ? "Je n’ai pas de fiche “toute faite” parfaite pour ta question, mais voici les extraits documentaires les plus pertinents + une checklist pour agir."
        : "I don’t have a perfect ready-made article for your exact question, but here are the most relevant document excerpts + a practical checklist.";

    const sections: AssistantSections = {};
    sections[lang === "fr" ? "Réponse rapide" : "Quick answer"] = [
      intro,
      "",
      lang === "fr"
        ? "✅ Checklist pour préciser la demande : pays (export/import), produit (HS + description), valeur, incoterm, mode transport, acteur qui dédouane."
        : "✅ Checklist to clarify: export/import countries, product (HS + description), value, incoterm, transport mode, who clears customs.",
    ];

    sections[lang === "fr" ? "Extraits documentaires" : "Document excerpts"] = docContext
      .split("\n")
      .filter((l) => l.trim().length > 0);

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
          ? ["Donner HS + pays pour obtenir une réponse plus précise.", "Ajouter des fiches pays/produits dans la base documentaire."]
          : ["Provide HS + country for a more precise answer.", "Add country/product sheets to the doc base."],
      citations,
      debug: { docsError: docsError ?? null },
    };
    return json(200, resp);
  }

  // 5) fallback ultime (aucune KB, aucun doc) => “assistant encyclopédie” générique + questions
  const fallbackAnswer =
    lang === "fr"
      ? "Je peux t’aider (encyclopédie import/export). Pour être précis, j’ai besoin du **pays d’import**, du **produit (description + HS si possible)**, de la **valeur**, de l’**Incoterm**, et du **mode de transport**.\n\nDémarre par : “Je vends [produit] de [pays origine] vers [pays destination] en [mode] Incoterm [xxx], valeur [€]. Quelles obligations & documents ?”"
      : "I can help (import/export encyclopedia). For precision, I need the **import country**, the **product (description + HS if possible)**, the **value**, the **Incoterm**, and the **transport mode**.\n\nStart with: “I sell [product] from [origin] to [destination] by [mode] under Incoterm [xxx], value [€]. What obligations & documents apply?”";

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
        ? ["Donner 4 infos : pays + produit + valeur + incoterm.", "Ajouter des guides dans la base documentaire pour enrichir l’encyclopédie."]
        : ["Provide 4 inputs: country + product + value + incoterm.", "Add guides to the doc base to enrich the encyclopedia."],
    citations: [],
    debug: { docsError: docsError ?? null },
  };

  return json(200, resp);
});
