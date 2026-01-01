import React from "react";
import { useLocation } from "react-router-dom";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export type TimeRangePreset = "last_7d" | "last_14d" | "last_30d" | "last_90d" | "this_month" | "previous_month" | "ytd" | "custom";

export type TimeRangeValue = {
  preset: TimeRangePreset;
  from?: string | null;
  to?: string | null;
};

export type ResolvedTimeRange = TimeRangeValue & {
  from: string;
  to: string;
  label: string;
};

export type GlobalVariables = {
  territory_code?: string | null;
  client_id?: string | null;
  product_id?: string | null;
};

export type SavedView = {
  id: string;
  name: string;
  route: string;
  timeRange: TimeRangeValue;
  variables: GlobalVariables;
  createdAt: number;
};

type AutoRefreshState = {
  enabled: boolean;
  intervalMs: number;
};

type Lookups = {
  territories: { code: string; label?: string | null }[];
  clients: { id: string; name?: string | null }[];
  products: { id: string; label?: string | null }[];
};

type GlobalFiltersState = {
  timeRange: TimeRangeValue;
  variables: GlobalVariables;
  autoRefresh: AutoRefreshState;
};

type GlobalFiltersContextValue = {
  timeRange: TimeRangeValue;
  resolvedRange: ResolvedTimeRange;
  setTimeRange: (value: TimeRangeValue) => void;
  variables: GlobalVariables;
  setVariable: <K extends keyof GlobalVariables>(key: K, value: GlobalVariables[K]) => void;
  resetFilters: () => void;
  autoRefresh: AutoRefreshState;
  setAutoRefresh: (value: AutoRefreshState) => void;
  refreshNow: () => void;
  lastRefreshAt: number | null;
  refreshToken: number;
  savedViews: SavedView[];
  saveView: (name: string, routeOverride?: string) => SavedView | null;
  applyView: (id: string) => SavedView | null;
  deleteView: (id: string) => void;
  activeViewId: string | null;
  lookups: Lookups;
  lookupsLoading: boolean;
};

const FALLBACK_TERRITORIES: Lookups["territories"] = [
  { code: "FR", label: "Metropole" },
  { code: "GP", label: "Guadeloupe" },
  { code: "MQ", label: "Martinique" },
  { code: "GF", label: "Guyane" },
  { code: "RE", label: "Reunion" },
  { code: "YT", label: "Mayotte" },
  { code: "SPM", label: "Saint-Pierre-et-Miquelon" },
  { code: "BL", label: "Saint-Barthelemy" },
  { code: "MF", label: "Saint-Martin" },
];

const defaultTimeRange: TimeRangeValue = { preset: "last_30d" };
const defaultAutoRefresh: AutoRefreshState = { enabled: false, intervalMs: 60_000 };

const GlobalFiltersContext = React.createContext<GlobalFiltersContextValue | null>(null);

const formatDate = (d: Date) => {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveTimeRange = (range: TimeRangeValue): ResolvedTimeRange => {
  const today = new Date();
  const end = range.to ? new Date(range.to) : today;

  const clampEnd = (d: Date) => {
    const copy = new Date(d);
    if (Number.isNaN(copy.getTime())) return today;
    return copy;
  };

  const clampStart = (d: Date) => {
    const copy = new Date(d);
    if (Number.isNaN(copy.getTime())) return new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    return copy;
  };

  const normalizedEnd = clampEnd(end);

  if (range.preset === "custom" && range.from && range.to) {
    const from = clampStart(new Date(range.from));
    const to = clampEnd(new Date(range.to));
    const label = `${formatDate(from)} -> ${formatDate(to)}`;
    return { ...range, from: formatDate(from), to: formatDate(to), label };
  }

  const presets: Record<Exclude<TimeRangePreset, "custom">, () => ResolvedTimeRange> = {
    last_7d: () => {
      const from = new Date(normalizedEnd);
      from.setDate(from.getDate() - 6);
      return {
        preset: "last_7d",
        from: formatDate(from),
        to: formatDate(normalizedEnd),
        label: "7 derniers jours",
      };
    },
    last_14d: () => {
      const from = new Date(normalizedEnd);
      from.setDate(from.getDate() - 13);
      return {
        preset: "last_14d",
        from: formatDate(from),
        to: formatDate(normalizedEnd),
        label: "14 derniers jours",
      };
    },
    last_30d: () => {
      const from = new Date(normalizedEnd);
      from.setDate(from.getDate() - 29);
      return {
        preset: "last_30d",
        from: formatDate(from),
        to: formatDate(normalizedEnd),
        label: "30 jours",
      };
    },
    last_90d: () => {
      const from = new Date(normalizedEnd);
      from.setDate(from.getDate() - 89);
      return {
        preset: "last_90d",
        from: formatDate(from),
        to: formatDate(normalizedEnd),
        label: "90 jours",
      };
    },
    this_month: () => {
      const from = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), 1);
      return {
        preset: "this_month",
        from: formatDate(from),
        to: formatDate(normalizedEnd),
        label: "Mois en cours",
      };
    },
    previous_month: () => {
      const startPrev = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth() - 1, 1);
      const endPrev = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), 0);
      return {
        preset: "previous_month",
        from: formatDate(startPrev),
        to: formatDate(endPrev),
        label: "Mois precedent",
      };
    },
    ytd: () => {
      const from = new Date(normalizedEnd.getFullYear(), 0, 1);
      return {
        preset: "ytd",
        from: formatDate(from),
        to: formatDate(normalizedEnd),
        label: "YTD",
      };
    },
  };

  const resolver = presets[range.preset as Exclude<TimeRangePreset, "custom">] ?? presets.last_30d;
  return resolver();
};

export function GlobalFiltersProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const { value: storedFilters, setValue: setStoredFilters } = useLocalStorage<GlobalFiltersState>(
    "global-filters",
    {
      timeRange: defaultTimeRange,
      variables: {},
      autoRefresh: defaultAutoRefresh,
    }
  );

  const { value: savedViews, setValue: setSavedViews } = useLocalStorage<SavedView[]>("global-saved-views", []);

  const [timeRange, setTimeRange] = React.useState<TimeRangeValue>(storedFilters.timeRange || defaultTimeRange);
  const [variables, setVariables] = React.useState<GlobalVariables>(storedFilters.variables || {});
  const [autoRefresh, setAutoRefresh] = React.useState<AutoRefreshState>(
    storedFilters.autoRefresh || defaultAutoRefresh
  );
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [lastRefreshAt, setLastRefreshAt] = React.useState<number | null>(null);
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);

  const [lookups, setLookups] = React.useState<Lookups>({ territories: FALLBACK_TERRITORIES, clients: [], products: [] });
  const [lookupsLoading, setLookupsLoading] = React.useState(false);

  React.useEffect(() => {
    setStoredFilters({ timeRange, variables, autoRefresh });
  }, [timeRange, variables, autoRefresh, setStoredFilters]);

  const resolvedRange = React.useMemo(() => resolveTimeRange(timeRange), [timeRange]);

  const refreshNow = React.useCallback(() => {
    setRefreshToken((x) => x + 1);
    setLastRefreshAt(Date.now());
  }, []);

  React.useEffect(() => {
    if (!autoRefresh.enabled) return;
    const id = window.setInterval(() => refreshNow(), Math.max(10_000, autoRefresh.intervalMs));
    return () => window.clearInterval(id);
  }, [autoRefresh, refreshNow]);

  const setVariable = React.useCallback(
    <K extends keyof GlobalVariables>(key: K, value: GlobalVariables[K]) => {
      setVariables((prev) => ({ ...prev, [key]: value || null }));
    },
    []
  );

  const resetFilters = React.useCallback(() => {
    setTimeRange(defaultTimeRange);
    setVariables({});
    setActiveViewId(null);
    setAutoRefresh(defaultAutoRefresh);
    refreshNow();
  }, [refreshNow]);

  const saveView = React.useCallback(
    (name: string, routeOverride?: string): SavedView | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const newView: SavedView = {
        id: crypto.randomUUID ? crypto.randomUUID() : `view-${Date.now()}`,
        name: trimmed,
        route: routeOverride || location.pathname,
        timeRange,
        variables,
        createdAt: Date.now(),
      };
      setSavedViews((prev) => [newView, ...prev.filter((v) => v.name !== trimmed)]);
      setActiveViewId(newView.id);
      return newView;
    },
    [location.pathname, setSavedViews, timeRange, variables]
  );

  const applyView = React.useCallback(
    (id: string): SavedView | null => {
      const view = savedViews.find((v) => v.id === id);
      if (!view) return null;
      setTimeRange(view.timeRange);
      setVariables(view.variables || {});
      setActiveViewId(view.id);
      refreshNow();
      return view;
    },
    [refreshNow, savedViews]
  );

  const deleteView = React.useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
      if (activeViewId === id) setActiveViewId(null);
    },
    [activeViewId, setSavedViews]
  );

  React.useEffect(() => {
    let isMounted = true;
    if (!SUPABASE_ENV_OK) {
      setLookups({ territories: FALLBACK_TERRITORIES, clients: [], products: [] });
      return () => {
        isMounted = false;
      };
    }

    const load = async () => {
      setLookupsLoading(true);
      try {
        const [{ data: territories }, { data: clients }, { data: products }] = await Promise.all([
          supabase.from("territories").select("code,label").order("label", { ascending: true }),
          supabase.from("clients").select("id,name").order("name", { ascending: true }).limit(500),
          supabase.from("products").select("id,libelle_article").order("libelle_article", { ascending: true }).limit(500),
        ]);

        if (!isMounted) return;

        setLookups({
          territories: (territories as any[])?.length ? (territories as any[]) : FALLBACK_TERRITORIES,
          clients: (clients as any[]) ?? [],
          products: ((products as any[]) ?? []).map((p: any) => ({ id: p.id, label: p.libelle_article })),
        });
      } catch (err) {
        console.error("[filters] lookups error", err);
        if (isMounted) setLookups({ territories: FALLBACK_TERRITORIES, clients: [], products: [] });
      } finally {
        if (isMounted) setLookupsLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const value: GlobalFiltersContextValue = {
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
    refreshToken,
    savedViews,
    saveView,
    applyView,
    deleteView,
    activeViewId,
    lookups,
    lookupsLoading,
  };

  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = React.useContext(GlobalFiltersContext);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}
