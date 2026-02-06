import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type SectionTone = "plain" | "muted" | "soft";
type SectionAlign = "left" | "center";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  tone?: SectionTone;
  align?: SectionAlign;
};

const toneStyles: Record<SectionTone, string> = {
  plain: "bg-white",
  muted: "bg-slate-50/70",
  soft: "bg-slate-100/60",
};

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  containerClassName,
  tone = "plain",
  align = "left",
}: SectionProps) {
  const reducedMotion = useReducedMotion();

  const headerMotion = reducedMotion
    ? {
        initial: { opacity: 1, y: 0 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0 },
        viewport: { once: true },
      }
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.6 },
        viewport: { once: true, margin: "-80px" },
      };

  const textAlign = align === "center" ? "text-center" : "text-left";
  const headerWidth = align === "center" ? "mx-auto max-w-3xl" : "max-w-3xl";

  return (
    <section id={id} className={cn("marketing-section py-16 md:py-24", toneStyles[tone], className)}>
      <div className={cn("mx-auto max-w-6xl px-6", containerClassName)}>
        {(eyebrow || title || description) && (
          <motion.div {...headerMotion} className={cn(headerWidth, textAlign)}>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{eyebrow}</p>
            )}
            {title && (
              <h2 className="marketing-display mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
                {title}
              </h2>
            )}
            {description && <p className="mt-3 text-base text-slate-600 md:text-lg">{description}</p>}
          </motion.div>
        )}
        <div className={cn(eyebrow || title || description ? "mt-10" : "")}>{children}</div>
      </div>
    </section>
  );
}
