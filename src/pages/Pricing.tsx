import { Link } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";

type TierSlug = "FREE" | "PRO" | "VIP";

export default function Pricing() {
  const { t } = useI18n();
  const pricingMeta = (t("pricing") as {
    headline: string;
    subhead: string;
    description: string;
    cta: string;
    tiers: Record<
      TierSlug,
      {
        name: string;
        price: string;
        description: string;
        features: string[];
      }
    >;
  }) ?? {
    headline: "",
    subhead: "",
    description: "",
    cta: "Choisir",
    tiers: {
      FREE: { name: "FREE", price: "0 €", description: "", features: [] },
      PRO: { name: "PRO", price: "290 €/month", description: "", features: [] },
      VIP: { name: "VIP", price: "690 €/month", description: "", features: [] },
    },
  };

  const tierKeys: TierSlug[] = ["FREE", "PRO", "VIP"];

  return (
    <MarketingLayout>
      <section className="bg-[#0B1220] py-16 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">Export Navigator</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{pricingMeta.headline}</h1>
          <p className="mt-4 text-lg text-white/80">{pricingMeta.subhead}</p>
          <p className="mt-2 text-sm text-white/70">{pricingMeta.description}</p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {tierKeys.map((key) => {
              const tier = pricingMeta.tiers[key];
              return (
                <article
                  key={key}
                  className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-slate-200/70 bg-slate-50 p-6 shadow-xl"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-slate-500">{tier.name}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{tier.price}</p>
                    <p className="mt-3 text-sm text-slate-600">{tier.description}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {tier.features.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-[#1E3A8A]" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/contact"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#1E3A8A] px-4 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-[#162864]"
                  >
                    {pricingMeta.cta}
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
