import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type FeatureLink = {
  to: string;
  label: string;
};

type FeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  link?: FeatureLink;
  badge?: string;
};

type FeatureGridProps = {
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
  className?: string;
};

const columnStyles: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

export function FeatureGrid({ items, columns = 3, className }: FeatureGridProps) {
  const reducedMotion = useReducedMotion();

  const reveal = (delay: number) =>
    reducedMotion
      ? {
          initial: { opacity: 1, y: 0 },
          whileInView: { opacity: 1, y: 0 },
          transition: { duration: 0 },
          viewport: { once: true },
        }
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay },
          viewport: { once: true, margin: "-80px" },
        };

  return (
    <div className={cn("grid gap-6", columnStyles[columns], className)}>
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.article
            key={`${item.title}-${index}`}
            {...reveal(index * 0.08)}
            className="group marketing-card flex h-full flex-col gap-4 p-6"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {item.badge && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {item.badge}
                </span>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </div>

            {item.link && (
              <Link
                to={item.link.to}
                className="mt-auto inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 transition group-hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
                aria-label={item.link.label}
              >
                {item.link.label}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
