import { cn } from "@/lib/utils";

type TricolorBannerProps = {
  title?: string;
  question?: string;
  compact?: boolean;
  className?: string;
};

export function TricolorBanner({
  title = "MPL Export Navigator",
  question = "Quelle decision export devez-vous securiser ?",
  compact = true,
  className,
}: TricolorBannerProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-full border border-blue-200/70 bg-gradient-to-r from-blue-700 via-blue-950 to-red-600 text-white shadow-sm",
        compact ? "px-4 py-2 md:px-6 md:py-2.5" : "p-7 md:p-10",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_10%,white,transparent_45%),radial-gradient(circle_at_80%_35%,white,transparent_40%)]" />
      <div className="relative flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
        <span>MPL Export Conseil</span>
        <span className="text-white/60">/</span>
        <span className="text-white">{title}</span>
        {question ? (
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.2em] text-white/65 sm:inline">
            • {question}
          </span>
        ) : null}
      </div>
    </section>
  );
}
