import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type SubscriptionPlan = "FREE" | "PRO_ONLINE" | "PROSPECTION" | "PRO_VISIO" | "PILOTAGE_HEBDO";

const STORAGE_KEY = "export-navigator-plan";
const PLAN_QUERY_PARAM = "plan";

const rank: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO_ONLINE: 1,
  PROSPECTION: 1,
  PRO_VISIO: 2,
  PILOTAGE_HEBDO: 3,
};

const SUPPORTED_PLANS: SubscriptionPlan[] = [
  "FREE",
  "PRO_ONLINE",
  "PROSPECTION",
  "PRO_VISIO",
  "PILOTAGE_HEBDO",
];

function safeStorageGet(key: string) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeStorageSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

const normalizePlanToken = (value: string) =>
  value
    .trim()
    .toUpperCase()
    // espaces / tirets / + -> underscore
    .replace(/[\s+/-]+/g, "_")
    .replace(/_+/g, "_");

const getPlanFromValue = (value: string | null): SubscriptionPlan | undefined => {
  if (!value) return undefined;
  const normalized = normalizePlanToken(value) as SubscriptionPlan;
  return SUPPORTED_PLANS.includes(normalized) ? normalized : undefined;
};

// Map des valeurs possibles stockées en billing_subscriptions.plan -> SubscriptionPlan
const mapBillingPlan = (planValue: unknown): SubscriptionPlan | null => {
  if (!planValue || typeof planValue !== "string") return null;
  const token = normalizePlanToken(planValue);

  // exemples acceptés : "online", "pro_online", "PRO-ONLINE"
  if (token === "ONLINE" || token === "PRO_ONLINE") return "PRO_ONLINE";

  // exemples : "visio", "pro_visio"
  if (token === "VISIO" || token === "PRO_VISIO") return "PRO_VISIO";

  // exemples : "prospection"
  if (token === "PROSPECTION" || token === "PROSPECTING") return "PROSPECTION";

  // exemples : "pilotage", "pilotage_hebdo", "PILOTAGE-HEBDO"
  if (token === "PILOTAGE" || token === "PILOTAGE_HEBDO") return "PILOTAGE_HEBDO";

  if (token === "FREE") return "FREE";

  return null;
};

type PlanContextValue = {
  plan: SubscriptionPlan;
  loading: boolean;
  error?: string;
  setPlan: (value: SubscriptionPlan) => void;
  canAccess: (requiredPlan: SubscriptionPlan) => boolean;
  refreshPlan: () => Promise<void>;
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export const PlanProvider = ({ children }: { children: ReactNode }) => {
  const mountedRef = useRef(true);

  const [manualPlan, setManualPlan] = useState<SubscriptionPlan>(() => {
    if (typeof window === "undefined") return "FREE";

    // 1) override via query param ?plan=PRO_ONLINE
    const params = new URLSearchParams(window.location.search);
    const fromParam = getPlanFromValue(params.get(PLAN_QUERY_PARAM));
    if (fromParam) return fromParam;

    // 2) sinon localStorage
    const stored = safeStorageGet(STORAGE_KEY);
    const fromStored = getPlanFromValue(stored);
    if (fromStored) return fromStored;

    return "FREE";
  });

  const [billingPlan, setBillingPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // persist le plan manuel (debug / override)
  useEffect(() => {
    safeStorageSet(STORAGE_KEY, manualPlan);
  }, [manualPlan]);

  // prendre le plan depuis l’URL une seule fois au mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromParam = getPlanFromValue(params.get(PLAN_QUERY_PARAM));
    if (fromParam) setManualPlan(fromParam);
  }, []);

  const setPlan = useCallback((next: SubscriptionPlan) => {
    setManualPlan(next);
  }, []);

  const resolvePlan = useCallback(async (userId: string) => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(undefined);

    const { data, error: queryError } = await supabase
      .from("billing_subscriptions")
      .select("plan,status,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mountedRef.current) return;

    if (queryError) {
      setError(queryError.message);
      setBillingPlan(null);
      setLoading(false);
      return;
    }

    // statut “actif” accepté (tu peux ajouter "past_due" si tu veux autoriser temporairement)
    const statusOk = data?.status === "active" || data?.status === "trialing";

    if (statusOk) {
      const mapped = mapBillingPlan(data?.plan);
      setBillingPlan(mapped); // null si inconnu => retombe sur manualPlan
    } else {
      setBillingPlan(null);
    }

    setLoading(false);
  }, []);

  const refreshPlan = useCallback(async () => {
    setError(undefined);

    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;

    if (userId) {
      await resolvePlan(userId);
      return;
    }

    if (!mountedRef.current) return;
    setBillingPlan(null);
    setLoading(false);
  }, [resolvePlan]);

  useEffect(() => {
    void refreshPlan();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        if (!mountedRef.current) return;
        setBillingPlan(null);
        setLoading(false);
        return;
      }
      void resolvePlan(userId);
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, [refreshPlan, resolvePlan]);

  const effectivePlan = billingPlan ?? manualPlan;

  const canAccess = useCallback(
    (requiredPlan: SubscriptionPlan) => rank[effectivePlan] >= rank[requiredPlan],
    [effectivePlan]
  );

  const value = useMemo(
    () => ({
      plan: effectivePlan,
      loading,
      error,
      setPlan,
      canAccess,
      refreshPlan,
    }),
    [effectivePlan, loading, error, setPlan, canAccess, refreshPlan]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) throw new Error("usePlan must be used within a PlanProvider");
  return context;
};

export const planRank = rank;
