import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const corsHeaders: Record<string, string> = {
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

async function sha256(input: string) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function pickText(x: any): string | null {
  if (x == null) return null;
  if (typeof x === "string") return x.trim() || null;
  if (typeof x === "number") return String(x);
  if (typeof x === "object") {
    if (typeof x["#text"] === "string") return x["#text"].trim() || null;
    if (typeof x["text"] === "string") return x["text"].trim() || null;
    if (typeof x["href"] === "string") return x["href"].trim() || null;
    if (typeof x["@_href"] === "string") return x["@_href"].trim() || null;
  }
  return null;
}

function toIsoOrNull(raw: string | null) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeItems(parsed: any) {
  // RSS 2.0
  if (parsed?.rss?.channel) {
    const ch = parsed.rss.channel;
    const items = asArray(ch.item);

    return items.map((it: any) => {
      const title = pickText(it.title) ?? "(sans titre)";
      const link = pickText(it.link) ?? pickText(it.guid) ?? "";
      const guid = pickText(it.guid) ?? null;
      const summary =
        pickText(it.description) ??
        pickText(it["content:encoded"]) ??
        null;
      const pub =
        pickText(it.pubDate) ??
        pickText(it.published) ??
        pickText(it.date) ??
        null;

      return { title, link, guid, summary, published_at: pub };
    });
  }

  // Atom
  if (parsed?.feed?.entry) {
    const entries = asArray(parsed.feed.entry);

    return entries.map((e: any) => {
      const title = pickText(e.title) ?? "(sans titre)";

      const links = asArray(e.link);
      const alt =
        links.find((l: any) => (l?.rel ?? l?.["@_rel"]) === "alternate") ??
        links[0];

      const href =
        (alt && (alt.href ?? alt["@_href"])) ??
        (typeof e.link?.href === "string" ? e.link.href : null) ??
        (typeof e.link?.["@_href"] === "string" ? e.link["@_href"] : null) ??
        pickText(e.link) ??
        "";

      const guid = pickText(e.id) ?? null;
      const summary = pickText(e.summary) ?? pickText(e.content) ?? null;
      const pub = pickText(e.updated) ?? pickText(e.published) ?? null;

      return { title, link: String(href ?? ""), guid, summary, published_at: pub };
    });
  }

  return [];
}

function compileRegex(pattern: string) {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function normalizeBool(x: any, fallback = false) {
  if (typeof x === "boolean") return x;
  if (x === "true") return true;
  if (x === "false") return false;
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const maxItemsPerSource = Math.min(Math.max(Number(body.maxItemsPerSource ?? 30), 5), 100);
  const autoTriage = normalizeBool(body.autoTriage, true);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
  });

  // 1) Sources actives (compat feed_url/url et enabled/is_enabled)
  const { data: rawSources, error: srcErr } = await supabase
    .from("watch_sources")
    .select("id,name,feed_url,url,enabled,is_enabled,format,jurisdiction,tags")
    .order("name", { ascending: true });

  if (srcErr) return json(500, { ok: false, error: srcErr.message });

  const sources = (rawSources ?? [])
    .map((s: any) => {
      const enabled = normalizeBool(s.enabled ?? s.is_enabled, true);
      const feedUrl = String(s.feed_url ?? s.url ?? "").trim();
      return {
        id: s.id,
        name: s.name,
        feedUrl,
        enabled,
        jurisdiction: s.jurisdiction ?? null,
        tags: s.tags ?? [],
      };
    })
    .filter((s) => s.enabled && !!s.feedUrl);

  // 2) Règles de triage
  let rules: any[] = [];
  if (autoTriage) {
    const { data: r, error: rErr } = await supabase
      .from("watch_rules")
      .select("*")
      .eq("enabled", true);

    if (!rErr) {
      rules = (r ?? []).map((x: any) => ({
        ...x,
        _rx: compileRegex(String(x.match_regex ?? "")),
      }));
    }
  }

  let insertedTotal = 0;
  let triagedTotal = 0;
  const perSource: any[] = [];

  for (const s of sources) {
    let httpStatus: number | null = null;
    let lastError: string | null = null;
    let insertedForSource = 0;
    let triagedForSource = 0;

    try {
      const res = await fetch(s.feedUrl, {
        headers: {
          "user-agent": "ExportNavigatorWatch/1.0",
          "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      });

      httpStatus = res.status;

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        await supabase
          .from("watch_sources")
          .update({
            last_checked_at: new Date().toISOString(),
            last_status: httpStatus,
            last_error: lastError,
          })
          .eq("id", s.id);

        perSource.push({ source: s.name, status: httpStatus, inserted: 0, triaged: 0, error: lastError });
        continue;
      }

      const xml = await res.text();
      const parsed = parser.parse(xml);
      const items = normalizeItems(parsed).slice(0, maxItemsPerSource);

      // Build rows
      const rows: any[] = [];
      for (const it of items) {
        const title = String(it.title ?? "").trim() || "(sans titre)";
        const url = String(it.link ?? "").trim();
        if (!url) continue;

        const guid = it.guid ?? null;
        const published_at = toIsoOrNull(it.published_at ? String(it.published_at) : null);
        const summary = it.summary ? String(it.summary).slice(0, 8000) : null;

        const hash = await sha256(`${s.id}|${guid ?? ""}|${url}|${title}`);

        rows.push({
          source_id: s.id,
          title,
          url,
          summary,
          published_at,
          guid,
          hash,
          raw: it,
        });
      }

      // 3) Upsert watch_items (fallback insert si pas de contrainte unique)
      let inserted: any[] = [];
      if (rows.length) {
        const up = await supabase
          .from("watch_items")
          .upsert(rows, { onConflict: "hash", ignoreDuplicates: true })
          .select("id,title,summary,source_id");

        if (up.error) {
          // Si pas d'index unique sur hash -> fallback insert (peut créer des doublons)
          const ins = await supabase
            .from("watch_items")
            .insert(rows)
            .select("id,title,summary,source_id");

          if (ins.error) throw ins.error;
          inserted = ins.data ?? [];
        } else {
          inserted = up.data ?? [];
        }
      }

      insertedForSource = inserted.length;
      insertedTotal += insertedForSource;

      // 4) Triage -> reg_events
      if (autoTriage && inserted.length && rules.length) {
        const eventsToWrite: any[] = [];

        for (const wi of inserted) {
          const text = `${wi.title ?? ""}\n${wi.summary ?? ""}`.toLowerCase();

          for (const rule of rules) {
            if (!rule?._rx) continue;
            if (!rule._rx.test(text)) continue;

            if (rule.jurisdiction && s.jurisdiction && rule.jurisdiction !== s.jurisdiction) continue;

            eventsToWrite.push({
              title: wi.title,
              summary: wi.summary ?? null,
              jurisdiction: s.jurisdiction ?? rule.jurisdiction ?? null,
              impact: rule.impact ?? "watch",
              status: rule.status ?? "triaged",
              export_zone: rule.export_zone ?? null,
              territory_codes: rule.territory_codes ?? [],
              hs_codes: [],
              source_item_id: wi.id,
            });

            break; // une règle suffit
          }
        }

        if (eventsToWrite.length) {
          // Upsert si unique(source_item_id) existe, sinon insert simple
          const upEv = await supabase
            .from("reg_events")
            .upsert(eventsToWrite, { onConflict: "source_item_id", ignoreDuplicates: true })
            .select("id");

          if (upEv.error) {
            const insEv = await supabase.from("reg_events").insert(eventsToWrite).select("id");
            if (!insEv.error) {
              triagedForSource = insEv.data?.length ?? 0;
              triagedTotal += triagedForSource;
            }
          } else {
            triagedForSource = upEv.data?.length ?? 0;
            triagedTotal += triagedForSource;
          }
        }
      }

      // 5) Update statut source
      await supabase
        .from("watch_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_status: httpStatus,
          last_error: null,
        })
        .eq("id", s.id);

      perSource.push({
        source: s.name,
        status: httpStatus,
        inserted: insertedForSource,
        triaged: triagedForSource,
        error: null,
      });
    } catch (e: any) {
      lastError = String(e?.message || e);

      await supabase
        .from("watch_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_status: httpStatus,
          last_error: lastError,
        })
        .eq("id", s.id);

      perSource.push({
        source: s.name,
        status: httpStatus,
        inserted: 0,
        triaged: 0,
        error: lastError,
      });
    }
  }

  return json(200, {
    ok: true,
    maxItemsPerSource,
    autoTriage,
    sources: sources.length,
    insertedTotal,
    triagedTotal,
    perSource,
  });
});
