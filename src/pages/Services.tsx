import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function ServicesPage() {
  const { t } = useI18n();
  usePageMeta("meta.services.title", "meta.services.description");

  const packs = (t("servicesPage.packs") as string[]) ?? [];

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-400">{t("servicesPage.subhead")}</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">{t("servicesPage.headline")}</h1>
          <p className="mt-4 text-base text-slate-700">{t("servicesPage.description")}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {packs.map((pack) => (
              <article
                key={pack}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-lg"
              >
                <p className="text-lg font-semibold text-slate-900">{pack}</p>
                <Link
                  to="/contact"
                  className="mt-8 inline-flex w-fit rounded-full border border-slate-900/20 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-900 transition hover:bg-slate-100"
                >
                  {t("servicesPage.cta")}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
