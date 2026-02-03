import { useMemo, useState } from "react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePlan } from "@/auth/PlanContext";
import { recordSimulation, getQuotaUsage, getQuotaLimit } from "@/lib/quota";
import { saveHistory } from "@/lib/history";

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

const defaultLines: LineItem[] = [
  { description: "Produit modèle", quantity: 1, unitPrice: 0 },
];

export default function ImportCheckInvoice() {
  const { t } = useI18n();
  const { plan } = usePlan();

  const [invoice, setInvoice] = useState({
    currency: "EUR",
    supplierCountry: "",
    incoterm: "EXW",
    invoiceTotal: "",
  });
  const [lines, setLines] = useState<LineItem[]>(defaultLines);
  const [ancillaries, setAncillaries] = useState({
    freight: 0,
    insurance: 0,
    handling: 0,
    storage: 0,
    other: 0,
  });
  const [taxes, setTaxes] = useState({ dutiesPercent: 5, vatPercent: 20 });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const featureTranslationsRaw = t("importWizard");
  const featureTranslations = (typeof featureTranslationsRaw === "object" && featureTranslationsRaw !== null
    ? (featureTranslationsRaw as unknown as {
        title?: string;
        subtitle?: string;
        steps?: string[];
        scoreLabel?: string;
        resultLabel?: string;
        warningsTitle?: string;
        actionsTitle?: string;
        saveButton?: string;
        usageLabel?: string;
        warnings?: Record<string, string>;
        actions?: Record<string, string>;
      })
    : {}) as {
    title: string;
    subtitle: string;
    steps: string[];
    scoreLabel: string;
    resultLabel: string;
    warningsTitle: string;
    actionsTitle: string;
    saveButton: string;
    usageLabel: string;
    warnings: Record<string, string>;
    actions: Record<string, string>;
  };

  const goodsTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  );
  const declaredTotal = Number(invoice.invoiceTotal) || goodsTotal;
  const ancillaryTotal = Object.values(ancillaries).reduce((sum, value) => sum + Number(value || 0), 0);
  const duties = (goodsTotal * (taxes.dutiesPercent || 0)) / 100;
  const vat = (goodsTotal + ancillaryTotal + duties) * ((taxes.vatPercent || 0) / 100);
  const landedCost = goodsTotal + ancillaryTotal + duties + vat;
  const rangeMin = landedCost * 0.92;
  const rangeMax = landedCost * 1.08;

  const warnings = useMemo<string[]>(() => {
    const list: string[] = [];
    if (!invoice.supplierCountry) {
      list.push((t("importWizard.warnings.missingSupplier") as string) ?? "Fournisseur manquant");
    }
    if (!invoice.incoterm) {
      list.push((t("importWizard.warnings.missingIncoterm") as string) ?? "Incoterm absent");
    }
    if (lines.some((line) => line.quantity <= 0 || line.unitPrice <= 0)) {
      list.push((t("importWizard.warnings.lowUnitPrice") as string) ?? "Prix unitaire bas");
    }
    if (Math.abs(declaredTotal - goodsTotal) > goodsTotal * 0.05) {
      list.push((t("importWizard.warnings.mismatchTotals") as string) ?? "Totaux incohérents");
    }
    if (
      ["EXW", "FCA"].includes(invoice.incoterm.toUpperCase()) &&
      Number(ancillaries.freight || 0) > 0
    ) {
      list.push((t("importWizard.warnings.unexpectedFreight") as string) ?? "Frais logistiques déjà inclus");
    }
    return list;
  }, [invoice, lines, ancillaries, declaredTotal, goodsTotal, t]);

  const score = useMemo(() => {
    let value = 100;
    value -= warnings.length * 10;
    value -= invoice.currency ? 0 : 5;
    return Math.max(0, Math.min(100, Math.round(value)));
  }, [warnings, invoice.currency]);

  const formatQuotaMessage = () => {
    const template = (t("quotas.usage") as string) ?? "";
    const usage = getQuotaUsage(plan);
    const limit = getQuotaLimit(plan);
    return template.replace("%s", String(usage)).replace("%s", String(limit));
  };

  const handleSave = () => {
    const usage = getQuotaUsage(plan);
    const limit = getQuotaLimit(plan);
    if (usage >= limit) {
      setStatusMessage(t("quotas.limitReached") as string);
      return;
    }

    const result = recordSimulation(plan);
    saveHistory(plan, {
      title: `Facture ${invoice.incoterm}`,
      summary: `Fournisseur ${invoice.supplierCountry || "à renseigner"}, ${lines.length} lignes`,
      score,
      landedCost,
    });

    setStatusMessage(`Simulation enregistrée (${result.usage}/${result.limit})`);
  };

  const addLine = () => setLines((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  const updateLine = (index: number, field: keyof LineItem, value: string | number) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, [field]: field === "description" ? value : Number(value) } : line,
      ),
    );
  };

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-[#1E3A8A]">Import Checker</p>
          <h1 className="mt-3 text-4xl font-semibold text-[#0B1220]">{featureTranslations.title}</h1>
          <p className="mt-4 text-sm text-slate-600">{featureTranslations.subtitle}</p>
        </div>

        <div className="mx-auto mt-10 max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-lg">
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-500">
                  Devise
                  <input
                    value={invoice.currency}
                    onChange={(event) =>
                      setInvoice((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-500">
                  Pays fournisseur
                  <input
                    value={invoice.supplierCountry}
                    onChange={(event) =>
                      setInvoice((prev) => ({ ...prev, supplierCountry: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>

              <div className="space-y-2 text-sm text-slate-500">
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Incoterm
                </label>
                <select
                  value={invoice.incoterm}
                  onChange={(event) => setInvoice((prev) => ({ ...prev, incoterm: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {["EXW", "FCA", "CPT", "DAP", "DDP"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-slate-500">
                  <span>Lignes de facture</span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="rounded-full border border-slate-200 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-600"
                  >
                    Ajouter
                  </button>
                </div>
                <div className="space-y-4">
                  {lines.map((line, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-3">
                      <input
                        placeholder="Description"
                        value={line.description}
                        onChange={(event) => updateLine(index, "description", event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <input
                        type="number"
                        min={0}
                        value={line.quantity}
                        onChange={(event) => updateLine(index, "quantity", Number(event.target.value))}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <input
                        type="number"
                        min={0}
                        value={line.unitPrice}
                        onChange={(event) => updateLine(index, "unitPrice", Number(event.target.value))}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 md:grid-cols-2">
                <label className="space-y-2">
                  Fret estimé
                  <input
                    type="number"
                    min={0}
                    value={ancillaries.freight}
                    onChange={(event) =>
                      setAncillaries((prev) => ({ ...prev, freight: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  Assurance
                  <input
                    type="number"
                    min={0}
                    value={ancillaries.insurance}
                    onChange={(event) =>
                      setAncillaries((prev) => ({ ...prev, insurance: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  Manutention
                  <input
                    type="number"
                    min={0}
                    value={ancillaries.handling}
                    onChange={(event) =>
                      setAncillaries((prev) => ({ ...prev, handling: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  Stockage & autres
                  <input
                    type="number"
                    min={0}
                    value={ancillaries.storage}
                    onChange={(event) =>
                      setAncillaries((prev) => ({ ...prev, storage: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-500">
                  Droits (%){" "}
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={taxes.dutiesPercent}
                    onChange={(event) =>
                      setTaxes((prev) => ({ ...prev, dutiesPercent: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-500">
                  TVA (%){" "}
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={taxes.vatPercent}
                    onChange={(event) =>
                      setTaxes((prev) => ({ ...prev, vatPercent: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-500">
                Total déclaré
                <input
                  type="number"
                  min={0}
                  value={invoice.invoiceTotal}
                  onChange={(event) =>
                    setInvoice((prev) => ({ ...prev, invoiceTotal: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-900/95 p-6 text-white shadow-2xl">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.7em] text-white/60">{featureTranslations.scoreLabel}</p>
                <div className="flex items-center justify-center">
                  <span className="text-5xl font-bold">{score}</span>
                  <span className="ml-3 text-sm text-white/70">/100</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/5 p-4 text-sm text-white/80">
                <p className="text-xs uppercase tracking-[0.5em] text-white/50">{featureTranslations.resultLabel}</p>
                <p className="mt-2 text-3xl font-semibold">{landedCost.toFixed(0)} €</p>
                <p className="text-xs text-white/60">
                  {rangeMin.toFixed(0)} € — {rangeMax.toFixed(0)} €
                </p>
                <ul className="mt-4 space-y-1 text-xs text-white/70">
                  <li>Marchandises : {goodsTotal.toFixed(0)} €</li>
                  <li>Annexes : {ancillaryTotal.toFixed(0)} €</li>
                  <li>Droits : {duties.toFixed(0)} € · TVA : {vat.toFixed(0)} €</li>
                </ul>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/20 bg-white/5 p-4 text-left text-sm text-white/80">
                <p className="text-xs uppercase tracking-[0.5em] text-white/50">{featureTranslations.warningsTitle}</p>
                <ul className="space-y-2">
                  {warnings.length === 0 ? (
                    <li className="text-white/70">Aucune alerte détectée.</li>
                  ) : (
                    warnings.map((warning) => (
                      <li key={warning} className="text-white/80">
                        • {warning}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/20 bg-white/5 p-4 text-left text-sm text-white/80">
                <p className="text-xs uppercase tracking-[0.5em] text-white/50">{featureTranslations.actionsTitle}</p>
                <ul className="space-y-2">
                  {(Object.values(featureTranslations.actions) as string[]).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs uppercase tracking-[0.3em] text-white/60">{formatQuotaMessage()}</p>
              <button
                type="button"
                onClick={handleSave}
                className="w-full rounded-full bg-[#DC2626] px-4 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-[#b0231d]"
              >
                {featureTranslations.saveButton}
              </button>
              {statusMessage && (
                <p className="text-center text-xs text-white/70">{statusMessage}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
