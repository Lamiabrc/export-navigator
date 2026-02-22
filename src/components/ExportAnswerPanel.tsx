import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExportAnswerResult } from "@/types/supabaseAI";
import { useI18n } from "@/contexts/LanguageContext";

const normalizeZone = (zone?: string | null) => (zone?.toUpperCase() === "DROM" ? "Territoires" : zone ?? "-");

export function ExportAnswerPanel({ data }: { data: ExportAnswerResult | null }) {
  const { lang } = useI18n();
  if (!data) return null;

  const cards = ["sanctions", "documents", "export_controls"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lang === "fr" ? "Résumé" : "Summary"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          {lang === "fr" ? "Destination" : "Destination"}: <strong>{data.destination?.name ?? data.destination?.iso2 ?? "-"}</strong> · {normalizeZone(data.destination?.zone)}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((key) => (
            <div key={key} className="rounded-md border p-3">
              <p className="font-medium capitalize">{key.replace("_", " ")}</p>
              <p className="text-xs text-muted-foreground">{JSON.stringify(data.country_rules?.[key] ?? "-")}</p>
            </div>
          ))}
        </div>
        {data.product_rules?.length ? (
          <div>
            <p className="font-medium">product_rules</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(data.product_rules, null, 2)}</pre>
          </div>
        ) : null}
        {data.update_sources?.length ? (
          <div>
            <p className="font-medium">update_sources</p>
            <ul className="list-disc pl-6">
              {data.update_sources.map((source, idx) => (
                <li key={`${source.url}-${idx}`}>
                  <a className="text-primary underline" href={source.url} target="_blank" rel="noreferrer">
                    {source.label ?? source.source_key ?? source.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
