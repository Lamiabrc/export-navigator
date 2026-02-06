import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CTAStripPremiumProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryCta: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  note?: string;
  className?: string;
};

export function CTAStripPremium({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  note,
  className = "",
}: CTAStripPremiumProps) {
  return (
    <section className={cn("mkt-section-dark mkt-section relative overflow-hidden", className)}>
      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 50%, hsl(var(--mkt-primary) / 0.15), transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 50%, hsl(var(--mkt-accent) / 0.1), transparent 50%)
          `,
        }}
        aria-hidden="true"
      />

      <div className="mkt-container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow && (
            <p className="mkt-eyebrow mb-4" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {eyebrow}
            </p>
          )}

          <h2 className="mkt-display mkt-display-md text-white">{title}</h2>

          {description && (
            <p className="mt-4 text-lg" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to={primaryCta.to} className="mkt-btn mkt-btn-primary">
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {secondaryCta && (
              <Link to={secondaryCta.to} className="mkt-btn mkt-btn-light">
                {secondaryCta.label}
              </Link>
            )}
          </div>

          {note && (
            <p className="mt-6 text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {note}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
