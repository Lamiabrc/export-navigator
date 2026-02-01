import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function AboutPage() {
  const { t } = useI18n();
  usePageMeta("meta.about.title", "meta.about.description");

  const highlights = (t("aboutPage.list") as string[]) ?? [];

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="text-4xl font-semibold text-slate-900">{t("aboutPage.headline")}</h1>
          <p className="mt-4 text-base text-slate-700">{t("aboutPage.body")}</p>
          <div className="mt-10 space-y-3">
            {highlights.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-900" aria-hidden />
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              to="/contact"
              className="rounded-full border border-slate-900/20 bg-slate-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-slate-800"
            >
              {t("sections.finalCtaButton")}
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
