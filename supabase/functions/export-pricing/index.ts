// supabase/functions/export-pricing/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  // ✅ mets TON domaine Vercel (recommandé), ou "*" pour tester
  "Access-Control-Allow-Origin": "https://export-navigator-orli.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toCsv(rows: any[]) {
  if (!rows || rows.length === 0) return "no_data\n";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

Deno.serve(async (req) => {
  // ✅ 1) Preflight CORS (doit être AVANT toute auth / req.json)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ 2) Auth header (mais renvoyer aussi CORS sur les erreurs)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing Authorization header", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 3) Params
    const { territory_code } = await req.json().catch(() => ({ territory_code: "FR" }));
    const territory = String(territory_code ?? "FR").toUpperCase();

    // 4) Service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // 5) Pagination
    const pageSize = 5000;
    let from = 0;
    const all: any[] = [];

    while (true) {
      const to = from + pageSize - 1;

      const { data, error } = await supabaseAdmin
        .from("v_export_pricing")
        .select("*")
        .eq("territory_code", territory)
        .order("sku", { ascending: true })
        .range(from, to);

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;

      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const csv = toCsv(all);

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders, // ✅ CORS aussi sur 200
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export_${territory}.csv"`,
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${String(e?.message ?? e)}`, {
      status: 500,
      headers: corsHeaders, // ✅ CORS aussi sur 500
    });
  }
});
