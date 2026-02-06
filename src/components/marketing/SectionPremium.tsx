import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionPremiumProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "default" | "muted" | "dark";
  className?: string;
  containerClassName?: string;
};

export function SectionPremium({
  eyebrow,
  title,
  description,
  children,
  variant = "default",
  className = "",
  containerClassName = "",
}: SectionPremiumProps) {
  const sectionClass = cn(
    "mkt-section",
    variant === "muted" && "mkt-section-muted",
    variant === "dark" && "mkt-section-dark",
    className
  );

  return (
    <section className={sectionClass}>
      <div className={cn("mkt-container", containerClassName)}>
        {(eyebrow || title || description) && (
          <div className="mb-12 max-w-3xl">
            {eyebrow && (
              <p className="mkt-eyebrow mb-4">{eyebrow}</p>
            )}
            <h2 className="mkt-display mkt-display-md">{title}</h2>
            {description && (
              <p className="mt-4 text-lg text-[hsl(var(--mkt-ink-muted))]">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
