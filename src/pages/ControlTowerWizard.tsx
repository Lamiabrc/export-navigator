import * as React from "react";
import { useLocation } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountryPicker } from "@/components/CountryPicker";
import { HsPicker } from "@/components/HsPicker";
import { ExportAnswerPanel } from "@/components/ExportAnswerPanel";
import { TradePanel } from "@/components/TradePanel";
import { SanctionsScreening } from "@/components/SanctionsScreening";
import { useI18n } from "@/contexts/LanguageContext";
import { countryFunnel, exportAnswer, hsFunnel, tradeBilateral } from "@/services/supabaseAI";
import type {
  CountrySuggestion,
  ExportAnswerResult,
  HsSuggestion,
  ScreeningResult,
  TradeBilateralResult,
} from "@/types/supabaseAI";

type WizardState = {
  mode?: "export" | "import";
  questionText?: string;
};

function readWizardState(state: unknown): WizardState {
  if (!state || typeof state !== "object") return {};
  const source = state as Record<string, unknown>;
  return {
    mode: source.mode === "import" ? "import" : source.mode === "export" ? "export" : undefined,
    questionText: typeof source.questionText === "string" ? source.questionText : undefined,
  };
}

export default function ControlTowerWizard() {
  const { lang } = useI18n();
  const location = useLocation();
  const wizardState = React.useMemo(() => readWizardState(location.state), [location.state]);

  const [country, setCountry] = React.useState<CountrySuggestion | null>(null);
  const [hs, setHs] = React.useState<HsSuggestion | null>(null);
  const [partyName, setPartyName] = React.useState("");
  const [screening, setScreening] = React.useState<ScreeningResult | null>(null);
  const [answer, setAnswer] = React.useState<ExportAnswerResult | null>(null);
  const [trade, setTrade] = React.useState<TradeBilateralResult | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dbHealth, setDbHealth] = React.useState<Record<string, unknown> | null>(null);

  const run = async () => {
    if (!country || !hs) return;

    setLoading(true);
    setError(null);
    try {
      const [answerData, tradeData] = await Promise.all([
        exportAnswer(country.iso2, hs.hs_code, lang),
        tradeBilateral("FR", country.iso2, new Date().getFullYear(), "exports"),
      ]);
      setAnswer(answerData);
      setTrade(tradeData);
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const testDbHealth = async () => {
    const errors: string[] = [];
    let countriesCount: number | null = null;
    let hsCount: number | null = null;
    let sourcesCount: number | null = null;
    let exportSample: unknown = null;

    try {
      const result = await countryFunnel("chile", "en", true);
      countriesCount = result.suggestions.length;
    } catch (exception) {
      errors.push((exception as Error).message);
    }

    try {
      const result = await hsFunnel("strawberries", "en");
      hsCount = result.suggestions.length;
    } catch (exception) {
      errors.push((exception as Error).message);
    }

    try {
      const result = await exportAnswer("CL", "081010", "en");
      exportSample = result.raw;
      sourcesCount = result.update_sources?.length ?? 0;
    } catch (exception) {
      errors.push((exception as Error).message);
    }

    setDbHealth({
      countries: countriesCount,
      hs_codes: hsCount,
      reference_sources: sourcesCount,
      rpc_export_answer_sample: exportSample,
      errors,
    });
  };

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-screen-xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>{lang === "fr" ? "Tour de contrôle" : "Control Tower"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {lang === "fr" ? "Mode" : "Mode"}: <strong>{wizardState.mode ?? "export"}</strong>
            </p>
            {wizardState.questionText ? <p className="text-muted-foreground">{wizardState.questionText}</p> : null}

            <CountryPicker value={country} onSelect={setCountry} />
            <HsPicker value={hs} onSelect={setHs} />

            <Button onClick={run} disabled={loading || !country || !hs}>
              {loading ? "..." : lang === "fr" ? "Lancer l'analyse" : "Run analysis"}
            </Button>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <ExportAnswerPanel data={answer} />
        <TradePanel data={trade} />
        <SanctionsScreening value={partyName} onValueChange={setPartyName} result={screening} onResult={setScreening} />

        <Card>
          <CardHeader>
            <CardTitle>DB Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button type="button" variant="outline" onClick={testDbHealth}>
              {lang === "fr" ? "Tester la base" : "Run DB health check"}
            </Button>
            {dbHealth ? (
              <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(dbHealth, null, 2)}</pre>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </PublicLayout>
  );
}
