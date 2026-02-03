import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useResolvedPricing, TierSlug } from "@/hooks/useResolvedPricing";

export default function ServicesPage() {
  const { t } = useI18n();
  usePageMeta("meta.services.title", "meta.services.description");

  const { resolved, tierKeys } = useResolvedPricing(t);

  // Fallback FR/EN robuste même si certaines clés i18n n'existent pas encore
  const lang =
    typeof document !== "undefined" && document.documentElement?.lang
      ? document.documentElement.lang.toLowerCase()
      : "fr";
  const isEn = lang.startsWith("en");

  const tt = (key: string, frFallback: string, enFallback: string) => {
    const fallback = isEn ? enFallback : frFallback;
    try {
      const v = t(key as any);
      return !v || v === key ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const keys =
    tierKeys?.length
      ? tierKeys
      : (Object.keys(resolved?.tiers ?? {}) as TierSlug[]);

  const primaryKey = (keys.find((k) => k === "PRO") ?? keys[0]) as TierSlug;

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

          {/* Proof bullets (département export digital) */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: tt(
                  "servicesPage.proof.adv.title",
                  "ADV export",
                  "Export ops"
                ),
                desc: tt(
                  "servicesPage.proof.adv.desc",
                  "Checklists documentaires, rapports PDF, préparation standardisée.",
                  "Document checklists, PDF reports, standardized prep."
                ),
              },
              {
                title: tt(
                  "servicesPage.proof.manager.title",
                  "Responsable export / ADV",
                  "Export manager"
                ),
                desc: tt(
                  "servicesPage.proof.manager.desc",
                  "Pilotage, historique, règles communes, partage simple avec l’équipe.",
                  "Tracking, history, shared rules, easy team handoff."
                ),
              },
              {
                title: tt(
                  "servicesPage.proof.consultant.title",
                  "Consultant export (tâches récurrentes)",
                  "Export consultant (recurring tasks)"
                ),
                desc: tt(
                  "servicesPage.proof.consultant.desc",
                  "Cadrage basique, synthèse, documents prêts à valider et diffuser.",
                  "Basic framing, summaries, ready-to-share documents."
                ),
              },
              {
                title: tt(
                  "servicesPage.proof.watch.title",
                  "Veille & conformité",
                  "Compliance watch"
                ),
                desc: tt(
                  "servicesPage.proof.watch.desc",
                  "Flux RSS, filtres, tags, et digest automatique selon votre plan.",
                  "RSS feeds, filters, tags, and automated digest (plan-based)."
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-sm transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {tt("servicesPage.cta.pricing", "Voir les tarifs", "See pricing")}
            </Link>

            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {t("servicesPage.cta")}
            </Link>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-500">
            {tt(
              "servicesPage.disclaimer",
              "Indications non contractuelles — ne remplace pas un agent en douane/commissionnaire. Vous restez responsable de la conformité finale.",
              "Non-binding information — does not replace a customs broker. You remain responsible for final compliance."
            )}
          </p>
        </div>
      </section>

      {/* TIERS SUMMARY (source unique = pricing) */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {keys.map((key: TierSlug) => {
              const tier = resolved?.tiers?.[key];
              if (!tier) return null;

              const isPrimary = key === primaryKey;
              const features = Array.isArray(tier.features) ? tier.features : [];
              const topFeatures = features.slice(0, 4);

              return (
                <article
                  key={key}
                  className={[
                    "flex flex-col justify-between rounded-3xl border p-7 shadow-sm transition hover:shadow-lg",
                    isPrimary
                      ? "border-slate-900/20 bg-white ring-1 ring-slate-900/10"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
                        {tier.name}
                      </p>

                      {isPrimary && (
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white">
                          {tt(
                            "servicesPage.badge.recommended",
                            "Recommandé",
                            "Recommended"
                          )}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-3xl font-semibold text-slate-950">{tier.price}</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {tier.description}
                    </p>

                    <div className="mt-5 h-px w-full bg-slate-100" />

                    <ul className="mt-5 space-y-2 text-sm text-slate-700">
                      {topFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-2 h-2 w-2 rounded-full bg-slate-900" aria-hidden />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to={`/pricing#${key}`}
                      className={[
                        "inline-flex w-fit items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] transition",
                        isPrimary
                          ? "bg-slate-950 text-white hover:bg-slate-900"
                          : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {tt(
                        "servicesPage.cta.details",
                        "Voir le détail",
                        "View details"
                      )}{" "}
                      →
                    </Link>

                    <Link
                      to="/contact"
                      className="inline-flex w-fit items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600 transition hover:text-slate-900"
                    >
                      {resolved?.cta ?? t("servicesPage.cta")}
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
