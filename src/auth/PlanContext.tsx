import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type SubscriptionPlan = "FREE" | "PRO" | "VIP";

const STORAGE_KEY = "export-navigator-plan";
const PLAN_QUERY_PARAM = "plan";

const rank: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 1,
  VIP: 2,
};

const SUPPORTED_PLANS: SubscriptionPlan[] = ["FREE", "PRO", "VIP"];

const getPlanFromValue = (value: string | null): SubscriptionPlan | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase() as SubscriptionPlan;
  if (SUPPORTED_PLANS.includes(normalized)) {
    return normalized;
  }
  return undefined;
};

type PlanContextValue = {
  plan: SubscriptionPlan;
  setPlan: (value: SubscriptionPlan) => void;
  canAccess: (requiredPlan: SubscriptionPlan) => boolean;
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export const PlanProvider = ({ children }: { children: ReactNode }) => {
  const [plan, setPlanState] = useState<SubscriptionPlan>(() => {
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, plan);
  }, [plan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromParam = getPlanFromValue(params.get(PLAN_QUERY_PARAM));
    if (fromParam) {
      setPlanState(fromParam);
    }
  }, []);

  const setPlan = useCallback((next: SubscriptionPlan) => {
    setPlanState(next);
  }, []);

  const canAccess = useCallback(
    (requiredPlan: SubscriptionPlan) => rank[plan] >= rank[requiredPlan],
    [plan],
  );

  const value = useMemo(
    () => ({
      plan,
      setPlan,
      canAccess,
    }),
    [plan, setPlan, canAccess],
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
