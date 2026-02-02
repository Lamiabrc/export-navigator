import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useProducts, safeNumber } from "@/hooks/useProducts";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

/**
 * ✅ Pays destination (monde)
 * OM n'est PAS lié au "hors UE" → OM dépend du territoire DROM.
 */
const DESTINATIONS = ["France", "Belgique", "Espagne", "Allemagne", "Suisse", "Etats-Unis", "Chine"] as const;
type Destination = (typeof DESTINATIONS)[number];

const INCOTERMS = ["EXW", "DAP", "DDP"] as const;
type Incoterm = (typeof INCOTERMS)[number];

/**
 * ✅ Territoires France (pour OM)
 * - METRO : TVA possible
 * - DROM : OM possible (selon HS4)
 */
const FR_TERRITORIES = ["METRO", "GP", "MQ", "GF", "RE", "YT"] as const;
type FranceTerritory = (typeof FR_TERRITORIES)[number];

const FR_TERRITORY_LABEL: Record<FranceTerritory, string> = {
  METRO: "France (Métropole)",
  GP: "Guadeloupe (DROM)",
  MQ: "Martinique (DROM)",
  GF: "Guyane (DROM)",
  RE: "La Réunion (DROM)",
  YT: "Mayotte (DROM)",
};

const EU_DESTINATIONS = new Set<Destination>(["France", "Belgique", "Espagne", "Allemagne"]);

type ZoneLabel = "UE" | "Hors UE" | "Outre-mer";

/** Simple détection langue (cohérent avec Pricing) */
function safeLangGuess(): string {
  try {
    const lsLang =
      (typeof window !== "undefined" &&
        (window.localStorage?.getItem("lang") || window.localStorage?.getItem("language"))) ||
      "";
    const docLang = typeof document !== "undefined" ? document.documentElement.lang : "";
    const navLang = typeof navigator !== "undefined" ? navigator.language : "";
    return (lsLang || docLang || navLang || "fr").toLowerCase();
  } catch {
    return "fr";
  }
}

function formatCurrency(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number.isFinite(n) ? n : 0);
}

function getZoneLabel(dest: Destination, frTerritory: FranceTerritory): ZoneLabel {
  if (dest === "France" && frTerritory !== "METRO") return "Outre-mer";
  if (EU_DESTINATIONS.has(dest)) return "UE";
  return "Hors UE";
}

function estimateTransport(zone: ZoneLabel, weightKg: number) {
  const w = Math.max(0.5, weightKg || 0);

  // Estimation simple & cohérente
  const base = zone === "Hors UE" ? 55 : zone === "Outre-mer" ? 35 : 18;
  const perKg = zone === "Hors UE" ? 4.5 : zone === "Outre-mer" ? 3.0 : 1.4;

  return base + perKg * w;
}

// 12.5 => 0.125 ; 0.125 => 0.125
function normalizeRateToFraction(rate: number) {
  if (!Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function formatRatePercent(rateRaw: number) {
  const frac = normalizeRateToFraction(rateRaw);
  return `${(frac * 100).toFixed(2)}%`;
}

type OmRateRow = {
  om_rate: number | null;
  omr_rate: number | null;
  year: number | null;
  source: string | null;
};

function MiniBars({
  items,
  locale,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  locale: string;
}) {
  const total = Math.max(
    1,
    items.reduce((s, i) => s + (Number.isFinite(i.value) ? i.value : 0), 0),
  );

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {items.map((it) => {
          const pct = Math.max(0, Math.min(100, (it.value / total) * 100));

          const cls =
            it.label.includes("HT")
              ? "bg-primary/80"
              : it.label.includes("TVA")
              ? "bg-emerald-500/70"
              : it.label.includes("OM")
              ? "bg-amber-500/80"
              : it.label.includes("Transport")
              ? "bg-sky-500/70"
              : "bg-slate-500/60";

          return (
            <div
              key={it.label}
              className={`${cls} h-full`}
              style={{ width: `${pct}%` }}
              title={`${it.label}: ${formatCurrency(it.value, locale)}${it.hint ? ` — ${it.hint}` : ""}`}
            />
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between rounded-lg border bg-white p-2">
            <div>
              <div className="text-xs font-semibold">{it.label}</div>
              {it.hint ? <div className="text-[11px] text-muted-foreground">{it.hint}</div> : null}
            </div>
            <div className="text-sm font-bold">{formatCurrency(it.value, locale)}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">Survole les barres pour afficher le détail.</p>
    </div>
  );
}

export default function Simulator() {
  const { products, isLoading, error, envOk } = useProducts({ pageSize: 2000 });

  const locale = useMemo(() => (safeLangGuess().startsWith("fr") ? "fr-FR" : "en-US"), []);

  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [destination, setDestination] = useState<Destination>("France");
  const [frTerritory, setFrTerritory] = useState<FranceTerritory>("METRO");
  const [incoterm, setIncoterm] = useState<Incoterm>("DDP");

  const [manualPrice, setManualPrice] = useState<number | "">("");
  const [manualWeight, setManualWeight] = useState<number | "">("");

  // OM from Supabase
  const [omRow, setOmRow] = useState<OmRateRow | null>(null);
  const [omLoading, setOmLoading] = useState(false);
  const [omError, setOmError] = useState<string | null>(null);

  // Si on quitte France → pas de territoire OM
  useEffect(() => {
    if (destination !== "France") setFrTerritory("METRO");
  }, [destination]);

  const product = useMemo(() => products.find((p) => p.code === sku), [products, sku]);

  const unitPrice = useMemo(() => {
    const fallback = safeNumber((product as any)?.unit_price_eur) || 0;
    return manualPrice === "" ? fallback : Number(manualPrice) || 0;
  }, [product, manualPrice]);

  const weightKg = useMemo(() => {
    const wKg = safeNumber((product as any)?.weight_kg) || 0;
    const auto = wKg * qty;
    return manualWeight === "" ? auto : Number(manualWeight) || 0;
  }, [product, manualWeight, qty]);

  const ht = unitPrice * qty;

  const zone = useMemo(() => getZoneLabel(destination, frTerritory), [destination, frTerritory]);

  const hsCode = useMemo(() => {
    const raw = String((product as any)?.hs_code || (product as any)?.hsCode || "").replace(/[^\d]/g, "");
    return raw || null;
  }, [product]);

  const hs4 = useMemo(() => (hsCode && hsCode.length >= 4 ? hsCode.slice(0, 4) : null), [hsCode]);

  const isOMTerritory = useMemo(() => destination === "France" && frTerritory !== "METRO", [destination, frTerritory]);

  // TVA (simple et cohérente)
  // - France Métropole : TVA produit (ou 20%)
  // - Autres cas : 0 (export / DOM)
  const tvaRate = useMemo(() => {
    if (destination === "France" && frTerritory === "METRO") return Number((product as any)?.tva ?? 20);
    return 0;
  }, [destination, frTerritory, product]);

  const tva = ht * (tvaRate / 100);

  const transportEst = useMemo(() => estimateTransport(zone, weightKg), [zone, weightKg]);

  // frais fixes (dossier / gestion)
  const feesFixed = 15;

  // OM rates
  const omRate = normalizeRateToFraction(safeNumber(omRow?.om_rate));
  const omrRate = normalizeRateToFraction(safeNumber(omRow?.omr_rate));
  const omTotalRate = omRate + omrRate;

  const omTheoretical = useMemo(() => {
    // ✅ OM uniquement si destination = France + territoire DROM
    if (!isOMTerritory) return 0;
    if (!hs4) return 0;
    return ht * omTotalRate;
  }, [isOMTerritory, hs4, ht, omTotalRate]);

  // Incoterm impact (vision "facture / vendeur")
  const transportSeller = incoterm === "EXW" ? 0 : transportEst;
  const omSeller = incoterm === "DDP" ? omTheoretical : 0;

  const totalSeller = ht + tva + transportSeller + feesFixed + omSeller;

  // Vision "acheteur" (ce qu’il peut avoir à payer en plus)
  const transportBuyer = incoterm === "EXW" ? transportEst : 0;
  const omBuyer = incoterm === "DDP" ? 0 : omTheoretical;

  // Fetch OM rates (Supabase) — uniquement si OM applicable
  useEffect(() => {
    let alive = true;

    const run = async () => {
      setOmError(null);
      setOmRow(null);

      if (!SUPABASE_ENV_OK) return;
      if (!envOk) return;

      if (!isOMTerritory) return;
      if (!hs4) return;

      setOmLoading(true);
      try {
        const { data, error } = await supabase
          .from("om_rates")
          .select("om_rate, omr_rate, year, source")
          .eq("territory_code", frTerritory) // ✅ GP/MQ/GF/RE/YT
          .eq("hs4", hs4)
          .order("year", { ascending: false })
          .limit(1);

        if (error) throw error;

        const row = (data || [])[0] as any;
        const next: OmRateRow = {
          om_rate: row?.om_rate ?? null,
          omr_rate: row?.omr_rate ?? null,
          year: row?.year ?? null,
          source: row?.source ?? null,
        };

        if (alive) setOmRow(next);
      } catch (e: any) {
        if (alive) setOmError(e?.message || String(e));
      } finally {
        if (alive) setOmLoading(false);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [envOk, isOMTerritory, frTerritory, hs4]);

  const omStatus = useMemo(() => {
    if (!isOMTerritory) return { ok: true, label: "Non applicable" };
    if (!hs4) return { ok: false, label: "HS manquant" };
    if (omLoading) return { ok: false, label: "Chargement..." };
    if (!omRow || (omRow.om_rate == null && omRow.omr_rate == null)) return { ok: false, label: "Taux OM non trouvé" };
    return { ok: true, label: "OK" };
  }, [isOMTerritory, hs4, omLoading, omRow]);

  const bars = useMemo(() => {
    const arr: Array<{ label: string; value: number; hint?: string }> = [
      { label: "Marchandise HT", value: ht, hint: product?.label ? product.label.slice(0, 40) : "" },
      {
        label: `TVA (${tvaRate.toFixed(2)}%)`,
        value: tva,
        hint:
          destination === "France" && frTerritory === "METRO"
            ? "TVA France métropole"
            : "TVA 0% (export / DOM par défaut)",
      },
      {
        label: "Transport (vendeur)",
        value: transportSeller,
        hint: incoterm === "EXW" ? "EXW : non inclus vendeur" : "Estimé selon poids / zone",
      },
      { label: "Frais fixes", value: feesFixed, hint: "Dossier / gestion" },
    ];

    // ✅ On n’affiche OM que si territoire DROM
    if (isOMTerritory) {
      arr.push({
        label: "OM (vendeur)",
        value: omSeller,
        hint: incoterm === "DDP" ? "DDP : OM inclus vendeur" : "Non inclus vendeur",
      });
    }

    return arr;
  }, [ht, product, tva, tvaRate, destination, frTerritory, transportSeller, incoterm, feesFixed, isOMTerritory, omSeller]);

  return (
    <AppLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Simulateur export</p>
          <h1 className="text-2xl font-bold">Estimation rapide prix / charges</h1>
          <p className="text-sm text-muted-foreground">Produit + destination + incoterm : détail HT / TVA / OM (DROM) / transport.</p>
        </div>

        {!SUPABASE_ENV_OK ? (
          <Card className="border-amber-300 bg-amber-50 text-amber-900">
            <CardContent className="pt-4 text-sm">Connexion base indisponible : taux OM en mode demo.</CardContent>
          </Card>
        ) : null}

        {!envOk ? (
          <Card className="border-amber-300 bg-amber-50 text-amber-900">
            <CardContent className="pt-4 text-sm">Catalogue en mode demo : catalogue / taux en mode dégradé.</CardContent>
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
                      <SelectItem key={p.code} value={p.code}>
                        {p.code} — {(p.label || "").slice(0, 60)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {product ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline">Zone: {zone}</Badge>
                    <Badge variant="outline">HS: {hsCode || "non renseigné"}</Badge>
                    {isOMTerritory ? <Badge variant={omStatus.ok ? "default" : "destructive"}>OM: {omStatus.label}</Badge> : null}
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
                  <p className="text-[11px] text-muted-foreground">Auto : prix unitaire demo ou renseigné catalogue.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Destination</Label>
                  <Select value={destination} onValueChange={(v) => setDestination(v as Destination)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DESTINATIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Incoterm</Label>
                  <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">EXW : transport/OM acheteur • DAP : transport vendeur • DDP : transport + OM vendeur</p>
                </div>
              </div>

              {/* ✅ Territoire France (uniquement si destination France) */}
              {destination === "France" ? (
                <div className="space-y-1">
                  <Label>Territoire (France)</Label>
                  <Select value={frTerritory} onValueChange={(v) => setFrTerritory(v as FranceTerritory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FR_TERRITORIES.map((tCode) => (
                        <SelectItem key={tCode} value={tCode}>
                          {FR_TERRITORY_LABEL[tCode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    OM affiché uniquement pour les territoires DROM (GP/MQ/GF/RE/YT).
                  </p>
                </div>
              ) : null}

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
              <CardDescription>Détail calcul + comparaison vendeur / acheteur</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <MiniBars items={bars} locale={locale} />

              <Separator />

              {/* ✅ Bloc OM visible seulement si DROM */}
              {isOMTerritory ? (
                <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">OM théorique</div>
                      <div className="text-xs text-muted-foreground">
                        {!hs4
                          ? "HS manquant : OM non calculable"
                          : omLoading
                          ? "Chargement des taux OM..."
                          : !omRow
                          ? "Taux OM non trouvé"
                          : `HS4 ${hs4} • OM ${omRow.om_rate == null ? "—" : formatRatePercent(Number(omRow.om_rate))} • OMR ${
                              omRow.omr_rate == null ? "—" : formatRatePercent(Number(omRow.omr_rate))
                            }${omRow.year ? ` • ${omRow.year}` : ""}`}
                      </div>
                      {omRow?.source ? <div className="text-[11px] text-muted-foreground">Source : {omRow.source}</div> : null}
                    </div>

                    <div className="text-lg font-bold">{formatCurrency(omTheoretical, locale)}</div>
                  </div>

                  {omError ? (
                    <div className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                      Erreur OM : {omError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">OM à charge vendeur : {formatCurrency(omSeller, locale)}</Badge>
                    <Badge variant="outline">OM à charge acheteur : {formatCurrency(omBuyer, locale)}</Badge>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-sm font-semibold">Total vendeur estimé</div>
                  <div className="text-xs text-muted-foreground">
                    Inclut : HT + TVA + (transport si DAP/DDP) + (OM si DDP, DROM) + frais fixes
                  </div>
                  <div className="pt-2 text-lg font-bold">{formatCurrency(totalSeller, locale)}</div>
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <div className="text-sm font-semibold">Surcoûts acheteur estimés</div>
                  <div className="text-xs text-muted-foreground">Selon incoterm : transport EXW + OM si non DDP (DROM)</div>
                  <div className="pt-2 text-lg font-bold">{formatCurrency(transportBuyer + omBuyer, locale)}</div>
                  <div className="pt-1 text-[11px] text-muted-foreground">
                    Transport acheteur : {formatCurrency(transportBuyer, locale)} • OM acheteur : {formatCurrency(omBuyer, locale)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Poids : {weightKg.toFixed(2)} kg</Badge>
                <Badge variant="outline">Tarif : {formatCurrency(unitPrice, locale)} /u</Badge>
                {destination === "France" ? <Badge variant="outline">Territoire : {FR_TERRITORY_LABEL[frTerritory]}</Badge> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
