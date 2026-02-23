<<<<<<< ours
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
=======
>>>>>>> theirs
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/LanguageContext";
import type { TradeBilateralResult } from "@/types/supabaseAI";

type Props = {
  data: TradeBilateralResult | null;
  /**
   * Optionnel : si tu branches plus tard l'import Comtrade on-demand
   * tu pourras afficher un bouton.
   */
  onImportComtrade?: () => Promise<void> | void;
  isImporting?: boolean;
};

function formatUSD(value: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString()} USD`;
  }
}

export function TradePanel({ data, onImportComtrade, isImporting }: Props) {
  const { lang } = useI18n();

  // Affichage "empty state" propre si pas de data
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{lang === "fr" ? "Relations commerciales" : "Trade snapshot"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {lang === "fr"
              ? "Aucune donnée pour l’instant. (Tu pourras brancher Comtrade pour alimenter ce panneau.)"
              : "No data yet. (You can connect Comtrade to populate this panel.)"}
          </p>
          {onImportComtrade ? (
            <Button onClick={onImportComtrade} disabled={isImporting}>
              {isImporting
                ? lang === "fr"
                  ? "Import en cours..."
                  : "Importing..."
                : lang === "fr"
                ? "Importer données Comtrade"
                : "Import Comtrade data"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const top = Array.isArray(data.top_hs6) ? data.top_hs6 : data.topHs6 ?? [];
  const total = typeof data.total_value_usd === "number" ? data.total_value_usd : data.total ?? 0;

  return (
    <Card>
      <CardHeader>
<<<<<<< ours
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
=======
>>>>>>> theirs
        <CardTitle>{lang === "fr" ? "Relations commerciales" : "Trade snapshot"}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            {lang === "fr" ? "Flux" : "Flow"}: <strong>{data.flow ?? "export"}</strong>
          </span>
          <span>
            {lang === "fr" ? "Année" : "Year"}: <strong>{data.year ?? "-"}</strong>
          </span>
          <span>
            {lang === "fr" ? "Reporter" : "Reporter"}: <strong>{data.reporter ?? "FR"}</strong>
          </span>
          <span>
            {lang === "fr" ? "Partenaire" : "Partner"}: <strong>{data.partner ?? "-"}</strong>
          </span>
        </div>

        <div className="rounded-md bg-muted p-3">
          <div className="text-xs text-muted-foreground">{lang === "fr" ? "Valeur totale" : "Total value"}</div>
          <div className="text-lg font-semibold">{formatUSD(total)}</div>
        </div>

        <div className="space-y-2">
          <div className="font-medium">{lang === "fr" ? "Top HS6" : "Top HS6"}</div>

          {top.length ? (
            <div className="space-y-1">
              {top.map((row, index) => (
                <div key={`${row.hs_code ?? row.hs6 ?? "hs"}-${index}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="font-mono text-xs">{row.hs_code ?? row.hs6 ?? "-"}</span>
                  <span className="text-xs">{formatUSD(row.value_usd ?? row.value ?? 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {lang === "fr" ? "Aucune ligne HS6 disponible." : "No HS6 lines available."}
            </p>
          )}
        </div>

        {onImportComtrade ? (
          <Button onClick={onImportComtrade} disabled={isImporting} variant="outline">
            {isImporting
              ? lang === "fr"
                ? "Import en cours..."
                : "Importing..."
              : lang === "fr"
              ? "Importer / rafraîchir Comtrade"
              : "Import / refresh Comtrade"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default TradePanel;
