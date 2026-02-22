import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { hsFunnel, hsSuggestInChapter } from "@/services/supabaseAI";
import type { HsSuggestion } from "@/types/supabaseAI";
import { useI18n } from "@/contexts/LanguageContext";

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

export function HsPicker({ value, onSelect }: { value?: HsSuggestion | null; onSelect: (hs: HsSuggestion) => void }) {
  const { lang } = useI18n();
  const [query, setQuery] = React.useState("");
  const [chapter, setChapter] = React.useState("");
  const debounced = useDebounced(query, 300);

  const hsQuery = useQuery({
    queryKey: ["hs-funnel", debounced, chapter, lang],
    queryFn: () => (chapter.trim() ? hsSuggestInChapter(debounced, chapter, lang) : hsFunnel(debounced, lang)),
    enabled: debounced.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          className="sm:col-span-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={lang === "fr" ? "Produit (ex: fraises, pièces frein)" : "Product (e.g. strawberries, brake parts)"}
        />
        <Input value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder={lang === "fr" ? "Chapitre HS (optionnel)" : "HS chapter (optional)"} />
      </div>
      {value ? (
        <p className="text-sm text-muted-foreground">
          HS: <strong>{value.hs_code}</strong> — {value.label}
        </p>
      ) : null}
      {hsQuery.isLoading ? <p className="text-xs text-muted-foreground">…</p> : null}
      {hsQuery.isError ? <p className="text-xs text-destructive">{(hsQuery.error as Error).message}</p> : null}
      <div className="flex flex-wrap gap-2">
        {hsQuery.data?.suggestions.map((suggestion) => (
          <Button key={`${suggestion.hs_code}-${suggestion.label}`} type="button" variant="outline" size="sm" onClick={() => onSelect(suggestion)}>
            {suggestion.hs_code} — {suggestion.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
