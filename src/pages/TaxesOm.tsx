import * as React from "react";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import {
  BadgePercent,
  Calculator,
  CircleAlert,
  CircleCheck,
  Globe,
  Info,
  ShieldCheck,
  Truck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { computeLandedCost, type Incoterm, type TransportMode } from "@/lib/landedCost";
import { useReferenceRates } from "@/hooks/useReferenceRates";
import { useReferenceData } from "@/hooks/useReferenceData";
import { getIncotermRule, getVatRateForDestination } from "@/data/referenceRates";

const INCOTERMS: Incoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const MODES: TransportMode[] = ["road", "sea", "air", "rail"];
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"];

const INCLUDE_TRANSPORT_INCOTERMS: Incoterm[] = ["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "N/A";
  return `${Math.round(value * 10) / 10}%`;
}

type ProductLine = {
  id: string;
  description: string;
  hs: string;
  qty: number;
  unitPrice: number;
  packaging: number;
};

type ProductTaxLookup = {
  hs_code: string | null;
  om_rate: number;
  omr_rate: number;
  taxes_rate: number;
  source?: string | null;
  note?: string | null;
  openai_enabled?: boolean;
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

export default function TaxesOm() {
  const { referenceData } = useReferenceData();
  const {
    vatRates,
    octroiMerRates,
    stats,
    isLoading: ratesLoading,
    error: ratesError,
  } = useReferenceRates();

  const destinationOptions = React.useMemo(() => {
    const list = referenceData.destinations.map((d) => String(d.destination));
    const unique = Array.from(new Set(list.map((d) => d.trim()).filter(Boolean)));
    return unique.length ? unique : ["Suisse", "Belgique", "Espagne", "Luxembourg", "International (hors UE)"];
  }, [referenceData.destinations]);

  const [destination, setDestination] = React.useState(destinationOptions[0] ?? "Suisse");
  const [customDestination, setCustomDestination] = React.useState("");

  const [incoterm, setIncoterm] = React.useState<Incoterm>("DAP");
  const [mode, setMode] = React.useState<TransportMode>("road");
  const [currency, setCurrency] = React.useState("EUR");

  const [lines, setLines] = React.useState<ProductLine[]>([
    { id: uid(), description: "", hs: "", qty: 1, unitPrice: 0, packaging: 0 },
  ]);
  const [lookupByLine, setLookupByLine] = React.useState<Record<string, ProductTaxLookup>>({});
  const [lookupLoadingByLine, setLookupLoadingByLine] = React.useState<Record<string, boolean>>({});

  const [dutyImportRate, setDutyImportRate] = React.useState(0);
  const [dutyExportRate, setDutyExportRate] = React.useState(0);
  const [vatRate, setVatRate] = React.useState(0);

  const [transportCost, setTransportCost] = React.useState(0);
  const [handlingCost, setHandlingCost] = React.useState(0);
  const [insurancePercent, setInsurancePercent] = React.useState(0.3);
  const [brokerage, setBrokerage] = React.useState(0);
  const [misc, setMisc] = React.useState(0);

  const [ddpMode, setDdpMode] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(true);

  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const effectiveDestination = destination === "__other__" ? customDestination.trim() : destination;

  React.useEffect(() => {
    if (!effectiveDestination) return;
    const refRate = getVatRateForDestination(effectiveDestination as any);
    if (refRate && vatRate === 0) {
      setVatRate(refRate.rate_standard ?? 0);
    }
  }, [effectiveDestination, vatRate]);

  const destinationInfo = React.useMemo(() => {
    const target = normalizeText(effectiveDestination || "");
    if (!target) return null;
    return referenceData.destinations.find((d) => normalizeText(String(d.destination)) === target) || null;
  }, [effectiveDestination, referenceData.destinations]);

  const incotermRule = React.useMemo(() => getIncotermRule(incoterm), [incoterm]);
  const insuranceRequired = incoterm === "CIF" || incoterm === "CIP";
  const includeTransport = INCLUDE_TRANSPORT_INCOTERMS.includes(incoterm);

  const updateLine = (id: string, patch: Partial<ProductLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { id: uid(), description: "", hs: "", qty: 1, unitPrice: 0, packaging: 0 }]);
  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
    setLookupByLine((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const detectProductTaxes = async (line: ProductLine) => {
    if (!effectiveDestination) return;
    setLookupLoadingByLine((prev) => ({ ...prev, [line.id]: true }));
    try {
      const resp = await fetch("/api/taxes-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: line.description,
          destination: effectiveDestination,
          hs_hint: line.hs,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "lookup_failed");
      const result: ProductTaxLookup = {
        hs_code: data?.hs_code ?? null,
        om_rate: Number(data?.om_rate || 0),
        omr_rate: Number(data?.omr_rate || 0),
        taxes_rate: Number(data?.taxes_rate || 0),
        source: data?.source ?? null,
        note: data?.note ?? null,
        openai_enabled: Boolean(data?.openai_enabled),
      };
      setLookupByLine((prev) => ({ ...prev, [line.id]: result }));
      if (result.hs_code) updateLine(line.id, { hs: result.hs_code });
    } catch (err) {
      setLookupByLine((prev) => ({
        ...prev,
        [line.id]: {
          hs_code: null,
          om_rate: 0,
          omr_rate: 0,
          taxes_rate: 0,
          note: err instanceof Error ? err.message : "Détection impossible",
        },
      }));
    } finally {
      setLookupLoadingByLine((prev) => ({ ...prev, [line.id]: false }));
    }
  };

  const merchandiseValue = React.useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0),
    [lines]
  );
  const packagingValue = React.useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.packaging) || 0), 0),
    [lines]
  );

  const goodsValue = merchandiseValue + packagingValue;
  const insurance = (goodsValue * insurancePercent) / 100;
  const transportBase = includeTransport ? transportCost + handlingCost : 0;

  const baseDuty = goodsValue + transportBase + insurance + brokerage + misc;
  const dutiesImport = (baseDuty * dutyImportRate) / 100;
  const dutiesExport = (baseDuty * dutyExportRate) / 100;
  const dutyRateTotal = dutyImportRate + dutyExportRate;

  const landed = React.useMemo(() => {
    return computeLandedCost({
      goodsValue,
      currency,
      quantity: undefined,
      destination: effectiveDestination || "",
      incoterm,
      mode,
      preCarriage: 0,
      mainFreight: includeTransport ? transportCost : 0,
      insuranceType: "percent",
      insuranceValue: insurancePercent,
      packaging: packagingValue,
      brokerage,
      misc: misc + handlingCost,
      dutyRate: dutyRateTotal,
      vatRate,
    });
  }, [goodsValue, currency, effectiveDestination, incoterm, mode, includeTransport, transportCost, insurancePercent, packagingValue, brokerage, misc, handlingCost, dutyRateTotal, vatRate]);

  const hsList = React.useMemo(() => {
    return lines.map((l) => String(l.hs || "").replace(/[^0-9]/g, "")).filter(Boolean);
  }, [lines]);

  const omMatches = React.useMemo(() => {
    const destKey = normalizeText(effectiveDestination || "");
    if (!destKey) return [];
    return (octroiMerRates || []).filter((r) => {
      const rDest = normalizeText(String(r.destination || ""));
      if (!rDest || rDest !== destKey) return false;
      if (!hsList.length) return true;
      const rHs = String((r as any).hs_code || "").replace(/[^0-9]/g, "");
      if (!rHs) return true;
      return hsList.some((hs) => hs.startsWith(rHs) || rHs.startsWith(hs));
    });
  }, [octroiMerRates, effectiveDestination, hsList]);

  const effectiveDdp = incoterm === "DDP" || ddpMode;
  const totalBeforeTaxes = goodsValue + transportBase + insurance + brokerage + misc;
  const totalDdp = landed.total;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Taxes produit</p>
            <h1 className="text-2xl font-bold">Taxes produit: HS, taxes & OM par destination</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saisissez un produit libre: on détecte le HS, les taxes et OM/OMR selon la destination (sans format tableau imposé).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/app/assistant">Poser une question IA</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact">Contacter un humain</Link>
            </Button>
          </div>
        </div>

        {ratesError ? (
          <Alert>
            <AlertTitle>Données de référence indisponibles</AlertTitle>
            <AlertDescription>{ratesError}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Saisie & paramètres
              </CardTitle>
              <CardDescription>Valeur marchandise = produits + conditionnement (HT).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Destination</div>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger>
                      <SelectValue placeholder="Destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other__">Autre destination</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Incoterm</div>
                  <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Incoterm" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Mode transport</div>
                  <Select value={mode} onValueChange={(v) => setMode(v as TransportMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Transport" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Devise</div>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Devise" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {destination === "__other__" ? (
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs text-muted-foreground">Destination (libre)</div>
                    <Input
                      value={customDestination}
                      onChange={(e) => setCustomDestination(e.target.value)}
                      placeholder="Pays ou zone"
                    />
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Produits, HS & taxes</div>
                  <Button variant="outline" onClick={addLine}>
                    Ajouter un produit
                  </Button>
                </div>

                <div className="space-y-3">
                  {lines.map((line) => (
                    <React.Fragment key={line.id}>
                      <div
                        className="grid gap-3 md:grid-cols-[2fr_0.8fr_0.6fr_0.8fr_0.8fr_auto_auto] items-end"
                      >
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Produit</div>
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(line.id, { description: e.target.value })}
                            placeholder="Produit / référence"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">HS code</div>
                          <Input
                            value={line.hs}
                            onChange={(e) => updateLine(line.id, { hs: e.target.value })}
                            placeholder="Ex : 6109"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Qté</div>
                          <Input
                            type="number"
                            min={0}
                            value={line.qty}
                            onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Prix unitaire</div>
                          <Input
                            type="number"
                            min={0}
                            value={line.unitPrice}
                            onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Conditionnement</div>
                          <Input
                            type="number"
                            min={0}
                            value={line.packaging}
                            onChange={(e) => updateLine(line.id, { packaging: Number(e.target.value) || 0 })}
                            placeholder="/ unité"
                          />
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => void detectProductTaxes(line)}
                          disabled={lookupLoadingByLine[line.id]}
                        >
                          {lookupLoadingByLine[line.id] ? "Détection..." : "Détecter HS/taxes"}
                        </Button>
                        <Button variant="ghost" onClick={() => removeLine(line.id)}>
                          Retirer
                        </Button>
                      </div>
                      {lookupByLine[line.id] ? (
                        <div className="md:col-span-7 rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
                          HS détecté: <span className="font-medium text-foreground">{lookupByLine[line.id].hs_code || "n/a"}</span>
                          {" · "}Taxes: <span className="font-medium text-foreground">{formatPct(lookupByLine[line.id].taxes_rate)}</span>
                          {" · "}OM: <span className="font-medium text-foreground">{formatPct(lookupByLine[line.id].om_rate)}</span>
                          {" · "}OMR: <span className="font-medium text-foreground">{formatPct(lookupByLine[line.id].omr_rate)}</span>
                          {lookupByLine[line.id].openai_enabled ? " · IA active" : " · IA indisponible"}
                          {lookupByLine[line.id].note ? <div className="mt-1">Note: {lookupByLine[line.id].note}</div> : null}
                        </div>
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Marchandise HT</div>
                    <div className="text-lg font-semibold">{formatMoney(merchandiseValue, currency)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Conditionnement</div>
                    <div className="text-lg font-semibold">{formatMoney(packagingValue, currency)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Valeur marchandise</div>
                    <div className="text-lg font-semibold">{formatMoney(goodsValue, currency)}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Transport principal</div>
                  <Input type="number" value={transportCost} onChange={(e) => setTransportCost(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Manutention</div>
                  <Input type="number" value={handlingCost} onChange={(e) => setHandlingCost(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Assurance (%)</div>
                  <Input type="number" value={insurancePercent} onChange={(e) => setInsurancePercent(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Frais dossier / transit</div>
                  <Input type="number" value={brokerage} onChange={(e) => setBrokerage(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Autres frais</div>
                  <Input type="number" value={misc} onChange={(e) => setMisc(Number(e.target.value))} min={0} />
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Droits import (%)</div>
                  <Input type="number" value={dutyImportRate} onChange={(e) => setDutyImportRate(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Droits export (%)</div>
                  <Input type="number" value={dutyExportRate} onChange={(e) => setDutyExportRate(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">TVA import (%)</div>
                  <Input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} min={0} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={ddpMode} onCheckedChange={setDdpMode} />
                  <div>
                    <div className="text-sm font-medium">Mode DDP</div>
                    <div className="text-xs text-muted-foreground">Inclure taxes locales dans le prix rendu.</div>
                  </div>
                </div>
              </div>

              {insuranceRequired ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Assurance obligatoire pour {incoterm}. Renseignez un pourcentage minimum adapté au contrat.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={scrollToResults}>
                  Voir le résultat
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card ref={resultsRef} className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgePercent className="h-5 w-5 text-blue-600" />
                Résultat
              </CardTitle>
              <CardDescription>Taxes locales, base douane et total rendu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Base douane</div>
                  <div className="text-lg font-semibold">{formatMoney(baseDuty, currency)}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Droits total</div>
                  <div className="text-lg font-semibold">{formatMoney(dutiesImport + dutiesExport, currency)}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">TVA import</div>
                  <div className="text-lg font-semibold">{formatMoney(landed.breakdown.vat, currency)}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Total hors taxes</div>
                  <div className="text-lg font-semibold">{formatMoney(totalBeforeTaxes, currency)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-blue-700">
                  {effectiveDdp ? "Total rendu DDP" : "Total si DDP"}
                </div>
                <div className="mt-1 text-2xl font-bold text-blue-900">{formatMoney(totalDdp, currency)}</div>
                {landed.unitCost ? (
                  <div className="mt-1 text-xs text-blue-700">Coût unitaire: {formatMoney(landed.unitCost, currency)}</div>
                ) : null}
              </div>

              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Détails et alertes
                    {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {landed.warnings.map((w) => (
                    <div key={w} className="flex items-start gap-2">
                      <CircleAlert className="h-3.5 w-3.5 text-amber-500" />
                      <span>{w}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Droits total: {formatPct(dutyRateTotal)}</Badge>
                <Badge variant="secondary">TVA: {formatPct(vatRate)}</Badge>
                <Badge variant="outline">Devise: {currency}</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Qui paie quoi
              </CardTitle>
              <CardDescription>Lecture rapide des responsabilités Incoterm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {incotermRule ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Transport principal</span>
                    <Badge variant="outline">{incotermRule.transport_principal}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Droits douane</span>
                    <Badge variant="outline">{incotermRule.droits_douane}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>TVA import</span>
                    <Badge variant="outline">{incotermRule.tva_import}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Assurance</span>
                    <Badge variant="outline">{incotermRule.assurance}</Badge>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Règles non configurées pour {incoterm}. Vérifiez la fiche Incoterm.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-blue-600" />
                Repère destination
              </CardTitle>
              <CardDescription>Informations pratiques (TVA, taxes possibles, docs).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {destinationInfo ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Zone</span>
                    <Badge variant="outline">{destinationInfo.zone}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Régime TVA</span>
                    <span className="text-xs text-muted-foreground">{destinationInfo.tvaRegime}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {destinationInfo.taxesPossibles.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {destinationInfo.flags.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Aucun repère pour cette destination. Utilisez les liens officiels ci-dessous.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-blue-600" />
                Octroi de mer / OM
              </CardTitle>
              <CardDescription>Actif pour les DROM si data disponible.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {ratesLoading ? (
                <div className="text-xs text-muted-foreground">Chargement des taux...</div>
              ) : omMatches.length ? (
                <div className="space-y-2">
                  {omMatches.slice(0, 4).map((r, idx) => (
                    <div key={`${r.destination}-${idx}`} className="rounded-lg border p-2">
                      <div className="text-xs text-muted-foreground">{r.category || "Standard"}</div>
                      <div className="text-sm font-medium">
                        OM {formatPct(r.om_rate)} / OMR {formatPct(r.omr_rate)}
                      </div>
                      {r.notes ? <div className="text-xs text-muted-foreground">{r.notes}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Aucun taux OM disponible. Ajoutez une table OM ou un HS pour filtrer.
                </div>
              )}
              <div className="text-xs text-muted-foreground">OM charges: {stats.om_total}</div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-blue-600" />
                Ce qu'il faut vérifier
              </CardTitle>
              <CardDescription>Checklist rapide avant devis DAP/DDP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>1. HS code exact (préfixe HS4/HS6 si besoin).</div>
              <div>2. Base douane = marchandise + conditionnement + transport + assurance + frais.</div>
              <div>3. Droits import + TVA import selon incoterm.</div>
              <div>4. Documents obligatoires (facture, origine, packing list).</div>
              <div>5. Si DDP: vérifier capacité locale (douane + TVA).</div>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleCheck className="h-4 w-4 text-blue-600" />
                Données de référence
              </CardTitle>
              <CardDescription>État des tables taxes dans Supabase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>TVA (rates)</span>
                <Badge variant="outline">{vatRates.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Octroi mer</span>
                <Badge variant="outline">{stats.om_total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>OM par HS</span>
                <Badge variant="outline">{stats.om_hs}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleAlert className="h-3.5 w-3.5" />
                Si les tables sont vides, ajoutez la migration ou chargez un CSV dans Supabase.
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">Ressources utiles</CardTitle>
            <CardDescription>Sources officielles pour vérifier les taux.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Access2Markets (UE)</Badge>
            <Badge variant="secondary">TARIC UE</Badge>
            <Badge variant="secondary">Douanes.gouv</Badge>
            <Badge variant="secondary">TARES Suisse</Badge>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
