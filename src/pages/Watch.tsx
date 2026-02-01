import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function WatchPage() {
  const { t } = useI18n();
  usePageMeta("meta.watch.title", "meta.watch.description");

  const cards = (t("watchPage.cards") as Array<{ title: string; detail: string }>) ?? [];

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-400">{t("watchPage.subhead")}</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">{t("watchPage.headline")}</h1>
          <p className="mt-4 text-base text-slate-700">{t("watchPage.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="rounded-full border border-slate-900/20 bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-slate-800"
            >
              {t("watchPage.cta")}
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl space-y-6 px-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-md"
            >
              <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
