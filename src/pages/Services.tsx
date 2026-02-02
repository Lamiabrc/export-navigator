import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useResolvedPricing, TierSlug } from "@/hooks/useResolvedPricing";

export default function ServicesPage() {
  const { t } = useI18n();
  usePageMeta("meta.services.title", "meta.services.description");

  const { resolved, tierKeys } = useResolvedPricing(t);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            {t("servicesPage.subhead")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-950 sm:text-5xl">
            {t("servicesPage.headline")}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-700 sm:text-lg">
            {t("servicesPage.description")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-sm transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Voir les tarifs
            </Link>

            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {t("servicesPage.cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* TIERS SUMMARY (source unique = pricing) */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {tierKeys.map((key: TierSlug) => {
              const tier = resolved.tiers[key];
              const isPrimary = key === "PRO";
              const topFeatures = tier.features.slice(0, 3);

              return (
                <article
                  key={key}
                  className={[
                    "flex flex-col justify-between rounded-3xl border p-7 shadow-sm transition hover:shadow-lg",
                    isPrimary ? "border-slate-900/20 bg-white ring-1 ring-slate-900/10" : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
                        {tier.name}
                      </p>
                      {isPrimary && (
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white">
                          Recommandé
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-3xl font-semibold text-slate-950">{tier.price}</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{tier.description}</p>

                    <div className="mt-5 h-px w-full bg-slate-100" />

                    <ul className="mt-5 space-y-2 text-sm text-slate-700">
                      {topFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-2 h-2 w-2 rounded-full bg-slate-900" aria-hidden />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {key === "VIP" && (
                      <p className="mt-4 text-xs text-slate-500">
                        Veille premium : VIP uniquement.
                      </p>
                    )}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to={`/pricing#${key}`}
                      className={[
                        "inline-flex w-fit items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] transition",
                        isPrimary ? "bg-slate-950 text-white hover:bg-slate-900" : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      Voir le détail →
                    </Link>

                    <Link
                      to="/contact"
                      className="inline-flex w-fit items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600 transition hover:text-slate-900"
                    >
                      {resolved.cta}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
