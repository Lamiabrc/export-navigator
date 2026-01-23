import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const OFAC_CSV_URL = "https://sanctionslist.ofac.treas.gov/api/PublicationPreview/exports/SDN.csv";
const UN_LEGACY_HTML = "https://unsolprodfiles.blob.core.windows.net/publiclegacyxmlfiles/EN/consolidatedLegacyByNAME.html";
const EU_PDF_URL = "https://www.sanctionsmap.eu/api/v1/pdf/regime?id[]=26&lang=en";

function checksum(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

async function insertSnapshot(sb: any, source: string, payload: unknown, hash: string) {
  await sb.from("raw_snapshots").insert({ source, payload, checksum: hash });
}

async function upsertEntity(sb: any, entity: any) {
  await sb.from("sanctions_entities").upsert(entity, { onConflict: "entity_key" });
}

async function logChange(sb: any, source: string, hash: string, previousHash?: string | null) {
  await sb.from("change_log").insert({
    source,
    entity_key: source,
    change_type: previousHash ? "update" : "insert",
    summary: previousHash ? "Source mise a jour" : "Nouvelle source ajoutee",
    severity: "medium",
    old_hash: previousHash || null,
    new_hash: hash,
  });
}

async function refreshOfac(sb: any) {
  const run = await sb.from("ingestion_runs").insert({ source: "OFAC", status: "running" }).select("id").single();
  const runId = run.data?.id;

  const text = await fetch(OFAC_CSV_URL).then((r) => r.text());
  const hash = checksum(text);

  const prev = await sb
    .from("raw_snapshots")
    .select("checksum")
    .eq("source", "OFAC")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev.data?.checksum !== hash) {
    await insertSnapshot(sb, "OFAC", { csv: text.slice(0, 200000) }, hash);
    await logChange(sb, "OFAC", hash, prev.data?.checksum || null);
  }

  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0] || "");
  const nameIdx = header.findIndex((h) => h.toLowerCase() === "name");
  const programIdx = header.findIndex((h) => h.toLowerCase() === "program");
  const countryIdx = header.findIndex((h) => h.toLowerCase() === "country");

  let rows = 0;
  for (const line of lines.slice(1, 2000)) {
    const cols = parseCsvLine(line);
    const name = cols[nameIdx] || cols[0];
    if (!name) continue;
    rows += 1;
    const entityKey = `OFAC:${name}`;
    await upsertEntity(sb, {
      entity_key: entityKey,
      list_name: "OFAC",
      name,
      program: cols[programIdx] || null,
      country: cols[countryIdx] || null,
      identifiers: {},
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }

  await sb.from("ingestion_runs").update({ status: "ok", ended_at: new Date().toISOString(), rows, checksum: hash }).eq("id", runId);
}

async function refreshUn(sb: any) {
  const run = await sb.from("ingestion_runs").insert({ source: "UN", status: "running" }).select("id").single();
  const runId = run.data?.id;

  const html = await fetch(UN_LEGACY_HTML).then((r) => r.text());
  const hash = checksum(html);
  const prev = await sb
    .from("raw_snapshots")
    .select("checksum")
    .eq("source", "UN")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev.data?.checksum !== hash) {
    await insertSnapshot(sb, "UN", { html: html.slice(0, 200000) }, hash);
    await logChange(sb, "UN", hash, prev.data?.checksum || null);
  }

  const names = Array.from(new Set(html.match(/<tr[^>]*>\s*<td[^>]*>([^<]{3,120})<\/td>/gi)?.map((m) => m.replace(/<[^>]+>/g, "").trim()) || []));
  let rows = 0;
  for (const name of names.slice(0, 2000)) {
    if (!name) continue;
    rows += 1;
    const entityKey = `UN:${name}`;
    await upsertEntity(sb, {
      entity_key: entityKey,
      list_name: "UN",
      name,
      aliases: null,
      program: null,
      country: null,
      identifiers: {},
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }

  await sb.from("ingestion_runs").update({ status: "ok", ended_at: new Date().toISOString(), rows, checksum: hash }).eq("id", runId);
}

async function refreshEu(sb: any) {
  const run = await sb.from("ingestion_runs").insert({ source: "EU", status: "running" }).select("id").single();
  const runId = run.data?.id;

  const buf = await fetch(EU_PDF_URL).then((r) => r.arrayBuffer());
  const hash = checksum(Buffer.from(buf).toString("base64"));
  const prev = await sb
    .from("raw_snapshots")
    .select("checksum")
    .eq("source", "EU")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev.data?.checksum !== hash) {
    await insertSnapshot(sb, "EU", { pdf_hash: hash }, hash);
    await logChange(sb, "EU", hash, prev.data?.checksum || null);
  }

  await sb.from("ingestion_runs").update({ status: "ok", ended_at: new Date().toISOString(), rows: 1, checksum: hash }).eq("id", runId);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers["x-refresh-token"] || req.query.token;
  if (!process.env.REFRESH_TOKEN || token !== process.env.REFRESH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "Supabase env missing" });

  const sb = createClient(url, key, { auth: { persistSession: false } });

  try {
    await refreshOfac(sb);
    await refreshUn(sb);
    await refreshEu(sb);
    return res.status(200).json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Refresh failed" });
  }
}
