import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type StatItem = {
  value: string;
  label: string;
  description?: string;
};

type Quote = {
  text: string;
  author?: string;
  role?: string;
};

type TestimonialOrStatsProps = {
  title?: string;
  subtitle?: string;
  stats: StatItem[];
  quote?: Quote;
  className?: string;
  variant?: "default" | "compact";
};

export function TestimonialOrStats({
  title,
  subtitle,
  stats,
  quote,
  className,
  variant = "default",
}: TestimonialOrStatsProps) {
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
    <div className={cn("w-full", className)}>
      {(title || subtitle) && (
        <motion.div {...reveal(0)} className="max-w-3xl">
          {title && (
            <h3 className="marketing-display text-2xl font-semibold text-slate-900 md:text-3xl">{title}</h3>
          )}
          {subtitle && <p className="mt-2 text-base text-slate-600">{subtitle}</p>}
        </motion.div>
      )}

      <div
        className={cn(
          "mt-6 grid gap-4",
          variant === "compact" ? "md:grid-cols-3" : "md:grid-cols-3",
        )}
      >
        {stats.map((stat, index) => (
          <motion.div
            key={`${stat.label}-${index}`}
            {...reveal(index * 0.08)}
            className={cn("marketing-card px-6 py-5", variant === "compact" ? "" : "")}
          >
            <div className="text-2xl font-semibold text-slate-900 md:text-3xl">{stat.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500 uppercase tracking-[0.25em]">
              {stat.label}
            </div>
            {stat.description && <p className="mt-3 text-xs text-slate-500">{stat.description}</p>}
          </motion.div>
        ))}
      </div>

      {quote && (
        <motion.div {...reveal(0.1)} className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-base text-slate-700">"{quote.text}"</p>
          {(quote.author || quote.role) && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              {quote.author}
              {quote.author && quote.role ? " - " : ""}
              {quote.role}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
