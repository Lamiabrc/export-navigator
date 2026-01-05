type RiskLevel = "low" | "medium" | "high";

const riskStyles: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: "Bas",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/40",
  },
  medium: {
    label: "Moyen",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/40",
  },
  high: {
    label: "Eleve",
    className:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/40",
  },
};

type RiskBadgeProps = {
  level: RiskLevel;
};

export function RiskBadge({ level }: RiskBadgeProps) {
  const config = riskStyles[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold border ${config.className}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      Risque {config.label}
    </span>
  );
}
