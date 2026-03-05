import * as React from "react";
import { ArrowRight, Globe2, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, PRODUCTS } from "@/lib/constants";
import { listDeals } from "@/services/crm";

type MarketScore = {
  iso2: string;
  countryLabel: string;
  score: number;
  reasons: string[];
};

type KnownDealSignal = {
  to_country: string | null;
  amount: number;
  probability: number;
};

type TradeFlowRow = {
  partner_country: string | null;
  hs_code: string | null;
  value_eur: number | null;
  flow_date: string | null;
};

const SPEED_REGION_FACTOR: Record<string, number> = {
  Europe: 1.2,
  MENA: 1.05,
  Africa: 1.0,
  Americas: 0.9,
  Asia: 0.86,
  Oceania: 0.82,
};

const PREMIUM_MARGIN_COUNTRIES = new Set([
  "US",
  "CA",
  "CH",
  "DE",
  "NL",
  "GB",
  "SE",
  "NO",
  "DK",
  "JP",
  "SG",
  "AU",
  "AE",
  "BE",
  "LU",
  "IE",
  "AT",
  "FI",
]);

const PRODUCT_HS_HINTS: Array<{ pattern: RegExp; prefixes: string[] }> = [
  { pattern: /(auto|automobile|vehicle|car|brake|frein|moteur|engine)/, prefixes: ["87"] },
  { pattern: /(textile|fashion|vetement|tshirt|chaussure|shoe|sneaker|apparel)/, prefixes: ["61", "62", "64"] },
  { pattern: /(cosmet|parfum|beauty|soin|skincare|shampoo)/, prefixes: ["33"] },
  { pattern: /(pharma|medic|medical|diagnostic|sante|health)/, prefixes: ["30", "38", "90"] },
  { pattern: /(electron|electri|laptop|smartphone|router|transformateur|sensor)/, prefixes: ["84", "85", "90"] },
  { pattern: /(agri|food|aliment|fruit|vin|wine|fromage|dairy|juice|boisson)/, prefixes: ["02", "03", "04", "07", "08", "20", "22"] },
  { pattern: /(construction|cement|ciment|acier|steel|aluminium|tile|ceramic|bois|wood)/, prefixes: ["69", "72", "73", "76", "44"] },
];

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toIso2(value: unknown) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function compactMoney(value: number, lang: "fr" | "en") {
  const locale = lang === "en" ? "en-US" : "fr-FR";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Math.max(0, value));
  } catch {
    return `${Math.round(value)} EUR`;
  }
}

function deterministicJitter(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 97) / 97;
}

function appendHsPrefixes(set: Set<string>, raw: string) {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.length >= 6) {
    set.add(digits.slice(0, 6));
    set.add(digits.slice(0, 4));
    set.add(digits.slice(0, 2));
    return;
  }
  if (digits.length >= 4) {
    set.add(digits.slice(0, 4));
    set.add(digits.slice(0, 2));
    return;
  }
  if (digits.length >= 2) set.add(digits.slice(0, 2));
}

function extractHsPrefixes(productText: string) {
  const normalized = normalize(productText);
  const prefixes = new Set<string>();

  const explicitDigits = String(productText || "").match(/[0-9]{2,10}/g) || [];
  for (const digits of explicitDigits) appendHsPrefixes(prefixes, digits);

  if (normalized) {
    const tokens = normalized.split(" ").filter((token) => token.length >= 4);

    for (const candidate of PRODUCTS) {
      const labelFr = normalize(candidate.label_fr);
      const labelEn = normalize(candidate.label_en);
      const labelHit =
        normalized.includes(labelFr) ||
        normalized.includes(labelEn) ||
        labelFr.includes(normalized) ||
        labelEn.includes(normalized);

      const tokenHit = tokens.some((token) => {
        if (token.length < 4) return false;
        if (labelFr.includes(token) || labelEn.includes(token)) return true;
        return candidate.tags.some((tag) => normalize(tag).includes(token));
      });

      if (labelHit || tokenHit) appendHsPrefixes(prefixes, candidate.hs6);
    }

    for (const hint of PRODUCT_HS_HINTS) {
      if (hint.pattern.test(normalized)) {
        for (const prefix of hint.prefixes) appendHsPrefixes(prefixes, prefix);
      }
    }
  }

  return Array.from(prefixes)
    .filter((value) => value.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
}

function hsMatchWeight(hsCode: string | null, hsPrefixes: string[]) {
  if (!hsPrefixes.length) return 1;
  const hsDigits = String(hsCode || "").replace(/[^0-9]/g, "");
  if (!hsDigits) return 0.62;

  let best = 0.48;
  for (const prefix of hsPrefixes) {
    if (!hsDigits.startsWith(prefix)) continue;
    if (prefix.length >= 6) best = Math.max(best, 1.45);
    else if (prefix.length >= 4) best = Math.max(best, 1.24);
    else best = Math.max(best, 1.1);
  }
  return best;
}

function isMissingTradeFlowsError(err: unknown) {
  const code = String((err as { code?: string } | null)?.code || "");
  const message = String((err as { message?: string } | null)?.message || "");
  return code === "42P01" || code === "PGRST205" || /trade_flows|schema cache|could not find|does not exist/i.test(message);
}

async function fetchTradeRows(lang: "fr" | "en"): Promise<{ rows: TradeFlowRow[]; warning: string | null }> {
  const legacy = await supabase
    .from("trade_flows")
    .select("partner_country,reporter_country,flow_type,hs_code,value_eur,flow_date")
    .eq("reporter_country", "FR")
    .eq("flow_type", "export")
    .order("flow_date", { ascending: false })
    .limit(5000);

  if (!legacy.error) {
    const rows = (legacy.data || []).map((row: Record<string, unknown>) => ({
      partner_country: toIso2(row.partner_country),
      hs_code: row.hs_code ? String(row.hs_code) : null,
      value_eur: row.value_eur === null ? null : asNumber(row.value_eur, 0),
      flow_date: row.flow_date ? String(row.flow_date) : null,
    }));
    if (rows.length) return { rows, warning: null };
  } else if (isMissingTradeFlowsError(legacy.error)) {
    return {
      rows: [],
      warning:
        lang === "en"
          ? "Trade flows table unavailable: fallback scoring was applied."
          : "Table trade_flows indisponible: un scoring de secours a ete applique.",
    };
  } else {
    throw legacy.error;
  }

  const modern = await supabase
    .from("trade_flows")
    .select("partner_iso2,reporter_iso2,flow,hs_code,value_usd,year")
    .eq("reporter_iso2", "FR")
    .eq("flow", "export")
    .order("year", { ascending: false })
    .limit(5000);

  if (modern.error) {
    if (isMissingTradeFlowsError(modern.error)) {
      return {
        rows: [],
        warning:
          lang === "en"
            ? "Trade flows table unavailable: fallback scoring was applied."
            : "Table trade_flows indisponible: un scoring de secours a ete applique.",
      };
    }
    throw modern.error;
  }

  const rows = (modern.data || []).map((row: Record<string, unknown>) => {
    const year = Math.max(1990, Math.min(2100, Math.trunc(asNumber(row.year, new Date().getFullYear()))));
    return {
      partner_country: toIso2(row.partner_iso2),
      hs_code: row.hs_code ? String(row.hs_code) : null,
      value_eur: row.value_usd === null ? null : asNumber(row.value_usd, 0),
      flow_date: `${year}-01-01`,
    } satisfies TradeFlowRow;
  });

  return {
    rows,
    warning: rows.length
      ? null
      : lang === "en"
      ? "No trade-flow records found for France exports: fallback scoring was applied."
      : "Aucune donnee trade_flows trouvee sur les exports France: scoring de secours applique.",
  };
}

function buildMarketScores(params: {
  lang: "fr" | "en";
  product: string;
  objective: "margin" | "volume" | "speed";
  budget: number;
  hsPrefixes: string[];
  knownDeals: KnownDealSignal[];
  tradeRows: TradeFlowRow[];
}) {
  const countriesByIso = new Map(COUNTRIES.map((country) => [country.iso2, country]));

  const tradeByCountry = new Map<
    string,
    { weighted: number; raw: number; matchedHits: number; totalHits: number; lastTs: number }
  >();

  for (const row of params.tradeRows) {
    const iso2 = toIso2(row.partner_country);
    if (!iso2 || iso2 === "FR") continue;

    const value = Math.max(0, asNumber(row.value_eur, 0));
    if (value <= 0) continue;

    const ts = row.flow_date ? Date.parse(row.flow_date) : Number.NaN;
    const ageYears = Number.isFinite(ts) ? Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24 * 365)) : 3;
    const recencyWeight = 1 / (1 + ageYears * 0.5);
    const hsWeight = hsMatchWeight(row.hs_code, params.hsPrefixes);
    const weighted = value * recencyWeight * hsWeight;

    const previous = tradeByCountry.get(iso2) || { weighted: 0, raw: 0, matchedHits: 0, totalHits: 0, lastTs: 0 };
    previous.weighted += weighted;
    previous.raw += value;
    previous.totalHits += 1;
    if (hsWeight > 1) previous.matchedHits += 1;
    if (Number.isFinite(ts)) previous.lastTs = Math.max(previous.lastTs, ts);
    tradeByCountry.set(iso2, previous);
  }

  const pipelineByCountry = new Map<string, number>();
  for (const deal of params.knownDeals) {
    const iso2 = toIso2(deal.to_country);
    if (!iso2) continue;
    const base = Math.max(0, asNumber(deal.amount, 0));
    const probability = Math.min(100, Math.max(0, asNumber(deal.probability, 20)));
    const weighted = (base > 0 ? base : 5000) * (Math.max(10, probability) / 100);
    pipelineByCountry.set(iso2, (pipelineByCountry.get(iso2) || 0) + weighted);
  }

  const maxTrade = Math.max(1, ...Array.from(tradeByCountry.values()).map((item) => item.weighted));
  const maxPipeline = Math.max(1, ...Array.from(pipelineByCountry.values()));

  const budget = Math.max(0, params.budget);
  const budgetFactor = budget >= 100000 ? 1.15 : budget >= 30000 ? 1.05 : budget >= 10000 ? 1 : 0.9;

  const candidateIso = new Set<string>(COUNTRIES.map((country) => country.iso2));
  for (const iso2 of tradeByCountry.keys()) candidateIso.add(iso2);
  for (const iso2 of pipelineByCountry.keys()) candidateIso.add(iso2);

  const results: MarketScore[] = [];
  for (const iso2 of candidateIso) {
    if (iso2 === "FR") continue;

    const country = countriesByIso.get(iso2);
    const region = country?.region || "Global";
    const trade = tradeByCountry.get(iso2);
    const pipeline = pipelineByCountry.get(iso2) || 0;

    const tradeNorm = trade ? trade.weighted / maxTrade : 0;
    const pipelineNorm = pipeline > 0 ? pipeline / maxPipeline : 0;

    const speedRegion = SPEED_REGION_FACTOR[region] || 0.88;
    const marginBonus = PREMIUM_MARGIN_COUNTRIES.has(iso2) ? 1.1 : 0.98;

    let objectiveSignal = 0;
    if (params.objective === "margin") {
      objectiveSignal = tradeNorm * 0.64 + pipelineNorm * 0.22 + (marginBonus * budgetFactor - 0.75) * 0.14;
    } else if (params.objective === "volume") {
      objectiveSignal = tradeNorm * 0.78 + pipelineNorm * 0.14 + budgetFactor * 0.08;
    } else {
      objectiveSignal = tradeNorm * 0.44 + pipelineNorm * 0.4 + (speedRegion / 1.2) * 0.16;
    }

    if (tradeNorm === 0 && pipelineNorm === 0) objectiveSignal *= 0.68;

    const jitter = deterministicJitter(`${params.product}|${params.objective}|${iso2}`) * 0.06;
    const score = Number(Math.max(0, (objectiveSignal + jitter) * 100).toFixed(1));

    const reasons: string[] = [];
    if (trade && trade.raw > 0) {
      reasons.push(
        params.lang === "en"
          ? `Recent FR export signal: ${compactMoney(trade.raw, "en")} on this destination.`
          : `Signal export FR recent: ${compactMoney(trade.raw, "fr")} sur cette destination.`
      );
    }
    if (params.hsPrefixes.length && trade && trade.matchedHits > 0) {
      reasons.push(
        params.lang === "en"
          ? `HS match detected (${trade.matchedHits}/${trade.totalHits} records on related HS prefixes).`
          : `Correspondance HS detectee (${trade.matchedHits}/${trade.totalHits} lignes sur prefixes HS proches).`
      );
    }
    if (pipeline > 0) {
      reasons.push(
        params.lang === "en"
          ? "Existing internal pipeline improves execution confidence."
          : "Pipeline interne existant qui renforce la confiance d'execution."
      );
    }
    if (params.objective === "speed" && speedRegion >= 1) {
      reasons.push(
        params.lang === "en"
          ? "Region fit for faster execution cycle from France."
          : "Region favorable a un cycle de mise en marche plus rapide depuis la France."
      );
    }
    if (params.objective === "margin" && PREMIUM_MARGIN_COUNTRIES.has(iso2)) {
      reasons.push(
        params.lang === "en"
          ? "Higher-value market profile aligned with margin objective."
          : "Profil de marche a valeur plus elevee, aligne avec l'objectif marge."
      );
    }
    if (!reasons.length) {
      reasons.push(
        params.lang === "en"
          ? "Expansion candidate based on current objective and budget."
          : "Candidat d'expansion coherent avec votre objectif et votre budget."
      );
    }

    results.push({
      iso2,
      countryLabel: country ? (params.lang === "en" ? country.label_en : country.label_fr) : iso2,
      score,
      reasons: reasons.slice(0, 3),
    });
  }

  return results
    .sort((a, b) => b.score - a.score || a.countryLabel.localeCompare(b.countryLabel))
    .slice(0, 5);
}

export default function MarketFinder() {
  const { lang } = useI18n();
  const uiLang = lang === "en" ? "en" : "fr";

  const [product, setProduct] = React.useState("");
  const [objective, setObjective] = React.useState<"margin" | "volume" | "speed">("margin");
  const [budget, setBudget] = React.useState("20000");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<MarketScore[]>([]);
  const [hsPrefixes, setHsPrefixes] = React.useState<string[]>([]);

  const copy = React.useMemo(
    () =>
      uiLang === "en"
        ? {
            title: "Market Finder",
            subtitle: "Top 5 countries scored with trade-flow data, objective and CRM signals.",
            product: "Product text",
            objective: "Objective",
            budget: "Budget (EUR)",
            run: "Find top 5 markets",
            margin: "Higher margin",
            volume: "Higher volume",
            speed: "Faster cycle",
            reasons: "Why this market",
            secure: "Create and secure a deal",
            hsDetected: "Detected HS prefixes",
          }
        : {
            title: "Market Finder",
            subtitle: "Top 5 pays scores avec donnees de flux commerciaux, objectif et signaux CRM.",
            product: "Produit (texte)",
            objective: "Objectif",
            budget: "Budget (EUR)",
            run: "Trouver les 5 marches",
            margin: "Marge plus elevee",
            volume: "Volume plus eleve",
            speed: "Cycle plus rapide",
            reasons: "Pourquoi ce marche",
            secure: "Creer puis securiser un deal",
            hsDetected: "Prefixes HS detectes",
          },
    [uiLang]
  );

  const run = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const [dealResponse, tradeResponse] = await Promise.all([listDeals(), fetchTradeRows(uiLang)]);
      const knownDeals = dealResponse.deals.map((deal) => ({
        to_country: deal.to_country,
        amount: deal.amount || 0,
        probability: deal.probability || 0,
      }));

      const detected = extractHsPrefixes(product);
      const scored = buildMarketScores({
        lang: uiLang,
        product,
        objective,
        budget: Math.max(0, asNumber(budget, 0)),
        hsPrefixes: detected,
        knownDeals,
        tradeRows: tradeResponse.rows,
      });

      setHsPrefixes(detected);
      setResults(scored);
      setWarning(tradeResponse.warning || dealResponse.warning || null);
    } catch (err) {
      setError((err as Error)?.message || "Run error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <Card className="border-blue-100 bg-white/95">
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1 xl:col-span-2">
              <Label>{copy.product}</Label>
              <Input
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder={uiLang === "en" ? "Ex: premium sandals / HS 6404" : "Ex: sandales premium / HS 6404"}
              />
            </div>
            <div className="space-y-1">
              <Label>{copy.objective}</Label>
              <Select value={objective} onValueChange={(value) => setObjective(value as "margin" | "volume" | "speed")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margin">{copy.margin}</SelectItem>
                  <SelectItem value="volume">{copy.volume}</SelectItem>
                  <SelectItem value="speed">{copy.speed}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{copy.budget}</Label>
              <Input type="number" min="0" value={budget} onChange={(event) => setBudget(event.target.value)} />
            </div>
            <div className="xl:col-span-4 flex flex-wrap items-center gap-2">
              <Button onClick={run} disabled={loading}>
                <TrendingUp className="mr-2 h-4 w-4" />
                {copy.run}
              </Button>
              {error ? <span className="text-xs text-rose-700">{error}</span> : null}
              {warning ? <span className="text-xs text-amber-700">{warning}</span> : null}
            </div>
            {hsPrefixes.length ? (
              <div className="xl:col-span-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{copy.hsDetected}:</span>
                {hsPrefixes.map((prefix) => (
                  <Badge key={`hs-${prefix}`} variant="outline">
                    {prefix}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {results.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {results.map((entry, index) => (
              <Card key={entry.iso2} className="border-blue-100 bg-white/95">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      #{index + 1} {entry.countryLabel}
                    </CardTitle>
                    <Badge variant="secondary">{entry.score}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe2 className="h-4 w-4" />
                    {entry.iso2}
                  </div>
                  <p className="text-xs font-medium">{copy.reasons}</p>
                  <ul className="list-disc space-y-1 pl-5 text-xs">
                    {entry.reasons.map((reason, reasonIndex) => (
                      <li key={`${entry.iso2}-reason-${reasonIndex}`}>{reason}</li>
                    ))}
                  </ul>
                  <Button asChild size="sm" className="w-full">
                    <Link to={`/app/dossiers?to=${entry.iso2}`}>
                      {copy.secure}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

