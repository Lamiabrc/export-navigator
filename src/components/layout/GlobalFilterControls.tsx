import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarClock, Clock3, RefreshCw, Save, Layers, CheckCircle2, X, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useGlobalFilters, TimeRangePreset } from "@/contexts/GlobalFiltersContext";

const timePresets: { value: TimeRangePreset; label: string }[] = [
  { value: "last_7d", label: "7j" },
  { value: "last_14d", label: "14j" },
  { value: "last_30d", label: "30j" },
  { value: "last_90d", label: "90j" },
  { value: "this_month", label: "Mois courant" },
  { value: "previous_month", label: "Mois precedent" },
  { value: "ytd", label: "YTD" },
  { value: "custom", label: "Custom" },
];

const autoRefreshIntervals = [
  { value: 15_000, label: "15s" },
  { value: 30_000, label: "30s" },
  { value: 60_000, label: "1 min" },
  { value: 300_000, label: "5 min" },
];

export function TimeRangePicker() {
  const { timeRange, resolvedRange, setTimeRange } = useGlobalFilters();

  const onPresetChange = (preset: TimeRangePreset) => {
    if (preset === "custom") {
      setTimeRange({ preset, from: resolvedRange.from, to: resolvedRange.to });
    } else {
      setTimeRange({ preset });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <Select value={timeRange.preset} onValueChange={(v) => onPresetChange(v as TimeRangePreset)}>
          <SelectTrigger className="h-8 w-[140px] text-sm">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            {timePresets.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground min-w-[120px]">{resolvedRange.label}</div>
      </div>

      {timeRange.preset === "custom" ? (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-8"
            value={timeRange.from ?? resolvedRange.from}
            onChange={(e) => setTimeRange({ ...timeRange, from: e.target.value })}
          />
          <span className="text-muted-foreground text-xs">&rarr;</span>
          <Input
            type="date"
            className="h-8"
            value={timeRange.to ?? resolvedRange.to}
            onChange={(e) => setTimeRange({ ...timeRange, to: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AutoRefreshControl() {
  const { autoRefresh, setAutoRefresh } = useGlobalFilters();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <Clock3 className="h-4 w-4 text-muted-foreground" />
      <Switch
        checked={autoRefresh.enabled}
        onCheckedChange={(checked) => setAutoRefresh({ ...autoRefresh, enabled: checked })}
        aria-label="Auto refresh"
      />
      <Select
        value={String(autoRefresh.intervalMs)}
        onValueChange={(v) => setAutoRefresh({ ...autoRefresh, intervalMs: Number(v) })}
        disabled={!autoRefresh.enabled}
      >
        <SelectTrigger className="h-8 w-[100px] text-sm">
          <SelectValue placeholder="Intervalle" />
        </SelectTrigger>
        <SelectContent>
          {autoRefreshIntervals.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function RefreshNowButton() {
  const { refreshNow, lastRefreshAt } = useGlobalFilters();
  const [busy, setBusy] = React.useState(false);

  const handleRefresh = async () => {
    setBusy(true);
    try {
      refreshNow();
    } finally {
      setBusy(false);
    }
  };

  const label = lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Now";

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={() => void handleRefresh()} disabled={busy}>
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      Refresh
      <Badge variant="secondary" className="ml-1">
        {label}
      </Badge>
    </Button>
  );
}

export function SavedViewsMenu() {
  const { savedViews, applyView, deleteView, saveView, activeViewId } = useGlobalFilters();
  const [name, setName] = React.useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const onApply = (id: string) => {
    const view = applyView(id);
    if (view && view.route && view.route !== location.pathname) {
      navigate(view.route);
    }
  };

  const onSave = () => {
    const view = saveView(name, location.pathname);
    if (view) setName("");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="h-4 w-4" />
          Saved views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <div className="px-2 py-2 space-y-2">
          <Label htmlFor="save-view-input" className="text-xs text-muted-foreground">
            Save current view
          </Label>
          <div className="flex gap-2">
            <Input
              id="save-view-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom"
              className="h-8"
            />
            <Button size="sm" onClick={onSave} disabled={!name.trim()}>
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {savedViews.length === 0 ? (
          <DropdownMenuItem disabled className="text-xs">
            Aucune vue enregistree
          </DropdownMenuItem>
        ) : (
          savedViews.map((view) => (
            <DropdownMenuItem key={view.id} className="flex items-center gap-2" onSelect={() => onApply(view.id)}>
              <CheckCircle2 className={`h-4 w-4 ${activeViewId === view.id ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <div className="text-sm font-medium leading-tight">{view.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {view.route} | {view.timeRange.preset}
                </div>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteView(view.id);
                }}
                aria-label="Supprimer la vue"
              >
                <X className="h-4 w-4" />
              </button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function VariablesBar() {
  const { variables, setVariable, lookups, lookupsLoading, resetFilters, saveView } = useGlobalFilters();
  const location = useLocation();
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");

  const onSave = () => {
    const view = saveView(saveName, location.pathname);
    if (view) {
      setSaveOpen(false);
      setSaveName("");
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Variables</Label>
        <Badge variant="outline" className="text-[11px]">
          Global filters
        </Badge>
        {lookupsLoading ? <Badge variant="secondary">Loading...</Badge> : null}
      </div>
      <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-5">
        <Select
          value={variables.territory_code ?? "all"}
          onValueChange={(v) => setVariable("territory_code", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Territoire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous territoires</SelectItem>
            {lookups.territories.map((t) => (
              <SelectItem key={t.code} value={t.code}>
                {t.label || t.code} ({t.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={variables.client_id ?? "all"}
          onValueChange={(v) => setVariable("client_id", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous clients</SelectItem>
            {lookups.clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={variables.product_id ?? "all"}
          onValueChange={(v) => setVariable("product_id", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Produit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous produits</SelectItem>
            {lookups.products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label || p.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Reset
          </Button>

          <Popover open={saveOpen} onOpenChange={setSaveOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                Save view
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-2">
              <Label htmlFor="save-view-inline" className="text-xs text-muted-foreground">
                Nom de la vue
              </Label>
              <Input
                id="save-view-inline"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Export DOM"
              />
              <Button size="sm" onClick={onSave} disabled={!saveName.trim()}>
                Enregistrer
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
