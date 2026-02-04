import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type BrandSize = "sm" | "md" | "lg";

type BrandLogoProps = {
  className?: string;
  href?: string;
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
  logoSrc?: string;
};

const sizeConfig: Record<BrandSize, { img: string; title: string; subtitle: string; location: string; gap: string }> = {
  sm: { img: "h-9", title: "text-sm", subtitle: "text-xs", location: "text-[11px]", gap: "gap-2" },
  md: { img: "h-12", title: "text-base", subtitle: "text-sm", location: "text-xs", gap: "gap-3" },
  lg: { img: "h-16 md:h-20", title: "text-lg", subtitle: "text-sm", location: "text-xs", gap: "gap-4" },
};

export function BrandLogo({
  className,
  href = "/",
  imageClassName,
  textClassName,
  titleClassName,
  subtitleClassName,
  locationClassName,
  showText = true,
  title = "MPL Conseil Export",
  subtitle = "Audit - Reglementation - Veille",
  location = "Conseil Export",
  size = "md",
  logoSrc = "/mpl-logo.svg",
}: BrandLogoProps) {
  const styles = sizeConfig[size];
  const sizePx = size === "sm" ? 36 : size === "md" ? 48 : 64;

  return (
    <Link to={href} className={cn("inline-flex items-center no-underline", styles.gap, className)} aria-label="Accueil MPL Conseil Export">
      <img
        src={logoSrc}
        alt="Logo MPL Conseil Export"
        width={sizePx}
        height={sizePx}
        className={cn(styles.img, "w-auto drop-shadow-lg shrink-0", imageClassName)}
        loading="eager"
        decoding="async"
      />
      {showText && (
        <div className={cn("flex flex-col leading-tight min-w-0", textClassName)}>
          <p className={cn(styles.title, "font-semibold text-foreground truncate", titleClassName)}>{title}</p>
          <p className={cn(styles.subtitle, "text-muted-foreground truncate", subtitleClassName)}>{subtitle}</p>
          <p className={cn(styles.location, "text-muted-foreground truncate", locationClassName)}>{location}</p>
        </div>
      )}
    </Link>
  );
}
