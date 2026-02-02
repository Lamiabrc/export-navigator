import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportFilters } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { RefreshCw, RotateCcw } from "lucide-react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

type Props = {
  value: ExportFilters;
  onChange: (value: ExportFilters) => void;
  onRefresh?: () => void;
  loading?: boolean;
  showInvoiceSearch?: boolean;
};

type ClientLookupRow = { id: string; libelle_client: string | null };

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ExportFiltersBar({ value, onChange, onRefresh, loading, showInvoiceSearch = true }: Props) {
  const { lookups, lookupsLoading } = useGlobalFilters();

  // Recherche client scalable (serveur)
  const [clientSearch, setClientSearch] = React.useState("");
  const debouncedClientSearch = useDebounced(clientSearch, 250);

  const handleChange = <K extends keyof ExportFilters>(key: K, v: ExportFilters[K]) => {
    onChange({ ...value, [key]: (v as any) || undefined });
  };

  const reset = () => {
    onChange({
      invoiceNumber: undefined,
      territory: undefined, // on l’utilise comme "Pays" dans l’UI
      clientId: undefined,
      from: undefined,
      to: undefined,
      search: undefined,
    });
    setClientSearch("");
  };

  // ✅ Clients: on ne charge plus toute la table, on recherche côté DB
  const clientsQuery = useQuery({
    queryKey: ["lookup-clients-libelle", debouncedClientSearch],
    enabled: SUPABASE_ENV_OK,
    staleTime: 60_000,
    queryFn: async (): Promise<ClientLookupRow[]> => {
      const term = debouncedClientSearch.trim();

      let q = supabase.from("clients").select("id, libelle_client").order("libelle_client", { ascending: true }).limit(80);

      // Si on tape quelque chose => filtre DB
      if (term) {
        // recherche “contains” sur libelle_client
        q = q.ilike("libelle_client", `%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ClientLookupRow[];
    },
  });

  const clients = clientsQuery.data || [];

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Du</Label>
          <Input
            type="date"
            value={value.from || ""}
            onChange={(e) => handleChange("from", (e.target.value || undefined) as any)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Au</Label>
          <Input
            type="date"
            value={value.to || ""}
            onChange={(e) => handleChange("to", (e.target.value || undefined) as any)}
          />
        </div>

        {/* ✅ Nouveau wording : pays (monde), France est le centre mais le filtre porte sur le pays */}
        <div className="space-y-1">
          <Label className="text-xs">Pays (origine / destination)</Label>
          <Select
            value={value.territory || "all"}
            onValueChange={(v) => handleChange("territory", (v === "all" ? undefined : (v as any)) as any)}
            disabled={lookupsLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={lookupsLoading ? "Chargement..." : "Tous les pays"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les pays</SelectItem>

              {/* lookups.territories => idéalement tu y mets les codes ISO pays + label */}
              {lookups.territories.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.label ? `${t.label} (${t.code})` : t.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Petit rappel “pays utile” (sans bloquer ici, car c’est une barre de filtres) */}
          {!value.territory ? (
            <div className="text-[11px] text-muted-foreground">
              Astuce : l’import/export dépend des accords, sanctions et règles locales — filtrer par pays rend l’analyse plus fiable.
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Client</Label>
          <Select
            value={value.clientId || "all"}
            onValueChange={(v) => handleChange("clientId", (v === "all" ? undefined : (v as any)) as any)}
            disabled={clientsQuery.isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={clientsQuery.isLoading ? "Chargement..." : "Tous"} />
            </SelectTrigger>

            <SelectContent className="max-h-72">
              <SelectItem value="all">Tous</SelectItem>

              {/* 🔎 recherche dans la liste (mais filtrage DB via query) */}
              <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Chercher une raison sociale..."
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {clientsQuery.isLoading ? "Recherche..." : `${clients.length} résultat(s)`}
                </div>
              </div>

              {clientsQuery.isLoading ? (
                <SelectItem value="loading" disabled>
                  Chargement...
                </SelectItem>
              ) : clients.length === 0 ? (
                <SelectItem value="none" disabled>
                  Aucun résultat
                </SelectItem>
              ) : (
                clients.map((c) => {
                  const label =
                    c.libelle_client?.trim() ||
                    (looksLikeUuid(c.id) ? "Client (raison sociale manquante)" : c.id);

                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {label}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>

        {showInvoiceSearch ? (
          <div className="space-y-1">
            <Label className="text-xs">Recherche facture</Label>
            <Input
              placeholder="invoice_number…"
              value={value.invoiceNumber || ""}
              onChange={(e) => handleChange("invoiceNumber", e.target.value as any)}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">Recherche</Label>
            <Input
              placeholder="facture, client…"
              value={(value.search as any) || ""}
              onChange={(e) => handleChange("search", e.target.value as any)}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-end mt-3">
        <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>

        {onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        ) : null}
      </div>
    </div>
  );
}
