import { Link } from "react-router-dom";

import heroVideo from "@/assets/hero-export.mp4";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { usePageMeta } from "@/hooks/usePageMeta";

type FeatureCard = { title: string; description: string };

export default function Home() {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  usePageMeta("meta.home.title", "meta.home.description");

  const heroTitle = (t("heroLanding.title") as string) ?? "";
  const heroSubtitle = (t("heroLanding.subtitle") as string) ?? "";
  const heroPrimary = (t("heroLanding.ctaPrimary") as string) ?? "Lancer";
  const heroSecondary = (t("heroLanding.ctaSecondary") as string) ?? "Voir les offres";
  const featureCards = (t("heroLanding.featureCards") as FeatureCard[]) ?? [];

  return (
    <MarketingLayout>
      <section className="relative min-h-[85vh] overflow-hidden text-white">
        <div className="absolute inset-0">
          {!prefersReducedMotion ? (
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              src={heroVideo}
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#0B1220] via-[#1E3A8A] to-[#0B1220]"
              aria-hidden
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B1220]/90 via-[#0B1220]/80 to-[#0B1220]/90" aria-hidden />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[85vh] max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.7em] text-white/60">Export Navigator</p>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {heroTitle}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-white/80 md:text-xl">{heroSubtitle}</p>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold uppercase tracking-[0.35em] md:text-sm">
            <Link
              to="/tool"
              className="rounded-full bg-[#DC2626] px-7 py-3 text-white transition hover:bg-[#b0231d]"
            >
              {heroPrimary}
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-white/80 px-7 py-3 text-white transition hover:border-white"
            >
              {heroSecondary}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-sm uppercase tracking-[0.6em] text-[#1E3A8A]">Focus</h2>
          <p className="mt-2 text-3xl font-semibold text-[#0B1220]">Vue claire, décisions rapides</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-xl"
              >
                <h3 className="text-xl font-semibold text-[#1E3A8A]">{card.title}</h3>
                <p className="text-sm text-slate-600">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-sm uppercase tracking-[0.5em] text-slate-500">Étapes suivantes</p>
          <h3 className="mt-3 text-3xl font-semibold text-slate-900">Besoin d’un expert ?</h3>
          <p className="mt-2 text-slate-600">
            L’outil vous donne un premier aperçu, la consultante confirme les cas complexes, TVA, DDP et conformité.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/import/check-invoice"
              className="rounded-full bg-[#1E3A8A] px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-[#162864]"
            >
              Vérifier une facture
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-[#1E3A8A]/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-[#1E3A8A] transition hover:border-[#1E3A8A]"
            >
              Parler à la consultante
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
