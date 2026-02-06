import { cn } from "@/lib/utils";

type StepItem = {
  title: string;
  description: string;
};

type StepsPremiumProps = {
  items: StepItem[];
  label?: string;
  className?: string;
};

export function StepsPremium({
  items,
  label = "Étape",
  className = "",
}: StepsPremiumProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="grid gap-8 md:grid-cols-3 md:gap-12">
        {items.map((item, index) => (
          <div key={item.title} className="relative">
            {/* Connector line (hidden on last item) */}
            {index < items.length - 1 && (
              <div
                className="absolute left-[1.25rem] top-14 hidden h-[calc(100%+2rem)] w-px bg-gradient-to-b from-[hsl(var(--mkt-primary)/0.3)] to-transparent md:left-[calc(100%+1.5rem)] md:top-6 md:h-px md:w-[calc(100%-0.5rem)] md:bg-gradient-to-r md:block"
                aria-hidden="true"
              />
            )}

            <div className="flex gap-5 md:flex-col md:gap-4">
              {/* Number */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--mkt-primary))] text-sm font-semibold text-white md:h-12 md:w-12 md:text-base">
                {index + 1}
              </div>

              <div>
                <p className="mkt-label mb-1 text-[hsl(var(--mkt-primary))]">
                  {label} {index + 1}
                </p>
                <h3 className="text-lg font-semibold text-[hsl(var(--mkt-ink))]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--mkt-ink-muted))]">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
