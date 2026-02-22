import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type IngestBody = {
  reporter_iso2?: string;
  partner_iso2?: string;
  year?: number;
  flow?: "export" | "import";
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMTRADE_TOKEN = Deno.env.get("COMTRADE_TOKEN") || "";
const COMTRADE_CRON_SECRET = Deno.env.get("COMTRADE_CRON_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function findCode(url: string, iso2: string) {
  const data = await fetchJson(url);
  const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
  const row = list.find((item: any) => String(item?.ISO2 || item?.iso2Code || item?.id || "").toUpperCase() === iso2.toUpperCase());
  if (!row) return null;
  return String(row?.id || row?.code || row?.Code || row?.reporterCode || row?.PartnerCode || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const headerSecret = req.headers.get("x-cron-secret") || "";
    const authHeader = req.headers.get("authorization") || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let isAuthedUser = false;
    if (authHeader) {
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (jwt) {
        const { data } = await supabase.auth.getUser(jwt);
        isAuthedUser = Boolean(data?.user);
      }
    }

    if (!isAuthedUser && (!COMTRADE_CRON_SECRET || headerSecret !== COMTRADE_CRON_SECRET)) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as IngestBody;
    const reporter_iso2 = (body.reporter_iso2 || "FR").toUpperCase();
    const partner_iso2 = (body.partner_iso2 || "WORLD").toUpperCase();
    const year = Number(body.year || new Date().getFullYear() - 1);
    const flow = body.flow === "import" ? "import" : "export";

    const reporterCode = await findCode("https://comtradeapi.un.org/files/v1/app/reference/Reporters.json", reporter_iso2);
    if (!reporterCode) throw new Error(`Reporter code not found for ${reporter_iso2}`);

    let partnerCode = "0";
    if (partner_iso2 !== "WORLD") {
      const foundPartner = await findCode("https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json", partner_iso2);
      if (!foundPartner) throw new Error(`Partner code not found for ${partner_iso2}`);
      partnerCode = foundPartner;
    }

    const rg = flow === "export" ? "2" : "1";
    const url = new URL("https://comtrade.un.org/api/get");
    url.searchParams.set("max", "50000");
    url.searchParams.set("type", "C");
    url.searchParams.set("freq", "A");
    url.searchParams.set("px", "HS");
    url.searchParams.set("ps", String(year));
    url.searchParams.set("r", reporterCode);
    url.searchParams.set("p", partnerCode);
    url.searchParams.set("rg", rg);
    url.searchParams.set("cc", "AG6");
    url.searchParams.set("fmt", "json");
    if (COMTRADE_TOKEN) url.searchParams.set("token", COMTRADE_TOKEN);

    const apiJson = await fetchJson(url.toString());
    const dataset = Array.isArray(apiJson?.dataset) ? apiJson.dataset : [];

    const rows = dataset
      .map((row: any) => ({
        reporter_iso2,
        partner_iso2,
        flow,
        year,
        hs_code: String(row?.cmdCode || row?.cmdcode || row?.cmd_code || "").trim(),
        value_usd: Number(row?.TradeValue ?? row?.tradeValue ?? 0),
        source: "uncomtrade_legacy",
      }))
      .filter((row: any) => row.hs_code);

    const { data: upsertRes, error } = await supabase.rpc("rpc_upsert_trade_flows", { p_rows: rows });
    if (error) throw error;

    return Response.json(
      {
        ok: true,
        upserted: Number((upsertRes as any)?.upserted ?? rows.length),
        total_rows: rows.length,
        year,
        reporter_iso2,
        partner_iso2,
        flow,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});
