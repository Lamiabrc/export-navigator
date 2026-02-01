import { useMemo, useState } from "react";

import { Link } from "react-router-dom";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { RequirePlan } from "@/components/RequirePlan";
import { useI18n } from "@/contexts/LanguageContext";
import { usePlan } from "@/auth/PlanContext";
import { recordSimulation, getQuotaUsage, getQuotaLimit } from "@/lib/quota";
import { saveHistory } from "@/lib/history";

export default function ExportCostingPage() {
  const { t } = useI18n();
  const { plan } = usePlan();

  const meta = (t("exportCosting") as {
    title: string;
    subtitle: string;
    summaryLabel: string;
    profitabilityTitle: string;
    profitabilitySubtitle: string;
    sensitivityLabel: string;
    cta: string;
  }) ?? {
    title: "",
    subtitle: "",
    summaryLabel: "",
    profitabilityTitle: "",
    profitabilitySubtitle: "",
    sensitivityLabel: "",
    cta: "Lancer la simulation",
  };

  const [values, setValues] = useState({
    goods: 12000,
    transport: 1500,
    insurance: 400,
    handling: 250,
    other: 180,
    dutiesPercent: 5,
    vatPercent: 20,
    salePrice: 18000,
  });
  const [status, setStatus] = useState<string | null>(null);

  const baseCost = values.goods + values.transport + values.insurance + values.handling + values.other;
  const duties = (values.goods * (values.dutiesPercent || 0)) / 100;
  const vat = (baseCost + duties) * ((values.vatPercent || 0) / 100);
  const landedCost = baseCost + duties + vat;
  const profit = values.salePrice - landedCost;
  const margin = values.salePrice ? (profit / values.salePrice) * 100 : 0;
  const breakEven = landedCost > values.salePrice;
  const freightImpact = values.transport * 0.2;
  const dutyImpact = values.goods * 0.1;

  const formatQuotaMessage = () => {
    const template = (t("quotas.usage") as string) ?? "";
    const usage = getQuotaUsage(plan);
    const limit = getQuotaLimit(plan);
    return template.replace("%s", String(usage)).replace("%s", String(limit));
  };

  const handleRecord = () => {
    const usage = getQuotaUsage(plan);
    const limit = getQuotaLimit(plan);
    if (usage >= limit) {
      setStatus(t("quotas.limitReached") as string);
      return;
    }

    const result = recordSimulation(plan);
    saveHistory(plan, {
      title: "Simulation export",
      summary: `Coût ${landedCost.toFixed(0)} €, marge ${margin.toFixed(1)}%`,
      landedCost,
      score: Math.round(margin),
    });
    setStatus(`Simulation enregistrée (${result.usage}/${result.limit})`);
  };

  return (
    <MarketingLayout>
      <section className="bg-[#0B1220] py-16 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">Export Costing</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{meta.title}</h1>
          <p className="mt-4 text-sm text-white/80">{meta.subtitle}</p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-xl">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "Coût produits", value: "goods" },
                  { label: "Transport", value: "transport" },
                  { label: "Assurance", value: "insurance" },
                  { label: "Manutention", value: "handling" },
                  { label: "Autres", value: "other" },
                ].map((field) => (
                  <label key={field.value} className="space-y-2 text-sm text-slate-500">
                    {field.label}
                    <input
                      type="number"
                      min={0}
                      value={(values as Record<string, number>)[field.value]}
                      onChange={(event) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.value]: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-500">
                  Droits (%)
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={values.dutiesPercent}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, dutiesPercent: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-500">
                  TVA (%)
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={values.vatPercent}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, vatPercent: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-500">
                Prix de vente souhaité
                <input
                  type="number"
                  min={0}
                  value={values.salePrice}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, salePrice: Number(event.target.value) }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-900/95 p-6 text-white shadow-2xl">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">{meta.summaryLabel}</p>
                <h2 className="mt-2 text-4xl font-semibold text-white">{landedCost.toFixed(0)} €</h2>
                <p className="text-xs text-white/60">
                  {baseCost.toFixed(0)} € + {duties.toFixed(0)} € droits + {vat.toFixed(0)} € TVA
                </p>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/5 p-5 text-left text-sm text-white/80">
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">{meta.profitabilityTitle}</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Marge {margin.toFixed(1)}% ·{" "}
                  {breakEven ? "Sous seuil" : "Au-dessus du seuil"}
                </p>
                <p className="text-xs">{meta.profitabilitySubtitle}</p>
              </div>

              <RequirePlan minPlan="VIP">
                <div className="rounded-2xl border border-white/20 bg-white/5 p-5 text-sm text-white/80">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">{meta.sensitivityLabel}</p>
                  <p className="mt-2 text-sm text-white/80">
                    Variation fret ±20% : {Math.max(0, landedCost - freightImpact).toFixed(0)} € —
                    {(landedCost + freightImpact).toFixed(0)} €
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Variation droits +10% : {(landedCost + dutyImpact).toFixed(0)} €
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Profit actuel : {profit.toFixed(0)} € (objectif {values.salePrice.toFixed(0)} €)
                  </p>
                </div>
              </RequirePlan>

              <p className="text-xs uppercase tracking-[0.3em] text-white/60">{formatQuotaMessage()}</p>
              <button
                type="button"
                onClick={handleRecord}
                className="w-full rounded-full bg-[#DC2626] px-4 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-[#b0231d]"
              >
                {meta.cta}
              </button>
              {status && <p className="text-center text-xs text-white/70">{status}</p>}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
