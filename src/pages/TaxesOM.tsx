import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Scale } from "lucide-react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import { useTaxesOm } from "@/hooks/useTaxesOm";

type Destination = { code: string; name: string };

const DESTINATIONS: Destination[] = [
  { code: "FR", name: "Métropole" },
  { code: "GP", name: "Guadeloupe" },
  { code: "MQ", name: "Martinique" },
  { code: "GF", name: "Guyane" },
  { code: "RE", name: "Réunion" },
  { code: "YT", name: "Mayotte" },
  { code: "BL", name: "Saint-Barthélemy" },
  { code: "MF", name: "Saint-Martin" },
  { code: "SPM", name: "Saint-Pierre-et-Miquelon" },
];

type ProductRow = {
  id: string;
  sku?: string | null;
  label?: string | null;
  hs_code?: string | null;
};

function uniqStrings(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.filter(Boolean).map((s) => String(s).trim()).filter(Boolean)));
}

function pretty(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function KVPairs({ row }: { row: Record<string, any> }) {
  const entries = Object.entries(row || {});
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-2">
          <div className="min-w-[140px] text-muted-foreground">{k}</div>
          <div className="break-all text-foreground">{pretty(v)}</div>
        </div>
      ))}
    </div>
  );
}

// Essaie plusieurs colonnes possibles pour filtrer (schema incertain)
async function fetchWithColumnFallback<T extends Record<string, any>>(opts: {
  table: string;
  select?: string;
  // ex: ["drom_code", "territory_code", "destination"]
  eqCandidates?: { cols: string[]; value: string }[];
  // ex: ["hs_code", "hs", "hs6"]
  inCandidates?: { cols: string[]; values: string[] }[];
  limit?: number;
}) {
  const { table, select = "*", eqCandidates = [], inCandidates = [], limit = 5000 } = opts;

  // On construit une liste de "plans" de requêtes : on tente combos de colonnes
  // 1) eq seulement
  // 2) eq + in
  // 3) sans filtre (dernier recours)
  const eqPlans: Array<Record<string, string>> = [];
  if (eqCandidates.length) {
    // une seule dimension eqCandidates ici : on prend le premier objet (destination)
    const first = eqCandidates[0];
    for (const col of first.cols) eqPlans.push({ [col]: first.value });
  } else {
    eqPlans.push({});
  }

  const inPlans: Array<{ col: string; values: string[] }> = [];
  if (inCandidates.length) {
    const first = inCandidates[0];
    for (const col of first.cols) inPlans.push({ col, values: first.values });
  } else {
    inPlans.push({ col: "", values: [] });
  }

  const errors: any[] = [];

  // on tente : eqPlan + inPlan (si inPlan.col non vide)
  for (const eqPlan of eqPlans) {
    for (const inPlan of inPlans) {
      try {
        let q = supabase.from(table).select(select).limit(limit);

        for (const [col, value] of Object.entries(eqPlan)) {
          q = q.eq(col as any, value as any);
        }

        if (inPlan.col && inPlan.values?.length) {
          q = q.in(inPlan.col as any, inPlan.values as any);
        }

        const res = await q;
        if (res.error) throw res.error;
        return { data: (res.data || []) as T[], usedEq: Object.keys(eqPlan)[0] || null, usedIn: inPlan.col || null };
      } catch (e) {
        errors.push(e);
      }
    }
  }

  // dernier recours : pas de filtre (utile pour “au moins afficher quelque chose”)
  try {
    const res = await supabase.from(table).select(select).limit(limit);
    if (res.error) throw res.error;
    return { data: (res.data || []) as T[], usedEq: null, usedIn: null, fallbackNoFilter: true as const };
  } catch (e) {
    errors.push(e);
    throw errors[0];
  }
}

export default function TaxesOM() {
  const { counts, isLoading: countsLoading, error: countsError, warning: countsWarning, refresh } = useTaxesOm();

  const [destination, setDestination] = React.useState<string>("GP");
  const [activeTab, setActiveTab] = React.useState<"om" | "vat" | "tax" | "products">("om");

  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [hsCodes, setHsCodes] = React.useState<string[]>([]);
  const [hsSearch, setHsSearch] = React.useState<string>("");

  const [omRows, setOmRows] = React.useState<any[]>([]);
  const [vatRows, setVatRows] = React.useState<any[]>([]);
  const [taxRows, setTaxRows] = React.useState<any[]>([]);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const [usedOmDestinationCol, setUsedOmDestinationCol] = React.useState<string | null>(null);
  const [usedOmHsCol, setUsedOmHsCol] = React.useState<string | null>(null);

  const refreshNonceRef = React.useRef(0);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const filteredHsCodes = React.useMemo(() => {
    const q = hsSearch.trim().toLowerCase();
    if (!q) return hsCodes;
    return hsCodes.filter((h) => h.toLowerCase().includes(q));
  }, [hsCodes, hsSearch]);

  React.useEffect(() => {
    let alive = true;

    const loadAll = async () => {
      setIsLoading(true);
      setError(null);
      setWarning(null);
      setUsedOmDestinationCol(null);
      setUsedOmHsCol(null);

      try {
        if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré (VITE_SUPABASE_URL / KEY).");

        // 1) Produits + HS codes
        // On tente "products" (le plus probable)
        let prod: ProductRow[] = [];
        try {
          const res = await supabase
            .from("products")
            .select("id,sku,label,hs_code")
            .not("hs_code", "is", null)
            .limit(5000);
          if (res.error) throw res.error;
          prod = (res.data || []) as ProductRow[];
        } catch (e: any) {
          // fallback (si tu as un autre nom de table)
          // -> on ne bloque pas la page, mais on prévient
          const msg =
            isMissingTableError(e)
              ? "Table products absente : impossible de filtrer OM par HS code automatiquement."
              : "Impossible de charger products : filtrage HS code indisponible.";
          setWarning((prev) => (prev ? `${prev}\n${msg}` : msg));
          prod = [];
        }

        const hs = uniqStrings(prod.map((p) => p.hs_code));
        if (!alive) return;
        setProducts(prod);
        setHsCodes(hs);

        // 2) OM rates : filtré destination + (si possible) HS codes
        // IMPORTANT : ton schéma exact peut varier => on tente plusieurs noms de colonnes
        let omUsedEq: string | null = null;
        let omUsedIn: string | null = null;

        try {
          const om = await fetchWithColumnFallback<any>({
            table: "om_rates",
            select: "*",
            eqCandidates: [{ cols: ["drom_code", "territory_code", "destination", "ile", "island"], value: destination }],
            inCandidates: hs.length ? [{ cols: ["hs_code", "hs", "hs6", "hs8", "hs10"], values: hs }] : [],
            limit: 5000,
          });
          if (!alive) return;
          setOmRows(om.data || []);
          omUsedEq = (om as any).usedEq ?? null;
          omUsedIn = (om as any).usedIn ?? null;
          setUsedOmDestinationCol(omUsedEq);
          setUsedOmHsCol(omUsedIn);

          if ((om as any).fallbackNoFilter) {
            setWarning((prev) =>
              prev
                ? `${prev}\nOM: filtre destination/HS non appliqué (colonnes non trouvées) → affichage global.`
                : "OM: filtre destination/HS non appliqué (colonnes non trouvées) → affichage global."
            );
          } else {
            if (!omUsedEq) {
              setWarning((prev) =>
                prev
                  ? `${prev}\nOM: filtre destination non appliqué (colonne inconnue) → affichage global.`
                  : "OM: filtre destination non appliqué (colonne inconnue) → affichage global."
              );
            }
            if (hs.length && !omUsedIn) {
              setWarning((prev) =>
                prev
                  ? `${prev}\nOM: filtre HS code non appliqué (colonne hs_* non trouvée) → affichage par destination uniquement.`
                  : "OM: filtre HS code non appliqué (colonne hs_* non trouvée) → affichage par destination uniquement."
              );
            }
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((prev) =>
              prev ? `${prev}\nTable om_rates absente.` : "Table om_rates absente."
            );
            setOmRows([]);
          } else {
            throw e;
          }
        }

        // 3) VAT rates : on affiche tout + on tente filtre destination si possible
        try {
          const vat = await fetchWithColumnFallback<any>({
            table: "vat_rates",
            select: "*",
            eqCandidates: [{ cols: ["territory_code", "destination", "zone", "drom_code"], value: destination }],
            limit: 5000,
          });
          if (!alive) return;
          setVatRows(vat.data || []);
          if ((vat as any).fallbackNoFilter) {
            setWarning((prev) =>
              prev
                ? `${prev}\nVAT: filtre destination non appliqué → affichage global.`
                : "VAT: filtre destination non appliqué → affichage global."
            );
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((prev) =>
              prev ? `${prev}\nTable vat_rates absente.` : "Table vat_rates absente."
            );
            setVatRows([]);
          } else {
            throw e;
          }
        }

        // 4) Taxes extra : on affiche tout + on tente filtre destination si possible
        try {
          const tax = await fetchWithColumnFallback<any>({
            table: "tax_rules_extra",
            select: "*",
            eqCandidates: [{ cols: ["territory_code", "destination", "zone", "drom_code"], value: destination }],
            limit: 5000,
          });
          if (!alive) return;
          setTaxRows(tax.data || []);
          if ((tax as any).fallbackNoFilter) {
            setWarning((prev) =>
              prev
                ? `${prev}\nTaxes extra: filtre destination non appliqué → affichage global.`
                : "Taxes extra: filtre destination non appliqué → affichage global."
            );
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((prev) =>
              prev ? `${prev}\nTable tax_rules_extra absente.` : "Table tax_rules_extra absente."
            );
            setTaxRows([]);
          } else {
            throw e;
          }
        }
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message || "Erreur chargement Taxes/OM");
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void loadAll();
    return () => {
      alive = false;
    };
  }, [destination, refreshNonce]);

  const headerMessage = countsError || countsWarning || error || warning;

  const destinationLabel = React.useMemo(() => {
    return DESTINATIONS.find((d) => d.code === destination)?.name || destination;
  }, [destination]);

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Données</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6" />
              Taxes & OM
            </h1>
            <p className="text-sm text-muted-foreground">
              Référentiels : <code className="text-xs">vat_rates</code>,{" "}
              <code className="text-xs">tax_rules_extra</code>,{" "}
              <code className="text-xs">om_rates</code> (+ HS codes via <code className="text-xs">products</code>).
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="text-xs text-muted-foreground">Destination</div>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Choisir destination" />
              </SelectTrigger>
              <SelectContent>
                {DESTINATIONS.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {headerMessage ? (
          <Card
            className={
              (String(headerMessage || "").toLowerCase().includes("manquante") ||
                String(headerMessage || "").toLowerCase().includes("absente"))
                ? "border-amber-300 bg-amber-50"
                : "border-red-200"
            }
          >
            <CardContent className="pt-6 text-sm text-foreground whitespace-pre-line">
              {headerMessage}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">VAT rates: {countsLoading ? "…" : counts.vatRates}</Badge>
          <Badge variant="secondary">Tax rules: {countsLoading ? "…" : counts.taxRulesExtra}</Badge>
          <Badge variant="secondary">OM rules: {countsLoading ? "…" : counts.omRates}</Badge>

          <Badge variant="outline" className="ml-0 sm:ml-2">
            Destination: <span className="ml-1 font-semibold">{destinationLabel}</span>
          </Badge>

          <Badge variant="outline">
            HS codes produits: <span className="ml-1 font-semibold">{hsCodes.length}</span>
          </Badge>

          <Button
            variant="outline"
            onClick={() => {
              refresh(); // refresh counts hook
              refreshNonceRef.current += 1;
              setRefreshNonce(refreshNonceRef.current); // refresh page data
            }}
            disabled={isLoading || countsLoading}
            className="ml-auto gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(isLoading || countsLoading) ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Destination : {destinationLabel}</CardTitle>
            <CardDescription>
              Objectif : sélectionner un territoire et afficher <b>toutes les règles OM</b> + taxes associées. <br />
              Filtre HS codes : actif si <code className="text-xs">om_rates</code> possède une colonne <code className="text-xs">hs_code</code> (ou équivalent).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>• OM/OMR : généralement par HS code + code DROM (validité dates).</div>
            <div>• Taxes : TVA/droits/taxes locales selon zone + incoterm (validité dates).</div>
            <div className="text-xs text-muted-foreground">
              Filtrage OM utilisé : destination = <b>{usedOmDestinationCol || "non appliqué"}</b>, HS = <b>{usedOmHsCol || "non appliqué"}</b>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
            <TabsTrigger value="om">OM</TabsTrigger>
            <TabsTrigger value="vat">TVA</TabsTrigger>
            <TabsTrigger value="tax">Taxes extra</TabsTrigger>
            <TabsTrigger value="products">Produits / HS</TabsTrigger>
          </TabsList>

          <TabsContent value="om" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle>Règles OM (Octroi de Mer)</CardTitle>
                <CardDescription>
                  {isLoading ? "Chargement..." : `${omRows.length} règle(s) trouvée(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Chargement OM…</div>
                ) : !omRows.length ? (
                  <div className="text-sm text-muted-foreground">
                    Aucune règle OM trouvée pour cette destination (ou filtre non applicable selon les colonnes).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {omRows.slice(0, 200).map((row, idx) => (
                      <Card key={row.id ?? `${idx}`} className="border-muted">
                        <CardContent className="pt-4">
                          <KVPairs row={row} />
                        </CardContent>
                      </Card>
                    ))}
                    {omRows.length > 200 ? (
                      <div className="text-xs text-muted-foreground">
                        Affichage limité à 200 lignes (pour performance). Ajuste si besoin.
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vat" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle>VAT rates (TVA)</CardTitle>
                <CardDescription>
                  {isLoading ? "Chargement..." : `${vatRows.length} ligne(s) trouvée(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Chargement TVA…</div>
                ) : !vatRows.length ? (
                  <div className="text-sm text-muted-foreground">Aucune règle TVA trouvée (ou table absente).</div>
                ) : (
                  vatRows.slice(0, 200).map((row, idx) => (
                    <Card key={row.id ?? `${idx}`} className="border-muted">
                      <CardContent className="pt-4">
                        <KVPairs row={row} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle>Taxes extra</CardTitle>
                <CardDescription>
                  {isLoading ? "Chargement..." : `${taxRows.length} règle(s) trouvée(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Chargement taxes…</div>
                ) : !taxRows.length ? (
                  <div className="text-sm text-muted-foreground">Aucune règle extra trouvée (ou table absente).</div>
                ) : (
                  taxRows.slice(0, 200).map((row, idx) => (
                    <Card key={row.id ?? `${idx}`} className="border-muted">
                      <CardContent className="pt-4">
                        <KVPairs row={row} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle>Produits & HS codes</CardTitle>
                <CardDescription>
                  {isLoading ? "Chargement..." : `${hsCodes.length} HS code(s) unique(s) détecté(s) dans products`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Input
                    value={hsSearch}
                    onChange={(e) => setHsSearch(e.target.value)}
                    placeholder="Filtrer HS codes (ex: 902110)"
                    className="sm:w-[260px]"
                  />
                  <Badge variant="secondary">
                    {filteredHsCodes.length} / {hsCodes.length}
                  </Badge>
                </div>

                {!hsCodes.length ? (
                  <div className="text-sm text-muted-foreground">
                    Aucun HS code trouvé dans <code className="text-xs">products.hs_code</code>. <br />
                    Vérifie que ta table products contient bien la colonne <b>hs_code</b> et qu’elle est remplie.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {filteredHsCodes.slice(0, 200).map((h) => (
                      <Badge key={h} variant="outline" className="justify-center">
                        {h}
                      </Badge>
                    ))}
                  </div>
                )}

                {filteredHsCodes.length > 200 ? (
                  <div className="text-xs text-muted-foreground">
                    Affichage HS limité à 200 valeurs (pour performance).
                  </div>
                ) : null}

                {products.length ? (
                  <Card className="border-muted">
                    <CardHeader>
                      <CardTitle className="text-base">Aperçu produits (20)</CardTitle>
                      <CardDescription>Vérifie que tes HS codes sont bien attachés à tes produits.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {products.slice(0, 20).map((p) => (
                        <div key={p.id} className="text-sm flex items-center justify-between gap-3">
                          <div className="truncate">
                            <span className="font-medium">{p.sku || p.id}</span>
                            <span className="text-muted-foreground"> — {p.label || "Sans libellé"}</span>
                          </div>
                          <Badge variant="secondary">{p.hs_code || "—"}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
