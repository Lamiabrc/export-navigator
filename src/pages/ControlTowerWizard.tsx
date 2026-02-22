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
import { exportAnswer, tradeBilateral, countryFunnel, hsFunnel } from "@/services/supabaseAI";
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

type IngestionRun = {
  id: string;
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
};

type LiveStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | "FALLBACK_PUBLIC" | "IDLE";

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
  const [liveStatus, setLiveStatus] = React.useState<LiveStatus>("IDLE");
  const [liveIngestion, setLiveIngestion] = React.useState<IngestionRun[]>([]);

  const countryRef = React.useRef<CountrySuggestion | null>(null);
  const hsRef = React.useRef<HsSuggestion | null>(null);

  React.useEffect(() => {
    countryRef.current = country;
    hsRef.current = hs;
  }, [country, hs]);

  // ⚠️ important:
  // - year courant est souvent vide, on prend N-1 par défaut
  // - flow doit être "export" (pas "exports")
  const defaultTradeYear = React.useMemo(() => new Date().getFullYear() - 1, []);

  const runAnalysis = React.useCallback(async () => {
    if (!country || !hs) return;

    setLoading(true);
    setError(null);

    try {
      const [answerData, tradeData] = await Promise.all([
        exportAnswer(country.iso2, hs.hs_code, lang),
        tradeBilateral("FR", country.iso2, defaultTradeYear, "export"),
      ]);

      setAnswer(answerData);
      setTrade(tradeData);
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setLoading(false);
    }
  }, [country, hs, lang, defaultTradeYear]);

  const testDbHealth = React.useCallback(async () => {
    const errors: string[] = [];
    try {
      const [countriesRes, hsRes, sourcesRes, sampleRes] = await Promise.all([
        supabase.from("countries").select("code_iso2", { head: true, count: "exact" }),
        supabase.from("hs_codes").select("hs_code", { head: true, count: "exact" }),
        supabase.from("reference_sources").select("source_key", { head: true, count: "exact" }),
        exportAnswer("CL", "081010", "en"),
      ]);

      if (countriesRes.error) errors.push(countriesRes.error.message);
      if (hsRes.error) errors.push(hsRes.error.message);
      if (sourcesRes.error) errors.push(sourcesRes.error.message);

      setDbHealth({
        countries: countriesRes.count ?? 0,
        hs_codes: hsRes.count ?? 0,
        reference_sources: sourcesRes.count ?? 0,
        rpc_export_answer_sample: sampleRes,
        errors,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      setDbHealth({
        countries: null,
        hs_codes: null,
        reference_sources: null,
        rpc_export_answer_sample: null,
        errors: [(e as Error).message],
        updated_at: new Date().toISOString(),
      });
    }

    // BONUS (soft check funnels)
    try {
      await countryFunnel("korea", "en", false);
      await hsFunnel("strawberries", "en");
    } catch {
      // ignore (DB Health reste focus sur counts + export_answer)
    }
  }, []);

  React.useEffect(() => {
    const privateMode =
      String(import.meta.env.VITE_CT_REALTIME_PRIVATE || "false").toLowerCase() === "true";
    const ingestionLive =
      String(import.meta.env.VITE_CT_INGESTION_LIVE || "false").toLowerCase() === "true";

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
              tradeBilateral("FR", selectedCountry.iso2, defaultTradeYear, "export"),
            ])
              .then(([nextAnswer, nextTrade]) => {
                if (cancelled) return;
                setAnswer(nextAnswer);
                setTrade(nextTrade);
              })
              .catch((exception) => {
                if (!cancelled) setError((exception as Error).message);
              });
          } else if (selectedCountry) {
            void tradeBilateral("FR", selectedCountry.iso2, defaultTradeYear, "export")
              .then((nextTrade) => {
                if (!cancelled) setTrade(nextTrade);
              })
              .catch((exception) => {
                if (!cancelled) setError((exception as Error).message);
              });
          }

          void testDbHealth();
        },
      });

      if (ingestionLive) {
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
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (cleanupRefresh) void cleanupRefresh();
      if (cleanupIngestion) void cleanupIngestion();
    };
  }, [lang, testDbHealth, defaultTradeYear]);

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-screen-xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{lang === "fr" ? "Tour de contrôle" : "Control Tower"}</CardTitle>
              <Badge variant="secondary">{lang === "fr" ? "Live" : "Live"}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <p>
              {lang === "fr" ? "Mode" : "Mode"}: <strong>{wizardState.mode ?? "export"}</strong>
            </p>

            {wizardState.questionText ? (
              <p className="text-muted-foreground">{wizardState.questionText}</p>
            ) : null}

            <CountryPicker value={country} onSelect={setCountry} />
            <HsPicker value={hs} onSelect={setHs} />

            <Button onClick={runAnalysis} disabled={loading || !country || !hs}>
              {loading ? "..." : lang === "fr" ? "Lancer l'analyse" : "Run analysis"}
            </Button>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <ExportAnswerPanel data={answer} />
        <TradePanel data={trade} />
        <SanctionsScreening
          value={partyName}
          onValueChange={setPartyName}
          result={screening}
          onResult={setScreening}
        />

        <Card>
          <CardHeader>
            <CardTitle>DB Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {lang === "fr" ? "État canal Realtime" : "Realtime channel status"}:{" "}
              <strong>{liveStatus}</strong>
            </p>

            <Button type="button" variant="outline" onClick={testDbHealth}>
              {lang === "fr" ? "Tester la base" : "Run DB health check"}
            </Button>

            {dbHealth ? (
              <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                {JSON.stringify(dbHealth, null, 2)}
              </pre>
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
