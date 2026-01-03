import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { calculateCosts, type ProductType, type CostBreakdown } from "@/utils/costCalculator";
import { getZoneFromDestination } from "@/data/referenceRates";
import { useReferenceRates } from "@/hooks/useReferenceRates";
import { useProducts, safeNumber, type ProductRow } from "@/hooks/useProducts";
import type { Destination, Incoterm, TransportMode } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calculator,
  Euro,
  MapPin,
  Truck,
  Package,
  TrendingUp,
  Check,
  AlertCircle,
  Info,
  Download,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";

const destinations: Destination[] = [
  "Guadeloupe",
  "Martinique",
  "Guyane",
  "Reunion",
  "Mayotte",
  "Belgique",
  "Espagne",
  "Luxembourg",
  "Suisse",
];

const incoterms: Incoterm[] = ["EXW", "FCA", "DAP", "DDP"];
const transportModes: TransportMode[] = ["Routier", "Maritime", "Aerien", "Express", "Ferroviaire"];

type GoodsValueMode = "manual" | "products";
type WeightMode = "manual" | "products";

type ProductLine = {
  code_article: string;
  qty: number;
};

const LINES_KEY = "export_simulator_product_lines_v1";
const GV_MODE_KEY = "export_simulator_goods_value_mode_v1";
const WT_MODE_KEY = "export_simulator_weight_mode_v1";

export default function Simulator() {
  const { vatRates, octroiMerRates, transportCosts, serviceCharges } = useReferenceRates();

  // ✅ produits (Supabase)
  const {
    products,
    isLoading: productsLoading,
    error: productsError,
    refresh: refreshProducts,
    getProductByCode,
    envOk: productsEnvOk,
    stats: productsStats,
  } = useProducts({ pageSize: 5000 });

  // valeurs existantes
  const [goodsValue, setGoodsValue] = useState<number>(10000);
  const [destination, setDestination] = useState<Destination>("Martinique");
  const [incoterm, setIncoterm] = useState<Incoterm>("DAP");
  const [productType, setProductType] = useState<ProductType>("lppr");
  const [transportMode, setTransportMode] = useState<TransportMode>("Maritime");
  const [weight, setWeight] = useState<number>(100);
  const [margin, setMargin] = useState<number>(25);

  const [goodsValueMode, setGoodsValueMode] = useState<GoodsValueMode>("manual");
  const [weightMode, setWeightMode] = useState<WeightMode>("manual");

  // 🧺 lignes produits
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [addCode, setAddCode] = useState("");
  const [addQty, setAddQty] = useState<number>(1);

  // restore from localStorage
  useEffect(() => {
    try {
      const rawLines = localStorage.getItem(LINES_KEY);
      if (rawLines) setLines(JSON.parse(rawLines));

      const gvm = localStorage.getItem(GV_MODE_KEY) as GoodsValueMode | null;
      if (gvm === "manual" || gvm === "products") setGoodsValueMode(gvm);

      const wtm = localStorage.getItem(WT_MODE_KEY) as WeightMode | null;
      if (wtm === "manual" || wtm === "products") setWeightMode(wtm);
    } catch {
      // ignore
    }
  }, []);
  // fallback: si mode produits mais aucune ligne, repasse en manuel pour éviter blocage
  useEffect(() => {
    if (goodsValueMode === "products" && lines.length === 0) {
      setGoodsValueMode("manual");
      if (goodsValue <= 0) setGoodsValue(1000);
    }
    if (weightMode === "products" && lines.length === 0) {
      setWeightMode("manual");
      if (weight <= 0) setWeight(10);
    }
  }, [goodsValueMode, weightMode, lines.length, goodsValue, weight]);

  // persist
  useEffect(() => {
    localStorage.setItem(LINES_KEY, JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    localStorage.setItem(GV_MODE_KEY, goodsValueMode);
  }, [goodsValueMode]);

  useEffect(() => {
    localStorage.setItem(WT_MODE_KEY, weightMode);
  }, [weightMode]);

  const zone = getZoneFromDestination(destination);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
      Number.isFinite(amount) ? amount : 0,
    );

  const resolveUnitPrice = (p?: ProductRow, type?: ProductType) => {
    if (!p) return 0;
    if (type === "lppr") return safeNumber(p.tarif_lppr_eur) || safeNumber(p.tarif_catalogue_2025);
    return safeNumber(p.tarif_catalogue_2025) || safeNumber(p.tarif_lppr_eur);
  };

  const goodsValueFromProducts = useMemo(() => {
    if (!lines.length) return 0;

    return lines.reduce((sum, l) => {
      const code = String(l.code_article ?? "").trim();
      const p = getProductByCode(code);
      const qty = Math.max(0, safeNumber(l.qty));
      const unit = resolveUnitPrice(p, productType);
      return sum + qty * unit;
    }, 0);
  }, [lines, getProductByCode, productType]);

  const weightFromProducts = useMemo(() => {
    if (!lines.length) return 0;

    const grams = lines.reduce((sum, l) => {
      const code = String(l.code_article ?? "").trim();
      const p = getProductByCode(code);
      const qty = Math.max(0, safeNumber(l.qty));
      return sum + qty * safeNumber(p?.unite_vente_poids_brut_g);
    }, 0);

    return grams / 1000;
  }, [lines, getProductByCode]);

  const effectiveGoodsValue = goodsValueMode === "products" ? goodsValueFromProducts : goodsValue;
  const effectiveWeight = weightMode === "products" ? weightFromProducts : weight;

  const invalidCodesCount = useMemo(
    () => lines.filter((l) => !getProductByCode(String(l.code_article ?? "").trim())).length,
    [lines, getProductByCode],
  );

  const missingHsCount = useMemo(() => {
    return lines.reduce((acc, l) => {
      const code = String(l.code_article ?? "").trim();
      const p = getProductByCode(code);
      if (!p) return acc;
      const hs = (p as any).hs_code;
      return hs ? acc : acc + 1;
    }, 0);
  }, [lines, getProductByCode]);

  const costBreakdown = useMemo<CostBreakdown | null>(() => {
    if (effectiveGoodsValue <= 0) return null;

    return calculateCosts({
      goodsValue: effectiveGoodsValue,
      destination,
      incoterm,
      productType,
      transportMode,
      weight: effectiveWeight,
      margin,
      customRates: { vatRates, octroiMerRates, transportCosts, serviceCharges },
    });
  }, [
    effectiveGoodsValue,
    destination,
    incoterm,
    productType,
    transportMode,
    effectiveWeight,
    margin,
    vatRates,
    octroiMerRates,
    transportCosts,
    serviceCharges,
  ]);

  const exportToCsv = () => {
    if (!costBreakdown) return;

    const linesCsv: string[][] = [
      ["Simulateur Export ORLIMAN", ""],
      ["", ""],
      ["Paramètres", ""],
      ["Valeur marchandise", formatCurrency(effectiveGoodsValue)],
      ["Destination", destination],
      ["Zone", zone],
      ["Incoterm", incoterm],
      ["Type produit", productType === "lppr" ? "LPPR (remboursé)" : "Standard"],
      ["Transport", transportMode],
      ["Poids (kg)", String(effectiveWeight)],
      ["", ""],
      ["Panier produits (optionnel)", ""],
      ["Code article", "HS code", "Libellé", "Qté", "Prix unitaire HT", "Sous-total HT"],
      ...lines.map((l) => {
        const code = String(l.code_article ?? "").trim();
        const p = getProductByCode(code);
        const qty = Math.max(0, safeNumber(l.qty));
        const unit = resolveUnitPrice(p, productType);
        const hs = p ? String((p as any).hs_code ?? "") : "";
        return [code, hs, p?.libelle_article ?? "INCONNU", String(qty), String(unit), String(qty * unit)];
      }),
      ["", ""],
      ["Détail des charges", ""],
      ["Poste", "Montant", "Payeur", "TVA récupérable"],
      ...costBreakdown.lines.map((l) => [l.label, formatCurrency(l.amount), l.payer, l.isRecoverable ? "Oui" : "Non"]),
      ["", ""],
      ["Résumé", ""],
      ["Prix de revient", formatCurrency(costBreakdown.prixDeRevient)],
      ["Prix vente HT conseillé", formatCurrency(costBreakdown.prixVenteHT)],
      ["TVA récupérable", formatCurrency(costBreakdown.totalTvaRecuperablePrestations)],
    ];

    const csvContent = linesCsv.map((row) => row.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `simulation_${destination}_${incoterm}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const addLine = () => {
    const code = addCode.trim();
    const qty = Math.max(1, safeNumber(addQty));
    if (!code) return;

    setLines((prev) => {
      const idx = prev.findIndex((p) => p.code_article === code);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], qty: clone[idx].qty + qty };
        return clone;
      }
      return [...prev, { code_article: code, qty }];
    });

    setAddCode("");
    setAddQty(1);
  };

  const updateQty = (code: string, qty: number) => {
    setLines((prev) => prev.map((l) => (l.code_article === code ? { ...l, qty: Math.max(1, safeNumber(qty)) } : l)));
  };

  const removeLine = (code: string) => setLines((prev) => prev.filter((l) => l.code_article !== code));
  const clearLines = () => setLines([]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-6 w-6 text-accent" />
              Simulateur de prix export
            </h1>
            <p className="mt-1 text-muted-foreground">
              Estimez vos coûts selon destination, incoterm, type produit — avec panier produits (HS code visible)
            </p>
          </div>
          {costBreakdown && (
            <Button variant="outline" onClick={exportToCsv}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Paramètres
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Goods Value Mode */}
              <div className="space-y-2">
                <Label>Valeur marchandise</Label>
                <Select value={goodsValueMode} onValueChange={(v) => setGoodsValueMode(v as GoodsValueMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Saisie manuelle</SelectItem>
                    <SelectItem value="products">Calculée depuis produits</SelectItem>
                  </SelectContent>
                </Select>

                <div className="space-y-2">
                  <Label htmlFor="goods_value" className="flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    Valeur marchandise HT
                  </Label>
                  <Input
                    id="goods_value"
                    type="number"
                    min="0"
                    step="100"
                    value={goodsValueMode === "products" ? Math.round(effectiveGoodsValue) : goodsValue}
                    onChange={(e) => setGoodsValue(Number(e.target.value))}
                    disabled={goodsValueMode === "products"}
                  />
                  {goodsValueMode === "products" && (
                    <p className="text-xs text-muted-foreground">
                      Basé sur ton panier ({lines.length} ligne(s)).{" "}
                      {invalidCodesCount > 0 ? `⚠️ ${invalidCodesCount} code(s) introuvable(s).` : ""}
                      {missingHsCount > 0 ? ` ⚠️ ${missingHsCount} HS code manquant.` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Destination */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Destination
                </Label>
                <Select value={destination} onValueChange={(v) => setDestination(v as Destination)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Badge
                    variant={zone === "UE" ? "default" : zone === "DROM" ? "secondary" : "outline"}
                    className={zone === "UE" ? "badge-ue" : zone === "DROM" ? "badge-drom" : "badge-hors-ue"}
                  >
                    Zone {zone}
                  </Badge>
                </div>
              </div>

              {/* Incoterm */}
              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {incoterms.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {incoterm === "EXW" && "Client assume tous les frais"}
                  {incoterm === "FCA" && "Fournisseur gère export uniquement"}
                  {incoterm === "DAP" && "Fournisseur livre, client gère import"}
                  {incoterm === "DDP" && "Fournisseur assume tout"}
                </p>
              </div>

              {/* Product Type */}
              <div className="space-y-2">
                <Label>Type de produit (impact taxes)</Label>
                <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lppr">LPPR (remboursé)</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transport Mode */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Mode de transport
                </Label>
                <Select value={transportMode} onValueChange={(v) => setTransportMode(v as TransportMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {transportModes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Weight Mode */}
              <div className="space-y-2">
                <Label>Poids estimé</Label>
                <Select value={weightMode} onValueChange={(v) => setWeightMode(v as WeightMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Saisie manuelle</SelectItem>
                    <SelectItem value="products">Calculé depuis produits</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  id="weight"
                  type="number"
                  min="0"
                  value={weightMode === "products" ? Math.round(effectiveWeight) : weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  disabled={weightMode === "products"}
                />
                {weightMode === "products" && (
                  <p className="text-xs text-muted-foreground">
                    Basé sur <code>unite_vente_poids_brut_g</code>.
                  </p>
                )}
              </div>

              {/* Margin */}
              <div className="space-y-2">
                <Label htmlFor="margin" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Marge souhaitée (%)
                </Label>
                <Input id="margin" type="number" min="0" max="100" value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
              </div>

              {/* Products Basket */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Panier produits</Label>
                  <Button variant="outline" size="sm" onClick={refreshProducts} disabled={productsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${productsLoading ? "animate-spin" : ""}`} />
                    Sync
                  </Button>
                </div>

                {!productsEnvOk ? (
                  <p className="text-xs text-red-600">
                    Supabase non configuré : impossible de charger les produits.
                  </p>
                ) : null}

                {productsError ? <p className="text-xs text-red-600">Erreur produits: {productsError}</p> : null}

                <p className="text-[11px] text-muted-foreground">
                  Produits chargés: <span className="font-medium">{productsStats.total}</span>
                  {productsLoading ? " (chargement…)" : ""}.
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input value={addCode} onChange={(e) => setAddCode(e.target.value)} placeholder="Code article (ex: 2118674)" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Colle un code + “Ajouter”. (On fera une recherche dropdown ensuite.)
                    </p>
                  </div>
                  <div>
                    <Input type="number" min="1" value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} placeholder="Qté" />
                  </div>
                </div>

                <Button onClick={addLine} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter produit
                </Button>

                {lines.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    {lines.map((l) => {
                      const code = String(l.code_article ?? "").trim();
                      const p: ProductRow | undefined = getProductByCode(code);
                      const qty = Math.max(1, safeNumber(l.qty));
                      const unit = resolveUnitPrice(p, productType);
                      const subtotal = qty * unit;
                      const hs = p ? String((p as any).hs_code ?? "") : "";

                      return (
                        <div key={code} className="rounded-lg border p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {code} — {p?.libelle_article ?? "Produit introuvable"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                HS: {hs || "—"} • PU HT: {formatCurrency(unit)} • Sous-total: {formatCurrency(subtotal)}
                              </div>
                              {!hs && p ? (
                                <p className="text-[11px] text-amber-600">⚠️ HS code manquant (impact OM/TVA selon DROM)</p>
                              ) : null}
                            </div>
                            <Button variant="ghost" onClick={() => removeLine(code)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Qté</Label>
                            <Input type="number" min="1" value={qty} onChange={(e) => updateQty(code, Number(e.target.value))} />
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Marchandise HT (panier): {formatCurrency(goodsValueFromProducts)}</Badge>
                      <Button variant="outline" size="sm" onClick={clearLines}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Vider panier
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1">Ajoute au moins 1 produit pour calculer depuis produits.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            {costBreakdown ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Valeur marchandise</p>
                      <p className="text-xl font-bold">{formatCurrency(effectiveGoodsValue)}</p>
                      <p className="text-xs text-muted-foreground">
                        {goodsValueMode === "products" ? "Source: produits" : "Source: manuel"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Prix de revient</p>
                      <p className="text-xl font-bold text-primary">{formatCurrency(costBreakdown.prixDeRevient)}</p>
                      <p className="text-xs text-muted-foreground">
                        +{((costBreakdown.prixDeRevient / Math.max(1, effectiveGoodsValue) - 1) * 100).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-accent/30 bg-accent/5">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Prix vente HT conseillé</p>
                      <p className="text-xl font-bold text-accent">{formatCurrency(costBreakdown.prixVenteHT)}</p>
                      <p className="text-xs text-muted-foreground">Marge {margin}%</p>
                    </CardContent>
                  </Card>

                  <Card className="border-[hsl(var(--status-ok))]/30 bg-[hsl(var(--status-ok))]/5">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">TVA récupérable</p>
                      <p className="text-xl font-bold text-[hsl(var(--status-ok))]">
                        {formatCurrency(costBreakdown.totalTvaRecuperablePrestations)}
                      </p>
                      <p className="text-xs text-muted-foreground">Neutre trésorerie</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Détail des charges</CardTitle>
                    <CardDescription>Répartition selon Incoterm {incoterm} vers {destination}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Check className="h-4 w-4 text-[hsl(var(--status-ok))]" />
                        Prestations avec TVA récupérable
                      </h4>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Poste</th>
                              <th className="text-right p-3 font-medium">Montant HT</th>
                              <th className="text-right p-3 font-medium">TVA</th>
                              <th className="text-center p-3 font-medium">Payeur</th>
                            </tr>
                          </thead>
                          <tbody>
                            {costBreakdown.lines
                              .filter((l) => l.category === "prestation" && l.isRecoverable)
                              .map((line, i) => (
                                <tr key={i} className="border-t">
                                  <td className="p-3">{line.label}</td>
                                  <td className="p-3 text-right font-medium">{formatCurrency(line.amount)}</td>
                                  <td className="p-3 text-right text-[hsl(var(--status-ok))]">{formatCurrency(line.tvaAmount)}</td>
                                  <td className="p-3 text-center">
                                    <Badge variant={line.payer === "Fournisseur" ? "default" : "outline"}>{line.payer}</Badge>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {costBreakdown.lines.filter((l) => l.category === "taxe").length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-[hsl(var(--status-risk))]" />
                          Taxes non récupérables
                        </h4>
                        <div className="rounded-lg border border-[hsl(var(--status-risk))]/30 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-[hsl(var(--status-risk))]/5">
                              <tr>
                                <th className="text-left p-3 font-medium">Taxe</th>
                                <th className="text-right p-3 font-medium">Montant</th>
                                <th className="text-center p-3 font-medium">Payeur</th>
                                <th className="text-left p-3 font-medium">Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {costBreakdown.lines
                                .filter((l) => l.category === "taxe")
                                .map((line, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="p-3">{line.label}</td>
                                    <td className="p-3 text-right font-medium text-[hsl(var(--status-risk))]">{formatCurrency(line.amount)}</td>
                                    <td className="p-3 text-center">
                                      <Badge variant="destructive">{line.payer}</Badge>
                                    </td>
                                    <td className="p-3 text-xs text-muted-foreground">{line.notes}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {costBreakdown.lines.filter((l) => l.category === "tva_import").length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Info className="h-4 w-4 text-primary" />
                          TVA Import
                        </h4>
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3 font-medium">Type</th>
                                <th className="text-right p-3 font-medium">Montant</th>
                                <th className="text-center p-3 font-medium">Récupérable</th>
                                <th className="text-left p-3 font-medium">Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {costBreakdown.lines
                                .filter((l) => l.category === "tva_import")
                                .map((line, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="p-3">{line.label}</td>
                                    <td className="p-3 text-right font-medium">{formatCurrency(line.amount)}</td>
                                    <td className="p-3 text-center">
                                      {line.isRecoverable ? (
                                        <Badge className="badge-ok">Oui (autoliq.)</Badge>
                                      ) : (
                                        <Badge variant="secondary">Client</Badge>
                                      )}
                                    </td>
                                    <td className="p-3 text-xs text-muted-foreground">{line.notes}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Charges fournisseur</p>
                        <p className="text-lg font-bold">{formatCurrency(costBreakdown.totalFournisseur)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Charges client</p>
                        <p className="text-lg font-bold">{formatCurrency(costBreakdown.totalClient)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[hsl(var(--status-risk))]/5">
                        <p className="text-xs text-muted-foreground">Taxes non récup.</p>
                        <p className="text-lg font-bold text-[hsl(var(--status-risk))]">{formatCurrency(costBreakdown.totalTaxesNonRecuperables)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[hsl(var(--status-ok))]/5">
                        <p className="text-xs text-muted-foreground">TVA récupérable</p>
                        <p className="text-lg font-bold text-[hsl(var(--status-ok))]">{formatCurrency(costBreakdown.totalTvaRecuperablePrestations)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="flex items-center justify-center h-64">
                <CardContent className="text-center">
                  <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Saisis une valeur marchandise ou passe en mode “manuel”.</p>
                  <p className="text-xs text-muted-foreground mt-1">Astuce: désactive “calculée depuis produits” si aucun article.</p>
                  <Button className="mt-3" onClick={() => { setGoodsValueMode("manual"); if (goodsValue <= 0) setGoodsValue(1000); }}>Passer en manuel</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
