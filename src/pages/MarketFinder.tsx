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
import { COUNTRIES } from "@/lib/constants";
import { listDeals } from "@/services/crm";

type MarketScore = {
  iso2: string;
  countryLabel: string;
  score: number;
  reasons: string[];
};

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PRODUCT_REGION_HINTS: Record<string, string[]> = {
  agri: ["EU", "MENA", "Asia"],
  textile: ["EU", "Americas", "MENA"],
  electronics: ["Americas", "Asia", "EU"],
  auto: ["EU", "Americas", "MENA"],
};

function detectSegment(product: string) {
  const text = normalize(product);
  if (!text) return "agri";
  if (/(textile|shoe|chaussure|fashion)/.test(text)) return "textile";
  if (/(laptop|ordinateur|software|electron)/.test(text)) return "electronics";
  if (/(auto|automobile|brake|piece)/.test(text)) return "auto";
  return "agri";
}

function buildMarketScores(params: {
  lang: "fr" | "en";
  product: string;
  objective: "margin" | "volume" | "speed";
  budget: number;
  knownDeals: Array<{ to_country: string | null; amount: number; probability: number }>;
}) {
  const segment = detectSegment(params.product);
  const preferredRegions = PRODUCT_REGION_HINTS[segment] || ["EU", "Americas", "Asia"];

  const currentCountryWeight = new Map<string, number>();
  for (const deal of params.knownDeals) {
    if (!deal.to_country) continue;
    const base = deal.amount > 0 ? deal.amount : 1000;
    const weighted = base * Math.max(10, deal.probability || 20) / 100;
    currentCountryWeight.set(deal.to_country, (currentCountryWeight.get(deal.to_country) || 0) + weighted);
  }

  const list: MarketScore[] = COUNTRIES.map((country) => {
    const historical = currentCountryWeight.get(country.iso2) || 0;
    const regionFit = preferredRegions.includes(country.region) ? 1.25 : 0.85;
    const objectiveWeight = params.objective === "margin" ? 1.2 : params.objective === "speed" ? 1.05 : 1.1;
    const budgetWeight = params.budget > 50000 ? 1.2 : params.budget > 10000 ? 1.05 : 0.9;
    const scoreBase = (historical / 15000 + 1) * regionFit * objectiveWeight * budgetWeight;
    const score = Number((scoreBase * 10).toFixed(1));

    const reasons: string[] = [];
    if (historical > 0) {
      reasons.push(
        params.lang === "en"
          ? `Existing pipeline signal (${Math.round(historical)} EUR weighted).`
          : `Signal pipeline existant (${Math.round(historical)} EUR ponderes).`
      );
    }
    if (preferredRegions.includes(country.region)) {
      reasons.push(
        params.lang === "en" ? `Region fit for ${segment} segment.` : `Region adaptee au segment ${segment}.`
      );
    }
    if (!reasons.length) {
      reasons.push(params.lang === "en" ? "Potential expansion market." : "Marche potentiel d'expansion.");
    }

    return {
      iso2: country.iso2,
      countryLabel: params.lang === "en" ? country.label_en : country.label_fr,
      score,
      reasons,
    };
  });

  return list.sort((a, b) => b.score - a.score).slice(0, 5);
}

export default function MarketFinder() {
  const { lang } = useI18n();
  const uiLang = lang === "en" ? "en" : "fr";

  const [product, setProduct] = React.useState("");
  const [objective, setObjective] = React.useState<"margin" | "volume" | "speed">("margin");
  const [budget, setBudget] = React.useState("20000");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<MarketScore[]>([]);

  const copy = React.useMemo(
    () =>
      uiLang === "en"
        ? {
            title: "Market Finder",
            subtitle: "Find top 5 countries based on your product, objective and existing pipeline.",
            product: "Product text",
            objective: "Objective",
            budget: "Budget (EUR)",
            run: "Find top 5 markets",
            margin: "Higher margin",
            volume: "Higher volume",
            speed: "Faster cycle",
            reasons: "Why this market",
            secure: "Create and secure a deal",
          }
        : {
            title: "Market Finder",
            subtitle: "Identifier les 5 meilleurs pays selon votre produit, objectif et pipeline existant.",
            product: "Produit (texte)",
            objective: "Objectif",
            budget: "Budget (EUR)",
            run: "Trouver les 5 marches",
            margin: "Marge plus elevee",
            volume: "Volume plus eleve",
            speed: "Cycle plus rapide",
            reasons: "Pourquoi ce marche",
            secure: "Creer puis securiser un deal",
          },
    [uiLang]
  );

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listDeals();
      const deals = response.deals.map((deal) => ({
        to_country: deal.to_country,
        amount: deal.amount || 0,
        probability: deal.probability || 0,
      }));
      const scored = buildMarketScores({
        lang: uiLang,
        product,
        objective,
        budget: Number(budget || 0),
        knownDeals: deals,
      });
      setResults(scored);
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
              <Input value={product} onChange={(event) => setProduct(event.target.value)} placeholder={uiLang === "en" ? "Ex: premium sandals" : "Ex: sandales premium"} />
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
            <div className="xl:col-span-4 flex gap-2">
              <Button onClick={run} disabled={loading}>
                <TrendingUp className="mr-2 h-4 w-4" />
                {copy.run}
              </Button>
              {error ? <span className="text-xs text-rose-700 self-center">{error}</span> : null}
            </div>
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
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {entry.reasons.map((reason, reasonIndex) => (
                      <li key={`${entry.iso2}-reason-${reasonIndex}`}>{reason}</li>
                    ))}
                  </ul>
                  <Button asChild size="sm" className="w-full">
                    <Link to={`/app/deals?to=${entry.iso2}`}>
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

