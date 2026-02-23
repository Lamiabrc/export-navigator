import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/LanguageContext";
import type { TradeBilateralResult } from "@/types/supabaseAI";

type Props = {
  data: TradeBilateralResult | null;
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

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{lang === "fr" ? "Relations commerciales" : "Trade snapshot"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {lang === "fr"
              ? "Aucune donnee pour l'instant. Vous pouvez importer Comtrade pour alimenter ce panneau."
              : "No data yet. You can import Comtrade to populate this panel."}
          </p>
          {onImportComtrade ? (
            <Button onClick={onImportComtrade} disabled={isImporting}>
              {isImporting
                ? lang === "fr"
                  ? "Import en cours..."
                  : "Importing..."
                : lang === "fr"
                ? "Importer donnees Comtrade"
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
        <CardTitle>{lang === "fr" ? "Relations commerciales" : "Trade snapshot"}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            {lang === "fr" ? "Flux" : "Flow"}: <strong>{data.flow ?? "export"}</strong>
          </span>
          <span>
            {lang === "fr" ? "Annee" : "Year"}: <strong>{data.year ?? "-"}</strong>
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
          <div className="font-medium">Top HS6</div>

          {top.length ? (
            <div className="space-y-1">
              {top.map((row, index) => (
                <div
                  key={`${row.hs_code ?? row.hs6 ?? "hs"}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
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
              ? "Importer ou rafraichir Comtrade"
              : "Import or refresh Comtrade"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default TradePanel;
