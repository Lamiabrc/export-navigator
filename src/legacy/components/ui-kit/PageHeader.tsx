import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, meta, rightSlot, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        "rounded-2xl border border-border bg-card/80 px-4 py-4 md:px-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5",
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {rightSlot && <div className="flex flex-wrap items-center gap-2">{rightSlot}</div>}
    </div>
  );
}
