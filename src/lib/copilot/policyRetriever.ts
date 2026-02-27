import type { SupabaseClient } from "@supabase/supabase-js";

import type { PolicyContext, PolicyRule, ProductAliasRecord, ResolvedContext, SanctionsMatch, SourceLink } from "./types";

type RetrieveParams = {
  admin: SupabaseClient;
  context: ResolvedContext;
};

type RuleRow = {
  topic?: string | null;
  rule_text?: string | null;
  docs?: unknown;
  sources?: unknown;
};

type SourceRow = {
  id?: string;
  name?: string | null;
};

type EntityRow = {
  source_id?: string | null;
  entity_name?: string | null;
  programs?: string[] | null;
  list_id?: string | null;
  name?: string | null;
  alt_names?: string[] | null;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

const OFFICIAL_BASE_LINKS: SourceLink[] = [
  { title: "Access2Markets", url: "https://trade.ec.europa.eu/access-to-markets/en/home" },
  { title: "EU TARIC", url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=en" },
  { title: "RITA / Douane francaise", url: "https://www.douane.gouv.fr/service-en-ligne/rita-encyclopedie-tarifaire" },
  { title: "EU Dual-use Regulation 2021/821", url: "https://eur-lex.europa.eu/eli/reg/2021/821/oj" },
  { title: "OFAC Sanctions Programs", url: "https://ofac.treasury.gov/sanctions-programs-and-country-information" },
  { title: "UN Consolidated Sanctions List", url: "https://scsanctions.un.org/consolidated/" },
];

const FALLBACK_ALIASES: ProductAliasRecord[] = [
  { term: "banane", hs_chapters: ["08"], examples: ["banane", "banana"] },
  { term: "ferraille", hs_chapters: ["72", "73"], examples: ["ferraille", "steel scrap"] },
  { term: "drone", hs_chapters: ["88", "85"], examples: ["drone", "uav"] },
  { term: "logiciel chiffrement", hs_chapters: ["85", "90"], examples: ["encryption software", "cryptography"] },
  { term: "service logiciel", hs_chapters: ["85"], examples: ["saas", "licence"] },
];

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function normalizeAliasRow(row: any): ProductAliasRecord | null {
  const term = String(row?.term || "").trim();
  if (!term) return null;

  const chapters = Array.isArray(row?.hs_chapters)
    ? row.hs_chapters.map((item: unknown) => String(item || "").replace(/[^0-9]/g, "").slice(0, 2)).filter(Boolean)
    : [];

  const examples = Array.isArray(row?.examples)
    ? row.examples.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : [];

  return {
    term,
    hs_chapters: chapters,
    examples,
  };
}

function toPolicyRule(row: RuleRow): PolicyRule | null {
  const topic = String(row?.topic || "").trim();
  const ruleText = String(row?.rule_text || "").trim();
  if (!topic || !ruleText) return null;

  const docs = parseJsonArray(row?.docs)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const name = String(obj.name || obj.label || "").trim();
      if (!name) return null;
      const url = String(obj.source_url || obj.url || "").trim();
      return {
        name,
        required: obj.required !== false,
        source_url: isHttpUrl(url) ? url : null,
      };
    })
    .filter((item): item is { name: string; required: boolean; source_url: string | null } => Boolean(item));

  const sources = parseJsonArray(row?.sources)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const title = String(obj.title || obj.name || "").trim();
      const url = String(obj.url || obj.source_url || "").trim();
      if (!title || !isHttpUrl(url)) return null;
      return { title, url };
    })
    .filter((item): item is SourceLink => Boolean(item));

  return {
    topic,
    rule_text: ruleText,
    docs,
    sources,
  };
}

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T) {
  cache.set(key, { at: Date.now(), value });
}

async function fetchAliases(admin: SupabaseClient): Promise<ProductAliasRecord[]> {
  const cacheKey = "copilot:aliases";
  const cached = getCached<ProductAliasRecord[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await admin.from("product_aliases").select("term,hs_chapters,examples").limit(500);
  if (error || !Array.isArray(data) || !data.length) {
    setCached(cacheKey, FALLBACK_ALIASES);
    return FALLBACK_ALIASES;
  }

  const aliases = data.map(normalizeAliasRow).filter((item): item is ProductAliasRecord => Boolean(item));
  const merged = aliases.length ? aliases : FALLBACK_ALIASES;
  setCached(cacheKey, merged);
  return merged;
}

async function fetchHsRules(admin: SupabaseClient, hs6: string | null, destination: string | null): Promise<PolicyRule[]> {
  if (!hs6) return [];

  const cacheKey = `copilot:hs_rules:${hs6}:${destination || "*"}`;
  const cached = getCached<PolicyRule[]>(cacheKey);
  if (cached) return cached;

  let query = admin.from("hs_rules").select("topic,rule_text,docs,sources").eq("hs6", hs6).limit(12);
  if (destination) {
    query = query.or(`to_iso2.eq.${destination},to_iso2.is.null`);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    setCached(cacheKey, []);
    return [];
  }

  const rules = data.map((row) => toPolicyRule(row as RuleRow)).filter((item): item is PolicyRule => Boolean(item));
  setCached(cacheKey, rules);
  return rules;
}

async function fetchCountryRules(admin: SupabaseClient, destination: string | null): Promise<PolicyRule[]> {
  if (!destination) return [];

  const cacheKey = `copilot:country_rules:${destination}`;
  const cached = getCached<PolicyRule[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await admin
    .from("country_rules")
    .select("topic,rule_text,sources")
    .or(`to_iso2.eq.${destination},to_iso2.eq.WORLD`)
    .limit(12);

  if (error || !Array.isArray(data)) {
    setCached(cacheKey, []);
    return [];
  }

  const rules = data
    .map((row) => toPolicyRule({ ...row, docs: [] } as RuleRow))
    .filter((item): item is PolicyRule => Boolean(item));

  setCached(cacheKey, rules);
  return rules;
}

async function fetchSanctionsMatches(admin: SupabaseClient, context: ResolvedContext): Promise<SanctionsMatch[]> {
  const names = [context.buyer, context.seller]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!names.length) return [];

  const sourcesResult = await admin.from("sanctions_sources").select("id,name").limit(100);
  const sourceById = new Map<string, string>();
  if (Array.isArray(sourcesResult.data)) {
    for (const row of sourcesResult.data as SourceRow[]) {
      if (row.id) sourceById.set(String(row.id), String(row.name || ""));
    }
  }
  if (!sourceById.size) {
    const listsResult = await admin.from("sanctions_lists").select("id,list_name").limit(100);
    if (Array.isArray(listsResult.data)) {
      for (const row of listsResult.data as Array<{ id?: string; list_name?: string | null }>) {
        if (row.id) sourceById.set(String(row.id), String(row.list_name || ""));
      }
    }
  }

  const matches: SanctionsMatch[] = [];
  for (const name of names) {
    const firstTry = await admin
      .from("sanctions_entities")
      .select("source_id,entity_name,programs")
      .ilike("entity_name", `%${name}%`)
      .limit(5);

    let rows: EntityRow[] = [];
    if (!firstTry.error && Array.isArray(firstTry.data)) {
      rows = firstTry.data as EntityRow[];
    } else {
      const fallbackTry = await admin
        .from("sanctions_entities")
        .select("list_id,name,alt_names")
        .ilike("name", `%${name}%`)
        .limit(5);
      if (!fallbackTry.error && Array.isArray(fallbackTry.data)) {
        rows = fallbackTry.data as EntityRow[];
      }
    }

    for (const row of rows) {
      const entityName = String(row.entity_name || row.name || "").trim();
      if (!entityName) continue;
      matches.push({
        entity_name: entityName,
        source_name:
          row.source_id
            ? sourceById.get(String(row.source_id)) || null
            : row.list_id
              ? sourceById.get(String(row.list_id)) || null
              : null,
        program: Array.isArray(row.programs) ? String(row.programs[0] || "").trim() || null : null,
      });
    }
  }

  const deduped = new Map<string, SanctionsMatch>();
  for (const item of matches) {
    deduped.set(item.entity_name.toLowerCase(), item);
  }

  return Array.from(deduped.values()).slice(0, 6);
}

function collectRuleLinks(hsRules: PolicyRule[], countryRules: PolicyRule[]) {
  const links = new Map<string, SourceLink>();
  for (const link of OFFICIAL_BASE_LINKS) links.set(link.url, link);

  for (const rule of [...hsRules, ...countryRules]) {
    for (const source of rule.sources) {
      if (isHttpUrl(source.url)) links.set(source.url, source);
    }
    for (const doc of rule.docs) {
      if (doc.source_url) {
        links.set(doc.source_url, { title: doc.name, url: doc.source_url });
      }
    }
  }

  return Array.from(links.values()).slice(0, 12);
}

export async function retrievePolicyContext(params: RetrieveParams): Promise<PolicyContext> {
  const aliases = await fetchAliases(params.admin).catch(() => FALLBACK_ALIASES);
  const hsRules = await fetchHsRules(params.admin, params.context.hs6, params.context.destination).catch(() => []);
  const countryRules = await fetchCountryRules(params.admin, params.context.destination).catch(() => []);
  const sanctionsMatches = await fetchSanctionsMatches(params.admin, params.context).catch(() => []);

  return {
    aliases,
    hsRules,
    countryRules,
    sanctionsMatches,
    officialLinks: collectRuleLinks(hsRules, countryRules),
    retrievalAt: new Date().toISOString(),
  };
}
