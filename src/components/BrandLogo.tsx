import { cn } from "@/lib/utils";
import logoOrliman from "@/assets/logo-orliman.png";

type BrandSize = "sm" | "md" | "lg";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  locationClassName?: string;
  showText?: boolean;
  title?: string;
  subtitle?: string;
  location?: string;
  size?: BrandSize;
};

const sizeConfig: Record<BrandSize, { img: string; title: string; subtitle: string; location: string; gap: string }> = {
  sm: { img: "h-8", title: "text-sm", subtitle: "text-xs", location: "text-[11px]", gap: "gap-2" },
  md: { img: "h-10", title: "text-sm", subtitle: "text-xs", location: "text-[11px]", gap: "gap-3" },
  lg: { img: "h-12", title: "text-base", subtitle: "text-sm", location: "text-xs", gap: "gap-3" },
};

export function BrandLogo({
  className,
  imageClassName,
  textClassName,
  titleClassName,
  subtitleClassName,
  locationClassName,
  showText = true,
  title = "Export Navigator",
  subtitle = "Orliman France",
  location = "Lieu-dit de la Herbetaie, La Mézière (Bretagne)",
  size = "md",
}: BrandLogoProps) {
  const styles = sizeConfig[size];

  return (
    <div className={cn("flex items-center", styles.gap, className)}>
      <img
        src={logoOrliman}
        alt="Logo Orliman"
        className={cn(styles.img, "w-auto drop-shadow-sm shrink-0", imageClassName)}
        loading="lazy"
      />
      {showText && (
        <div className={cn("flex flex-col leading-tight min-w-0", textClassName)}>
          <p className={cn(styles.title, "font-semibold text-foreground truncate", titleClassName)}>{title}</p>
          <p className={cn(styles.subtitle, "text-muted-foreground truncate", subtitleClassName)}>{subtitle}</p>
          <p className={cn(styles.location, "text-muted-foreground truncate", locationClassName)}>{location}</p>
        </div>
      )}
    </div>
  );
}
