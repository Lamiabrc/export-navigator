import React from "react";
import { CalendarClock, RefreshCw, RotateCw } from "lucide-react";
import { useGlobalFilters, TimeRangePreset, TimeRangeValue } from "@/contexts/GlobalFiltersContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

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
    // petite validation simple
    if (customFrom > customTo) return;

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

              {customFrom && customTo && customFrom > customTo ? (
                <div className="text-xs text-destructive mt-1">La date de début doit être avant la date de fin.</div>
              ) : null}
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
      <Switch
        checked={autoRefresh.enabled}
        onCheckedChange={(checked) => setAutoRefresh({ ...autoRefresh, enabled: checked })}
      />
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

/**
 * ✅ VariablesBar (nouveau positionnement)
 * - Pays/destination (Monde) = filtre principal
 * - pas de Client/Produit (ça fait “CRM” et données sensibles)
 */
export function VariablesBar(props: { className?: string } = {}) {
  const { variables, setVariable, refreshNow, lookups, lookupsLoading, labels } = useGlobalFilters();

  const selectedCountryLabel =
    labels.territory_label ||
    (variables.territory_code ? variables.territory_code : null);

  const isAll = !variables.territory_code;

  return (
    <div className={`flex flex-col xl:flex-row xl:items-end gap-3 ${props.className || ""}`}>
      {/* Pays / Destination */}
      <div className="min-w-[240px]">
        <Label className="text-xs text-muted-foreground">Pays / destination</Label>

        <Select
          value={variables.territory_code ?? ALL}
          onValueChange={(v) => {
            setVariable("territory_code", v === ALL ? null : v);
            refreshNow();
          }}
          disabled={lookupsLoading}
        >
          <SelectTrigger className="justify-between">
            <SelectValue placeholder="Tous pays" />
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

        {selectedCountryLabel ? (
          <div className="mt-1">
            <Badge variant="secondary" className="text-xs">
              {selectedCountryLabel}
            </Badge>
          </div>
        ) : null}

        {isAll ? (
          <div className="mt-1 text-[11px] text-muted-foreground">
            L’export dépend des relations, sanctions et traités : sélectionne un pays pour une lecture précise.
          </div>
        ) : null}
      </div>
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
