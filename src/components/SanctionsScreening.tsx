import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { screenParty } from "@/services/supabaseAI";
import type { ScreeningResult } from "@/types/supabaseAI";
import { useI18n } from "@/contexts/LanguageContext";

export function SanctionsScreening({
  value,
  onValueChange,
  result,
  onResult,
}: {
  value: string;
  onValueChange: (value: string) => void;
  result: ScreeningResult | null;
  onResult: (result: ScreeningResult | null) => void;
}) {
  const { lang } = useI18n();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runScreening = async () => {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await screenParty(value.trim(), 8);
      onResult(data);
    } catch (e) {
      setError((e as Error).message);
      onResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lang === "fr" ? "Screening sanctions" : "Sanctions screening"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={lang === "fr" ? "Nom de contrepartie" : "Counterparty name"} />
          <Button type="button" onClick={runScreening} disabled={loading || !value.trim()}>
            {loading ? "..." : lang === "fr" ? "Vérifier" : "Screen"}
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {result?.hits?.length ? (
          <ul className="space-y-2 text-sm">
            {result.hits.map((hit, index) => (
              <li key={`${hit.name}-${index}`} className="rounded-md border p-2">
                <strong>{hit.name}</strong> {hit.entity_type ? `(${hit.entity_type})` : ""}
                {hit.source_url ? (
                  <div>
                    <a href={hit.source_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      {hit.source_key ?? hit.source_url}
                    </a>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
