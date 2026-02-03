import { useI18n } from "@/contexts/LanguageContext";

export function GdprGuarantee() {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
        {t("gdpr.guaranteeTitle")}
      </p>
      <p className="mt-2 text-sm text-slate-600">{t("gdpr.guaranteeBody")}</p>
    </div>
  );
}
