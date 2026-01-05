import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  icon?: ReactNode;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, icon, rightSlot, children, className }: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
        "dark:border-white/10 dark:bg-white/5",
        className
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg" aria-hidden>{icon}</span>}
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
