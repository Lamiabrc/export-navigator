import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { cn } from "@/lib/utils";
import { TestimonialOrStats } from "@/components/marketing/TestimonialOrStats";

type HeroLink = {
  label: string;
  to: string;
};

type HeroStat = {
  value: string;
  label: string;
  description?: string;
};

type HeroPremiumProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: HeroLink;
  secondaryCta: HeroLink;
  bullets: string[];
  stats: HeroStat[];
  note?: HeroLink;
  className?: string;
};

export function HeroPremium({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  bullets,
  stats,
  note,
  className,
}: HeroPremiumProps) {
  const reducedMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -60]);

  const reveal = (delay: number) =>
    reducedMotion
      ? {
          initial: { opacity: 1, y: 0 },
          whileInView: { opacity: 1, y: 0 },
          transition: { duration: 0 },
          viewport: { once: true },
        }
      : {
          initial: { opacity: 0, y: 18 },
          whileInView: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay },
          viewport: { once: true, margin: "-80px" },
        };

  return (
    <section ref={heroRef} className={cn("relative overflow-hidden bg-white pb-16 pt-10 md:pt-20", className)}>
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 marketing-fine-grid opacity-70" />
        <motion.div className="absolute inset-0 marketing-radial" style={{ y: parallaxY }} />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-white" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div {...reveal(0)} className="flex flex-col gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500 shadow-sm">
              {eyebrow}
            </span>

            <h1 className="marketing-display text-4xl font-semibold text-slate-900 md:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base text-slate-600 md:text-lg">{subtitle}</p>

            <div className="flex flex-wrap gap-3">
              <Link
                to={primaryCta.to}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
              >
                {primaryCta.label}
              </Link>
              <Link
                to={secondaryCta.to}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 transition hover:border-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
              >
                {secondaryCta.label}
              </Link>
            </div>

            {note && (
              <Link
                to={note.to}
                className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 underline underline-offset-4 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
              >
                {note.label}
              </Link>
            )}

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {bullets.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
                  <span className="text-sm text-slate-600">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...reveal(0.1)} className="relative">
            <div className="marketing-device p-6">
              <div className="flex items-center justify-between">
                <div className="h-2 w-12 rounded-full bg-white/40" />
                <div className="h-2 w-6 rounded-full bg-white/20" />
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
                    <span>Scenario</span>
                    <span>DDP</span>
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">+6.8%</div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div className="h-2 w-2/3 rounded-full bg-emerald-400/80" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
                    <span>Documents</span>
                    <span>8/12</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={`doc-${index}`} className="h-2 rounded-full bg-white/20" />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
                    <span>Risque</span>
                    <span>Controle</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 w-12 rounded-full bg-amber-300/70" />
                    <div className="h-2 w-20 rounded-full bg-white/20" />
                    <div className="h-2 w-6 rounded-full bg-white/20" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-10 -top-10 hidden h-32 w-32 rounded-full border border-slate-200 bg-white/70 shadow-xl lg:block" />
            <div className="pointer-events-none absolute -bottom-8 -left-10 hidden h-24 w-24 rounded-full border border-slate-200 bg-white/60 shadow-lg lg:block" />
          </motion.div>
        </div>

        <div className="mt-12">
          <TestimonialOrStats stats={stats} variant="compact" />
        </div>
      </div>
    </section>
  );
}
