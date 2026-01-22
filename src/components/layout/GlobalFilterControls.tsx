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

const ALL = "__all__";

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
  buttonClassName,
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
  buttonClassName?: string;
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
    onSearch(""); // petite liste à l’ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="min-w-[200px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={`w-full justify-between ${buttonClassName || ""}`}>
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

/** ✅ Export attendu par MainLayout.tsx */
export function TimeRangePicker(props: { className?: string } = {}) {
  const { timeRange, resolvedRange, setTimeRange, refreshNow } = useGlobalFilters();

  const [customFrom, setCustomFrom] = React.useState(timeRange.from ?? "");
  const [customTo, setCustomTo] = React.useState(timeRange.to ?? "");

  React.useEffect(() => {
    setCustomFrom(timeRange.from ?? "");
    setCustomTo(timeRange.to ?? "");
  }, [timeRange.from, timeRange.to]);

  const presets: { value: TimeRangePreset; label: string }[] = [
    { value: "last_7d", label: "7 jours" },
    { value: "last_14d", label: "14 jours" },
    { value: "last_30d", label: "30 jours" },
    { value: "last_90d", label: "90 jours" },
    { value: "this_month", label: "Mois en cours" },
    { value: "previous_month", label: "Mois précédent" },
    { value: "ytd", label: "YTD" },
    { value: "custom", label: "Personnalisé" },
  ];

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const v: TimeRangeValue = { preset: "custom", from: customFrom, to: customTo };
    setTimeRange(v);
    refreshNow();
  };

  return (
    <div className={props.className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 justify-between">
            <CalendarClock className="h-4 w-4" />
            <span className="hidden md:inline">Période :</span>
            <span className="font-medium">{resolvedRange.label}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[360px] p-3">
          <Label className="text-xs text-muted-foreground">Période</Label>
          <Select
            value={timeRange.preset}
            onValueChange={(v) => {
              const preset = v as TimeRangePreset;
              if (preset === "custom") {
                setTimeRange({ preset: "custom", from: customFrom || undefined, to: customTo || undefined });
                return;
              }
              setTimeRange({ preset });
              refreshNow();
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {timeRange.preset === "custom" ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Du</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Au</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </div>
              <Button type="button" onClick={applyCustom} className="w-full gap-2">
                <RotateCw className="h-4 w-4" />
                Appliquer
              </Button>
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">
              {resolvedRange.from} → {resolvedRange.to}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** ✅ Export attendu par MainLayout.tsx */
export function RefreshNowButton(props: { className?: string } = {}) {
  const { refreshNow } = useGlobalFilters();
  return (
    <Button variant="outline" onClick={refreshNow} className={`gap-2 ${props.className || ""}`}>
      <RefreshCw className="h-4 w-4" />
      <span className="hidden md:inline">Refresh</span>
    </Button>
  );
}

/** ✅ Export attendu par MainLayout.tsx */
export function AutoRefreshControl(props: { className?: string } = {}) {
  const { autoRefresh, setAutoRefresh, lastRefreshAt } = useGlobalFilters();
  const fmtLast = lastRefreshAt ? new Date(lastRefreshAt).toLocaleString("fr-FR") : null;

  return (
    <div className={`flex items-center gap-2 ${props.className || ""}`}>
      <Switch checked={autoRefresh.enabled} onCheckedChange={(checked) => setAutoRefresh({ ...autoRefresh, enabled: checked })} />
      <span className="text-sm hidden lg:inline">Auto</span>

      <Select
        value={String(autoRefresh.intervalMs)}
        onValueChange={(v) => setAutoRefresh({ ...autoRefresh, intervalMs: Number(v) })}
        disabled={!autoRefresh.enabled}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Intervalle" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="60000">1 min</SelectItem>
          <SelectItem value="120000">2 min</SelectItem>
          <SelectItem value="300000">5 min</SelectItem>
          <SelectItem value="900000">15 min</SelectItem>
        </SelectContent>
      </Select>

      {fmtLast ? <span className="text-xs text-muted-foreground hidden xl:inline">Dernier: {fmtLast}</span> : null}
    </div>
  );
}

/** ✅ Compat build : pas de save views */
export function SavedViewsMenu(_props: { className?: string } = {}) {
  return null;
}

/** ✅ Export attendu : VariablesBar = filtres (territoire + client + produit) */
export function VariablesBar(props: { className?: string } = {}) {
  const {
    variables,
    setVariable,
    refreshNow,
    lookups,
    lookupsLoading,
    searchingClients,
    searchingProducts,
    searchClients,
    searchProducts,
    labels,
  } = useGlobalFilters();

  const clientOptions: Option[] = (lookups.clients ?? []).map((c) => ({ value: c.id, label: c.label }));
  const productOptions: Option[] = (lookups.products ?? []).map((p) => ({ value: p.id, label: p.label }));

  return (
    <div className={`flex flex-col xl:flex-row xl:items-end gap-3 ${props.className || ""}`}>
      {/* Territoire */}
      <div className="min-w-[220px]">
        <Label className="text-xs text-muted-foreground">Territoire</Label>
        <Select
          value={variables.territory_code ?? ALL}
          onValueChange={(v) => {
            setVariable("territory_code", v === ALL ? null : v);
            refreshNow();
          }}
          disabled={lookupsLoading}
        >
          <SelectTrigger className="justify-between">
            <SelectValue placeholder="Tous territoires" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous</SelectItem>
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

      {/* Client */}
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

      {/* Produit */}
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
    </div>
  );
}

/** Optionnel : barre complète */
export function GlobalFilterControls() {
  const { resetFilters } = useGlobalFilters();
  return (
    <div className="w-full rounded-xl border bg-background p-3">
      <div className="flex flex-col xl:flex-row xl:items-end gap-3">
        <TimeRangePicker />
        <VariablesBar />
        <div className="flex items-end gap-2 ml-auto">
          <AutoRefreshControl />
          <RefreshNowButton />
          <Button variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GlobalFilterControls;
