import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "Missing supabase env" });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const email = normStr(body?.email).toLowerCase();
  const name = normStr(body?.name) || null;
  const message = normStr(body?.message);
  const page_url = normStr(body?.page_url) || null;
  const context = body?.context ?? null;

  if (!email) return json(400, { ok: false, error: "email is required" });
  if (!message) return json(400, { ok: false, error: "message is required" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("support_messages").insert({
    email,
    name,
    message,
    page_url,
    context,
    status: "new",
  });

  if (error) return json(500, { ok: false, error: error.message });

  return json(200, { ok: true });
});
