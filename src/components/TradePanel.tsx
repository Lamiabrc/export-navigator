import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradeBilateralResult } from "@/types/supabaseAI";
import { useI18n } from "@/contexts/LanguageContext";

export function TradePanel({ data }: { data: TradeBilateralResult | null }) {
  const { lang } = useI18n();
  if (!data) return null;
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TradeBilateralResult } from "@/types/supabaseAI";
import { useI18n } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  data: TradeBilateralResult | null;
  selectedCountryIso2?: string | null;
  defaultYear?: number;
  onImported?: () => Promise<void> | void;
};

export function TradePanel({ data, selectedCountryIso2, defaultYear, onImported }: Props) {
  const { lang } = useI18n();
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasData = Boolean(data && ((data.total ?? 0) > 0 || data.topHs6.length > 0));

  const importComtrade = async () => {
    if (!selectedCountryIso2) return;
    setImporting(true);
    setError(null);
    try {
      const body = {
        reporter_iso2: "FR",
        partner_iso2: selectedCountryIso2,
        year: defaultYear ?? new Date().getFullYear() - 1,
        flow: "export",
      };

      const cronSecret = String(import.meta.env.VITE_COMTRADE_CRON_SECRET || "").trim();
      const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cronSecret) headers["x-cron-secret"] = cronSecret;
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comtrade-ingest`;
      const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(String(json.error || `HTTP ${response.status}`));
      }

      await onImported?.();
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setImporting(false);
    }
  };

  if (!data && !selectedCountryIso2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lang === "fr" ? "Relations commerciales" : "Trade relations"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Total: <strong>{(data.total ?? 0).toLocaleString()}</strong> {data.currency}
        </p>
        <ul className="space-y-1">
          {data.topHs6.map((line, idx) => (
            <li key={`${line.hs6}-${idx}`} className="rounded-md border p-2">
              <strong>{line.hs6 ?? "-"}</strong> — {(line.value ?? 0).toLocaleString()} {data.currency}
              {line.label ? <span className="text-muted-foreground"> · {line.label}</span> : null}
            </li>
          ))}
        </ul>
          Total: <strong>{(data?.total ?? 0).toLocaleString()}</strong> {data?.currency ?? "USD"}
        </p>

        {!hasData ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              {lang === "fr" ? "Aucune donnée disponible pour ce couple pays/année." : "No data available for this country pair/year."}
            </p>
            <Button type="button" onClick={importComtrade} disabled={importing || !selectedCountryIso2}>
              {importing ? "..." : lang === "fr" ? "Importer données Comtrade" : "Import Comtrade data"}
            </Button>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        ) : (
          <ul className="space-y-1">
            {(data?.topHs6 ?? []).map((line, idx) => (
              <li key={`${line.hs6}-${idx}`} className="rounded-md border p-2">
                <strong>{line.hs6 ?? "-"}</strong> — {(line.value ?? 0).toLocaleString()} {data?.currency ?? "USD"}
                {line.label ? <span className="text-muted-foreground"> · {line.label}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
