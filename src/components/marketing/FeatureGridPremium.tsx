import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureItem = {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: string;
  link?: { to: string; label: string };
};

type FeatureGridPremiumProps = {
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
  className?: string;
};

export function FeatureGridPremium({
  items,
  columns = 3,
  className = "",
}: FeatureGridPremiumProps) {
  const gridClass = cn(
    "grid gap-6",
    columns === 2 && "md:grid-cols-2",
    columns === 3 && "md:grid-cols-2 lg:grid-cols-3",
    columns === 4 && "md:grid-cols-2 lg:grid-cols-4",
    className
  );

  return (
    <div className={gridClass}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.title}
            className="mkt-card group p-6 lg:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              {Icon && (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--mkt-primary)/0.1)] text-[hsl(var(--mkt-primary))] transition group-hover:bg-[hsl(var(--mkt-primary))] group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
              )}
              {item.badge && (
                <span className="mkt-badge shrink-0">{item.badge}</span>
              )}
            </div>

            <h3 className="mt-5 text-lg font-semibold text-[hsl(var(--mkt-ink))]">
              {item.title}
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--mkt-ink-muted))]">
              {item.description}
            </p>

            {item.link && (
              <Link
                to={item.link.to}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--mkt-primary))] transition hover:gap-3"
              >
                {item.link.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
