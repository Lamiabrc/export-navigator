import React from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { RiskBadge } from "@/components/strategy/RiskBadge";
import { PageHeader } from "@/components/PageHeader";
import { sampleDecisionBrief } from "@/data/mockStrategyData";
import type { ScenarioResult } from "@/types/strategy";

type FormState = {
  market: string;
  channel: string;
  strategy: "premium" | "match" | "penetration";
  incoterm: string;
  logisticsCost: number;
  productCost: number;
  catalogPriceMetro?: number;
  vatPct?: number;
  octroiPct?: number;
  lpprMarkupPct?: number;
  targetPrice?: number;
};

const DROM_RULES: Record<string, { vatPct: number; octroiPct: number; lpprMarkupPct: number }> = {
  DROM: { vatPct: 8.5, octroiPct: 7, lpprMarkupPct: 8 },
  MQ: { vatPct: 8.5, octroiPct: 7, lpprMarkupPct: 8 },
  GP: { vatPct: 8.5, octroiPct: 7, lpprMarkupPct: 8 },
  RE: { vatPct: 8.5, octroiPct: 7, lpprMarkupPct: 8 },
  GF: { vatPct: 0, octroiPct: 0, lpprMarkupPct: 8 },
  YT: { vatPct: 0, octroiPct: 0, lpprMarkupPct: 8 },
};

export default function ScenarioLab() {
  const [search] = useSearchParams();
  const [form, setForm] = React.useState<FormState>({
    market: search.get("market") ?? "DROM",
    channel: search.get("channel") ?? "hospital",
    strategy: (search.get("strategy") as FormState["strategy"]) ?? "premium",
    incoterm: "DAP",
    logisticsCost: 12,
    productCost: 40,
    catalogPriceMetro: search.get("catalogPrice") ? Number(search.get("catalogPrice")) : 60,
    vatPct: DROM_RULES[search.get("market") ?? "DROM"]?.vatPct ?? 8.5,
    octroiPct: DROM_RULES[search.get("market") ?? "DROM"]?.octroiPct ?? 7,
    lpprMarkupPct: DROM_RULES[search.get("market") ?? "DROM"]?.lpprMarkupPct ?? 8,
    targetPrice: search.get("targetPrice") ? Number(search.get("targetPrice")) : undefined,
  });
  const [result, setResult] = React.useState<ScenarioResult | null>(null);
  const [showBrief, setShowBrief] = React.useState(false);

  const baseCost = form.productCost + form.logisticsCost;
  const marginTarget =
    form.strategy === "premium" ? 0.35 : form.strategy === "match" ? 0.25 : 0.18;

  const compute = () => {
    const dromRule = DROM_RULES[form.market] ?? DROM_RULES.DROM;
    const vat = form.vatPct ?? dromRule.vatPct;
    const octroi = form.octroiPct ?? dromRule.octroiPct;
    const lppr = form.lpprMarkupPct ?? dromRule.lpprMarkupPct;

    const metroBase =
      form.lpprBaseMetro && form.lpprBaseMetro > 0
        ? form.lpprBaseMetro
        : form.catalogPriceMetro && form.catalogPriceMetro > 0
          ? form.catalogPriceMetro
          : baseCost;

    // Applique d'abord la majoration LPPR sur le tarif métropole, puis les taxes locales (octroi + TVA)
    const baseWithLppr = metroBase * (1 + lppr / 100);
    const localizedBase = baseWithLppr * (1 + octroi / 100) * (1 + vat / 100);

    const recommendedPrice =
      form.targetPrice && form.targetPrice > 0
        ? form.targetPrice
        : Number((localizedBase * (1 + marginTarget)).toFixed(2));
    const margin = Number((recommendedPrice - baseCost).toFixed(2));
    const riskLevel: ScenarioResult["riskLevel"] =
      margin <= 0 || !form.market || !form.channel ? "high" : margin < 10 ? "medium" : "low";

    const rationale = [
      `Strategie: ${form.strategy}`,
      `Base coût (produit + logistique): €${baseCost.toFixed(2)}`,
      `Prix LPPR/catalogue métropole: €${metroBase.toFixed(2)}`,
      `Majoration LPPR appliquée: +${lppr}% => €${baseWithLppr.toFixed(2)}`,
      `Ajustements DROM: Octroi ${octroi}% + TVA locale ${vat}%`,
      `Base locale après LPPR + taxes: €${localizedBase.toFixed(2)}`,
      form.targetPrice ? "Prix cible imposé" : `Marge cible: ${(marginTarget * 100).toFixed(0)}%`,
    ];

    setResult({
      recommendedPrice,
      margin,
      riskLevel,
      rationale,
    });
    setShowBrief(false);
  };

  const handleChange = (field: keyof FormState, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [field]: typeof value === "string" && field !== "strategy" ? value : value,
    }));
  };

  return (
    <MainLayout>
      <PageHeader
        title="Scenario Lab"
        subtitle="Simuler une decision et obtenir une reco exploitable."
        actions={
          <button
            type="button"
            onClick={compute}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground border border-primary/60 shadow-lg shadow-primary/30"
          >
            Calculer
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4 dark:border-white/10 dark:bg-white/5">
          <h2 className="text-lg font-semibold text-foreground">Parametres</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Marché (DROM)</span>
              <select
                value={form.market}
                onChange={(e) => {
                  const next = e.target.value;
                  const rule = DROM_RULES[next];
                  setForm((prev) => ({
                    ...prev,
                    market: next,
                    vatPct: rule?.vatPct ?? prev.vatPct,
                    octroiPct: rule?.octroiPct ?? prev.octroiPct,
                    lpprMarkupPct: rule?.lpprMarkupPct ?? prev.lpprMarkupPct,
                  }));
                }}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              >
                <option value="DROM">DROM (générique)</option>
                <option value="MQ">Martinique (MQ)</option>
                <option value="GP">Guadeloupe (GP)</option>
                <option value="RE">Réunion (RE)</option>
                <option value="GF">Guyane (GF)</option>
                <option value="YT">Mayotte (YT)</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Canal</span>
              <input
                value={form.channel}
                onChange={(e) => handleChange("channel", e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Strategie</span>
              <select
                value={form.strategy}
                onChange={(e) => handleChange("strategy", e.target.value as FormState["strategy"])}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              >
                <option value="premium">Premium</option>
                <option value="match">Match</option>
                <option value="penetration">Penetration</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Incoterm</span>
              <input
                value={form.incoterm}
                onChange={(e) => handleChange("incoterm", e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Coût logistique (€)</span>
              <input
                type="number"
                value={form.logisticsCost}
                onChange={(e) => handleChange("logisticsCost", Number(e.target.value))}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Coût produit (€)</span>
              <input
                type="number"
                value={form.productCost}
                onChange={(e) => handleChange("productCost", Number(e.target.value))}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Prix catalogue métropole (HT)</span>
              <input
                type="number"
                value={form.catalogPriceMetro ?? ""}
                onChange={(e) => handleChange("catalogPriceMetro", Number(e.target.value))}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>TVA locale (%)</span>
              <input
                type="number"
                value={form.vatPct ?? ""}
                onChange={(e) => handleChange("vatPct", Number(e.target.value))}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
              <p className="text-[11px] text-muted-foreground">La TVA locale influence le remboursement LPPR.</p>
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Octroi de mer (%)</span>
              <input
                type="number"
                value={form.octroiPct ?? ""}
                onChange={(e) => handleChange("octroiPct", Number(e.target.value))}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Majoration LPPR (%)</span>
              <input
                type="number"
                value={form.lpprMarkupPct ?? ""}
                onChange={(e) => handleChange("lpprMarkupPct", Number(e.target.value))}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-muted-foreground">
              <span>Prix cible (optionnel)</span>
              <input
                type="number"
                value={form.targetPrice ?? ""}
                onChange={(e) =>
                  handleChange("targetPrice", e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Resultats</h2>
              {result && <RiskBadge level={result.riskLevel} />}
            </div>
            {result ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="text-2xl font-bold text-foreground">
                  Prix recommande: €{result.recommendedPrice.toFixed(2)}
                </div>
                <p>Marge estimee: €{result.margin.toFixed(2)}</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.rationale.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setShowBrief(true)}
                  className="mt-2 rounded-lg bg-primary/15 border border-primary/50 px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/25 transition"
                >
                  Generer note de decision
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Remplir le formulaire puis cliquer sur Calculer.
              </p>
            )}
          </div>

          {showBrief && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Note de decision (mock)</h3>
                <RiskBadge level="medium" />
              </div>
              <p className="text-sm text-muted-foreground">{sampleDecisionBrief.context}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-semibold text-foreground">Hypotheses</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {sampleDecisionBrief.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Options</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {sampleDecisionBrief.options.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground">Reco</h4>
                <p className="text-muted-foreground">{sampleDecisionBrief.recommendation}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-semibold text-foreground">Risques</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {sampleDecisionBrief.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Next actions</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {sampleDecisionBrief.nextActions.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
