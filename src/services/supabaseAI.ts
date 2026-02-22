import { supabase } from "@/integrations/supabase/client";
import type {
  CountryFunnelResult,
  CountrySuggestion,
  ExportAnswerResult,
  HsFunnelResult,
  HsSuggestion,
  ScreeningHit,
  ScreeningResult,
  TradeBilateralResult,
  TradePartnerLine,
} from "@/types/supabaseAI";

const asArray = (input: unknown): unknown[] => (Array.isArray(input) ? input : []);
const missingRpcCache = new Set<string>();

function isMissingRpcError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find the function") ||
    normalized.includes("no route matched") ||
    normalized.includes("404") ||
    normalized.includes("pgrst")
  );
}

function asErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

async function callRpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  if (missingRpcCache.has(name)) {
    throw new Error(`${name}: unavailable`);
  }
  try {
    const { data, error } = await supabase.rpc(name, params);
    if (error) {
      if (isMissingRpcError(error.message)) {
        missingRpcCache.add(name);
      }
      throw new Error(error.message);
    }
    return data as T;
  } catch (error) {
    if (isMissingRpcError(asErrorMessage(error, ""))) {
      missingRpcCache.add(name);
    }
    throw new Error(`${name}: ${asErrorMessage(error, "unknown RPC error")}`);
  }
}

async function callRpcFallback<T>(names: string[], params: Record<string, unknown>): Promise<T> {
  const errors: string[] = [];
  for (const name of names) {
    if (missingRpcCache.has(name)) continue;
    try {
      return await callRpc<T>(name, params);
    } catch (error) {
      errors.push(asErrorMessage(error, "unknown error"));
      if (!isMissingRpcError(asErrorMessage(error, ""))) {
        throw error;
      }
    }
  }
  throw new Error(errors[0] ?? `RPC unavailable (${names.join(", ")})`);
}

const mapCountrySuggestions = (raw: unknown): CountrySuggestion[] => {
  const rows = asArray(raw);
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const value = row as Record<string, unknown>;
      const iso2 = String(value.iso2 ?? value.code_iso2 ?? value.country_iso2 ?? "").toUpperCase();
      if (!iso2) return null;
      const label = String(value.label ?? value.name ?? value.country_name ?? iso2);
      return {
        iso2,
        label,
        zone: (value.zone as string | null | undefined) ?? null,
        confidence: Number(value.confidence ?? value.score ?? 0) || null,
      } satisfies CountrySuggestion;
    })
    .filter(Boolean) as CountrySuggestion[];
};

const mapHsSuggestions = (raw: unknown): HsSuggestion[] => {
  const rows = asArray(raw);
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const value = row as Record<string, unknown>;
      const hs_code = String(value.hs_code ?? value.code ?? value.hs ?? "");
      if (!hs_code) return null;
      return {
        hs_code,
        label: String(value.label ?? value.description ?? hs_code),
        chapter: String(value.chapter ?? "") || null,
        confidence: Number(value.confidence ?? value.score ?? 0) || null,
      } satisfies HsSuggestion;
    })
    .filter(Boolean) as HsSuggestion[];
};

export async function countryFunnel(q: string, lang: string, ignoreLearning = false): Promise<CountryFunnelResult> {
  const raw = await callRpcFallback<unknown>(["rpc_country_funnel", "country_funnel"], {
    q,
    lang,
    lim: 8,
    ignore_learning: ignoreLearning,
  });
  const suggestions = mapCountrySuggestions(raw);
  return { suggestions, needsClarification: suggestions.length > 1, raw };
}

export async function confirmCountry(term: string, lang: string, code_iso2: string) {
  return callRpc("rpc_confirm_country_choice_smart", { term, lang, code_iso2 });
}

export async function hsFunnel(q: string, lang: string): Promise<HsFunnelResult> {
  const raw = await callRpcFallback<unknown>(["rpc_hs_funnel", "hs_funnel"], { q, lang, lim: 8 });
  const suggestions = mapHsSuggestions(raw);
  return { suggestions, needsClarification: suggestions.length > 1, raw };
}

export async function hsSuggestInChapter(q: string, chapter: string, lang: string): Promise<HsFunnelResult> {
  const raw = await callRpcFallback<unknown>(["rpc_suggest_hs_in_chapter", "rpc_suggest_hs_bi", "suggest_hs_in_chapter"], {
    q,
    chapter,
    lang,
    lim: 8,
  });
  const suggestions = mapHsSuggestions(raw);
  return { suggestions, needsClarification: suggestions.length > 1, raw };
}

export async function exportAnswer(destination_iso2: string, hs_code: string, lang: string): Promise<ExportAnswerResult> {
  const raw = await callRpcFallback<Record<string, unknown>>(["rpc_export_answer", "export_answer"], {
    destination_iso2,
    hs_code,
    lang,
  });
  return {
    destination: (raw.destination as ExportAnswerResult["destination"]) ?? undefined,
    country_rules: (raw.country_rules as Record<string, unknown>) ?? undefined,
    product_rules: asArray(raw.product_rules).filter(Boolean) as Array<Record<string, unknown>>,
    update_sources: asArray(raw.update_sources).filter(Boolean) as ExportAnswerResult["update_sources"],
    raw,
  };
}

export async function tradeBilateral(
  reporter: string,
  partner: string,
  year: number,
  flow: "exports" | "imports" = "exports",
): Promise<TradeBilateralResult> {
  const raw = await callRpcFallback<unknown>(["rpc_trade_bilateral", "trade_bilateral"], {
    reporter,
    partner,
    year,
    flow,
    lim: 6,
  });
  const rows = asArray(raw);
  const topHs6: TradePartnerLine[] = rows.map((row) => {
    const line = (row ?? {}) as Record<string, unknown>;
    return {
      hs6: String(line.hs6 ?? line.hs_code ?? "") || undefined,
      value: Number(line.value ?? line.trade_value ?? 0) || 0,
      label: String(line.label ?? line.product_label ?? "") || undefined,
    };
  });
  const total = topHs6.reduce((sum, item) => sum + (item.value ?? 0), 0);
  return { total, currency: "USD", topHs6, raw };
}

export async function screenParty(name: string, lim = 5): Promise<ScreeningResult> {
  const raw = await callRpcFallback<unknown>(["rpc_screen_party", "screen_party"], { name, lim });
  const hits: ScreeningHit[] = asArray(raw).map((row) => {
    const value = (row ?? {}) as Record<string, unknown>;
    return {
      name: String(value.name ?? "Unknown"),
      entity_type: String(value.entity_type ?? "") || null,
      source_key: String(value.source_key ?? "") || null,
      source_url: String(value.source_url ?? "") || null,
      score: Number(value.score ?? 0) || null,
    };
  });
  return { hits, raw };
}
