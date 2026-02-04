import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { useI18n } from "@/contexts/LanguageContext";
import { usePlan, type SubscriptionPlan } from "@/auth/PlanContext";

export const RequirePlan = ({
  minPlan,
  children,
}: {
  minPlan: SubscriptionPlan;
  children: ReactNode;
}) => {
  const { canAccess, loading } = usePlan();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16 text-center text-sm text-slate-500">
        Chargement du plan...
      </div>
    );
  }

  if (canAccess(minPlan)) {
    return <>{children}</>;
  }

  const planLabel = (t(`gating.planLabels.${minPlan}`) as string) ?? minPlan;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-3xl rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.5em] text-slate-500">{planLabel}</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">{t("gating.title")}</h1>
        <p className="mt-4 text-sm text-slate-600">{t("gating.body")}</p>
        <Link
          to="/pricing"
          className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-slate-800"
        >
          {t("gating.cta")}
        </Link>
      </div>
    </div>
  );
};
