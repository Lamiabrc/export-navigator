import type { VercelRequest, VercelResponse } from "@vercel/node";

/*
 * Sondage express « IA & export » (page /sondage).
 * POST : enregistre une réponse (table survey_responses, insertion seule pour anon) puis renvoie les statistiques.
 * GET  : renvoie les statistiques agrégées (fonction survey_stats, aucune réponse individuelle exposée).
 */

const ALLOWED = {
  heures: ["lt2", "2-5", "5-10", "10+"],
  tache: ["devis", "documents", "relances", "regles"],
  ia: ["non", "teste", "quotidien"],
  region: ["bretagne", "pdl", "normandie", "idf", "autre"],
} as const;

function db() {
  const url = (process.env.SUPABASE_FORMS_URL || process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_FORMS_KEY || "").trim();
  return { url, key };
}

async function stats(url: string, key: string) {
  const r = await fetch(`${url}/rest/v1/rpc/survey_stats`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_survey: "ia-export-2026" }),
  });
  if (!r.ok) throw new Error(`stats ${r.status}`);
  return r.json();
}

function pick<T extends readonly string[]>(v: unknown, list: T): T[number] | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  const { url, key } = db();
  if (!url || !key) return res.status(503).json({ ok: false, error: "db_not_configured" });

  try {
    if (req.method === "GET") return res.status(200).json({ ok: true, stats: await stats(url, key) });
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const row = {
      heures: pick(b.heures, ALLOWED.heures),
      tache: pick(b.tache, ALLOWED.tache),
      ia: pick(b.ia, ALLOWED.ia),
      region: pick(b.region, ALLOWED.region),
      email: typeof b.email === "string" && /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(b.email.trim()) ? b.email.trim().slice(0, 254) : null,
      source: typeof b.source === "string" ? b.source.slice(0, 60) : null,
      campaign: typeof b.campaign === "string" ? b.campaign.slice(0, 80) : null,
    };
    if (!row.heures && !row.tache && !row.ia && !row.email) return res.status(400).json({ ok: false, error: "empty" });

    const ins = await fetch(`${url}/rest/v1/survey_responses`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!ins.ok) return res.status(502).json({ ok: false, error: `insert_${ins.status}` });
    return res.status(200).json({ ok: true, stats: await stats(url, key) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e as Error).message || e) });
  }
}
