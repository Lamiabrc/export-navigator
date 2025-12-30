import { Nullable } from "./types";

export function coerceNumber(value: Nullable<number | string>, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const asString = String(value).trim().replace(",", ".");
  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeText(value: Nullable<string>): string {
  return (value || "").trim();
}

export function matchesDateRange(dateValue: Nullable<string>, start?: string, end?: string): boolean {
  if (!start && !end) return true;
  if (!dateValue) return false;

  const ts = Date.parse(dateValue);
  if (Number.isNaN(ts)) return false;

  if (start && ts < Date.parse(start)) return false;
  if (end && ts > Date.parse(end)) return false;
  return true;
}

export function isMissingTableError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as any)?.code;
  if (code === "42P01") return true; // relation does not exist

  const message = (error as any)?.message || "";
  const normalized = String(message).toLowerCase();
  return normalized.includes("does not exist") || normalized.includes("missing") && normalized.includes("relation");
}

export function summarizeWarning(label: string, reason?: string): string {
  return reason ? `${label}: ${reason}` : label;
}
