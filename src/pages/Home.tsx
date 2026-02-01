import { Link } from "react-router-dom";

import heroVideo from "@/assets/hero-export.mp4";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Home() {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  usePageMeta("meta.home.title", "meta.home.description");

  const whoCards = (t("sections.whoCards") as string[]) ?? [];
  const toolSteps = (t("sections.toolSteps") as string[]) ?? [];
  const limitations = (t("sections.limitations") as string[]) ?? [];
  const consultingPacks = ((t("sections.consultingPacks") as Array<{ name: string; detail: string }>) ?? []).slice(0, 3);
  const faqItems = ((t("sections.faqItems") as Array<{ question: string; answer: string }>) ?? []).slice(0, 5);
  const finalCtaTitle = t("sections.finalCtaTitle") as string;
  const finalCtaParagraph = t("sections.finalCtaParagraph") as string;
  const finalCtaButton = t("sections.finalCtaButton") as string;
  const consultingPriceLabel = (t("sections.consultingPrice") as string) ?? "";
  const limitationsSummary = (t("toolPage.toolLimitationsBody") as string) ?? "";
  const humanValidationCta = (t("toolPage.humanValidationCta") as string) ?? "";

  return (
    <MarketingLayout>
      <section className="relative min-h-[80vh] overflow-hidden text-white">
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
            <div className="h-full w-full bg-slate-900" aria-hidden />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" aria-hidden />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center gap-6 px-6 pb-24 text-center">
          <p className="text-xs uppercase tracking-[0.75em] text-white/60">{t("hero.brandLabel")}</p>
          <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">{t("hero.title")}</h1>
          <p className="max-w-3xl text-lg text-white/80">{t("hero.subtitle")}</p>
          <p className="max-w-3xl text-base text-white/70">{t("hero.paragraph")}</p>

          <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold uppercase tracking-wide">
            <Link
              to="/tool"
              className="rounded-full bg-white px-6 py-3 text-slate-900 transition hover:bg-slate-100"
            >
              {t("hero.ctaPrimary")}
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-white/70 px-6 py-3 text-white transition hover:border-white/90 hover:text-white"
            >
              {t("hero.ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>

      <section id="who" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-8 text-3xl font-semibold text-slate-900">{t("sections.whoTitle")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {whoCards.map((item) => (
              <article
                key={item}
                className="rounded-2xl border border-slate-200/80 bg-slate-50 p-6 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.4)]"
              >
                <p className="text-base font-semibold text-slate-900">{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tool" className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-6 text-3xl font-semibold text-slate-900">{t("sections.toolTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {toolSteps.map((step) => (
              <div
                key={step}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-slate-900" aria-hidden />
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="limitations" className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-6 rounded-3xl border border-slate-900/10 bg-slate-900/80 p-10 text-white shadow-xl md:flex-row">
            <div className="flex-1">
              <h3 className="text-3xl font-semibold">{t("sections.limitationsTitle")}</h3>
              <ul className="mt-6 space-y-3 text-sm">
                {limitations.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-white" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between gap-4 text-sm">
              <p className="text-white/80">{limitationsSummary}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/contact"
                  className="rounded-full border border-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:border-white"
                >
                  {humanValidationCta}
                </Link>
                <span className="text-xs uppercase tracking-[0.4em] text-white/70">
                  {t("sections.limitationsCta")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.5em] text-slate-500">{t("sections.consultingTitle")}</p>
            <p className="mt-3 max-w-3xl text-lg text-slate-700">{t("sections.consultingDescription")}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {consultingPacks.map((pack) => (
              <article
                key={pack.name}
                className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_15px_40px_-22px_rgba(15,23,42,0.6)]"
              >
                <div>
                  <p className="text-xl font-semibold text-slate-900">{pack.name}</p>
                  <p className="mt-3 text-sm text-slate-600">{pack.detail}</p>
                </div>
                <p className="mt-6 text-xs uppercase tracking-[0.4em] text-slate-500">{consultingPriceLabel}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-8 text-3xl font-semibold text-slate-900">{t("sections.faqTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700"
              >
                <summary className="cursor-pointer font-semibold text-slate-900">{item.question}</summary>
                <p className="mt-3 text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="final-cta" className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-3xl border border-slate-900/10 bg-gradient-to-r from-slate-900 to-slate-800 p-10 text-white shadow-2xl">
            <div className="space-y-6 text-center">
              <p className="text-xl font-semibold">{finalCtaTitle}</p>
              <p className="text-sm text-white/80">{finalCtaParagraph}</p>
              <Link
                to="/contact"
                className="mx-auto inline-flex rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.6em] text-slate-900 transition hover:bg-slate-100"
              >
                {finalCtaButton}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
