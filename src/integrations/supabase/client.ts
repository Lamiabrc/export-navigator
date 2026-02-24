import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();
const supabaseClientKey = supabaseAnonKey || supabasePublishableKey || "";

/**
 * IMPORTANT:
 * - En prod, si Vercel n’injecte pas les env au build, supabaseAnonKey peut être vide => crash.
 * - Ici, on évite le crash en fournissant des placeholders.
 * - L’app ne plantera plus, mais les requêtes échoueront tant que les env ne sont pas correctes.
 */
export const SUPABASE_ENV_OK = Boolean(supabaseUrl && supabaseClientKey);
export const DEMO_MODE = !SUPABASE_ENV_OK;

if (!SUPABASE_ENV_OK) {
  console.error("[Supabase] Missing VITE_SUPABASE_URL and Supabase client key at build time.", {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    hasPublishableKey: Boolean(supabasePublishableKey),
    keyLength: (supabaseClientKey || "").length,
  });
}

// Placeholders pour éviter l’exception “supabaseKey is required”
const SAFE_URL = supabaseUrl || "https://example.supabase.co";
const SAFE_KEY = supabaseClientKey || "public-anon-key-missing";

export const supabase = createClient(SAFE_URL, SAFE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // ✅ important pour les liens email avec ?code=...
    flowType: "pkce",
    // (optionnel mais propre)
    storageKey: "export-navigator-auth",
  },
});
