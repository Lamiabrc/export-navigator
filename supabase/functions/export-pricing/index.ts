// supabase/functions/export-pricing/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing Authorization header", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Params
    const { territory_code } = await req.json().catch(() => ({ territory_code: "FR" }));
    const territory = String(territory_code ?? "FR").toUpperCase();

    // Env
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ✅ 1) Valider le JWT avec ANON KEY (sinon n’importe qui peut appeler le service role)
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response("Invalid or expired JWT", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // ✅ 2) Client admin (service role) après auth OK
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Pagination
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
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export_${territory}.csv"`,
      },
    });
  } catch (e) {
    return new Response(`Error: ${String((e as any)?.message ?? e)}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
