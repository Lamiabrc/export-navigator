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

import {
  BadgePercent,
  Calculator,
  CircleAlert,
  CircleCheck,
  Globe,
  Info,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { computeLandedCost, type Incoterm, type TransportMode } from "@/lib/landedCost";
import { useReferenceRates } from "@/hooks/useReferenceRates";
import { useReferenceData } from "@/hooks/useReferenceData";
import { getIncotermRule, getVatRateForDestination } from "@/data/referenceRates";

const INCOTERMS: Incoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const MODES: TransportMode[] = ["road", "sea", "air", "rail"];
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

  const [hsCode, setHsCode] = React.useState("");
  const [incoterm, setIncoterm] = React.useState<Incoterm>("DAP");
  const [mode, setMode] = React.useState<TransportMode>("road");
  const [currency, setCurrency] = React.useState("EUR");
  const [goodsValue, setGoodsValue] = React.useState(10000);
  const [quantity, setQuantity] = React.useState(1);

  const [dutyImportRate, setDutyImportRate] = React.useState(0);
  const [dutyExportRate, setDutyExportRate] = React.useState(0);
  const [vatRate, setVatRate] = React.useState(0);

  const [mainFreight, setMainFreight] = React.useState(0);
  const [insurancePercent, setInsurancePercent] = React.useState(0.3);
  const [brokerage, setBrokerage] = React.useState(0);
  const [misc, setMisc] = React.useState(0);
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
    return (
      referenceData.destinations.find((d) => normalizeText(String(d.destination)) === target) || null
    );
  }, [effectiveDestination, referenceData.destinations]);

  const incotermRule = React.useMemo(() => getIncotermRule(incoterm), [incoterm]);
  const insuranceRequired = incoterm === "CIF" || incoterm === "CIP";

  const baseDuty = React.useMemo(() => {
    const insurance = (goodsValue * insurancePercent) / 100;
    return goodsValue + mainFreight + insurance + brokerage + misc;
  }, [goodsValue, insurancePercent, mainFreight, brokerage, misc]);

  const dutiesImport = React.useMemo(() => (baseDuty * dutyImportRate) / 100, [baseDuty, dutyImportRate]);
  const dutiesExport = React.useMemo(() => (baseDuty * dutyExportRate) / 100, [baseDuty, dutyExportRate]);
  const dutyRateTotal = dutyImportRate + dutyExportRate;

  const landed = React.useMemo(() => {
    return computeLandedCost({
      goodsValue,
      currency,
      quantity: quantity > 0 ? quantity : undefined,
      destination: effectiveDestination || "",
      incoterm,
      mode,
      preCarriage: 0,
      mainFreight,
      insuranceType: "percent",
      insuranceValue: insurancePercent,
      packaging: 0,
      brokerage,
      misc,
      dutyRate: dutyRateTotal,
      vatRate,
    });
  }, [goodsValue, currency, quantity, effectiveDestination, incoterm, mode, mainFreight, insurancePercent, brokerage, misc, dutyRateTotal, vatRate]);

  const omMatches = React.useMemo(() => {
    const destKey = normalizeText(effectiveDestination || "");
    if (!destKey) return [];
    const hs = hsCode.replace(/[^0-9]/g, "");
    return (octroiMerRates || []).filter((r) => {
      const rDest = normalizeText(String(r.destination || ""));
      if (!rDest || rDest !== destKey) return false;
      if (!hs) return true;
      const rHs = String((r as any).hs_code || "").replace(/[^0-9]/g, "");
      if (!rHs) return true;
      return hs.startsWith(rHs) || rHs.startsWith(hs);
    });
  }, [octroiMerRates, effectiveDestination, hsCode]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Taxes & douanes</p>
            <h1 className="text-2xl font-bold">Taxes, TVA import et Octroi de mer</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Page simple pour calculer les droits, clarifier qui paie quoi et preparer un cout rendu fiable.
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
            <AlertTitle>Donnees de reference indisponibles</AlertTitle>
            <AlertDescription>{ratesError}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Calcul rapide
              </CardTitle>
              <CardDescription>
                Renseigne destination, valeur et taux. Les montants se calculent automatiquement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <div className="text-xs text-muted-foreground">HS code</div>
                  <Input value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="ex: 902110" />
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
                  <div className="text-xs text-muted-foreground">Valeur marchandise</div>
                  <Input
                    type="number"
                    value={goodsValue}
                    onChange={(e) => setGoodsValue(Number(e.target.value))}
                    min={0}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Quantite</div>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    min={0}
                  />
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
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Droits import (%)</div>
                  <Input
                    type="number"
                    value={dutyImportRate}
                    onChange={(e) => setDutyImportRate(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Droits export (%)</div>
                  <Input
                    type="number"
                    value={dutyExportRate}
                    onChange={(e) => setDutyExportRate(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">TVA import (%)</div>
                  <Input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Transport principal</div>
                  <Input type="number" value={mainFreight} onChange={(e) => setMainFreight(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Assurance (%)</div>
                  <Input
                    type="number"
                    value={insurancePercent}
                    onChange={(e) => setInsurancePercent(Number(e.target.value))}
                    min={0}
                  />
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

              {insuranceRequired ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Assurance obligatoire pour {incoterm}. Renseigne un pourcentage minimum adapte au contrat.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={scrollToResults}>
                  Voir le resultat
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card ref={resultsRef} className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgePercent className="h-5 w-5 text-blue-600" />
                Resultat
              </CardTitle>
              <CardDescription>Montants calcules a partir des taux et de la valeur marchandise.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Base douane</div>
                  <div className="text-lg font-semibold">{formatMoney(baseDuty, currency)}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Droits import</div>
                  <div className="text-lg font-semibold">{formatMoney(dutiesImport, currency)}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Droits export</div>
                  <div className="text-lg font-semibold">{formatMoney(dutiesExport, currency)}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">TVA import</div>
                  <div className="text-lg font-semibold">{formatMoney(landed.breakdown.vat, currency)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-blue-700">Total</div>
                <div className="mt-1 text-2xl font-bold text-blue-900">{formatMoney(landed.total, currency)}</div>
                {landed.unitCost ? (
                  <div className="mt-1 text-xs text-blue-700">Cout unitaire: {formatMoney(landed.unitCost, currency)}</div>
                ) : null}
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                {landed.warnings.map((w) => (
                  <div key={w} className="flex items-start gap-2">
                    <CircleAlert className="h-3.5 w-3.5 text-amber-500" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>

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
              <CardDescription>Lecture rapide des responsabilites Incoterm.</CardDescription>
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
                  Regles non configurees pour {incoterm}. Verifie la fiche Incoterm.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-blue-600" />
                Repere destination
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
                    <span>Regime TVA</span>
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
                  Aucun repere pour cette destination. Utilise les liens officiels ci-dessous.
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
                  Aucun taux OM disponible. Ajoute une table OM ou un HS pour filtrer.
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
                Ce qu'il faut verifier
              </CardTitle>
              <CardDescription>Checklist rapide avant devis DAP/DDP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>1. HS code exact (prefixe HS4/HS6 si besoin).</div>
              <div>2. Base douane = valeur + transport + assurance + frais.</div>
              <div>3. Droits import + TVA import selon incoterm.</div>
              <div>4. Documents obligatoires (facture, origine, packing list).</div>
              <div>5. Si DDP: verifier capacite locale (douane + TVA).</div>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleCheck className="h-4 w-4 text-blue-600" />
                Donnees de reference
              </CardTitle>
              <CardDescription>Etat des tables taxes dans Supabase.</CardDescription>
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
                Si les tables sont vides, ajoute la migration ou charge un CSV dans Supabase.
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">Ressources utiles</CardTitle>
            <CardDescription>Sources officielles pour verifier les taux.</CardDescription>
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
