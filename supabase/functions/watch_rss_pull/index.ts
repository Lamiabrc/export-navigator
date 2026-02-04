import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseFeed } from "https://deno.land/x/rss@1.1.3/mod.ts";

// =====================================================
// Types
// =====================================================

type WatchCategory = "customs" | "trade" | "sanctions" | "tax_vat" | "standards" | "logistics" | "general";
type ImpactLevel = "LOW" | "MED" | "HIGH";

type WatchSource = {
  id: string;
  name: string;
  url: string;
  format: string;
  type: string;
  country: string | null;
  category: WatchCategory;
  is_enabled: boolean;
};

type PullRequest = {
  type?: string;
  source_id?: string;
  max_sources?: number;
  limit_per_source?: number;
  since_days?: number;
  dry_run?: boolean;
};

// =====================================================
// CORS & Helpers
// =====================================================

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

function normStr(x: unknown): string {
  return String(x ?? "").trim();
}

function toIsoOrNull(d: unknown): string | null {
  if (!d) return null;
  const dt = new Date(String(d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function pickLink(entry: Record<string, unknown>): string | null {
  const link =
    (typeof entry?.link === "string" && entry.link) ||
    (Array.isArray(entry?.links) && entry.links.find((x: unknown) => typeof x === "string" && x)) ||
    null;
  return link ? String(link) : null;
}

function buildGuid(entry: Record<string, unknown>): string {
  const id =
    (typeof entry?.id === "string" && entry.id) ||
    (typeof entry?.guid === "string" && entry.guid) ||
    null;

  if (id) return String(id).trim();

  const title = normStr(entry?.title);
  const link = pickLink(entry) ?? "";
  const date = toIsoOrNull(entry?.published ?? entry?.updated) ?? "";
  return `${title}::${link}::${date}`.slice(0, 500);
}

// =====================================================
// Impact Scoring (keywords-based)
// =====================================================

const HIGH_KEYWORDS: Array<{ key: string; tags: string[]; reason: string }> = [
  { key: "sanction", tags: ["sanctions"], reason: "Mention de sanctions" },
  { key: "embargo", tags: ["sanctions"], reason: "Mention d'embargo" },
  { key: "anti-dumping", tags: ["trade-defense"], reason: "Mesure anti-dumping" },
  { key: "antidumping", tags: ["trade-defense"], reason: "Mesure anti-dumping" },
  { key: "export control", tags: ["export-control"], reason: "Contrôle des exportations" },
  { key: "controle des exportations", tags: ["export-control"], reason: "Contrôle des exportations" },
  { key: "dual-use", tags: ["export-control"], reason: "Biens à double usage" },
  { key: "double usage", tags: ["export-control"], reason: "Biens à double usage" },
  { key: "prohibition", tags: ["restrictions"], reason: "Interdiction" },
  { key: "interdiction", tags: ["restrictions"], reason: "Interdiction" },
];

const MED_KEYWORDS: Array<{ key: string; tags: string[]; reason: string }> = [
  { key: "tariff", tags: ["tariffs"], reason: "Mention de tarifs" },
  { key: "tarif", tags: ["tariffs"], reason: "Mention de tarifs" },
  { key: "droit de douane", tags: ["customs"], reason: "Droits de douane" },
  { key: "douane", tags: ["customs"], reason: "Douane" },
  { key: "customs", tags: ["customs"], reason: "Douane" },
  { key: "vat", tags: ["vat"], reason: "TVA/VAT" },
  { key: "tva", tags: ["vat"], reason: "TVA/VAT" },
  { key: "incoterm", tags: ["incoterms"], reason: "Incoterms" },
  { key: "strike", tags: ["logistics"], reason: "Grève ou perturbation" },
  { key: "greve", tags: ["logistics"], reason: "Grève ou perturbation" },
  { key: "grève", tags: ["logistics"], reason: "Grève ou perturbation" },
  { key: "port congestion", tags: ["logistics"], reason: "Congestion portuaire" },
  { key: "congestion", tags: ["logistics"], reason: "Congestion logistique" },
  { key: "inspection", tags: ["compliance"], reason: "Contrôle ou inspection" },
  { key: "procedures", tags: ["compliance"], reason: "Procédure douanière" },
  { key: "procedure", tags: ["compliance"], reason: "Procédure douanière" },
  { key: "regulation", tags: ["regulatory"], reason: "Réglementation" },
  { key: "règlement", tags: ["regulatory"], reason: "Réglementation" },
  { key: "directive", tags: ["regulatory"], reason: "Directive" },
];

type ScoreResult = {
  impact: ImpactLevel;
  tags: string[];
};

function scoreImpact(text: string): ScoreResult {
  const normalized = text.toLowerCase();
  const tags: string[] = [];

  let impact: ImpactLevel = "LOW";

  for (const rule of HIGH_KEYWORDS) {
    if (normalized.includes(rule.key)) {
      impact = "HIGH";
      rule.tags.forEach((t) => {
        if (!tags.includes(t)) tags.push(t);
      });
    }
  }

  for (const rule of MED_KEYWORDS) {
    if (normalized.includes(rule.key)) {
      if (impact !== "HIGH") impact = "MED";
      rule.tags.forEach((t) => {
        if (!tags.includes(t)) tags.push(t);
      });
    }
  }

  if (tags.length === 0) {
    tags.push("general");
  }

  return { impact, tags };
}

// =====================================================
// Main Handler
// =====================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return json(500, { error: "Missing env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)" });
  }

  // --- Auth: admin-only (based on email whitelist)
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "Missing Authorization Bearer token" });
  }

  const adminEmails = (Deno.env.get("WATCH_ADMIN_EMAILS") ?? "lamia.brechet@outlook.fr,sabullelam@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
  const email = userData?.user?.email?.toLowerCase() ?? null;

  if (userErr || !email) return json(401, { error: "Unauthorized" });
  if (!adminEmails.includes(email)) return json(403, { error: "Forbidden (admin only)" });

  // Admin client (service role)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: PullRequest = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const type = normStr(body.type) || "regulatory";
  const maxSources = Math.min(Math.max(Number(body.max_sources ?? 20), 1), 100);
  const limitPerSource = Math.min(Math.max(Number(body.limit_per_source ?? 25), 1), 100);
  const sinceDays = Math.min(Math.max(Number(body.since_days ?? 90), 1), 3650);
  const dryRun = Boolean(body.dry_run);

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  // --- Fetch enabled RSS sources
  let sources: WatchSource[] = [];

  const query = supabase
    .from("watch_sources")
    .select("id, name, url, format, type, country, category, is_enabled")
    .eq("is_enabled", true)
    .eq("format", "rss")
    .order("updated_at", { ascending: false })
    .limit(maxSources);

  // Optionally filter by type
  if (type && type !== "all") {
    query.eq("type", type);
  }

  const { data: sourcesData, error: sourcesErr } = await query;
  if (sourcesErr) return json(500, { error: sourcesErr.message });
  sources = (sourcesData ?? []) as WatchSource[];

  // Filter by source_id if provided
  if (body.source_id) {
    sources = sources.filter((s) => String(s.id) === String(body.source_id));
  }

  const results: Array<{
    source_id: string;
    name: string;
    url: string;
    parsedCount: number;
    upserted: number;
    ok: boolean;
    error: string | null;
    ms: number;
  }> = [];
  let totalUpserted = 0;
  let totalParsed = 0;

  for (const s of sources) {
    const sourceId = String(s.id);
    const url = String(s.url ?? "");
    const name = String(s.name ?? "Source RSS");
    const sourceCountry = s.country ?? null;
    const sourceCategory = s.category ?? "general";

    const started = Date.now();
    let parsedCount = 0;
    let upserted = 0;
    let errMsg: string | null = null;

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20_000);

      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "user-agent": "ExportNavigatorRSS/1.0 (+supabase edge function)",
          "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      });

      clearTimeout(t);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Fetch failed: ${res.status} ${errText.slice(0, 200)}`);
      }

      const xml = await res.text();
      const feed = await parseFeed(xml);

      const feedAny = feed as unknown as { entries?: Array<Record<string, unknown>> };
      const entries = Array.isArray(feedAny?.entries) ? feedAny.entries : [];
      const sliced = entries.slice(0, limitPerSource);

      parsedCount = sliced.length;
      totalParsed += parsedCount;

      const rows = sliced
        .map((e) => {
          const published = toIsoOrNull(e?.published ?? e?.updated);
          // Filter by since_days if we have a date
          if (published) {
            const dt = new Date(published);
            if (!Number.isNaN(dt.getTime()) && dt < since) return null;
          }

          const link = pickLink(e);
          const title = normStr(e?.title) || null;
          const summary = normStr(e?.summary ?? e?.description) || null;

          // Score impact based on title + summary
          const textToScore = `${title ?? ""} ${summary ?? ""}`;
          const { impact, tags } = scoreImpact(textToScore);

          return {
            source_id: sourceId,
            type,
            title,
            summary,
            url: link,
            published_at: published,
            guid: buildGuid(e),
            country: sourceCountry,
            category: sourceCategory,
            impact,
            tags,
            raw: e ?? null,
          };
        })
        .filter(Boolean);

      if (!dryRun && rows.length) {
        const { data, error } = await supabase
          .from("watch_items")
          .upsert(rows as Record<string, unknown>[], { onConflict: "source_id,guid" })
          .select("id");

        if (error) throw new Error(error.message);
        upserted = data?.length ?? 0;
        totalUpserted += upserted;
      }

      // Update source last_checked_at
      if (!dryRun) {
        await supabase
          .from("watch_sources")
          .update({ last_checked_at: new Date().toISOString(), last_error: null })
          .eq("id", sourceId);
      }
    } catch (e: unknown) {
      errMsg = String((e as Error)?.message || e);

      if (!dryRun) {
        await supabase
          .from("watch_sources")
          .update({ last_checked_at: new Date().toISOString(), last_error: errMsg })
          .eq("id", sourceId);
      }
    }

    results.push({
      source_id: sourceId,
      name,
      url,
      parsedCount,
      upserted,
      ok: !errMsg,
      error: errMsg,
      ms: Date.now() - started,
    });
  }

  return json(200, {
    ok: true,
    type,
    dry_run: dryRun,
    sources_count: sources.length,
    total_parsed: totalParsed,
    total_upserted: totalUpserted,
    results,
  });
});
