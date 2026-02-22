import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradeBilateralResult } from "@/types/supabaseAI";
import { useI18n } from "@/contexts/LanguageContext";

export function TradePanel({ data }: { data: TradeBilateralResult | null }) {
  const { lang } = useI18n();
  if (!data) return null;

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
      </CardContent>
    </Card>
  );
}
