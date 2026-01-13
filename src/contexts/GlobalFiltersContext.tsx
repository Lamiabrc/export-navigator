import React from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export type TimeRangePreset =
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "last_90d"
  | "this_month"
  | "previous_month"
  | "ytd"
  | "custom";

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

type AutoRefreshState = {
  enabled: boolean;
  intervalMs: number;
};

type Lookups = {
  territories: { code: string; label?: string | null }[];
  clients: { id: string; label: string }[]; // résultats de recherche
  products: { id: string; label: string }[]; // résultats de recherche
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

  lookups: Lookups;
  lookupsLoading: boolean;

  searchingClients: boolean;
  searchingProducts: boolean;
  searchClients: (term: string) => Promise<void>;
  searchProducts: (term: string) => Promise<void>;

  labels: {
    territory_label: string | null;
    client_label: string | null;
    product_label: string | null;
  };
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
      return { preset: "last_7d", from: formatDate(from), to: formatDate(normalizedEnd), label: "7 derniers jours" };
    },
    last_14d: () => {
      const from = new Date(normalizedEnd);
      from.setDate(from.getDate() - 13);
      return { preset: "last_14d", from: formatDate(from), to: formatDate(normalizedEnd), label: "14 derniers jours" };
    },
    last_30d: () => {
      const from = new Date(normalizedEnd);
      from.setDate(from.getDate() - 29);
      return { preset: "last_30d", from: formatDate(from), to: formatDate(normalizedEnd), label: "30 jours" };
    },
    last_90d: () => {
      const from = new Date(normalizedEnd);
      from.setDate(from.getDate() - 89);
      return { preset: "last_90d", from: formatDate(from), to: formatDate(normalizedEnd), label: "90 jours" };
    },
    this_month: () => {
      const from = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), 1);
      return { preset: "this_month", from: formatDate(from), to: formatDate(normalizedEnd), label: "Mois en cours" };
    },
    previous_month: () => {
      const startPrev = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth() - 1, 1);
      const endPrev = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), 0);
      return { preset: "previous_month", from: formatDate(startPrev), to: formatDate(endPrev), label: "Mois precedent" };
    },
    ytd: () => {
      const from = new Date(normalizedEnd.getFullYear(), 0, 1);
      return { preset: "ytd", from: formatDate(from), to: formatDate(normalizedEnd), label: "YTD" };
    },
  };

  const resolver = presets[range.preset as Exclude<TimeRangePreset, "custom">] ?? presets.last_30d;
  return resolver();
};

function sanitizeForOr(term: string) {
  // évite de casser supabase .or("...") avec des caractères structurants
  return (term ?? "")
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTerritoryCode(v: unknown) {
  if (typeof v !== "string") return v as any;
  const s = v.trim();
  if (!s) return null;
  return s.toUpperCase();
}

export function GlobalFiltersProvider({ children }: { children: React.ReactNode }) {
  const { value: storedFilters, setValue: setStoredFilters } = useLocalStorage<GlobalFiltersState>("global-filters", {
    timeRange: defaultTimeRange,
    variables: {},
    autoRefresh: defaultAutoRefresh,
  });

  const [timeRange, setTimeRange] = React.useState<TimeRangeValue>(storedFilters.timeRange || defaultTimeRange);
  const [variables, setVariables] = React.useState<GlobalVariables>(storedFilters.variables || {});
  const [autoRefresh, setAutoRefresh] = React.useState<AutoRefreshState>(storedFilters.autoRefresh || defaultAutoRefresh);

  const [refreshToken, setRefreshToken] = React.useState(0);
  const [lastRefreshAt, setLastRefreshAt] = React.useState<number | null>(null);

  const [lookups, setLookups] = React.useState<Lookups>({
    territories: FALLBACK_TERRITORIES,
    clients: [],
    products: [],
  });
  const [lookupsLoading, setLookupsLoading] = React.useState(false);

  const [searchingClients, setSearchingClients] = React.useState(false);
  const [searchingProducts, setSearchingProducts] = React.useState(false);

  // cache id -> label pour ne jamais afficher d’UUID dans l’UI
  const clientCacheRef = React.useRef<Record<string, string>>({});
  const productCacheRef = React.useRef<Record<string, string>>({});

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
      let v: any = value;

      // Normalisation critique : éviter de stocker "Saint-Martin" au lieu de "MF"
      if (key === "territory_code") v = normalizeTerritoryCode(v);

      // garder null si vide
      if (v === "" || v === undefined) v = null;

      setVariables((prev) => ({ ...prev, [key]: v || null }));
    },
    []
  );

  const resetFilters = React.useCallback(() => {
    setTimeRange(defaultTimeRange);
    setVariables({});
    setAutoRefresh(defaultAutoRefresh);
    refreshNow();
  }, [refreshNow]);

  // Territories (1 fois)
  React.useEffect(() => {
    let isMounted = true;
    if (!SUPABASE_ENV_OK) {
      setLookups((prev) => ({ ...prev, territories: FALLBACK_TERRITORIES }));
      return () => {
        isMounted = false;
      };
    }

    const load = async () => {
      setLookupsLoading(true);
      try {
        const { data, error } = await supabase.from("territories").select("code,label").order("label", { ascending: true });
        if (error) throw error;
        if (!isMounted) return;
        setLookups((prev) => ({
          ...prev,
          territories: (data as any[])?.length ? (data as any[]) : FALLBACK_TERRITORIES,
        }));
      } catch (err) {
        console.error("[global-filters] territories error", err);
        if (isMounted) setLookups((prev) => ({ ...prev, territories: FALLBACK_TERRITORIES }));
      } finally {
        if (isMounted) setLookupsLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * ✅ IMPORTANT : ta table clients n'a (visiblement) PAS une colonne "name".
   * On utilise "libelle_client" (cohérent avec tes imports CSV).
   */
  const searchClients = React.useCallback(async (term: string) => {
    if (!SUPABASE_ENV_OK) return;
    const t = sanitizeForOr(term ?? "");

    setSearchingClients(true);
    try {
      const q = supabase.from("clients").select("id,libelle_client");

      const { data, error } =
        t.length >= 2
          ? await q.ilike("libelle_client", `%${t}%`).order("libelle_client", { ascending: true }).limit(30)
          : await q.order("libelle_client", { ascending: true }).limit(30);

      if (error) throw error;

      const rows = ((data as any[]) ?? [])
        .map((c) => ({ id: String(c.id), label: String(c.libelle_client ?? "") }))
        .filter((x) => x.label);

      for (const r of rows) clientCacheRef.current[r.id] = r.label;
      setLookups((prev) => ({ ...prev, clients: rows }));
    } catch (err) {
      console.error("[global-filters] searchClients error", err);
      setLookups((prev) => ({ ...prev, clients: [] }));
    } finally {
      setSearchingClients(false);
    }
  }, []);

  const searchProducts = React.useCallback(async (term: string) => {
    if (!SUPABASE_ENV_OK) return;
    const t = sanitizeForOr(term ?? "");

    setSearchingProducts(true);
    try {
      const q = supabase.from("products").select("id,libelle_article,code_article");

      const { data, error } =
        t.length >= 2
          ? await q
              .or(`libelle_article.ilike.%${t}%,code_article.ilike.%${t}%`)
              .order("libelle_article", { ascending: true })
              .limit(30)
          : await q.order("libelle_article", { ascending: true }).limit(30);

      if (error) throw error;

      const rows = ((data as any[]) ?? [])
        .map((p) => {
          const id = String(p.id);
          const code = p.code_article ? String(p.code_article) : "";
          const lib = p.libelle_article ? String(p.libelle_article) : "";
          const label = code ? `${code} — ${lib}` : lib;
          return { id, label };
        })
        .filter((x) => x.label);

      for (const r of rows) productCacheRef.current[r.id] = r.label;
      setLookups((prev) => ({ ...prev, products: rows }));
    } catch (err) {
      console.error("[global-filters] searchProducts error", err);
      setLookups((prev) => ({ ...prev, products: [] }));
    } finally {
      setSearchingProducts(false);
    }
  }, []);

  // hydrate les labels si on a juste un id (rechargement / navigation)
  React.useEffect(() => {
    let cancelled = false;
    if (!SUPABASE_ENV_OK) return;

    const run = async () => {
      const clientId = variables.client_id || null;
      const productId = variables.product_id || null;

      try {
        if (clientId && !clientCacheRef.current[clientId]) {
          const { data, error } = await supabase
            .from("clients")
            .select("id,libelle_client")
            .eq("id", clientId)
            .maybeSingle();

          if (!error && !cancelled && data?.id) {
            clientCacheRef.current[String(data.id)] = String((data as any).libelle_client ?? "");
          }
        }

        if (productId && !productCacheRef.current[productId]) {
          const { data, error } = await supabase
            .from("products")
            .select("id,libelle_article,code_article")
            .eq("id", productId)
            .maybeSingle();

          if (!error && !cancelled && data?.id) {
            const code = (data as any).code_article ? String((data as any).code_article) : "";
            const lib = (data as any).libelle_article ? String((data as any).libelle_article) : "";
            productCacheRef.current[String(data.id)] = code ? `${code} — ${lib}` : lib;
          }
        }
      } catch (e) {
        console.error("[global-filters] hydrate labels error", e);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [variables.client_id, variables.product_id]);

  const labels = React.useMemo(() => {
    const wantedTerr = variables.territory_code ? String(variables.territory_code).toUpperCase() : null;

    const territory = wantedTerr
      ? (lookups.territories.find((t) => String(t.code).toUpperCase() === wantedTerr)?.label ?? wantedTerr)
      : null;

    const client = variables.client_id ? clientCacheRef.current[variables.client_id] ?? null : null;
    const product = variables.product_id ? productCacheRef.current[variables.product_id] ?? null : null;

    return {
      territory_label: territory ?? null,
      client_label: client,
      product_label: product,
    };
  }, [lookups.territories, variables.territory_code, variables.client_id, variables.product_id]);

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

    lookups,
    lookupsLoading,

    searchingClients,
    searchingProducts,
    searchClients,
    searchProducts,

    labels,
  };

  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = React.useContext(GlobalFiltersContext);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}
