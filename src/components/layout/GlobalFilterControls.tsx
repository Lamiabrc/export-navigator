import React from "react";
import { CalendarClock, RefreshCw, RotateCw, X } from "lucide-react";
import { useGlobalFilters, TimeRangePreset, TimeRangeValue } from "@/contexts/GlobalFiltersContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function useDebounced<T>(value: T, delayMs = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return v;
}

type Option = { value: string; label: string };

function RemotePicker({
  label,
  placeholder,
  value,
  selectedLabel,
  options,
  loading,
  onSearch,
  onSelect,
  onClear,
}: {
  label: string;
  placeholder: string;
  value: string | null | undefined;
  selectedLabel: string | null | undefined;
  options: Option[];
  loading: boolean;
  onSearch: (term: string) => void;
  onSelect: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const debounced = useDebounced(term, 250);

  React.useEffect(() => {
    if (!open) return;
    onSearch(debounced);
  }, [open, debounced, onSearch]);

  React.useEffect(() => {
    if (!open) return;
    onSearch(""); // charge une liste courte à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="min-w-[220px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">{selectedLabel || (value ? value : placeholder)}</span>
            <span className="text-muted-foreground">{loading ? "…" : "▾"}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[360px] p-3">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher… (2 caractères conseillé)"
          />

          <div className="mt-2 max-h-[260px] overflow-auto rounded-md border">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Recherche…</div>
            ) : options.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Aucun résultat.</div>
            ) : (
              options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/40 ${
                      active ? "bg-muted/50 font-medium" : ""
                    }`}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTerm("");
                onClear();
              }}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Effacer
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function GlobalFilterControls() {
  const {
    timeRange,
    resolvedRange,
    setTimeRange,
    variables,
    setVariable,
    resetFilters,
    autoRefresh,
    setAutoRefresh,
    refreshNow,
    lastRefreshAt,
    lookups,
    lookupsLoading,
    searchingClients,
    searchingProducts,
    searchClients,
    searchProducts,
    labels,
  } = useGlobalFilters();

  const [customFrom, setCustomFrom] = React.useState(timeRange.from ?? "");
  const [customTo, setCustomTo] = React.useState(timeRange.to ?? "");

  React.useEffect(() => {
    setCustomFrom(timeRange.from ?? "");
    setCustomTo(timeRange.to ?? "");
  }, [timeRange.from, timeRange.to]);

  const timePresets: { value: TimeRangePreset; label: string }[] = [
    { value: "last_7d", label: "7 jours" },
    { value: "last_14d", label: "14 jours" },
    { value: "last_30d", label: "30 jours" },
    { value: "last_90d", label: "90 jours" },
    { value: "this_month", label: "Mois en cours" },
    { value: "previous_month", label: "Mois précédent" },
    { value: "ytd", label: "YTD" },
    { value: "custom", label: "Personnalisé" },
  ];

  const clientOptions: Option[] = (lookups.clients ?? []).map((c) => ({ value: c.id, label: c.label }));
  const productOptions: Option[] = (lookups.products ?? []).map((p) => ({ value: p.id, label: p.label }));

  const fmtLast = lastRefreshAt ? new Date(lastRefreshAt).toLocaleString("fr-FR") : null;

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const v: TimeRangeValue = { preset: "custom", from: customFrom, to: customTo };
    setTimeRange(v);
    refreshNow();
  };

  return (
    <div className="w-full rounded-xl border bg-background p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          {/* Période */}
          <div className="min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Période</Label>
            <Select
              value={timeRange.preset}
              onValueChange={(v) => {
                const preset = v as TimeRangePreset;
                if (preset === "custom") {
                  setTimeRange({ preset: "custom", from: customFrom || undefined, to: customTo || undefined });
                } else {
                  setTimeRange({ preset });
                  refreshNow();
                }
              }}
            >
              <SelectTrigger className="justify-between">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                {timePresets.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              <span>{resolvedRange.label}</span>
            </div>
          </div>

          {/* Custom dates */}
          {timeRange.preset === "custom" ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Du</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Au</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
              <Button type="button" onClick={applyCustom} className="gap-2">
                <RotateCw className="h-4 w-4" />
                Appliquer
              </Button>
            </div>
          ) : null}

          {/* Territoire */}
          <div className="min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Territoire</Label>
            <Select
              value={variables.territory_code ?? ""}
              onValueChange={(v) => {
                setVariable("territory_code", v || null);
                refreshNow();
              }}
              disabled={lookupsLoading}
            >
              <SelectTrigger className="justify-between">
                <SelectValue placeholder="Tous territoires" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {lookups.territories.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.label || t.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {labels.territory_label ? (
              <div className="mt-1">
                <Badge variant="secondary" className="text-xs">
                  {labels.territory_label}
                </Badge>
              </div>
            ) : null}
          </div>

          {/* Client remote (recherche) */}
          <RemotePicker
            label="Client"
            placeholder="Tous clients"
            value={variables.client_id ?? null}
            selectedLabel={labels.client_label}
            options={clientOptions}
            loading={searchingClients}
            onSearch={(t) => void searchClients(t)}
            onSelect={(id) => {
              setVariable("client_id", id);
              refreshNow();
            }}
            onClear={() => {
              setVariable("client_id", null);
              refreshNow();
            }}
          />

          {/* Produit remote (recherche) */}
          <RemotePicker
            label="Produit"
            placeholder="Tous produits"
            value={variables.product_id ?? null}
            selectedLabel={labels.product_label}
            options={productOptions}
            loading={searchingProducts}
            onSearch={(t) => void searchProducts(t)}
            onSelect={(id) => {
              setVariable("product_id", id);
              refreshNow();
            }}
            onClear={() => {
              setVariable("product_id", null);
              refreshNow();
            }}
          />

          {/* Actions */}
          <div className="flex items-end gap-2 ml-auto">
            <Button variant="outline" onClick={refreshNow} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>

        {/* Auto refresh */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh.enabled}
              onCheckedChange={(checked) => setAutoRefresh({ ...autoRefresh, enabled: checked })}
            />
            <span className="text-sm">Auto-refresh</span>

            <Select
              value={String(autoRefresh.intervalMs)}
              onValueChange={(v) => setAutoRefresh({ ...autoRefresh, intervalMs: Number(v) })}
              disabled={!autoRefresh.enabled}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Intervalle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60000">1 min</SelectItem>
                <SelectItem value="120000">2 min</SelectItem>
                <SelectItem value="300000">5 min</SelectItem>
                <SelectItem value="900000">15 min</SelectItem>
              </SelectContent>
            </Select>

            {fmtLast ? <span className="text-xs text-muted-foreground">Dernier: {fmtLast}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
