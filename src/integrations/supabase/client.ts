import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/**
 * IMPORTANT:
 * - En prod, si Vercel n’injecte pas les env au build, supabaseAnonKey peut être vide => crash.
 * - Ici, on évite le crash en fournissant des placeholders.
 * - L’app ne plantera plus, mais les requêtes échoueront tant que les env ne sont pas correctes.
 */
export const SUPABASE_ENV_OK = Boolean(supabaseUrl && supabaseAnonKey);

if (!SUPABASE_ENV_OK) {
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY at build time.",
    {
      hasUrl: Boolean(supabaseUrl),
      keyLength: (supabaseAnonKey || "").length,
    }
  );
}

// Placeholders pour éviter l’exception “supabaseKey is required”
const SAFE_URL = supabaseUrl || "https://example.supabase.co";
const SAFE_KEY = supabaseAnonKey || "public-anon-key-missing";

export const supabase = createClient(SAFE_URL, SAFE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
