import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return null;
  }

  supabaseClient = createClient(url, serviceRole, {
    auth: { persistSession: false },
    global: { headers: { "x-functions-role": "rpc" } },
  });

  return supabaseClient;
}
