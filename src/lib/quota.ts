import type { SubscriptionPlan } from "@/auth/PlanContext";

const STORAGE_KEY = "export-navigator-quota";
const QUOTA_LIMITS: Record<SubscriptionPlan, number> = {
  FREE: 3,
  PRO: 30,
  VIP: 300,
};

type QuotaPayload = {
  date: string;
  counts: Record<SubscriptionPlan, number>;
};

const nowKey = () => new Date().toISOString().split("T")[0];

const readPayload = (): QuotaPayload => {
  if (typeof window === "undefined") {
    return { date: nowKey(), counts: { FREE: 0, PRO: 0, VIP: 0 } };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { date: nowKey(), counts: { FREE: 0, PRO: 0, VIP: 0 } };
  }

  try {
    const parsed = JSON.parse(raw) as QuotaPayload;
    if (parsed.date !== nowKey()) {
      return { date: nowKey(), counts: { FREE: 0, PRO: 0, VIP: 0 } };
    }

    return {
      date: parsed.date,
      counts: {
        FREE: parsed.counts.FREE ?? 0,
        PRO: parsed.counts.PRO ?? 0,
        VIP: parsed.counts.VIP ?? 0,
      },
    };
  } catch {
    return { date: nowKey(), counts: { FREE: 0, PRO: 0, VIP: 0 } };
  }
};

const writePayload = (payload: QuotaPayload) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const getQuotaUsage = (plan: SubscriptionPlan) => {
  const payload = readPayload();
  return payload.counts[plan] ?? 0;
};

export const getQuotaLimit = (plan: SubscriptionPlan) => QUOTA_LIMITS[plan];

export const recordSimulation = (plan: SubscriptionPlan) => {
  const payload = readPayload();
  if (payload.date !== nowKey()) {
    payload.date = nowKey();
    payload.counts = { FREE: 0, PRO: 0, VIP: 0 };
  }

  payload.counts[plan] = (payload.counts[plan] ?? 0) + 1;
  writePayload(payload);

  return {
    usage: payload.counts[plan],
    limit: QUOTA_LIMITS[plan],
  };
};

export const getRemainingQuota = (plan: SubscriptionPlan) => {
  const usage = getQuotaUsage(plan);
  return Math.max(0, QUOTA_LIMITS[plan] - usage);
};
