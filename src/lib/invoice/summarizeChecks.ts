import type { CheckerItem, CheckerStatus } from "./types";

type SummarizeResult = {
  mainBlockers: CheckerItem[];
  blockers: CheckerItem[];
  warnings: CheckerItem[];
  ok: CheckerItem[];
  status: CheckerStatus;
  score: number;
};

const PRIORITY_ORDER = [
  "vat_status",
  "vat_vies_format",
  "customs_value_currency",
  "fx_rate_presence",
  "mentions_invoice_number",
  "mentions_issue_date",
  "mentions_seller_identity",
  "mentions_buyer_identity",
];

function priorityRank(check: CheckerItem) {
  const index = PRIORITY_ORDER.indexOf(check.id);
  return index === -1 ? PRIORITY_ORDER.length + 1 : index;
}

function computeScore(checks: CheckerItem[]) {
  const penalties = checks.reduce((acc, check) => {
    if (check.status === "KO") return acc + 18;
    if (check.status === "WARN") return acc + 7;
    return acc;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalties));
}

export function summarizeChecks(checks: CheckerItem[]): SummarizeResult {
  const blockers = checks
    .filter((check) => check.status === "KO")
    .sort((a, b) => priorityRank(a) - priorityRank(b));

  const warnings = checks
    .filter((check) => check.status === "WARN")
    .sort((a, b) => priorityRank(a) - priorityRank(b));

  const ok = checks
    .filter((check) => check.status === "OK")
    .sort((a, b) => priorityRank(a) - priorityRank(b));

  const mainBlockers = blockers.slice(0, 2);
  const remainingBlockers = blockers.slice(2);

  const status: CheckerStatus = blockers.length > 0 ? "BLOCKING" : warnings.length > 0 ? "WARNING" : "OK";

  return {
    mainBlockers,
    blockers: remainingBlockers,
    warnings,
    ok,
    status,
    score: computeScore(checks),
  };
}

