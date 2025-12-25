import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
};

const toneStyles: Record<Tone, { bg: string; text: string; dot: string; border: string }> = {
  neutral: {
    bg: "bg-card",
    text: "text-foreground",
    dot: "bg-muted-foreground/50",
    border: "border-border",
  },
  info: {
    bg: "bg-secondary/10",
    text: "text-secondary",
    dot: "bg-secondary",
    border: "border-secondary/30",
  },
  success: {
    bg: "bg-[hsl(var(--status-ok-bg))]",
    text: "text-[hsl(var(--status-ok))]",
    dot: "bg-[hsl(var(--status-ok))]",
    border: "border-[hsl(var(--status-ok))/40]",
  },
  warning: {
    bg: "bg-[hsl(var(--status-warning-bg))]",
    text: "text-[hsl(var(--status-warning))]",
    dot: "bg-[hsl(var(--status-warning))]",
    border: "border-[hsl(var(--status-warning))/40]",
  },
  danger: {
    bg: "bg-[hsl(var(--status-risk-bg))]",
    text: "text-[hsl(var(--status-risk))]",
    dot: "bg-[hsl(var(--status-risk))]",
    border: "border-[hsl(var(--status-risk))/40]",
  },
};

export function StatCard({ title, value, subtitle, tone = "neutral", icon, className }: StatCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
        "p-4 flex flex-col gap-2",
        toneStyle.bg,
        toneStyle.border,
        "dark:border-white/10 dark:bg-white/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            {icon && <span className="text-lg">{icon}</span>}
            <p className={cn("text-2xl font-semibold", toneStyle.text)}>{value}</p>
          </div>
        </div>
      </div>
      {subtitle && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", toneStyle.dot)} />
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}
