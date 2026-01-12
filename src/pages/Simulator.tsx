import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProducts, safeNumber } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { getZoneFromDestination } from "@/data/referenceRates";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const DESTINATIONS = ["Metropole", "Guadeloupe", "Martinique", "Guyane", "Reunion", "Mayotte", "Belgique", "Espagne"] as const;
const INCOTERMS = ["EXW", "DAP", "DDP"] as const;

type Destination = (typeof DESTINATIONS)[number];
type Incoterm = (typeof INCOTERMS)[number];
type TerritoryCode = "GP" | "MQ" | "GF" | "RE" | "YT";

function estimateTransport(destination: Destination, weightKg: number) {
  const w = Math.max(0.5, weightKg || 0);
  const isDrom = ["Guadeloupe", "Martinique", "Guyane", "Reunion", "Mayotte"].includes(destination);
  const base = isDrom ? 35 : 18;
  const perKg = isDrom ? 3.2 : 1.4;
  return base + perKg * w;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(n) ? n : 0);
}

function getTerritoryCodeFromDestination(dest: Destination): TerritoryCode | null {
  if (dest === "Guadeloupe") return "GP";
  if (dest === "Martinique") return "MQ";
  if (dest === "Guyane") return "GF";
  if (dest === "Reunion") return "RE";
  if (dest === "Mayotte") return "YT";
  return null;
}

function normalizeRateToFraction(rate: number) {
  // 12.5 => 0.125 ; 0.125 => 0.125
  if (!Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function formatRatePercent(rateRaw: number) {
  const frac = normalizeRateToFraction(rateRaw);
  return `${(frac * 100).toFixed(2)}%`;
}

export default function Simulator() {
  const { products, isLoading, error, envOk } = useProducts({ pageSize: 2000 });

  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);

  const [destination, setDestination] = useState<Destination>("Martinique");
  const [incoterm, setIncoterm] = useState<Incoterm>("DDP");

  const [manualPrice, setManualPrice] = useState<number | "">("");
  const [manualWeight, setManualWeight] = useState<number | "">("");

  // OM
  const [omRateRaw, setOmRateRaw] = useState<number | null>(null);
  const [omRateYear, setOmRateYear] = useState<number | null>(null);
  const [omLoading, setOmLoading] = useState(false);
  const [omError, setOmError] = useState<string | null>(null);

  const product = useMemo(() => products.find((p) => p.code_article === sku), [products, sku]);

  const unitPrice = useMemo(() => {
    const fallback = safeNumber(product?.tarif_catalogue_2025) || safeNumber(product?.tarif_lppr_eur) || 0;
    return manualPrice === "" ? fallback : Number(manualPrice) || 0;
  }, [product, manualPrice]);

  const weightKg = useMemo(() => {
    const w = safeNumber((product as any)?.unite_vente_poids_brut_g) || 0;
    const auto = (w * qty) / 1000;
    return manualWeight === "" ? auto : Number(manualWeight) || 0;
  }, [product, manualWeight, qty]);

  const zone = useMemo(() => getZoneFromDestination(destination as any), [destination]);
  const territory = useMemo(() => getTerritoryCodeFromDestination(destination), [destination]);

  const hsCode = useMemo(() => {
    const raw = String((product as any)?.hs_code || (product as any)?.hsCode || "").replace(/[^\d]/g, "");
    return raw || null;
  }, [product]);

  const hs4 = useMemo(() => (hsCode && hsCode.length >= 4 ? hsCode.slice(0, 4) : null), [hsCode]);

  // TVA : simplifié (cohérent avec tes factures export)
  // - Métropole : TVA produit (ou 20%)
  // - Hors Métropole : TVA 0 (exonération / export)
  const tvaRate = useMemo(() => {
    if (destination === "Metropole") return (product as any)?.tva_percent ?? 20;
    return 0;
  }, [destination, product]);

  const ht = unitPrice * qty;
  const tva = ht * (Number(tvaRate) / 100);

  const transportEstimated = useMemo(() => estimateTransport(destination, weightKg), [destination, weightKg]);
  const feesFixed = 15;

  // Qui paye quoi selon incoterm (vision vendeur)
  const transportSeller = incoterm === "EXW" ? 0 : transportEstimated;
  // OM : uniquement DROM + HS4 connu (sinon 0)
  const omRateFraction = normalizeRateToFraction(safeNumber(omRateRaw));
  const omTheoretical = useMemo(() => {
    if (zone !== "DROM") return 0;
    if (!hs4) return 0;
    return ht * omRateFraction;
  }, [zone, hs4, ht, omRateFraction]);

  const omSeller = incoterm === "DDP" ? omTheoretical : 0;
  const omBuyer = incoterm === "DDP" ? 0 : omTheoretical;

  const totalSeller = ht + tva + transportSeller + feesFixed + omSeller;

  // Fetch OM rate (Supabase)
  useEffect(() => {
    let mounted = true;

    async function run() {
      setOmError(null);
      setOmRateRaw(null);
      setOmRateYear(null);

      if (zone !== "DROM") return;
      if (!territory) return;
      if (!hs4) return;

      setOmLoading(true);
      try {
        const { data, error } = await supabase
          .from("om_rates")
          .select("om_rate, year")
          .eq("territory_code", territory)
          .eq("hs4", hs4)
          .order("year", { ascending: false })
          .limit(1);

        if (error) throw error;

        const row = (data || [])[0] as any;
        const rate = row?.om_rate ?? null;
        const year = row?.year ?? null;

        if (mounted) {
          setOmRateRaw(rate !== null ? Number(rate) : null);
          setOmRateYear(year !== null ? Number(year) : null);
        }
      } catch (e: any) {
        if (mounted) setOmError(e?.message || String(e));
      } finally {
        if (mounted) setOmLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [zone, territory, hs4]);

  const chartData = useMemo(() => {
    return [
      { name: "Marchandise HT", value: ht },
      { name: "TVA", value: tva },
      { name: "Transport", value: transportSeller },
      { name: "Frais fixes", value: feesFixed },
      { name: "OM (si vendeur)", value: omSeller },
    ];
  }, [ht, tva, transportSeller, feesFixed, omSeller]);

  return (
    <MainLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Simulateur export</p>
          <h1 className="text-2xl font-bold">Estimation rapide prix / charges</h1>
          <p className="text-sm text-muted-foreground">
            Catalogue produit + destination + incoterm : détail HT / TVA / OM / transport / frais.
          </p>
        </div>

        {!envOk ? (
          <Card className="border-amber-300 bg-amber-50 text-amber-900">
            <CardContent className="pt-4 text-sm">Supabase non configuré : affichage mode local (catalogue vide).</CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-rose-300 bg-rose-50 text-rose-900">
            <CardContent className="pt-4 text-sm">{String(error)}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Paramètres */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Paramètres</CardTitle>
              <CardDescription>Produit catalogue + destination + incoterm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Produit (SKU)</Label>
                <Select value={sku} onValueChange={setSku}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoading ? "Chargement..." : "Choisir un produit"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {products.slice(0, 800).map((p) => (
                      <SelectItem key={p.code_article} value={p.code_article}>
                        {p.code_article} — {(p.libelle_article || "").slice(0, 60)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {product ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline">HS: {hsCode || "non renseigné"}</Badge>
                    <Badge variant="outline">Zone: {zone}</Badge>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <Label>Prix unitaire (€) (optionnel)</Label>
                  <Input
                    type="number"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">Auto : tarif_catalogue_2025 / LPPR.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Destination</Label>
                  <Select value={destination} onValueChange={(v) => setDestination(v as Destination)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DESTINATIONS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Incoterm</Label>
                  <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    EXW : transport/OM côté acheteur • DAP : transport vendeur • DDP : transport + OM vendeur
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Poids total (kg) (optionnel)</Label>
                  <Input
                    type="number"
                    value={manualWeight}
                    onChange={(e) => setManualWeight(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">Auto : poids brut × quantité.</p>
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setManualPrice("");
                      setManualWeight("");
                    }}
                  >
                    Reset valeurs auto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Résultats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Résultat estimation</CardTitle>
              <CardDescription>Coût vendeur estimé (selon incoterm) vers {destination}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-2">
              <InfoRow label="Valeur marchandise HT" value={formatCurrency(ht)} hint={product?.libelle_article || ""} />
              <InfoRow label={`TVA (${Number(tvaRate).toFixed(2)}%)`} value={formatCurrency(tva)} hint={destination === "Metropole" ? "TVA France" : "Export : TVA 0% (par défaut)"} />

              <InfoRow label="Transport estimé (si vendeur)" value={formatCurrency(transportSeller)} hint={incoterm === "EXW" ? "EXW : transport non inclus vendeur" : "Transport estimé selon poids/destination"} />
              <InfoRow label="Frais fixes (dossier/etc.)" value={formatCurrency(feesFixed)} />

              <div className="rounded-lg border p-3 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">OM théorique</div>
                    <div className="text-xs text-muted-foreground">
                      {zone !== "DROM"
                        ? "Non applicable (destination hors DROM)"
                        : !hs4
                        ? "HS manquant : OM non calculable"
                        : omLoading
                        ? "Chargement du taux OM..."
                        : omRateRaw === null
                        ? "Taux OM non trouvé (table om_rates)"
                        : `Taux ${formatRatePercent(omRateRaw)} • HS4 ${hs4}${omRateYear ? ` • ${omRateYear}` : ""}`}
                    </div>
                  </div>
                  <div className="text-lg font-bold">{formatCurrency(omTheoretical)}</div>
                </div>

                {omError ? (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                    Erreur OM : {omError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">OM à charge vendeur : {formatCurrency(omSeller)}</Badge>
                  <Badge variant="outline">OM à charge acheteur : {formatCurrency(omBuyer)}</Badge>
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Total vendeur estimé</div>
                  <div className="text-xs text-muted-foreground">Incoterm {incoterm}</div>
                </div>
                <div className="text-lg font-bold">{formatCurrency(totalSeller)}</div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Poids estimé : {weightKg.toFixed(2)} kg</Badge>
                <Badge variant="outline">Tarif : {formatCurrency(unitPrice)} /u</Badge>
              </div>

              <Separator className="my-2" />

              <div className="space-y-2">
                <div className="text-sm font-semibold">Graphique (composition du coût vendeur)</div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${Math.round(v)}€`} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 bg-white">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint.slice(0, 120)}</div> : null}
      </div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}
