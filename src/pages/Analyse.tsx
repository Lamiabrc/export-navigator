import React from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { computeLandedCost } from "@/lib/landedCost";
import type { Incoterm, TransportMode, LandedCostInput } from "@/lib/landedCost";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const INCOTERMS: Incoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const MODES: TransportMode[] = ["road", "air", "sea", "rail"];

const DEFAULT_FORM = {
  goodsValue: "12000",
  currency: "EUR",
  quantity: "100",
  destination: "Allemagne",
  incoterm: "DAP" as Incoterm,
  mode: "road" as TransportMode,
  preCarriage: "250",
  mainFreight: "1200",
  insuranceType: "percent" as "percent" | "amount",
  insuranceValue: "0.4",
  packaging: "180",
  brokerage: "220",
  misc: "90",
  dutyRate: "0",
  vatRate: "20",
  marginTarget: "15",
};

type FormState = typeof DEFAULT_FORM;

type ScenarioState = {
  id: string;
  label: string;
  enabled: boolean;
  form: FormState;
};

type SharePayload = {
  id: string;
  createdAt: string;
  input: LandedCostInput;
  result: ReturnType<typeof computeLandedCost>;
};

const SHARE_KEY = "mpl_share_payloads";

function toNumber(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

function toInput(form: FormState): LandedCostInput {
  return {
    goodsValue: toNumber(form.goodsValue),
    currency: form.currency,
    quantity: form.quantity ? toNumber(form.quantity) : undefined,
    destination: form.destination,
    incoterm: form.incoterm,
    mode: form.mode,
    preCarriage: toNumber(form.preCarriage),
    mainFreight: toNumber(form.mainFreight),
    insuranceType: form.insuranceType,
    insuranceValue: toNumber(form.insuranceValue),
    packaging: toNumber(form.packaging),
    brokerage: toNumber(form.brokerage),
    misc: toNumber(form.misc),
    dutyRate: toNumber(form.dutyRate),
    vatRate: toNumber(form.vatRate),
    marginTarget: toNumber(form.marginTarget),
  };
}

function updateForm(setter: React.Dispatch<React.SetStateAction<FormState>>, key: keyof FormState, value: string) {
  setter((prev) => ({ ...prev, [key]: value }));
}

function breakdownData(result: ReturnType<typeof computeLandedCost>) {
  return [
    { name: "Goods", value: result.breakdown.goodsValue },
    { name: "Pre-carriage", value: result.breakdown.preCarriage },
    { name: "Main freight", value: result.breakdown.mainFreight },
    { name: "Insurance", value: result.breakdown.insurance },
    { name: "Packaging", value: result.breakdown.packaging },
    { name: "Brokerage", value: result.breakdown.brokerage },
    { name: "Misc", value: result.breakdown.misc },
    { name: "Duties", value: result.breakdown.duties },
    { name: "VAT", value: result.breakdown.vat },
  ];
}

function buildShareId() {
  return `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readShareStore(): Record<string, SharePayload> {
  try {
    const raw = localStorage.getItem(SHARE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, SharePayload>;
  } catch {
    return {};
  }
}

function writeShareStore(store: Record<string, SharePayload>) {
  localStorage.setItem(SHARE_KEY, JSON.stringify(store));
}

async function generatePdf(payload: SharePayload) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  let cursor = height - 60;
  const left = 50;
  const line = 16;

  page.drawText("MPL Export Conseil - Fiche Decision", { x: left, y: cursor, size: 16, font: bold, color: rgb(0.1, 0.2, 0.4) });
  cursor -= 26;

  page.drawText(`Date: ${new Date(payload.createdAt).toLocaleDateString("fr-FR")}`, {
    x: left,
    y: cursor,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  cursor -= 24;

  const rows = [
    `Destination: ${payload.input.destination}`,
    `Incoterm: ${payload.input.incoterm}`,
    `Mode: ${payload.input.mode}`,
    `Goods value: ${formatMoney(payload.input.goodsValue, payload.input.currency)}`,
  ];
  rows.forEach((text) => {
    page.drawText(text, { x: left, y: cursor, size: 11, font });
    cursor -= line;
  });

  cursor -= 10;
  page.drawText("Breakdown", { x: left, y: cursor, size: 12, font: bold });
  cursor -= 18;

  const breakdown = payload.result.breakdown;
  const breakdownLines = [
    `Pre-carriage: ${formatMoney(breakdown.preCarriage, payload.input.currency)}`,
    `Main freight: ${formatMoney(breakdown.mainFreight, payload.input.currency)}`,
    `Insurance: ${formatMoney(breakdown.insurance, payload.input.currency)}`,
    `Packaging: ${formatMoney(breakdown.packaging, payload.input.currency)}`,
    `Brokerage: ${formatMoney(breakdown.brokerage, payload.input.currency)}`,
    `Misc: ${formatMoney(breakdown.misc, payload.input.currency)}`,
    `Duties: ${formatMoney(breakdown.duties, payload.input.currency)}`,
    `VAT: ${formatMoney(breakdown.vat, payload.input.currency)}`,
  ];
  breakdownLines.forEach((text) => {
    page.drawText(text, { x: left, y: cursor, size: 10, font });
    cursor -= line;
  });

  cursor -= 8;
  page.drawText(`Total landed cost: ${formatMoney(payload.result.total, payload.input.currency)}`, {
    x: left,
    y: cursor,
    size: 12,
    font: bold,
  });
  cursor -= 18;

  if (payload.result.unitCost) {
    page.drawText(`Unit cost: ${formatMoney(payload.result.unitCost, payload.input.currency)}`, {
      x: left,
      y: cursor,
      size: 10,
      font,
    });
    cursor -= 16;
  }

  cursor -= 6;
  page.drawText("Warnings", { x: left, y: cursor, size: 12, font: bold });
  cursor -= 16;
  payload.result.warnings.slice(0, 6).forEach((warning) => {
    page.drawText(`- ${warning}`, { x: left, y: cursor, size: 9, font });
    cursor -= 12;
  });

  page.drawText("Estimation indicative - validation humaine recommandee.", {
    x: left,
    y: 60,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}

export default function Analyse() {
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [scenarios, setScenarios] = React.useState<ScenarioState[]>([
    {
      id: "A",
      label: "Scenario A",
      enabled: true,
      form: { ...DEFAULT_FORM, incoterm: "FCA", mode: "road" },
    },
    {
      id: "B",
      label: "Scenario B",
      enabled: false,
      form: { ...DEFAULT_FORM, incoterm: "CIF", mode: "sea" },
    },
    {
      id: "C",
      label: "Scenario C",
      enabled: false,
      form: { ...DEFAULT_FORM, incoterm: "DDP", mode: "air" },
    },
  ]);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [shareStatus, setShareStatus] = React.useState<string | null>(null);

  const baseInput = React.useMemo(() => toInput(form), [form]);
  const baseResult = React.useMemo(() => computeLandedCost(baseInput), [baseInput]);

  const scenarioResults = scenarios
    .filter((scenario) => scenario.enabled)
    .map((scenario) => ({
      ...scenario,
      input: toInput(scenario.form),
    }))
    .map((scenario) => ({
      ...scenario,
      result: computeLandedCost(scenario.input),
    }));

  const comparisonData = [
    { name: "Base", total: baseResult.total },
    ...scenarioResults.map((scenario) => ({ name: scenario.label, total: scenario.result.total })),
  ];

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      const payload: SharePayload = {
        id: buildShareId(),
        createdAt: new Date().toISOString(),
        input: baseInput,
        result: baseResult,
      };
      const blob = await generatePdf(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-decision-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShare = async () => {
    const payload: SharePayload = {
      id: buildShareId(),
      createdAt: new Date().toISOString(),
      input: baseInput,
      result: baseResult,
    };
    const store = readShareStore();
    store[payload.id] = payload;
    writeShareStore(store);

    const shareUrl = `${window.location.origin}/share/${payload.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Lien copie dans le presse-papiers.");
    } catch {
      setShareStatus("Lien genere. Copiez-le manuellement.");
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Analyse export</p>
          <h1 className="text-4xl font-semibold text-white">Landed cost en 3 minutes, sans blocage.</h1>
          <p className="text-lg text-slate-200">
            Estimation indicative, basee sur vos donnees manuelles. Aucun taux officiel n'est devine.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => (window.location.href = "/contact")}>Demander un audit export</Button>
            <Button
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => (window.location.href = "/veille")}
            >
              Veille export
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Entrees principales</CardTitle>
              <CardDescription className="text-slate-200">
                Renseignez vos couts. Droits et TVA restent manuels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valeur marchandise</Label>
                  <Input value={form.goodsValue} onChange={(e) => updateForm(setForm, "goodsValue", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select value={form.currency} onValueChange={(value) => updateForm(setForm, "currency", value)}>
                    <SelectTrigger className="bg-white/90 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantite (optionnel)</Label>
                  <Input value={form.quantity} onChange={(e) => updateForm(setForm, "quantity", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Destination (pays)</Label>
                  <Input value={form.destination} onChange={(e) => updateForm(setForm, "destination", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Incoterm</Label>
                  <Select value={form.incoterm} onValueChange={(value) => updateForm(setForm, "incoterm", value)}>
                    <SelectTrigger className="bg-white/90 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mode transport</Label>
                  <Select value={form.mode} onValueChange={(value) => updateForm(setForm, "mode", value)}>
                    <SelectTrigger className="bg-white/90 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pre-carriage</Label>
                  <Input value={form.preCarriage} onChange={(e) => updateForm(setForm, "preCarriage", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Main freight</Label>
                  <Input value={form.mainFreight} onChange={(e) => updateForm(setForm, "mainFreight", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Insurance</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.insuranceType}
                      onValueChange={(value) => updateForm(setForm, "insuranceType", value)}
                    >
                      <SelectTrigger className="bg-white/90 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={form.insuranceValue}
                      onChange={(e) => updateForm(setForm, "insuranceValue", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Packaging</Label>
                  <Input value={form.packaging} onChange={(e) => updateForm(setForm, "packaging", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Brokerage / customs</Label>
                  <Input value={form.brokerage} onChange={(e) => updateForm(setForm, "brokerage", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Misc</Label>
                  <Input value={form.misc} onChange={(e) => updateForm(setForm, "misc", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Duties rate (manual %)</Label>
                  <Input value={form.dutyRate} onChange={(e) => updateForm(setForm, "dutyRate", e.target.value)} />
                  <p className="text-xs text-slate-300">Enter the % you have validated manually.</p>
                </div>
                <div className="space-y-2">
                  <Label>Import VAT rate (manual %)</Label>
                  <Input value={form.vatRate} onChange={(e) => updateForm(setForm, "vatRate", e.target.value)} />
                  <p className="text-xs text-slate-300">Manual field. No auto lookup.</p>
                </div>
                <div className="space-y-2">
                  <Label>Target margin (optional %)</Label>
                  <Input
                    value={form.marginTarget}
                    onChange={(e) => updateForm(setForm, "marginTarget", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Resultats</CardTitle>
              <CardDescription className="text-slate-200">Vue de synthese + breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs uppercase text-slate-200">Total landed cost</div>
                  <div className="text-2xl font-semibold">
                    {formatMoney(baseResult.total, baseInput.currency)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs uppercase text-slate-200">Unit cost</div>
                  <div className="text-2xl font-semibold">
                    {baseResult.unitCost
                      ? formatMoney(baseResult.unitCost, baseInput.currency)
                      : "n/a"}
                  </div>
                </div>
              </div>

              {baseResult.margin && (
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs uppercase text-slate-200">Target margin</div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatMoney(baseResult.margin.targetAmount, baseInput.currency)}
                  </div>
                  <div className="text-sm text-slate-200">
                    Target price: {formatMoney(baseResult.margin.targetPrice, baseInput.currency)}
                  </div>
                </div>
              )}

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData(baseResult)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#e2e8f0" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#e2e8f0" tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any) => formatMoney(Number(value || 0), baseInput.currency)}
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Comparateur de scenarios</CardTitle>
              <CardDescription className="text-slate-200">
                Modifiez incoterm, mode et couts pour comparer jusqu'a 3 scenarios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                {scenarios.map((scenario, index) => (
                  <div key={scenario.id} className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{scenario.label}</div>
                      <Button
                        size="sm"
                        variant={scenario.enabled ? "default" : "outline"}
                        onClick={() =>
                          setScenarios((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, enabled: !item.enabled } : item
                            )
                          )
                        }
                      >
                        {scenario.enabled ? "Active" : "Inactive"}
                      </Button>
                    </div>
                    <div className={cn("mt-4 space-y-3", !scenario.enabled && "opacity-60")}> 
                      <div className="space-y-2">
                        <Label>Incoterm</Label>
                        <Select
                          value={scenario.form.incoterm}
                          onValueChange={(value) =>
                            setScenarios((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, form: { ...item.form, incoterm: value as Incoterm } } : item
                              )
                            )
                          }
                        >
                          <SelectTrigger className="bg-white/90 text-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INCOTERMS.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Mode</Label>
                        <Select
                          value={scenario.form.mode}
                          onValueChange={(value) =>
                            setScenarios((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, form: { ...item.form, mode: value as TransportMode } } : item
                              )
                            )
                          }
                        >
                          <SelectTrigger className="bg-white/90 text-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MODES.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Main freight</Label>
                        <Input
                          value={scenario.form.mainFreight}
                          onChange={(e) =>
                            setScenarios((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? { ...item, form: { ...item.form, mainFreight: e.target.value } }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white text-white hover:bg-white/10"
                        onClick={() =>
                          setScenarios((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, form: { ...form } } : item))
                          )
                        }
                      >
                        Use base values
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="bg-white/10" />

              <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Comparison table</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Base</span>
                      <span>{formatMoney(baseResult.total, baseInput.currency)}</span>
                    </div>
                    {scenarioResults.map((scenario) => (
                      <div key={scenario.id} className="flex items-center justify-between">
                        <span>{scenario.label}</span>
                        <span>{formatMoney(scenario.result.total, scenario.input.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#e2e8f0" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#e2e8f0" tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: any) => formatMoney(Number(value || 0), baseInput.currency)}
                        contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                      />
                      <Bar dataKey="total" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Decision & risques</CardTitle>
              <CardDescription className="text-slate-200">
                Alerts simples, checklist documents, et rappels incoterm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {baseResult.warnings.map((warning) => (
                  <div key={warning} className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm">
                    {warning}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-sm font-semibold">Documents checklist</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                  <li>Commercial invoice</li>
                  <li>Packing list</li>
                  <li>Certificate of origin</li>
                  <li>Transport document (AWB, B/L, CMR)</li>
                  <li>Insurance certificate (if applicable)</li>
                  <li>Export declaration</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  onClick={handlePdf}
                  disabled={pdfLoading}
                >
                  {pdfLoading ? "Generating..." : "Generate decision PDF"}
                </Button>
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  onClick={handleShare}
                >
                  Share link
                </Button>
              </div>
              {shareStatus && <p className="text-xs text-slate-200">{shareStatus}</p>}
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button size="lg" onClick={() => (window.location.href = "/contact")}>Demander un audit export</Button>
      </div>
    </PublicLayout>
  );
}
