import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/auth/PlanContext";

import { cn } from "@/lib/utils";
import { computeLandedCost } from "@/lib/landedCost";
import type { Incoterm, TransportMode, LandedCostInput } from "@/lib/landedCost";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const INCOTERMS: Incoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const MODES: TransportMode[] = ["road", "air", "sea", "rail"];

/** ✅ Light inputs */
const INPUT_CLASSES = "bg-background border-input text-foreground placeholder:text-muted-foreground";
const SELECT_TRIGGER_CLASSES = "bg-background border-input text-foreground";

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
const FREE_ANALYSE_RUNS_KEY = "mpl_free_analyse_runs";
const PLAN_KEY_CANDIDATES = ["mpl_plan", "plan", "mpl_subscription_plan", "mplPlan", "subscription_plan"];

const FREE_RUN_LIMIT = 1;

type PlanSlug = "FREE" | "TOOL" | "PRO" | "VIP";

function normalizePlan(raw: string): PlanSlug {
  const v = String(raw || "").trim().toUpperCase();

  // ✅ Compat avec tes slugs internes (vu dans App.tsx)
  if (v.includes("PILOTAGE") || v.includes("VIP")) return "VIP";
  if (v.includes("PRO")) return "PRO";
  if (v.includes("TOOL")) return "TOOL";
  if (v.includes("FREE")) return "FREE";

  // legacy / variations
  if (v === "VIP+" || v === "ENTERPRISE" || v === "PREMIUM") return "VIP";
  if (v === "PRO+" || v === "PROPLUS" || v === "PRO_PLUS") return "PRO";
  if (v === "BASIC" || v === "STARTER") return "TOOL";

  return "FREE";
}

function safePlanGuess(): PlanSlug {
  try {
    if (typeof window === "undefined") return "FREE";
    for (const k of PLAN_KEY_CANDIDATES) {
      const v = window.localStorage?.getItem(k);
      if (v) return normalizePlan(v);
    }
    return "FREE";
  } catch {
    return "FREE";
  }
}

function planRank(p: PlanSlug) {
  if (p === "VIP") return 3;
  if (p === "PRO") return 2;
  if (p === "TOOL") return 1;
  return 0;
}

function hasAtLeast(plan: PlanSlug, required: PlanSlug) {
  return planRank(plan) >= planRank(required);
}

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
    { name: "Marchandise", value: result.breakdown.goodsValue },
    { name: "Pré-achemin.", value: result.breakdown.preCarriage },
    { name: "Fret princ.", value: result.breakdown.mainFreight },
    { name: "Assurance", value: result.breakdown.insurance },
    { name: "Emballage", value: result.breakdown.packaging },
    { name: "Douane", value: result.breakdown.brokerage },
    { name: "Divers", value: result.breakdown.misc },
    { name: "Droits", value: result.breakdown.duties },
    { name: "TVA", value: result.breakdown.vat },
  ];
}

function buildShareId() {
  return `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readShareStore(): Record<string, SharePayload> {
  try {
    if (typeof window === "undefined") return {};
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
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(SHARE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

async function generatePdf(payload: SharePayload) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  let cursor = height - 60;
  const left = 50;
  const line = 16;

  page.drawText("MPL Export Conseil — Fiche décision (Landed Cost)", {
    x: left,
    y: cursor,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.2, 0.4),
  });
  cursor -= 26;

  page.drawText(`Date : ${new Date(payload.createdAt).toLocaleDateString("fr-FR")}`, {
    x: left,
    y: cursor,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  cursor -= 24;

  const rows = [
    `Destination : ${payload.input.destination}`,
    `Incoterm : ${payload.input.incoterm}`,
    `Mode : ${payload.input.mode}`,
    `Valeur marchandise : ${formatMoney(payload.input.goodsValue, payload.input.currency)}`,
  ];
  rows.forEach((text) => {
    page.drawText(text, { x: left, y: cursor, size: 11, font });
    cursor -= line;
  });

  cursor -= 10;
  page.drawText("Détail", { x: left, y: cursor, size: 12, font: bold });
  cursor -= 18;

  const breakdown = payload.result.breakdown;
  const breakdownLines = [
    `Pré-acheminement : ${formatMoney(breakdown.preCarriage, payload.input.currency)}`,
    `Fret principal : ${formatMoney(breakdown.mainFreight, payload.input.currency)}`,
    `Assurance : ${formatMoney(breakdown.insurance, payload.input.currency)}`,
    `Emballage : ${formatMoney(breakdown.packaging, payload.input.currency)}`,
    `Douane : ${formatMoney(breakdown.brokerage, payload.input.currency)}`,
    `Divers : ${formatMoney(breakdown.misc, payload.input.currency)}`,
    `Droits : ${formatMoney(breakdown.duties, payload.input.currency)}`,
    `TVA : ${formatMoney(breakdown.vat, payload.input.currency)}`,
  ];
  breakdownLines.forEach((text) => {
    page.drawText(text, { x: left, y: cursor, size: 10, font });
    cursor -= line;
  });

  cursor -= 8;
  page.drawText(`Total coût rendu : ${formatMoney(payload.result.total, payload.input.currency)}`, {
    x: left,
    y: cursor,
    size: 12,
    font: bold,
  });
  cursor -= 18;

  if (payload.result.unitCost) {
    page.drawText(`Coût unitaire : ${formatMoney(payload.result.unitCost, payload.input.currency)}`, {
      x: left,
      y: cursor,
      size: 10,
      font,
    });
    cursor -= 16;
  }

  cursor -= 6;
  page.drawText("Alertes (indications)", { x: left, y: cursor, size: 12, font: bold });
  cursor -= 16;

  payload.result.warnings.slice(0, 6).forEach((warning) => {
    page.drawText(`- ${warning}`, { x: left, y: cursor, size: 9, font });
    cursor -= 12;
  });

  page.drawText("Estimation indicative — validation humaine recommandée. Ne constitue pas un avis juridique.", {
    x: left,
    y: 60,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export default function Analyse() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // ✅ Plan: on privilégie le contexte, sinon fallback localStorage
  const { plan: planFromCtx, loading: planLoading } = usePlan();
  const plan = React.useMemo<PlanSlug>(() => {
    if (planFromCtx) return normalizePlan(String(planFromCtx));
    return safePlanGuess();
  }, [planFromCtx]);

  const isVip = hasAtLeast(plan, "VIP");
  const isToolPlus = hasAtLeast(plan, "TOOL");

  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [scenarios, setScenarios] = React.useState<ScenarioState[]>([
    { id: "A", label: "Scénario A", enabled: true, form: { ...DEFAULT_FORM, incoterm: "FCA", mode: "road" } },
    { id: "B", label: "Scénario B", enabled: false, form: { ...DEFAULT_FORM, incoterm: "CIF", mode: "sea" } },
    { id: "C", label: "Scénario C", enabled: false, form: { ...DEFAULT_FORM, incoterm: "DDP", mode: "air" } },
  ]);

  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [shareStatus, setShareStatus] = React.useState<string | null>(null);

  // ✅ Soft-gating FREE: 1 calcul seulement
  const [freeRuns, setFreeRuns] = React.useState<number>(0);
  const remainingFreeRuns = Math.max(0, FREE_RUN_LIMIT - freeRuns);
  const freeLocked = plan === "FREE" && remainingFreeRuns <= 0;

  // ✅ Snapshot
  const [computed, setComputed] = React.useState<{
    input: LandedCostInput;
    result: ReturnType<typeof computeLandedCost>;
    createdAt: string;
  } | null>(null);

  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem(FREE_ANALYSE_RUNS_KEY);
      const n = raw ? Number(raw) : 0;
      setFreeRuns(Number.isFinite(n) ? n : 0);
    } catch {
      setFreeRuns(0);
    }
  }, []);

  // ✅ Pré-remplissage via query params (?incoterm=DDP)
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const incoterm = params.get("incoterm");
      if (incoterm && INCOTERMS.includes(incoterm as Incoterm)) {
        setForm((prev) => ({ ...prev, incoterm: incoterm as Incoterm }));
      }
    } catch {
      // ignore
    }
  }, [location.search]);

  const currentInput = React.useMemo(() => toInput(form), [form]);
  const currentResult = React.useMemo(() => computeLandedCost(currentInput), [currentInput]);

  const activeInput = computed?.input ?? currentInput;
  const activeResult = computed?.result ?? currentResult;

  const scenarioResults = React.useMemo(() => {
    if (!isToolPlus) return [];
    return scenarios
      .filter((s) => s.enabled)
      .map((s) => ({ ...s, input: toInput(s.form) }))
      .map((s) => ({ ...s, result: computeLandedCost(s.input) }));
  }, [scenarios, isToolPlus]);

  const comparisonData = React.useMemo(() => {
    if (!isToolPlus) return [];
    return [
      { name: "Base", total: activeResult.total },
      ...scenarioResults.map((s) => ({ name: s.label, total: s.result.total })),
    ];
  }, [activeResult.total, scenarioResults, isToolPlus]);

  const goPricing = (anchor?: string) => {
    const path = anchor ? `/pricing#${anchor}` : "/pricing";
    navigate(path);
    if (anchor) {
      window.setTimeout(() => {
        const el = document.getElementById(anchor);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const goTo = (path: string) => navigate(path);

  const handleGoWatch = () => {
    if (!isVip) {
      toast({
        title: "Accès VIP",
        description: "La veille est réservée au plan VIP. Passez au VIP pour activer la veille premium par destination.",
      });
      goPricing("vip");
      return;
    }
    goTo("/veille");
  };

  const handleCompute = () => {
    if (plan === "FREE" && freeLocked) {
      setShareStatus("Limite FREE atteinte : 1 calcul gratuit. Passez à TOOL pour un accès illimité.");
      toast({
        title: "Limite FREE atteinte",
        description: "Passez à TOOL pour utiliser le simulateur sans limite.",
      });
      return;
    }

    const snap = {
      input: currentInput,
      result: currentResult,
      createdAt: new Date().toISOString(),
    };
    setComputed(snap);
    setShareStatus(null);

    if (plan === "FREE") {
      const next = freeRuns + 1;
      setFreeRuns(next);
      try {
        localStorage.setItem(FREE_ANALYSE_RUNS_KEY, String(next));
      } catch {
        // ignore
      }
    }
  };

  const handlePdf = async () => {
    if (!computed) {
      toast({ title: "Action requise", description: "Clique d’abord sur “Calculer” pour générer le PDF." });
      return;
    }
    if (!isToolPlus) {
      toast({ title: "TOOL requis", description: "Le PDF est inclus à partir de l’offre TOOL." });
      goPricing("tool");
      return;
    }

    setPdfLoading(true);
    try {
      const payload: SharePayload = {
        id: buildShareId(),
        createdAt: computed.createdAt,
        input: computed.input,
        result: computed.result,
      };
      const blob = await generatePdf(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-decision-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF généré", description: "Le téléchargement a démarré." });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShare = async () => {
    if (!computed) {
      toast({ title: "Action requise", description: "Clique d’abord sur “Calculer” pour générer un lien." });
      return;
    }
    if (!isToolPlus) {
      toast({ title: "TOOL requis", description: "Le partage est inclus à partir de l’offre TOOL." });
      goPricing("tool");
      return;
    }

    const payload: SharePayload = {
      id: buildShareId(),
      createdAt: computed.createdAt,
      input: computed.input,
      result: computed.result,
    };

    const store = readShareStore();
    store[payload.id] = payload;
    writeShareStore(store);

    const shareUrl = `${window.location.origin}/share/${payload.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Lien copié dans le presse-papiers.");
      toast({ title: "Lien copié", description: "Partage-le à ton client ou à ton équipe." });
    } catch {
      setShareStatus(`Lien généré : ${shareUrl}`);
      toast({ title: "Lien généré", description: "Copie le lien affiché sous les boutons." });
    }
  };

  const showPaywall = plan === "FREE" && freeLocked;

  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* HERO */}
        <section className="force-white rounded-3xl border border-border bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 text-white shadow-xl md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Analyse export</p>
              <h1 className="mt-2 text-4xl font-semibold md:text-5xl">Landed cost en 3 minutes, sans blocage.</h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-200">
                Estimation indicative basée sur vos données. Droits/TVA : saisie manuelle (pas d’auto-lookup).
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className="border-white/20 text-white/80">
                Plan : {planLoading ? "…" : plan}
              </Badge>
              {plan === "FREE" ? (
                <Badge variant="outline" className="border-white/20 text-white/80">
                  Gratuit : {remainingFreeRuns}/{FREE_RUN_LIMIT} calcul
                </Badge>
              ) : (
                <Badge variant="outline" className="border-white/20 text-white/80">
                  Accès illimité simulateur
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => goTo("/contact")}>Demander un audit export</Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => goTo("/import/check-invoice")}>
              Vérifier une facture import/export
            </Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={handleGoWatch}>
              Veille export (VIP)
            </Button>
          </div>

          <div className="mt-4 text-xs text-white/70">
            {plan === "FREE" ? (
              <>
                Vous testez en <span className="font-semibold text-white">FREE</span> : 1 calcul gratuit. Pour un usage régulier :{" "}
                <button className="underline hover:opacity-90" onClick={() => goPricing("tool")}>
                  TOOL
                </button>
                .
              </>
            ) : (
              <>
                Besoin d’un accompagnement humain :{" "}
                <button className="underline hover:opacity-90" onClick={() => goPricing("pro")}>
                  PRO
                </button>{" "}
                ou{" "}
                <button className="underline hover:opacity-90" onClick={() => goPricing("vip")}>
                  VIP
                </button>
                .
              </>
            )}
          </div>
        </section>

        {/* PAYWALL (FREE lock) */}
        {showPaywall && (
          <section>
            <Card className="rounded-3xl border-border bg-muted/30 shadow-sm">
              <CardHeader>
                <CardTitle>Limite FREE atteinte</CardTitle>
                <CardDescription>
                  Vous avez utilisé votre <span className="font-semibold">1 calcul gratuit</span>. Passez à TOOL pour un
                  usage illimité + vérification facture + suivi opération.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <div className="font-semibold">TOOL — 149 €/mois (100% en ligne)</div>
                  <div className="text-muted-foreground">Simulateur complet • Vérification facture • Suivi opérations</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => goTo("/import/check-invoice")}>
                    Tester la vérification
                  </Button>
                  <Button onClick={() => goPricing("tool")}>Voir TOOL</Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* CONTENU */}
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Entrées principales</CardTitle>
              <CardDescription>
                Renseignez vos coûts. Cliquez sur “Calculer” pour figer un résultat (utile pour limiter FREE).
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valeur marchandise</Label>
                  <Input value={form.goodsValue} onChange={(e) => updateForm(setForm, "goodsValue", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select value={form.currency} onValueChange={(v) => updateForm(setForm, "currency", v)}>
                    <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
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
                  <Label>Quantité (optionnel)</Label>
                  <Input value={form.quantity} onChange={(e) => updateForm(setForm, "quantity", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Destination (pays)</Label>
                  <Input value={form.destination} onChange={(e) => updateForm(setForm, "destination", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Incoterm</Label>
                  <Select value={form.incoterm} onValueChange={(v) => updateForm(setForm, "incoterm", v)}>
                    <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((it) => (
                        <SelectItem key={it} value={it}>
                          {it}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mode transport</Label>
                  <Select value={form.mode} onValueChange={(v) => updateForm(setForm, "mode", v)}>
                    <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((it) => (
                        <SelectItem key={it} value={it}>
                          {it}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Champs avancés */}
              <div className={cn("grid gap-4 md:grid-cols-2", !isToolPlus && "opacity-70")}>
                <div className="space-y-2">
                  <Label>Pré-acheminement</Label>
                  <Input value={form.preCarriage} onChange={(e) => updateForm(setForm, "preCarriage", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Fret principal</Label>
                  <Input value={form.mainFreight} onChange={(e) => updateForm(setForm, "mainFreight", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Assurance</Label>
                  <div className="flex gap-2">
                    <Select value={form.insuranceType} onValueChange={(v) => updateForm(setForm, "insuranceType", v)}>
                      <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">Montant</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={form.insuranceValue} onChange={(e) => updateForm(setForm, "insuranceValue", e.target.value)} className={INPUT_CLASSES} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Emballage</Label>
                  <Input value={form.packaging} onChange={(e) => updateForm(setForm, "packaging", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Douane / transit</Label>
                  <Input value={form.brokerage} onChange={(e) => updateForm(setForm, "brokerage", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Divers</Label>
                  <Input value={form.misc} onChange={(e) => updateForm(setForm, "misc", e.target.value)} className={INPUT_CLASSES} />
                </div>

                <div className="space-y-2">
                  <Label>Taux droits (manuel %)</Label>
                  <Input value={form.dutyRate} onChange={(e) => updateForm(setForm, "dutyRate", e.target.value)} className={INPUT_CLASSES} />
                  <p className="text-xs text-muted-foreground">Entrez le % validé (HS / pays / origine).</p>
                </div>

                <div className="space-y-2">
                  <Label>TVA import (manuel %)</Label>
                  <Input value={form.vatRate} onChange={(e) => updateForm(setForm, "vatRate", e.target.value)} className={INPUT_CLASSES} />
                  <p className="text-xs text-muted-foreground">Champ manuel. Pas d’auto lookup.</p>
                </div>

                <div className="space-y-2">
                  <Label>Marge cible (optionnel %)</Label>
                  <Input value={form.marginTarget} onChange={(e) => updateForm(setForm, "marginTarget", e.target.value)} className={INPUT_CLASSES} />
                </div>
              </div>

              {!isToolPlus && (
                <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                  <div className="font-semibold">Astuce</div>
                  Pour un usage régulier + vérification facture + suivi :{" "}
                  <button className="underline" onClick={() => goPricing("tool")}>
                    TOOL
                  </button>
                  .
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleCompute} disabled={plan === "FREE" && freeLocked}>
                  {plan === "FREE" && freeLocked ? "Calcul FREE indisponible" : computed ? "Recalculer" : "Calculer"}
                </Button>

                <Button variant="outline" onClick={() => goTo("/import/check-invoice")}>
                  Vérifier une facture
                </Button>

                {!isToolPlus && (
                  <Button variant="outline" onClick={() => goPricing("tool")}>
                    Passer à TOOL
                  </Button>
                )}
              </div>

              {plan === "FREE" && (
                <p className="text-xs text-muted-foreground">FREE = {FREE_RUN_LIMIT} calcul gratuit. TOOL/PRO/VIP = illimité.</p>
              )}
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Résultats</CardTitle>
              <CardDescription>Vue de synthèse + breakdown.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {!computed ? (
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  Clique sur <span className="font-semibold text-foreground">“Calculer”</span> pour afficher un résultat.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs uppercase text-muted-foreground">Total coût rendu</div>
                      <div className="text-2xl font-semibold">{formatMoney(activeResult.total, activeInput.currency)}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs uppercase text-muted-foreground">Coût unitaire</div>
                      <div className="text-2xl font-semibold">
                        {activeResult.unitCost ? formatMoney(activeResult.unitCost, activeInput.currency) : "n/a"}
                      </div>
                    </div>
                  </div>

                  {activeResult.margin && (
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs uppercase text-muted-foreground">Marge cible</div>
                      <div className="mt-1 text-lg font-semibold">{formatMoney(activeResult.margin.targetAmount, activeInput.currency)}</div>
                      <div className="text-sm text-muted-foreground">Prix cible : {formatMoney(activeResult.margin.targetPrice, activeInput.currency)}</div>
                    </div>
                  )}

                  <div className="h-72 rounded-xl border bg-card p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breakdownData(activeResult)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: any) => formatMoney(Number(value || 0), activeInput.currency)}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Scénarios => TOOL+ */}
        <section className="space-y-6">
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Comparateur de scénarios</CardTitle>
              <CardDescription>
                {isToolPlus ? "Modifiez incoterm, mode et coûts pour comparer jusqu'à 3 scénarios." : "Disponible à partir de TOOL."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {!isToolPlus ? (
                <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                  <div className="font-semibold">Débloquer le comparateur</div>
                  TOOL = simulateur complet + comparateur + vérification facture + suivi opérations.
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => goPricing("tool")}>Passer à TOOL</Button>
                    <Button variant="outline" onClick={() => goTo("/contact")}>
                      Demander une démo
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {scenarios.map((scenario, index) => (
                      <div key={scenario.id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{scenario.label}</div>
                          <Button
                            size="sm"
                            variant={scenario.enabled ? "default" : "outline"}
                            onClick={() =>
                              setScenarios((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, enabled: !item.enabled } : item))
                              )
                            }
                          >
                            {scenario.enabled ? "Actif" : "Inactif"}
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
                              <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
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
                              <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
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
                            <Label>Fret principal</Label>
                            <Input
                              value={scenario.form.mainFreight}
                              onChange={(e) =>
                                setScenarios((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index ? { ...item, form: { ...item.form, mainFreight: e.target.value } } : item
                                  )
                                )
                              }
                              className={INPUT_CLASSES}
                            />
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setScenarios((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, form: { ...form } } : item))
                              )
                            }
                          >
                            Copier les valeurs base
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-sm font-semibold">Table de comparaison</div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Base</span>
                          <span className="text-foreground">{computed ? formatMoney(activeResult.total, activeInput.currency) : "—"}</span>
                        </div>
                        {scenarioResults.map((scenario) => (
                          <div key={scenario.id} className="flex items-center justify-between">
                            <span>{scenario.label}</span>
                            <span className="text-foreground">{formatMoney(scenario.result.total, scenario.input.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-56 rounded-xl border bg-card p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: any) => formatMoney(Number(value || 0), activeInput.currency)}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              color: "hsl(var(--foreground))",
                            }}
                          />
                          <Bar dataKey="total" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Décision & risques */}
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Décision & risques</CardTitle>
              <CardDescription>Alertes simples + checklist documents.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!computed ? (
                <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">Clique sur “Calculer” pour afficher les alertes.</div>
              ) : (
                <div className="space-y-2">
                  {activeResult.warnings.map((warning) => (
                    <div key={warning} className="rounded-lg border bg-card p-3 text-sm">
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="text-sm font-semibold">Checklist documents (indicatif)</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Facture commerciale</li>
                  <li>Packing list</li>
                  <li>Certificat d’origine (si applicable)</li>
                  <li>Document transport (AWB, B/L, CMR)</li>
                  <li>Assurance (si applicable)</li>
                  <li>Déclaration export / formalités douanières</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handlePdf} disabled={pdfLoading}>
                  {pdfLoading ? "Génération..." : "Générer PDF décision (TOOL+)"}
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  Partager un lien (TOOL+)
                </Button>
                <Button variant="outline" onClick={() => goTo("/import/check-invoice")}>
                  Vérifier une facture
                </Button>
              </div>

              {shareStatus && <p className="text-xs text-muted-foreground">{shareStatus}</p>}

              <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Note :</span> résultats indicatifs. Pour une décision “zéro surprise”, demande une validation (audit / express).
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <Button size="lg" onClick={() => goTo("/contact")}>
          Demander un audit export
        </Button>
        {!isToolPlus && (
          <Button size="lg" variant="outline" onClick={() => goPricing("tool")}>
            Passer à TOOL
          </Button>
        )}
      </div>
    </PublicLayout>
  );
}
