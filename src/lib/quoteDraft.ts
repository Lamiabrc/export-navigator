import type { QuoteLine, QuoteContext } from "@/lib/costCalculator";

export type QuoteDraft = QuoteContext & {
  updated_at: string;
  lines: QuoteLine[];
};

const KEY = "export_quote_draft_v1";

export function loadQuoteDraft(): QuoteDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { updated_at: new Date().toISOString(), lines: [] };
    const parsed = JSON.parse(raw) as QuoteDraft;
    if (!parsed?.lines) return { updated_at: new Date().toISOString(), lines: [] };
    return parsed;
  } catch {
    return { updated_at: new Date().toISOString(), lines: [] };
  }
}

export function saveQuoteDraft(d: Omit<QuoteDraft, "updated_at">) {
  localStorage.setItem(KEY, JSON.stringify({ ...d, updated_at: new Date().toISOString() }));
}

export function clearQuoteDraft() {
  localStorage.removeItem(KEY);
}
