import { cn } from "@/lib/utils";

type KPIStatCardProps = {
  title: string;
  value: string | number;
  delta?: string;
  badge?: string;
  className?: string;
};

export function KPIStatCard({ title, value, delta, badge, className }: KPIStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4 shadow-md shadow-black/10",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 transition-all",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/60">{title}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>
        {badge && (
          <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary-foreground border border-primary/40">
            {badge}
          </span>
        )}
      </div>
      {delta && (
        <p className="mt-2 text-sm text-emerald-300 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          {delta}
        </p>
      )}
    </div>
  );
}
