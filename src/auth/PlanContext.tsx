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

export type SubscriptionPlan = "FREE" | "PRO_ONLINE" | "PRO_VISIO" | "PILOTAGE_HEBDO";

const STORAGE_KEY = "export-navigator-plan";
const PLAN_QUERY_PARAM = "plan";

const rank: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO_ONLINE: 1,
  PRO_VISIO: 2,
  PILOTAGE_HEBDO: 3,
};

const SUPPORTED_PLANS: SubscriptionPlan[] = ["FREE", "PRO_ONLINE", "PRO_VISIO", "PILOTAGE_HEBDO"];

const getPlanFromValue = (value: string | null): SubscriptionPlan | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase().replace(" ", "_") as SubscriptionPlan;
  return SUPPORTED_PLANS.includes(normalized) ? normalized : undefined;
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
  const [manualPlan, setManualPlan] = useState<SubscriptionPlan>(() => {
    if (typeof window === "undefined") {
      return "FREE";
    }

    const params = new URLSearchParams(window.location.search);
    const fromParam = getPlanFromValue(params.get(PLAN_QUERY_PARAM));
    if (fromParam) {
      return fromParam;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_PLANS.includes(stored as SubscriptionPlan)) {
      return stored as SubscriptionPlan;
    }

    return "FREE";
  });
  const [billingPlan, setBillingPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, manualPlan);
  }, [manualPlan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromParam = getPlanFromValue(params.get(PLAN_QUERY_PARAM));
    if (fromParam) {
      setManualPlan(fromParam);
    }
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

    if (data && (data.status === "active" || data.status === "trialing") && data.plan === "online") {
      setBillingPlan("PRO_ONLINE");
    } else {
      setBillingPlan(null);
    }
    setLoading(false);
  }, []);

  const refreshPlan = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (userId) {
      await resolvePlan(userId);
    } else {
      if (!mountedRef.current) return;
      setBillingPlan(null);
      setLoading(false);
    }
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
    [effectivePlan],
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
    [effectivePlan, loading, error, setPlan, canAccess, refreshPlan],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("usePlan must be used within a PlanProvider");
  }
  return context;
};

export const planRank = rank;
