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
        "relative overflow-hidden rounded-3xl border border-blue-200/70 bg-gradient-to-r from-blue-700 via-blue-950 to-red-600 text-white shadow-sm",
        compact ? "px-5 py-4 md:px-7 md:py-5" : "p-7 md:p-10",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_10%,white,transparent_45%),radial-gradient(circle_at_80%_35%,white,transparent_40%)]" />
      <div className="relative flex flex-col gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
          MPL Export Conseil
        </div>
        <div className="text-lg font-semibold md:text-xl">{title}</div>
        {question ? (
          <div className="text-sm text-white/85">
            <span className="font-semibold">Question :</span> {question}
          </div>
        ) : null}
      </div>
    </section>
  );
}
