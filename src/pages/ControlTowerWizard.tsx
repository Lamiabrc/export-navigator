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
import { exportAnswer, tradeBilateral } from "@/services/supabaseAI";
import type { CountrySuggestion, ExportAnswerResult, HsSuggestion, ScreeningResult, TradeBilateralResult } from "@/types/supabaseAI";
import { supabase } from "@/integrations/supabase/client";

export default function ControlTowerWizard() {
  const { lang } = useI18n();
  const location = useLocation();
  const initialState = (location.state ?? {}) as { mode?: "export" | "import"; questionText?: string };
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const testDbHealth = async () => {
    const [countries, hs_codes, reference_sources, rpc] = await Promise.all([
      supabase.from("countries").select("id", { head: true, count: "exact" }),
      supabase.from("hs_codes").select("id", { head: true, count: "exact" }),
      supabase.from("reference_sources").select("id", { head: true, count: "exact" }),
      supabase.rpc("rpc_export_answer", { destination_iso2: "CL", hs_code: "081010", lang: "en" }),
    ]);

    setDbHealth({
      countries: countries.count ?? 0,
      hs_codes: hs_codes.count ?? 0,
      reference_sources: reference_sources.count ?? 0,
      rpc_export_answer_sample: rpc.data,
      errors: [countries.error?.message, hs_codes.error?.message, reference_sources.error?.message, rpc.error?.message].filter(Boolean),
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
              {lang === "fr" ? "Mode" : "Mode"}: <strong>{initialState.mode ?? "export"}</strong>
            </p>
            {initialState.questionText ? <p className="text-muted-foreground">{initialState.questionText}</p> : null}
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
            <Button variant="outline" onClick={testDbHealth}>
              {lang === "fr" ? "Tester la base" : "Run DB health check"}
            </Button>
            {dbHealth ? <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(dbHealth, null, 2)}</pre> : null}
          </CardContent>
        </Card>
      </main>
    </PublicLayout>
  );
}
