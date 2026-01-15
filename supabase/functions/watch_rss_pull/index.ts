import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseFeed } from "https://deno.land/x/rss@1.1.3/mod.ts";

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

function normStr(x: any) {
  return String(x ?? "").trim();
}

function toIsoOrNull(d: any): string | null {
  if (!d) return null;
  const dt = new Date(String(d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function pickLink(entry: any): string | null {
  // parseFeed retourne souvent links: string[] ou link: string
  const link =
    (typeof entry?.link === "string" && entry.link) ||
    (Array.isArray(entry?.links) && entry.links.find((x: any) => typeof x === "string" && x)) ||
    null;
  return link ? String(link) : null;
}

function buildGuid(entry: any): string {
  // guid/id si présent, sinon fallback stable
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

type PullRequest = {
  // filtres optionnels
  type?: string; // default 'regulatory'
  source_id?: string;

  // limites
  max_sources?: number;       // default 20
  limit_per_source?: number;  // default 25
  since_days?: number;        // default 90

  // debug
  dry_run?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return json(500, { error: "Missing env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)" });
  }

  // --- sécurité : seulement admin
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

  // client admin (service role) pour lire/écrire
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

  // --- récupérer sources RSS actives
  let sources: any[] = [];

  // tentative 1 : filtrer format='rss'
  const q1 = supabase
    .from("watch_sources")
    .select("id,name,url,type,format,is_enabled")
    .eq("is_enabled", true)
    .eq("type", type)
    .eq("format", "rss")
    .order("updated_at", { ascending: false })
    .limit(maxSources);

  const r1 = await q1;
  if (!r1.error) {
    sources = r1.data ?? [];
  } else {
    // fallback : si colonne format n'existe pas
    const q2 = supabase
      .from("watch_sources")
      .select("id,name,url,type,is_enabled")
      .eq("is_enabled", true)
      .eq("type", type)
      .order("updated_at", { ascending: false })
      .limit(maxSources);

    const r2 = await q2;
    if (r2.error) return json(500, { error: r2.error.message });
    sources = r2.data ?? [];
  }

  if (body.source_id) {
    sources = sources.filter((s) => String(s.id) === String(body.source_id));
  }

  const results: any[] = [];
  let totalUpserted = 0;
  let totalParsed = 0;

  for (const s of sources) {
    const sourceId = String(s.id);
    const url = String(s.url ?? "");
    const name = String(s.name ?? "Source RSS");

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

      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);

      const xml = await res.text();
      const feed = await parseFeed(xml);

      const entries = Array.isArray((feed as any)?.entries) ? (feed as any).entries : [];
      const sliced = entries.slice(0, limitPerSource);

      parsedCount = sliced.length;
      totalParsed += parsedCount;

      const rows = sliced
        .map((e: any) => {
          const published = toIsoOrNull(e?.published ?? e?.updated);
          // Filtre "since_days" si on a une date
          if (published) {
            const dt = new Date(published);
            if (!Number.isNaN(dt.getTime()) && dt < since) return null;
          }

          const link = pickLink(e);
          return {
            source_id: sourceId,
            type,
            title: normStr(e?.title) || null,
            summary: normStr(e?.summary ?? e?.description) || null,
            url: link,
            published_at: published,
            guid: buildGuid(e),
            raw: e ?? null,
          };
        })
        .filter(Boolean);

      if (!dryRun && rows.length) {
        const { data, error } = await supabase
          .from("watch_items")
          .upsert(rows as any[], { onConflict: "source_id,guid" })
          .select("id");

        if (error) throw new Error(error.message);
        upserted = data?.length ?? 0;
        totalUpserted += upserted;
      }

      if (!dryRun) {
        await supabase
          .from("watch_sources")
          .update({ last_checked_at: new Date().toISOString(), last_error: null })
          .eq("id", sourceId);
      }
    } catch (e: any) {
      errMsg = String(e?.message || e);

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
