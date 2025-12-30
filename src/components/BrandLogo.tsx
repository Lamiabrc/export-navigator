import { cn } from "@/lib/utils";
import logoOrliman from "@/assets/logo-orliman.png";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  title?: string;
  subtitle?: string;
  location?: string;
  textClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  locationClassName?: string;
};

export function BrandLogo({
  className,
  imageClassName,
  showText = true,
  title = "Export Navigator",
  subtitle = "Orliman France",
  location = "Lieu-dit de la Herbetaie, La Mézière (Bretagne)",
  textClassName,
  titleClassName,
  subtitleClassName,
  locationClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoOrliman}
        alt="Logo Orliman"
        className={cn("h-10 w-auto drop-shadow-sm shrink-0", imageClassName)}
        loading="lazy"
      />

      {showText && (
        <div className={cn("flex flex-col leading-tight min-w-0", textClassName)}>
          <p className={cn("text-sm font-semibold text-foreground truncate", titleClassName)}>
            {title}
          </p>
          <p className={cn("text-xs text-muted-foreground truncate", subtitleClassName)}>
            {subtitle}
          </p>
          <p className={cn("text-[11px] text-muted-foreground truncate", locationClassName)}>
            {location}
          </p>
        </div>
      )}
    </div>
  );
}
