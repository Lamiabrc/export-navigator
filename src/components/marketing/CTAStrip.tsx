import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type CTAItem = {
  label: string;
  to: string;
};

type CTAStripProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  primary: CTAItem;
  secondary?: CTAItem;
  tertiary?: CTAItem;
  note?: string;
  className?: string;
};

export function CTAStrip({
  eyebrow,
  title,
  description,
  primary,
  secondary,
  tertiary,
  note,
  className,
}: CTAStripProps) {
  const reducedMotion = useReducedMotion();

  const reveal = reducedMotion
    ? {
        initial: { opacity: 1, y: 0 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0 },
        viewport: { once: true },
      }
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.6 },
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <section className={cn("py-16 md:py-20", className)}>
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          {...reveal}
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800 px-8 py-10 text-white shadow-2xl md:px-12"
        >
          <div className="absolute inset-0 opacity-40 marketing-fine-grid" aria-hidden="true" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_55%)]" aria-hidden="true" />

          <div className="relative">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">{eyebrow}</p>
            )}
            <h3 className="marketing-display mt-3 text-3xl font-semibold md:text-4xl">{title}</h3>
            {description && <p className="mt-3 text-base text-white/80 md:text-lg">{description}</p>}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={primary.to}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {primary.label}
              </Link>
              {secondary && (
                <Link
                  to={secondary.to}
                  className="inline-flex items-center justify-center rounded-full border border-white/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {secondary.label}
                </Link>
              )}
              {tertiary && (
                <Link
                  to={tertiary.to}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {tertiary.label}
                </Link>
              )}
            </div>

            {note && <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">{note}</p>}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
