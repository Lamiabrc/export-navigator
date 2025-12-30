import { cn } from "@/lib/utils";
import logoOrliman from "@/assets/logo-orliman.png";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  withText?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function BrandLogo({
  className,
  imageClassName,
  withText = true,
  titleClassName,
  subtitleClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoOrliman}
        alt="Logo Orliman"
        className={cn("h-10 w-auto drop-shadow-sm", imageClassName)}
        loading="lazy"
      />

      {withText && (
        <div className="leading-tight">
          <p className={cn("text-sm font-semibold text-foreground", titleClassName)}>Export Navigator</p>
          <p className={cn("text-xs text-muted-foreground", subtitleClassName)}>Orliman</p>
        </div>
      )}
    </div>
  );
}
