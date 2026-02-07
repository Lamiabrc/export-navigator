import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, FileText, ShieldAlert, BellRing } from "lucide-react";
import worldMap from "@/assets/world-map.svg";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

type Stat = {
  value: string;
  label: string;
};

type HeroCockpitProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets?: string[];
  primaryCta: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  stats?: Stat[];
  vipNote?: { label: string; to: string };
  className?: string;
};

export function HeroCockpit({
  eyebrow,
  title,
  subtitle,
  bullets = [],
  primaryCta,
  secondaryCta,
  stats = [],
  vipNote,
  className = "",
}: HeroCockpitProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section className={cn("mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden", className)}>
      <div className="mkt-container relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Content */}
          <div className="max-w-xl">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {eyebrow}
            </p>

            <h1 className="mkt-display mkt-display-xl mt-4 text-white">
              {title}
            </h1>

            <p className="mt-6 text-lg leading-relaxed" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {subtitle}
            </p>

            {bullets.length > 0 && (
              <ul className="mt-6 space-y-2">
                {bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/40 shrink-0" />
                    {bullet}
                  </li>
                ))}
              </ul>
            )}

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
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

            {/* VIP Note */}
            {vipNote && (
              <div className="mt-6">
                <Link
                  to={vipNote.to}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  {vipNote.label}
                </Link>
              </div>
            )}
          </div>

          {/* Media Mockup */}
          <div className="relative mx-auto w-full max-w-lg lg:mx-0">
            <div className="mkt-device aspect-[4/3] relative overflow-hidden">
              <div className="absolute inset-0">
                {prefersReducedMotion ? (
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: "url(/videos/hero-export.jpg)" }}
                    aria-hidden
                  />
                ) : (
                  <video
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster="/videos/hero-export.jpg"
                  >
                    <source src="/videos/hero-export.webm" type="video/webm" />
                    <source src="/videos/hero-export.mp4" type="video/mp4" />
                  </video>
                )}
              </div>

              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(6, 10, 20, 0.88) 0%, rgba(12, 20, 40, 0.72) 45%, rgba(6, 10, 20, 0.92) 100%)",
                }}
                aria-hidden
              />

              <div className="absolute inset-0 cinematic-map-glow opacity-60" aria-hidden />
              <img
                src={worldMap}
                alt=""
                className="pointer-events-none absolute -right-16 -top-12 w-[420px] opacity-40 mix-blend-screen"
              />

              <div className="relative z-10">
                <div className="mkt-device-header">
                  <div className="mkt-device-dot" />
                  <div className="mkt-device-dot" />
                  <div className="mkt-device-dot" />
                  <span className="ml-3 text-xs font-medium text-white/40">Export Cockpit</span>
                </div>
                <div className="mkt-device-content">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cost card */}
                    <div className="mkt-device-card">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="mkt-device-label">Coût rendu</span>
                      </div>
                      <p className="mkt-device-value">12 450 €</p>
                      <p className="mt-1 text-xs text-white/40">+droits +TVA</p>
                    </div>

                    {/* Documents card */}
                    <div className="mkt-device-card">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                        <span className="mkt-device-label">Documents</span>
                      </div>
                      <p className="mkt-device-value">5 requis</p>
                      <p className="mt-1 text-xs text-white/40">EUR.1, facture...</p>
                    </div>

                    {/* Risk card */}
                    <div className="mkt-device-card">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                        <span className="mkt-device-label">Risque</span>
                      </div>
                      <p className="mkt-device-value text-amber-400">Moyen</p>
                      <p className="mt-1 text-xs text-white/40">DDP, TVA import</p>
                    </div>

                    {/* Watch card */}
                    <div className="mkt-device-card">
                      <div className="flex items-center gap-2">
                        <BellRing className="h-3.5 w-3.5 text-purple-400" />
                        <span className="mkt-device-label">Veille VIP</span>
                      </div>
                      <p className="mkt-device-value">3 alertes</p>
                      <p className="mt-1 text-xs text-white/40">Réglementaire</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow effect */}
            <div
              className="pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full opacity-30"
              style={{
                background: "radial-gradient(circle, hsl(217 76% 46%), transparent 70%)",
              }}
            />
          </div>
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="mt-16 grid grid-cols-2 gap-8 border-t border-white/10 pt-12 md:grid-cols-3">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="mkt-display text-3xl font-medium text-white md:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

