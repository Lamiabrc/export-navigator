import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { countryFunnel } from "@/services/supabaseAI";
import type { CountrySuggestion } from "@/types/supabaseAI";
import { useI18n } from "@/contexts/LanguageContext";

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

export function CountryPicker({
  value,
  onSelect,
  placeholder,
}: {
  value?: CountrySuggestion | null;
  onSelect: (country: CountrySuggestion) => void;
  placeholder?: string;
}) {
  const { lang } = useI18n();
  const [query, setQuery] = React.useState("");
  const debounced = useDebounced(query, 300);

  const countryQuery = useQuery({
    queryKey: ["country-funnel", debounced, lang],
    queryFn: () => countryFunnel(debounced, lang),
    enabled: debounced.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder ?? (lang === "fr" ? "Ex: Chili, Corée, Canada" : "E.g. Chile, Korea, Canada")}
      />
      {value ? (
        <p className="text-sm text-muted-foreground">
          {lang === "fr" ? "Pays sélectionné" : "Selected country"}: <strong>{value.label}</strong> ({value.iso2})
        </p>
      ) : null}
      {countryQuery.isLoading ? <p className="text-xs text-muted-foreground">…</p> : null}
      {countryQuery.isError ? <p className="text-xs text-destructive">{(countryQuery.error as Error).message}</p> : null}
      <div className="flex flex-wrap gap-2">
        {countryQuery.data?.suggestions.map((suggestion) => (
          <Button
            key={`${suggestion.iso2}-${suggestion.label}`}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(suggestion)}
            className="h-auto px-3 py-2 text-left"
          >
            <span className="block text-xs font-medium">
              {suggestion.label} ({suggestion.iso2})
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Zone: {suggestion.zone || "-"} | Confiance: {typeof suggestion.confidence === "number" ? `${Math.round(suggestion.confidence * 100)}%` : "-"}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
