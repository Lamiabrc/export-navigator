import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const FALLBACK_ALERTS = [
  {
    id: "al-1",
    title: "Mise a jour sanctions (UE)",
    message: "Verifier les restrictions sur certains pays sensibles.",
    severity: "high",
    country_iso2: "RU",
    hs_prefix: null,
    detected_at: new Date().toISOString(),
    source: "EU",
  },
  {
    id: "al-2",
    title: "Evolution taxes import US",
    message: "Certaines lignes HS 3004 impactees par un relèvement de droits.",
    severity: "medium",
    country_iso2: "US",
    hs_prefix: "3004",
    detected_at: new Date().toISOString(),
    source: "WITS",
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const email = typeof req.query.email === "string" ? req.query.email : null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(200).json({ updatedAt: new Date().toISOString(), alerts: FALLBACK_ALERTS });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  let countryFilters: string[] = [];
  let hsFilters: string[] = [];

  if (email) {
    const { data: prefs } = await sb.from("user_prefs").select("countries_json,hs_json").eq("email", email).maybeSingle();
    if (prefs?.countries_json) countryFilters = prefs.countries_json as string[];
    if (prefs?.hs_json) hsFilters = prefs.hs_json as string[];
  }

  let query = sb
    .from("alerts")
    .select("id,title,message,severity,country_iso2,hs_prefix,detected_at,source")
    .order("detected_at", { ascending: false })
    .limit(20);

  if (countryFilters.length) query = query.in("country_iso2", countryFilters);
  if (hsFilters.length) query = query.in("hs_prefix", hsFilters);

  const { data, error } = await query;
  if (error || !data) {
    return res.status(200).json({ updatedAt: new Date().toISOString(), alerts: FALLBACK_ALERTS });
  }

  const alerts = data.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    severity: a.severity,
    country_iso2: a.country_iso2,
    hs_prefix: a.hs_prefix,
    detected_at: a.detected_at,
    source: a.source,
  }));

  return res.status(200).json({ updatedAt: new Date().toISOString(), alerts });
}
