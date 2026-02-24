import { countryFunnel, exportAnswer, hsFunnel } from "@/services/supabaseAI";
import type { CountrySuggestion, HsSuggestion } from "@/types/supabaseAI";

export type SupabaseAiFallback = {
  answer: string;
  summary: string;
  followUpQuestions: string[];
  sourceLinks: Array<{ title: string; url: string; origin: "supabase" }>;
  contextSummary: string;
};

function detectLang(question: string): "fr" | "en" {
  const q = String(question || "").toLowerCase();
  if (!q.trim()) return "fr";
  if (/[àâçéèêëîïôùûüÿœæ]/i.test(q)) return "fr";
  if (/\b(the|what|which|how|import|export|documents|duties|vat)\b/i.test(q)) return "en";
  return "fr";
}

function firstCountryLabel(country: CountrySuggestion | null, lang: "fr" | "en") {
  if (!country) return lang === "fr" ? "non detecte" : "not detected";
  return `${country.label} (${country.iso2})`;
}

function firstHsLabel(hs: HsSuggestion | null, lang: "fr" | "en") {
  if (!hs) return lang === "fr" ? "non detecte" : "not detected";
  return hs.label && hs.label !== hs.hs_code ? `${hs.hs_code} - ${hs.label}` : hs.hs_code;
}

export async function getSupabaseAiFallback(question: string): Promise<SupabaseAiFallback | null> {
  const q = String(question || "").trim();
  if (!q) return null;

  const lang = detectLang(q);
  const [countryResult, hsResult] = await Promise.allSettled([countryFunnel(q, lang, true), hsFunnel(q, lang)]);

  const country =
    countryResult.status === "fulfilled" ? (countryResult.value.suggestions?.[0] ?? null) : null;
  const hs = hsResult.status === "fulfilled" ? (hsResult.value.suggestions?.[0] ?? null) : null;

  if (!country && !hs) return null;

  let sourceLinks: Array<{ title: string; url: string; origin: "supabase" }> = [];
  if (country && hs) {
    try {
      const detailed = await exportAnswer(country.iso2, hs.hs_code, lang);
      sourceLinks = (detailed.update_sources ?? [])
        .map((item, idx) => {
          const url = String(item?.url ?? "").trim();
          if (!/^https?:\/\//i.test(url)) return null;
          const title = String(item?.label ?? item?.source_key ?? `Source ${idx + 1}`).trim() || `Source ${idx + 1}`;
          return { title, url, origin: "supabase" as const };
        })
        .filter(Boolean)
        .slice(0, 4) as Array<{ title: string; url: string; origin: "supabase" }>;
    } catch {
      sourceLinks = [];
    }
  }

  const followUpQuestions: string[] = [];
  if (!country) followUpQuestions.push(lang === "fr" ? "Quel est le pays de destination ?" : "What is the destination country?");
  if (!hs) followUpQuestions.push(lang === "fr" ? "Quel est le produit ou code HS ?" : "What is the product or HS code?");
  if (!followUpQuestions.length) {
    followUpQuestions.push(
      lang === "fr"
        ? "Peux-tu confirmer la valeur, l'incoterm et le mode de transport ?"
        : "Can you confirm value, incoterm, and transport mode?"
    );
  }

  const summary =
    lang === "fr"
      ? "Reponse de secours via Supabase AI"
      : "Fallback answer via Supabase AI";

  const answer =
    lang === "fr"
      ? [
          "Je prends le relais avec les donnees Supabase AI.",
          `- Destination detectee: ${firstCountryLabel(country, lang)}`,
          `- Produit/HS detecte: ${firstHsLabel(hs, lang)}`,
          "- Etapes conseillees: verifier restrictions/sanctions, valider droits/TVA, puis confirmer les documents de dedouanement.",
        ].join("\n")
      : [
          "I am taking over with Supabase AI data.",
          `- Detected destination: ${firstCountryLabel(country, lang)}`,
          `- Detected product/HS: ${firstHsLabel(hs, lang)}`,
          "- Recommended steps: verify restrictions/sanctions, validate duties/VAT, then confirm customs documentation.",
        ].join("\n");

  const contextSummary = `destination=${country?.iso2 ?? "?"} | hs=${hs?.hs_code ?? "?"}`;

  return {
    answer,
    summary,
    followUpQuestions,
    sourceLinks,
    contextSummary,
  };
}
