import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type StepItem = {
  title: string;
  description: string;
};

type StepsProps = {
  items: StepItem[];
  label?: string;
  className?: string;
};

export function Steps({ items, label = "Step", className }: StepsProps) {
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
    <div className={cn("grid gap-6 md:grid-cols-3", className)}>
      {items.map((step, index) => (
        <motion.div key={`${step.title}-${index}`} {...reveal(index * 0.08)} className="marketing-card p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{label}</span>
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900">{step.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{step.description}</p>
        </motion.div>
      ))}
    </div>
  );
}
