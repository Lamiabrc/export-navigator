import * as React from "react";
import { Calculator, CircleDollarSign, Truck } from "lucide-react";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  COUNTRIES,
  CURRENCIES,
  INCOTERMS,
  TRANSPORT_MODES,
  VALUE_BANDS,
  VOLUME_BANDS,
  WEIGHT_BANDS,
  YES_NO_OPTIONS,
  getBandMidValue,
  getCountryLabel,
  getVolumeApproxM3,
  getWeightApproxKg,
} from "@/lib/constants";
import { useI18n } from "@/contexts/LanguageContext";
import { sanitizeOptionalComment } from "@/lib/textSanitizer";

type DutyProfile = "low" | "medium" | "high";

type SimulatorState = {
  destination: string;
  incoterm: string;
  transportMode: string;
  currency: string;
  valueBand: string;
  customExwValue: string;
  weightBand: string;
  volumeBand: string;
  insurance: string;
  dutyProfile: DutyProfile;
  manualDutyRate: string;
  manualVatRate: string;
  optionalComment: string;
};

const INITIAL_STATE: SimulatorState = {
  destination: "",
  incoterm: "EXW",
  transportMode: "road",
  currency: "EUR",
  valueBand: "5000-20000",
  customExwValue: "",
  weightBand: "20-100",
  volumeBand: "1-5",
  insurance: "yes",
  dutyProfile: "medium",
  manualDutyRate: "",
  manualVatRate: "",
  optionalComment: "",
};

function getDutyRateFromProfile(profile: DutyProfile) {
  if (profile === "low") return 0.03;
  if (profile === "high") return 0.12;
  return 0.07;
}

function getVatRateFromProfile(profile: DutyProfile) {
  if (profile === "low") return 0.08;
  if (profile === "high") return 0.22;
  return 0.16;
}

function getTransportBaseByMode(mode: string) {
  if (mode === "air") return 2.1;
  if (mode === "sea") return 0.7;
  if (mode === "rail") return 0.95;
  if (mode === "courier") return 2.4;
  return 1.15;
}

function toNum(value: string) {
  const raw = String(value || "").trim().replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${Math.round(value || 0)} ${currency || "EUR"}`;
  }
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function TaxesOm() {
  const { lang } = useI18n();
  const isEn = lang === "en";

  const [state, setState] = React.useState<SimulatorState>(INITIAL_STATE);

  const exwValue = React.useMemo(() => {
    if (state.valueBand === "other") {
      return Math.max(0, toNum(state.customExwValue));
    }
    return getBandMidValue(state.valueBand);
  }, [state.customExwValue, state.valueBand]);

  const weightKg = React.useMemo(() => getWeightApproxKg(state.weightBand), [state.weightBand]);
  const volumeM3 = React.useMemo(() => getVolumeApproxM3(state.volumeBand), [state.volumeBand]);

  const transportEstimate = React.useMemo(() => {
    const modeFactor = getTransportBaseByMode(state.transportMode);
    const densityFactor = Math.max(1, weightKg / 100 + volumeM3);
    return Math.max(0, exwValue * 0.03 * modeFactor + densityFactor * 14);
  }, [exwValue, state.transportMode, volumeM3, weightKg]);

  const insuranceCost = React.useMemo(() => {
    if (state.insurance !== "yes") return 0;
    return (exwValue + transportEstimate) * 0.004;
  }, [exwValue, state.insurance, transportEstimate]);

  const dutyRate = React.useMemo(() => {
    const manual = toNum(state.manualDutyRate);
    if (manual > 0) return manual / 100;
    return getDutyRateFromProfile(state.dutyProfile);
  }, [state.dutyProfile, state.manualDutyRate]);

  const vatRate = React.useMemo(() => {
    const manual = toNum(state.manualVatRate);
    if (manual > 0) return manual / 100;
    return getVatRateFromProfile(state.dutyProfile);
  }, [state.dutyProfile, state.manualVatRate]);

  const customsBase = exwValue + transportEstimate + insuranceCost;
  const customsDuty = customsBase * dutyRate;
  const localTax = exwValue * 0.015;
  const importVat = (customsBase + customsDuty) * vatRate;

  const preCarriage = exwValue * 0.01;
  const exportHandling = exwValue * 0.007;
  const importHandling = exwValue * 0.01;
  const lastMile = exwValue * 0.008;

  const landedPrice =
    exwValue +
    preCarriage +
    exportHandling +
    transportEstimate +
    insuranceCost +
    importHandling +
    customsDuty +
    importVat +
    localTax +
    lastMile;

  const optimizationAdvice = React.useMemo(() => {
    const items: string[] = [];

    if (state.transportMode === "air" && weightKg > 100) {
      items.push(isEn ? "Consider sea or rail consolidation for heavy volumes." : "Envisagez maritime/rail pour des volumes lourds.");
    }

    if (state.incoterm === "DDP") {
      items.push(
        isEn
          ? "DDP can increase working capital pressure. Validate local tax representation first."
          : "Le DDP peut alourdir la tresorerie. Validez votre representation fiscale locale."
      );
    }

    if (dutyRate > 0.1) {
      items.push(
        isEn
          ? "High duty estimate detected. Verify HS and preferential origin options."
          : "Droit estime eleve. Verifiez HS et opportunites d'origine preferentielle."
      );
    }

    items.push(
      isEn
        ? "Before final quote, validate exact rates with customs broker and official tariff tools."
        : "Avant devis final, confirmez les taux exacts avec votre declarant et les outils officiels."
    );

    return items.slice(0, 4);
  }, [dutyRate, isEn, state.incoterm, state.transportMode, weightKg]);

  const updateState = (patch: Partial<SimulatorState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">MPL Export Navigator</p>
            <h1 className="text-2xl font-semibold">
              {isEn ? "Landed price simulator (EXW to destination)" : "Simulateur prix rendu (EXW vers destination)"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEn
                ? "Controlled dropdown workflow with estimate-only logic (no exact legal tariff promise)."
                : "Workflow guide en dropdown avec logique estimative (sans promesse de taux legal exact)."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setState(INITIAL_STATE)}>
              {isEn ? "Reset simulation" : "Reinitialiser"}
            </Button>
            <Button asChild>
              <Link to="/contact?offer=audit">{isEn ? "Need an audit quote" : "Besoin d'un devis"}</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Input (dropdown-first)" : "Saisie (priorite dropdowns)"}</CardTitle>
            <CardDescription>
              {isEn
                ? "One controlled set of assumptions to estimate landed cost."
                : "Un jeu d'hypotheses controlees pour estimer le cout rendu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>{isEn ? "Destination country" : "Pays destination"}</Label>
              <Select value={state.destination} onValueChange={(value) => updateState({ destination: value })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={`dest-${country.iso2}`} value={country.iso2}>
                      {lang === "en" ? country.label_en : country.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Incoterm</Label>
              <Select value={state.incoterm} onValueChange={(value) => updateState({ incoterm: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((incoterm) => (
                    <SelectItem key={`incoterm-${incoterm.value}`} value={incoterm.value}>{incoterm.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Transport mode" : "Mode transport"}</Label>
              <Select value={state.transportMode} onValueChange={(value) => updateState({ transportMode: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSPORT_MODES.map((mode) => (
                    <SelectItem key={`mode-${mode.value}`} value={mode.value}>
                      {lang === "en" ? mode.label_en : mode.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Currency" : "Devise"}</Label>
              <Select value={state.currency} onValueChange={(value) => updateState({ currency: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={`currency-${currency.value}`} value={currency.value}>{currency.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "EXW value band" : "Bande valeur EXW"}</Label>
              <Select value={state.valueBand} onValueChange={(value) => updateState({ valueBand: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUE_BANDS.map((band) => (
                    <SelectItem key={`band-${band.value}`} value={band.value}>
                      {lang === "en" ? band.label_en : band.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.valueBand === "other" ? (
              <div className="space-y-1">
                <Label>{isEn ? "Custom EXW value" : "Valeur EXW personnalisee"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={state.customExwValue}
                  onChange={(event) => updateState({ customExwValue: event.target.value })}
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <Label>{isEn ? "Weight band" : "Bande poids"}</Label>
              <Select value={state.weightBand} onValueChange={(value) => updateState({ weightBand: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEIGHT_BANDS.map((band) => (
                    <SelectItem key={`weight-${band.value}`} value={band.value}>
                      {lang === "en" ? band.label_en : band.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Volume band" : "Bande volume"}</Label>
              <Select value={state.volumeBand} onValueChange={(value) => updateState({ volumeBand: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOLUME_BANDS.map((band) => (
                    <SelectItem key={`volume-${band.value}`} value={band.value}>
                      {lang === "en" ? band.label_en : band.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Insurance" : "Assurance"}</Label>
              <Select value={state.insurance} onValueChange={(value) => updateState({ insurance: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YES_NO_OPTIONS.map((option) => (
                    <SelectItem key={`insurance-${option.value}`} value={option.value}>
                      {lang === "en" ? option.label_en : option.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Duty/tax profile" : "Profil droits/taxes"}</Label>
              <Select
                value={state.dutyProfile}
                onValueChange={(value) => updateState({ dutyProfile: value as DutyProfile })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{isEn ? "Low" : "Faible"}</SelectItem>
                  <SelectItem value="medium">{isEn ? "Medium" : "Moyen"}</SelectItem>
                  <SelectItem value="high">{isEn ? "High" : "Eleve"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Manual duty rate (%)" : "Taux droits manuel (%)"}</Label>
              <Input
                type="number"
                min={0}
                value={state.manualDutyRate}
                onChange={(event) => updateState({ manualDutyRate: event.target.value })}
                placeholder={isEn ? "optional" : "optionnel"}
              />
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Manual VAT rate (%)" : "Taux TVA manuel (%)"}</Label>
              <Input
                type="number"
                min={0}
                value={state.manualVatRate}
                onChange={(event) => updateState({ manualVatRate: event.target.value })}
                placeholder={isEn ? "optional" : "optionnel"}
              />
            </div>

            <div className="space-y-1 md:col-span-4">
              <Label>{isEn ? "Optional precision" : "Precision optionnelle"}</Label>
              <Input
                value={state.optionalComment}
                onChange={(event) => updateState({ optionalComment: event.target.value })}
                onBlur={() => updateState({ optionalComment: sanitizeOptionalComment(state.optionalComment) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              {isEn ? "Cost breakdown" : "Decomposition des couts"}
            </CardTitle>
            <CardDescription>
              {isEn
                ? "Estimate only. Confirm legal rates with official tariffs before commitment."
                : "Estimation uniquement. Confirmez les taux legaux avec les tarifs officiels avant engagement."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">EXW</div>
                <div className="text-lg font-semibold">{formatMoney(exwValue, state.currency)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Transport" : "Transport"}</div>
                <div className="text-lg font-semibold">{formatMoney(transportEstimate, state.currency)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Insurance" : "Assurance"}</div>
                <div className="text-lg font-semibold">{formatMoney(insuranceCost, state.currency)}</div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div>{isEn ? "Pre-carriage" : "Pre-acheminement"}: <b>{formatMoney(preCarriage, state.currency)}</b></div>
                <div>{isEn ? "Export handling" : "Frais export"}: <b>{formatMoney(exportHandling, state.currency)}</b></div>
                <div>{isEn ? "Import handling" : "Frais import"}: <b>{formatMoney(importHandling, state.currency)}</b></div>
                <div>{isEn ? "Customs duty" : "Droits de douane"}: <b>{formatMoney(customsDuty, state.currency)}</b> ({formatPercent(dutyRate)})</div>
                <div>{isEn ? "Import VAT" : "TVA import"}: <b>{formatMoney(importVat, state.currency)}</b> ({formatPercent(vatRate)})</div>
                <div>{isEn ? "Local taxes" : "Taxes locales"}: <b>{formatMoney(localTax, state.currency)}</b></div>
                <div>{isEn ? "Last mile" : "Dernier kilometre"}: <b>{formatMoney(lastMile, state.currency)}</b></div>
                <div>{isEn ? "Customs base" : "Base douane"}: <b>{formatMoney(customsBase, state.currency)}</b></div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <div className="text-xs uppercase tracking-[0.2em]">{isEn ? "Estimated landed price" : "Prix rendu estime"}</div>
              <div className="mt-1 flex items-center gap-2 text-3xl font-semibold">
                <CircleDollarSign className="h-7 w-7" />
                {formatMoney(landedPrice, state.currency)}
              </div>
              <div className="mt-1 text-xs">{state.destination ? getCountryLabel(state.destination, lang) : "-"} · {state.incoterm} · {state.transportMode}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              {isEn ? "Optimization recommendations" : "Recommandations d'optimisation"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {optimizationAdvice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              {isEn
                ? "Official checks: Access2Markets, TARIC, local customs authority, and broker validation before final quote."
                : "Verifications officielles: Access2Markets, TARIC, douanes locales et validation declarant avant devis final."}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
