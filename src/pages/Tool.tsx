import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function ToolPage() {
  const { t } = useI18n();
  usePageMeta("meta.tool.title", "meta.tool.description");

  const features = (t("toolPage.list") as string[]) ?? [];
  const limitations = (t("toolPage.toolLimitationsList") as string[]) ?? [];
  const limitationsBody = (t("toolPage.toolLimitationsBody") as string) ?? "";
  const limitationsTitle = (t("toolPage.toolLimitationsTitle") as string) ?? "";
  const limitationsCta = (t("toolPage.toolLimitationsCta") as string) ?? "";
  const humanValidationCta = (t("toolPage.humanValidationCta") as string) ?? "";

  return (
    <MarketingLayout>
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.5em] text-white/60">{t("toolPage.subhead")}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-white md:text-5xl">
            {t("toolPage.headline")}
          </h1>
          <p className="mt-5 text-base text-white/70">{t("toolPage.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="rounded-full border border-white/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.5em] text-white transition hover:border-white"
            >
              {humanValidationCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm"
              >
                <p className="text-base font-semibold text-slate-900">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-6 rounded-3xl border border-slate-900/10 bg-slate-900/90 p-8 text-white shadow-lg md:p-12">
            <div>
              <h2 className="text-3xl font-semibold">{limitationsTitle}</h2>
              <p className="mt-3 max-w-3xl text-sm text-white/80">{limitationsBody}</p>
            </div>
            <ul className="space-y-3 text-sm text-white/90">
              {limitations.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-white" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/contact"
                className="rounded-full border border-white/80 px-5 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:border-white"
              >
                {humanValidationCta}
              </Link>
              <span className="text-xs uppercase tracking-[0.35em] text-white/70">{limitationsCta}</span>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
