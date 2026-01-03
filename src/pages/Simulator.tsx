import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProducts, safeNumber } from "@/hooks/useProducts";

const DESTINATIONS = ["Metropole", "Guadeloupe", "Martinique", "Guyane", "Reunion", "Mayotte", "Belgique", "Espagne"];
const INCOTERMS = ["EXW", "DAP", "DDP"];

function estimateTransport(destination: string, weightKg: number) {
  const w = Math.max(0.5, weightKg || 0);
  const isDrom = ["Guadeloupe", "Martinique", "Guyane", "Reunion", "Mayotte"].includes(destination);
  const base = isDrom ? 35 : 18;
  const perKg = isDrom ? 3.2 : 1.4;
  return base + perKg * w;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(n) ? n : 0);
}

export default function Simulator() {
  const { products, isLoading, error, envOk } = useProducts({ pageSize: 2000 });
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [destination, setDestination] = useState("Martinique");
  const [incoterm, setIncoterm] = useState("DDP");
  const [manualPrice, setManualPrice] = useState<number | "">("");
  const [manualWeight, setManualWeight] = useState<number | "">("");

  const product = useMemo(() => products.find((p) => p.code_article === sku), [products, sku]);
  const unitPrice = useMemo(() => {
    const fallback = safeNumber(product?.tarif_catalogue_2025) || safeNumber(product?.tarif_lppr_eur) || 0;
    return manualPrice === "" ? fallback : Number(manualPrice) || 0;
  }, [product, manualPrice]);

  const weightKg = useMemo(() => {
    const w = safeNumber(product?.unite_vente_poids_brut_g) || 0;
    const auto = (w * qty) / 1000;
    return manualWeight === "" ? auto : Number(manualWeight) || 0;
  }, [product, manualWeight, qty]);

  const ht = unitPrice * qty;
  const tvaRate = product?.tva_percent ?? (destination === "Metropole" ? 20 : 8.5);
  const tva = ht * (tvaRate / 100);
  const transport = estimateTransport(destination, weightKg);
  const fees = 15;
  const total = ht + tva + transport + fees;

  return (
    <MainLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Simulateur export</p>
          <h1 className="text-2xl font-bold">Estimation rapide prix/charges</h1>
          <p className="text-sm text-muted-foreground">Catalogue produit + destination + incoterm ? détail coûts.</p>
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
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Quantité</Label>
                  <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <div>
                  <Label>Prix unitaire (€) (optionnel)</Label>
                  <Input type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value === "" ? "" : Number(e.target.value))} />
                  <p className="text-[11px] text-muted-foreground">Auto: tarif_catalogue_2025 / LPPR.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Destination</Label>
                  <Select value={destination} onValueChange={setDestination}>
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
                  <Select value={incoterm} onValueChange={setIncoterm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Poids total (kg) (optionnel)</Label>
                  <Input type="number" value={manualWeight} onChange={(e) => setManualWeight(e.target.value === "" ? "" : Number(e.target.value))} />
                  <p className="text-[11px] text-muted-foreground">Auto: poids brut x qty.</p>
                </div>
                <div className="flex items-end justify-end">
                  <Button type="button" onClick={() => { setManualPrice(""); setManualWeight(""); }}>Reset valeurs auto</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Résultat estimation</CardTitle>
              <CardDescription>Coût total expédier vers {destination}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <InfoRow label="Valeur marchandise HT" value={formatCurrency(ht)} hint={product?.libelle_article || ""} />
              <InfoRow label={`TVA ${tvaRate}%`} value={formatCurrency(tva)} />
              <InfoRow label="Transport estimé" value={formatCurrency(transport)} />
              <InfoRow label="Frais fixes (dossier/etc.)" value={formatCurrency(fees)} />
              <div className="rounded-lg border p-3 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Total TTC estimé</div>
                  <div className="text-xs text-muted-foreground">Incoterm {incoterm}</div>
                </div>
                <div className="text-lg font-bold">{formatCurrency(total)}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Poids estimé: {weightKg.toFixed(2)} kg</Badge>
                <Badge variant="outline">Tarif: {formatCurrency(unitPrice)} /u</Badge>
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
        {hint ? <div className="text-[11px] text-muted-foreground">{hint.slice(0, 80)}</div> : null}
      </div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}
