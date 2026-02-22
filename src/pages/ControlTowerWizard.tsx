import * as React from "react";
import { useLocation } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountryPicker } from "@/components/CountryPicker";
import { HsPicker } from "@/components/HsPicker";
import { ExportAnswerPanel } from "@/components/ExportAnswerPanel";
import { TradePanel } from "@/components/TradePanel";
import { SanctionsScreening } from "@/components/SanctionsScreening";
import { useI18n } from "@/contexts/LanguageContext";
import { exportAnswer, tradeBilateral } from "@/services/supabaseAI";
import type { CountrySuggestion, ExportAnswerResult, HsSuggestion, ScreeningResult, TradeBilateralResult } from "@/types/supabaseAI";
import { supabase } from "@/integrations/supabase/client";
import { countryFunnel, exportAnswer, hsFunnel, tradeBilateral } from "@/services/supabaseAI";
import type { CountrySuggestion, ExportAnswerResult, HsSuggestion, ScreeningResult, TradeBilateralResult } from "@/types/supabaseAI";
import { countryFunnel, exportAnswer, hsFunnel, tradeBilateral } from "@/services/supabaseAI";
import { countryFunnel, exportAnswer, hsFunnel, tradeBilateral } from "@/services/supabaseAI";
import { subscribeControlTowerRefresh } from "@/services/controlTowerRealtime";
import { supabase } from "@/integrations/supabase/client";
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

export default function ControlTowerWizard() {
  const { lang } = useI18n();
  const location = useLocation();
  const initialState = (location.state ?? {}) as { mode?: "export" | "import"; questionText?: string };
  const initialState = (location.state ?? {}) as WizardState;
type IngestionRun = {
  id: string;
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
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
  const [liveStatus, setLiveStatus] = React.useState<"SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | "FALLBACK_PUBLIC" | "IDLE">("IDLE");
  const [liveIngestion, setLiveIngestion] = React.useState<IngestionRun[]>([]);

  const countryRef = React.useRef<CountrySuggestion | null>(null);
  const hsRef = React.useRef<HsSuggestion | null>(null);

  React.useEffect(() => {
    countryRef.current = country;
    hsRef.current = hs;
  }, [country, hs]);

  const runAnalysis = React.useCallback(async () => {
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
    } catch (exception) {
      setError((exception as Error).message);
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
    const errors: string[] = [];

  }, [country, hs, lang]);

  const testDbHealth = React.useCallback(async () => {
    const errors: string[] = [];
    let countriesCount: number | null = null;
    let hsCount: number | null = null;
    let sourcesCount: number | null = null;
    let exportSample: unknown = null;

    try {
      const res = await countryFunnel("chile", "en", true);
      countriesCount = res.suggestions.length;
    } catch (e) {
      errors.push((e as Error).message);
    }

    try {
      const res = await hsFunnel("strawberries", "en");
      hsCount = res.suggestions.length;
    } catch (e) {
      errors.push((e as Error).message);
    }

    try {
      const res = await exportAnswer("CL", "081010", "en");
      exportSample = res.raw;
      sourcesCount = res.update_sources?.length ?? 0;
    } catch (e) {
      errors.push((e as Error).message);
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
      updated_at: new Date().toISOString(),
    });
  }, []);

  React.useEffect(() => {
    const privateMode = String(import.meta.env.VITE_CT_REALTIME_PRIVATE || "false").toLowerCase() === "true";
    let cleanupRefresh: (() => Promise<void>) | null = null;
    let cleanupIngestion: (() => Promise<void>) | null = null;
    let cancelled = false;

    const init = async () => {
      cleanupRefresh = await subscribeControlTowerRefresh({
        supabase,
        isPrivate: privateMode,
        onStatus: (status) => {
          if (!cancelled) setLiveStatus(status);
        },
        onRefresh: () => {
          const selectedCountry = countryRef.current;
          const selectedHs = hsRef.current;

          if (selectedCountry && selectedHs) {
            void Promise.all([
              exportAnswer(selectedCountry.iso2, selectedHs.hs_code, lang),
              tradeBilateral("FR", selectedCountry.iso2, new Date().getFullYear(), "exports"),
            ])
              .then(([answerData, tradeData]) => {
                if (cancelled) return;
                setAnswer(answerData);
                setTrade(tradeData);
              })
              .catch((exception) => {
                if (!cancelled) setError((exception as Error).message);
              });
          } else if (selectedCountry) {
            void tradeBilateral("FR", selectedCountry.iso2, new Date().getFullYear(), "exports")
              .then((data) => {
                if (!cancelled) setTrade(data);
              })
              .catch((exception) => {
                if (!cancelled) setError((exception as Error).message);
              });
          }

          void testDbHealth();
        },
      });

      const ingestionChannel = supabase
        .channel("ct:ingestion")
        .on("postgres_changes", { event: "*", schema: "public", table: "ingestion_runs" }, (payload) => {
          if (cancelled) return;
          const next = payload.new as IngestionRun | null;
          if (!next?.id) return;
          setLiveIngestion((prev) => [next, ...prev.filter((run) => run.id !== next.id)].slice(0, 5));
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("[ControlTowerRealtime] ingestion_runs subscription unavailable.");
          }
        });

      cleanupIngestion = async () => {
        try {
          await ingestionChannel.unsubscribe();
        } catch {
          // ignore
        }
        try {
          await supabase.removeChannel(ingestionChannel);
        } catch {
          // ignore
        }
      };
    };

    void init();

    return () => {
      cancelled = true;
      if (cleanupRefresh) void cleanupRefresh();
      if (cleanupIngestion) void cleanupIngestion();
    };
  }, [lang, testDbHealth]);

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
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{lang === "fr" ? "Tour de contrôle" : "Control Tower"}</CardTitle>
              <Badge variant="secondary">{lang === "fr" ? "Live" : "Live"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {lang === "fr" ? "Mode" : "Mode"}: <strong>{wizardState.mode ?? "export"}</strong>
            </p>
            {wizardState.questionText ? <p className="text-muted-foreground">{wizardState.questionText}</p> : null}

            <CountryPicker value={country} onSelect={setCountry} />
            <HsPicker value={hs} onSelect={setHs} />

            <Button onClick={run} disabled={loading || !country || !hs}>
            <Button onClick={runAnalysis} disabled={loading || !country || !hs}>
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
            <p className="text-xs text-muted-foreground">
              {lang === "fr" ? "État canal Realtime" : "Realtime channel status"}: <strong>{liveStatus}</strong>
            </p>
            <Button type="button" variant="outline" onClick={testDbHealth}>
              {lang === "fr" ? "Tester la base" : "Run DB health check"}
            </Button>
            {dbHealth ? (
              <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(dbHealth, null, 2)}</pre>
            ) : null}
            {liveIngestion.length ? (
              <div className="space-y-1 text-xs">
                <p className="font-medium">{lang === "fr" ? "Derniers runs" : "Latest runs"}</p>
                {liveIngestion.map((run) => (
                  <p key={run.id}>
                    {run.status} · {run.started_at ?? "-"}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </PublicLayout>
  );
}
