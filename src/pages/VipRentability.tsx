import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";

export default function VipRentability() {
  const { t } = useI18n();
  const meta = (t("exportCosting") as {
    title: string;
    subtitle: string;
    profitabilityTitle: string;
  }) ?? { title: "VIP Rentabilité", subtitle: "", profitabilityTitle: "" };

  return (
    <MarketingLayout>
      <section className="bg-gradient-to-b from-[#1E3A8A] to-[#0B1220] py-20 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-white/70">VIP</p>
          <h1 className="mt-3 text-4xl font-semibold">{meta.title}</h1>
          <p className="mt-4 text-sm text-white/80">{meta.subtitle}</p>
          <p className="mt-6 text-sm text-white/70">
            Rentabilité, seuil et sensibilité sont présentés avec des scénarios (variation fret/taux ou droits) et des recommandations.
          </p>
          <Link
            to="/pricing"
            className="mt-8 inline-flex items-center justify-center rounded-full border border-white/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:border-white"
          >
            {t("gating.cta")}
          </Link>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6 space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">{meta.profitabilityTitle}</h2>
          <p className="text-sm text-slate-600">
            La version VIP présente la marge brute, les seuils critiques, la sensibilité fret/taux/droits et des recommandations contractuelles.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <article className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <h3 className="text-sm uppercase tracking-[0.4em] text-slate-500">Marge</h3>
              <p className="text-lg font-semibold text-slate-900">Calculée en temps réel avec vos frais et prix projetés.</p>
            </article>
            <article className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <h3 className="text-sm uppercase tracking-[0.4em] text-slate-500">Sensibilité</h3>
              <p className="text-lg font-semibold text-slate-900">
                Scénarios +10% fret, +5% droits, +2 points TVA pour anticiper les risques.
              </p>
            </article>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
