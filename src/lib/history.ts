import type { SubscriptionPlan } from "@/auth/PlanContext";

const STORAGE_KEY = "export-navigator-history";
const HISTORY_LIMIT = 40;

export type HistoryEntry = {
  id: string;
  plan: SubscriptionPlan;
  title: string;
  summary: string;
  score?: number;
  landedCost?: number;
  createdAt: string;
};

const readHistory = (): HistoryEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const data = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const writeHistory = (entries: HistoryEntry[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

export const loadHistory = () => readHistory();

export const saveHistory = (
  plan: SubscriptionPlan,
  payload: Omit<HistoryEntry, "id" | "createdAt" | "plan">,
) => {
  if (plan === "FREE") {
    return null;
  }

  const entries = readHistory();
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    plan,
    ...payload,
    createdAt: new Date().toISOString(),
  };

  const updated = [entry, ...entries].slice(0, HISTORY_LIMIT);
  writeHistory(updated);
  return entry;
};
