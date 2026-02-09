import * as React from "react";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { computeLandedCost, type Currency, type Incoterm } from "@/lib/exportSimulator";
import { CostBreakdownBar, CostSharePie } from "@/components/charts/CostCharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

const INCOTERMS: Incoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CHF", "CNY"];

export default function ExportSimulator() {
  const [form, setForm] = React.useState({
    quantity: 100,

    productUnitPrice: 12.5,
    productCurrency: "EUR" as Currency,
    fxToEur: 0.92,

    incoterm: "EXW" as Incoterm,

    preCarriageEur: 120,
    mainCarriageEur: 450,
    insuranceMode: "rate" as "rate" | "fixed",
    insuranceRatePct: 0.6,
    insuranceFixedEur: 0,

    exportClearanceEur: 40,
    importClearanceEur: 85,
    handlingEur: 60,
    otherFeesEur: 35,

    dutyRatePct: 4.2,
    preferOrigin: false,
    dutyRatePreferentialPct: 0,
    vatRatePct: 20,

    sellingUnitPriceEur: 21,
  });

  const result = React.useMemo(() => computeLandedCost(form), [form]);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const onNum =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [k]: Number(e.target.value) }));

  const onStr =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <AppLayout wrapperClassName="simulator-world">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* HERO */}
        <div className="mb-8 rounded-3xl border bg-card/95 p-6 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Simulation opérationnelle
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Calcule ton coût complet export (Incoterm, transport, droits, TVA)
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Décide vite, sans approximations — coût complet, coût unitaire, marge, et lecture visuelle.
              </p>

              {/* mini actions (cohérent avec l'app) */}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/app/control-tower">
                  <Button variant="outline">Retour cockpit</Button>
                </Link>
                <Link to="/app/centre-veille/reglementation">
                  <Button variant="outline">Veille</Button>
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setForm((s) => ({ ...s, incoterm: "EXW", productCurrency: "EUR", fxToEur: 1 }));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Repartir d’un exemple
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {/* INPUTS */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Paramètres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantité</Label>
                  <Input type="number" value={form.quantity} onChange={onNum("quantity")} min={1} />
                </div>

                <div className="space-y-2">
                  <Label>Incoterm</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.incoterm}
                    onChange={onStr("incoterm")}
                  >
                    {INCOTERMS.map((it) => (
                      <option key={it} value={it}>
                        {it}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Prix unitaire produit</Label>
                  <Input
                    type="number"
                    value={form.productUnitPrice}
                    onChange={onNum("productUnitPrice")}
                    min={0}
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Devise</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.productCurrency}
                    onChange={(e) => setForm((s) => ({ ...s, productCurrency: e.target.value as Currency }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Taux de change → EUR (1 devise = X EUR)</Label>
                  <Input type="number" value={form.fxToEur} onChange={onNum("fxToEur")} min={0} step="0.0001" />
                  <div className="text-xs text-muted-foreground">Si devise = EUR, tu peux laisser 1.</div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Pré-acheminement (€)</Label>
                  <Input
                    type="number"
                    value={form.preCarriageEur}
                    onChange={onNum("preCarriageEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Transport principal (€)</Label>
                  <Input
                    type="number"
                    value={form.mainCarriageEur}
                    onChange={onNum("mainCarriageEur")}
                    min={0}
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assurance</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.insuranceMode}
                    onChange={(e) => setForm((s) => ({ ...s, insuranceMode: e.target.value as any }))}
                  >
                    <option value="rate">Taux (%)</option>
                    <option value="fixed">Forfait (€)</option>
                  </select>
                </div>

                {form.insuranceMode === "rate" ? (
                  <div className="space-y-2">
                    <Label>Taux assurance (%)</Label>
                    <Input
                      type="number"
                      value={form.insuranceRatePct}
                      onChange={onNum("insuranceRatePct")}
                      min={0}
                      step="0.01"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Assurance forfait (€)</Label>
                    <Input
                      type="number"
                      value={form.insuranceFixedEur}
                      onChange={onNum("insuranceFixedEur")}
                      min={0}
                      step="0.01"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Formalités export (€)</Label>
                  <Input
                    type="number"
                    value={form.exportClearanceEur}
                    onChange={onNum("exportClearanceEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dédouanement import (€)</Label>
                  <Input
                    type="number"
                    value={form.importClearanceEur}
                    onChange={onNum("importClearanceEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manutention / terminal (€)</Label>
                  <Input
                    type="number"
                    value={form.handlingEur}
                    onChange={onNum("handlingEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Autres frais (€)</Label>
                  <Input
                    type="number"
                    value={form.otherFeesEur}
                    onChange={onNum("otherFeesEur")}
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Droits de douane (%)</Label>
                  <Input type="number" value={form.dutyRatePct} onChange={onNum("dutyRatePct")} min={0} step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>TVA import (%)</Label>
                  <Input type="number" value={form.vatRatePct} onChange={onNum("vatRatePct")} min={0} step="0.01" />
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    id="prefer"
                    type="checkbox"
                    checked={form.preferOrigin}
                    onChange={(e) => setForm((s) => ({ ...s, preferOrigin: e.target.checked }))}
                  />
                  <Label htmlFor="prefer">Origine préférentielle (réduction droits)</Label>
                </div>

                {form.preferOrigin ? (
                  <div className="space-y-2 col-span-2">
                    <Label>Droits préférentiels (%)</Label>
                    <Input
                      type="number"
                      value={form.dutyRatePreferentialPct}
                      onChange={onNum("dutyRatePreferentialPct")}
                      min={0}
                      step="0.01"
                    />
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Prix de vente unitaire (€) (pour marge)</Label>
                <Input
                  type="number"
                  value={form.sellingUnitPriceEur}
                  onChange={onNum("sellingUnitPriceEur")}
                  min={0}
                  step="0.01"
                />
              </div>


              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={scrollToResults}>
                  Voir le resultat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* OUTPUTS + CHARTS */}
          <div ref={resultsRef} className="space-y-6 md:col-span-3">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Coût complet</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{eur(result.totalLandedCostEur)}</CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Coût unitaire</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{eur(result.unitLandedCostEur)}</CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-2xl font-semibold">{result.marginEur !== undefined ? eur(result.marginEur) : "—"}</div>
                  <div className="text-sm text-muted-foreground">
                    {result.marginPct !== undefined ? `${pct(result.marginPct)} du CA` : "Renseigne un prix de vente"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Lecture douane (utile pour vérifier)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valeur marchandise</span>
                  <span className="font-medium">{eur(result.goodsValueEur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valeur en douane (base droits)</span>
                  <span className="font-medium">{eur(result.customsValueEur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Droits</span>
                  <span className="font-medium">{eur(result.dutyEur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TVA (base {eur(result.vatBaseEur)})</span>
                  <span className="font-medium">{eur(result.vatEur)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Répartition des coûts</CardTitle>
                </CardHeader>
                <CardContent>
                  <CostBreakdownBar lines={result.lines.map((l) => ({ label: l.label, amountEur: l.amountEur }))} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Part relative</CardTitle>
                </CardHeader>
                <CardContent>
                  <CostSharePie lines={result.lines.map((l) => ({ label: l.label, amountEur: l.amountEur }))} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border p-6 text-sm text-muted-foreground">
          Hypothèses simplifiées (mais opérationnelles) : valeur en douane ~ marchandise + transport principal + assurance
          (et pré-acheminement selon incoterm). Base TVA import ~ valeur douane + droits + frais import.
        </div>
      </div>
    </AppLayout>
  );
}
