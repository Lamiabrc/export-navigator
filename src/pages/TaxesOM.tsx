import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Scale, Search } from "lucide-react";
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

/**
 * ✅ Métropole supprimée
 * (OM = surtout DROM, et tu as demandé d’enlever Métropole du listing)
 */
const DESTINATIONS: Destination[] = [
  { code: "GP", name: "Guadeloupe" },
  { code: "MQ", name: "Martinique" },
  { code: "GF", name: "Guyane" },
  { code: "RE", name: "Réunion" },
  { code: "YT", name: "Mayotte" },
  { code: "BL", name: "Saint-Barthélemy" },
  { code: "MF", name: "Saint-Martin" },
  { code: "SPM", name: "Saint-Pierre-et-Miquelon" },
];

/**
 * ✅ Références Douanières / HS codes (tes codes)
 */
const OUR_HS_CODES = [
  "61151010",
  "62129000",
  "63079010",
  "63079098",
  "64039993",
  "64041990",
  "64069050",
  "64069090",
  "90211010",
  "90211090",
  "96180000",
  "3824999699",
  "61099090",
  "48239085",
] as const;

/**
 * Petit rappel TVA "réel" (régime DOM) — utile même si ta table vat_rates est vide.
 * - GP/MQ/RE : TVA DOM (taux normal/réduit)
 * - GF/YT : TVA non applicable (régime particulier)
 */
const OFFICIAL_VAT_HINTS: Record<string, { title: string; lines: string[] }> = {
  GP: {
    title: "TVA DOM (Guadeloupe)",
    lines: ["Taux DOM spécifiques (normal/réduit selon produits)."],
  },
  MQ: {
    title: "TVA DOM (Martinique)",
    lines: ["Taux DOM spécifiques (normal/réduit selon produits)."],
  },
  RE: {
    title: "TVA DOM (Réunion)",
    lines: ["Taux DOM spécifiques (normal/réduit selon produits)."],
  },
  GF: {
    title: "TVA non applicable (Guyane)",
    lines: ["Régime particulier : facturation généralement HT (selon cas)."],
  },
  YT: {
    title: "TVA non applicable (Mayotte)",
    lines: ["Régime particulier : facturation généralement HT (selon cas)."],
  },
};

type ProductRow = {
  id: string;
  sku?: string | null;
  label?: string | null;
  hs_code?: string | null;
};

function uniqStrings(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(values.filter(Boolean).map((s) => String(s).trim()).filter(Boolean))
  );
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

function normalizeHS(v: any) {
  return String(v ?? "")
    .trim()
    .replace(/[^\d]/g, "");
}

function firstDefined(row: any, keys: string[]) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return null;
}

function extractHsFromOmRow(row: any) {
  const v = firstDefined(row, [
    "hs_code",
    "hs",
    "hs6",
    "hs8",
    "hs10",
    "hs_code_10",
    "hs_code10",
    "hs4",
  ]);
  const n = normalizeHS(v);
  return n || null;
}

function extractDestinationFromRow(row: any) {
  const v = firstDefined(row, [
    "drom_code",
    "territory_code",
    "destination",
    "ile",
    "island",
    "zone",
  ]);
  return v ? String(v).trim() : null;
}

function isPermissionError(e: any) {
  const msg = String(e?.message || "").toLowerCase();
  const code = String(e?.code || "").toUpperCase();
  return (
    code === "42501" ||
    msg.includes("permission") ||
    msg.includes("row level security") ||
    msg.includes("rls") ||
    msg.includes("not allowed")
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
  const { table, select = "*", eqCandidates = [], inCandidates = [], limit = 5000 } =
    opts;

  const eqPlans: Array<Record<string, string>> = [];
  if (eqCandidates.length) {
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

        return {
          data: (res.data || []) as T[],
          usedEq: Object.keys(eqPlan)[0] || null,
          usedIn: inPlan.col || null,
        };
      } catch (e) {
        errors.push(e);
      }
    }
  }

  // dernier recours : pas de filtre
  try {
    const res = await supabase.from(table).select(select).limit(limit);
    if (res.error) throw res.error;
    return {
      data: (res.data || []) as T[],
      usedEq: null,
      usedIn: null,
      fallbackNoFilter: true as const,
    };
  } catch (e) {
    errors.push(e);
    throw errors[0];
  }
}

type RecapItem = {
  key: string;
  sku?: string | null;
  label?: string | null;
  hs_code: string;
};

export default function TaxesOM() {
  const {
    counts,
    isLoading: countsLoading,
    error: countsError,
    warning: countsWarning,
    refresh,
  } = useTaxesOm();

  const [destination, setDestination] = React.useState<string>("GP");
  const [activeTab, setActiveTab] = React.useState<
    "recap" | "om" | "vat" | "tax" | "products"
  >("recap");

  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [ourProducts, setOurProducts] = React.useState<ProductRow[]>([]);
  const [productSearch, setProductSearch] = React.useState<string>("");

  const [hsCodesFound, setHsCodesFound] = React.useState<string[]>([]);
  const [hsSearch, setHsSearch] = React.useState<string>("");

  const [omRows, setOmRows] = React.useState<any[]>([]);
  const [vatRows, setVatRows] = React.useState<any[]>([]);
  const [taxRows, setTaxRows] = React.useState<any[]>([]);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const [usedOmDestinationCol, setUsedOmDestinationCol] = React.useState<
    string | null
  >(null);
  const [usedOmHsCol, setUsedOmHsCol] = React.useState<string | null>(null);

  const refreshNonceRef = React.useRef(0);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const destinationLabel = React.useMemo(() => {
    return (
      DESTINATIONS.find((d) => d.code === destination)?.name || destination
    );
  }, [destination]);

  const headerMessage = countsError || countsWarning || error || warning;

  const hsCodesMissing = React.useMemo(() => {
    const found = new Set(hsCodesFound.map(normalizeHS));
    return OUR_HS_CODES.filter((h) => !found.has(normalizeHS(h)));
  }, [hsCodesFound]);

  const filteredHsReference = React.useMemo(() => {
    const q = hsSearch.trim().toLowerCase();
    const base = OUR_HS_CODES.map(String);
    if (!q) return base;
    return base.filter((h) => h.toLowerCase().includes(q));
  }, [hsSearch]);

  const recapItems: RecapItem[] = React.useMemo(() => {
    // si products dispo → on liste nos produits réels
    if (ourProducts.length) {
      return ourProducts
        .map((p) => ({
          key: p.id,
          sku: p.sku,
          label: p.label,
          hs_code: normalizeHS(p.hs_code),
        }))
        .filter((it) => Boolean(it.hs_code));
    }

    // fallback : HS codes uniquement (si products absent / RLS / vide)
    return OUR_HS_CODES.map((h) => ({
      key: `HS-${h}`,
      sku: null,
      label: "—",
      hs_code: normalizeHS(h),
    }));
  }, [ourProducts]);

  const recapItemsFiltered = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return recapItems;

    return recapItems.filter((it) => {
      const blob = `${it.sku ?? ""} ${it.label ?? ""} ${it.hs_code ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [recapItems, productSearch]);

  const omByHs = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const row of omRows) {
      const hs = extractHsFromOmRow(row);
      if (!hs) continue;
      const key = normalizeHS(hs);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(row);
    }
    return m;
  }, [omRows]);

  const [selectedHs, setSelectedHs] = React.useState<string | null>(null);

  React.useEffect(() => {
    // reset sélection quand on change destination
    setSelectedHs(null);
  }, [destination]);

  React.useEffect(() => {
    let alive = true;

    const loadAll = async () => {
      setIsLoading(true);
      setError(null);
      setWarning(null);
      setUsedOmDestinationCol(null);
      setUsedOmHsCol(null);

      try {
        if (!SUPABASE_ENV_OK)
          throw new Error(
            "Supabase non configuré (VITE_SUPABASE_URL / KEY)."
          );

        /**
         * 1) Produits (optionnel) : on tente products, mais la page doit fonctionner même sans.
         */
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
          const msg = isMissingTableError(e)
            ? "Table products absente : recherche par produit limitée (HS codes OK)."
            : isPermissionError(e)
              ? "Accès products refusé (RLS/droits) : recherche par produit limitée (HS codes OK)."
              : "Impossible de charger products : recherche par produit limitée (HS codes OK).";
          setWarning((prev) => (prev ? `${prev}\n${msg}` : msg));
          prod = [];
        }

        const our = prod.filter((p) =>
          OUR_HS_CODES.includes(normalizeHS(p.hs_code) as any)
        );

        const foundHs = uniqStrings(our.map((p) => normalizeHS(p.hs_code)));

        if (!alive) return;
        setProducts(prod);
        setOurProducts(our);
        setHsCodesFound(foundHs);

        /**
         * 2) OM rates : ✅ on filtre toujours sur NOS HS codes (tes références)
         */
        let omUsedEq: string | null = null;
        let omUsedIn: string | null = null;

        try {
          const om = await fetchWithColumnFallback<any>({
            table: "om_rates",
            select: "*",
            eqCandidates: [
              {
                cols: ["drom_code", "territory_code", "destination", "ile", "island"],
                value: destination,
              },
            ],
            inCandidates: [
              {
                cols: ["hs_code", "hs", "hs6", "hs8", "hs10", "hs_code_10", "hs4"],
                values: OUR_HS_CODES.map(String),
              },
            ],
            limit: 5000,
          });

          if (!alive) return;

          // si le filtre HS a échoué (colonne inconnue), on fait au moins un filtre client-side
          let data = (om.data || []) as any[];
          if (!om.usedIn) {
            const ourSet = new Set(OUR_HS_CODES.map((h) => normalizeHS(h)));
            data = data.filter((r) => {
              const hs = extractHsFromOmRow(r);
              if (!hs) return false;
              return ourSet.has(normalizeHS(hs));
            });
          }

          setOmRows(data);
          omUsedEq = (om as any).usedEq ?? null;
          omUsedIn = (om as any).usedIn ?? null;
          setUsedOmDestinationCol(omUsedEq);
          setUsedOmHsCol(omUsedIn);

          if ((om as any).fallbackNoFilter) {
            setWarning((prev) =>
              prev
                ? `${prev}\nOM: filtre destination/HS non appliqué (colonnes non trouvées) → affichage (filtré client-side si possible).`
                : "OM: filtre destination/HS non appliqué (colonnes non trouvées) → affichage (filtré client-side si possible)."
            );
          } else {
            if (!omUsedEq) {
              setWarning((prev) =>
                prev
                  ? `${prev}\nOM: filtre destination non appliqué (colonne inconnue) → résultats possiblement trop larges.`
                  : "OM: filtre destination non appliqué (colonne inconnue) → résultats possiblement trop larges."
              );
            }
            if (!omUsedIn) {
              setWarning((prev) =>
                prev
                  ? `${prev}\nOM: filtre HS non appliqué côté DB → filtrage client-side activé.`
                  : "OM: filtre HS non appliqué côté DB → filtrage client-side activé."
              );
            }
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((prev) => (prev ? `${prev}\nTable om_rates absente.` : "Table om_rates absente."));
            setOmRows([]);
          } else {
            throw e;
          }
        }

        /**
         * 3) VAT rates : filtre destination si possible
         */
        try {
          const vat = await fetchWithColumnFallback<any>({
            table: "vat_rates",
            select: "*",
            eqCandidates: [
              { cols: ["territory_code", "destination", "zone", "drom_code"], value: destination },
            ],
            limit: 5000,
          });
          if (!alive) return;
          setVatRows(vat.data || []);
          if ((vat as any).fallbackNoFilter) {
            setWarning((prev) =>
              prev ? `${prev}\nVAT: filtre destination non appliqué → affichage global.` : "VAT: filtre destination non appliqué → affichage global."
            );
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((prev) => (prev ? `${prev}\nTable vat_rates absente.` : "Table vat_rates absente."));
            setVatRows([]);
          } else {
            throw e;
          }
        }

        /**
         * 4) Taxes extra
         */
        try {
          const tax = await fetchWithColumnFallback<any>({
            table: "tax_rules_extra",
            select: "*",
            eqCandidates: [
              { cols: ["territory_code", "destination", "zone", "drom_code"], value: destination },
            ],
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
            setWarning((prev) => (prev ? `${prev}\nTable tax_rules_extra absente.` : "Table tax_rules_extra absente."));
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

  const vatHint = OFFICIAL_VAT_HINTS[destination];

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
              Référentiels :{" "}
              <code className="text-xs">vat_rates</code>,{" "}
              <code className="text-xs">tax_rules_extra</code>,{" "}
              <code className="text-xs">om_rates</code> (+ produits via{" "}
              <code className="text-xs">products</code>).
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
                String(headerMessage || "").toLowerCase().includes("absente") ||
                String(headerMessage || "").toLowerCase().includes("refusé") ||
                String(headerMessage || "").toLowerCase().includes("rls"))
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
          <Badge variant="secondary">
            VAT rates: {countsLoading ? "…" : counts.vatRates}
          </Badge>
          <Badge variant="secondary">
            Tax rules: {countsLoading ? "…" : counts.taxRulesExtra}
          </Badge>
          <Badge variant="secondary">
            OM rules: {countsLoading ? "…" : counts.omRates}
          </Badge>

          <Badge variant="outline" className="ml-0 sm:ml-2">
            Destination:{" "}
            <span className="ml-1 font-semibold">{destinationLabel}</span>
          </Badge>

          <Badge variant="outline">
            HS références:{" "}
            <span className="ml-1 font-semibold">{OUR_HS_CODES.length}</span>
          </Badge>

          <Badge variant="outline">
            HS trouvés (products):{" "}
            <span className="ml-1 font-semibold">{hsCodesFound.length}</span>
          </Badge>

          <Button
            variant="outline"
            onClick={() => {
              refresh();
              refreshNonceRef.current += 1;
              setRefreshNonce(refreshNonceRef.current);
            }}
            disabled={isLoading || countsLoading}
            className="ml-auto gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${(isLoading || countsLoading) ? "animate-spin" : ""}`}
            />
            Actualiser
          </Button>
        </div>

        {/* ✅ Récap "réel" + recherche produit */}
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif — Nos produits (HS) → OM & Taxes</CardTitle>
            <CardDescription>
              Listing basé sur tes <b>Références Douanières (HS)</b>. Recherche par produit (si{" "}
              <code className="text-xs">products</code> accessible) et filtrage par destination.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {vatHint ? (
              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{vatHint.title}</CardTitle>
                  <CardDescription>
                    Rappel “règles réelles” utile si tes tables ne sont pas encore complètes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  {vatHint.lines.map((l) => (
                    <div key={l}>• {l}</div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-[420px]">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher par produit (sku/label) ou HS code…"
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">
                {recapItemsFiltered.length} ligne(s)
              </Badge>
              {hsCodesMissing.length ? (
                <Badge variant="outline">
                  HS manquants dans products:{" "}
                  <span className="ml-1 font-semibold">{hsCodesMissing.length}</span>
                </Badge>
              ) : (
                <Badge variant="outline">Tous les HS sont présents dans products ✅</Badge>
              )}
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="[&>th]:text-left [&>th]:px-3 [&>th]:py-2">
                    <th>Produit</th>
                    <th className="whitespace-nowrap">HS code</th>
                    <th className="whitespace-nowrap">Règles OM</th>
                    <th className="whitespace-nowrap">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {recapItemsFiltered.slice(0, 300).map((it) => {
                    const rules = omByHs.get(normalizeHS(it.hs_code)) || [];
                    const isSelected = normalizeHS(it.hs_code) === normalizeHS(selectedHs);
                    return (
                      <tr
                        key={it.key}
                        className={`border-t [&>td]:px-3 [&>td]:py-2 hover:bg-muted/30 cursor-pointer ${
                          isSelected ? "bg-muted/30" : ""
                        }`}
                        onClick={() => setSelectedHs(normalizeHS(it.hs_code))}
                      >
                        <td className="min-w-[320px]">
                          <div className="font-medium truncate">
                            {it.sku ? (
                              <>
                                <span>{it.sku}</span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  — {it.label || "Sans libellé"}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                (Produits indisponibles) — HS uniquement
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge variant="outline">{it.hs_code}</Badge>
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge variant={rules.length ? "secondary" : "outline"}>
                            {rules.length} règle(s)
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap text-muted-foreground">
                          Cliquer pour voir
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {recapItemsFiltered.length > 300 ? (
              <div className="text-xs text-muted-foreground">
                Affichage limité à 300 lignes (pour performance).
              </div>
            ) : null}

            {/* Détails OM sélection */}
            <Card className="border-muted">
              <CardHeader>
                <CardTitle className="text-base">
                  Détails OM — {selectedHs ? `HS ${selectedHs}` : "Sélectionner une ligne"}
                </CardTitle>
                <CardDescription>
                  Les règles affichées viennent de <code className="text-xs">om_rates</code> pour la destination{" "}
                  <b>{destination}</b>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedHs ? (
                  <div className="text-sm text-muted-foreground">
                    Clique une ligne dans le tableau pour afficher les règles OM correspondantes.
                  </div>
                ) : (omByHs.get(normalizeHS(selectedHs)) || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Aucune règle OM trouvée pour ce HS code sur cette destination. <br />
                    Vérifie : (1) le HS code exact dans <code className="text-xs">om_rates</code>, (2) la colonne
                    de destination (drom_code/territory_code), (3) les dates de validité.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(omByHs.get(normalizeHS(selectedHs)) || []).slice(0, 50).map((row, idx) => (
                      <Card key={row.id ?? `${idx}`} className="border-muted">
                        <CardContent className="pt-4">
                          <KVPairs row={row} />
                        </CardContent>
                      </Card>
                    ))}
                    {(omByHs.get(normalizeHS(selectedHs)) || []).length > 50 ? (
                      <div className="text-xs text-muted-foreground">
                        Affichage limité à 50 règles pour ce HS (performance).
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground">
              Filtrage OM utilisé : destination = <b>{usedOmDestinationCol || "non appliqué"}</b>, HS ={" "}
              <b>{usedOmHsCol || "non appliqué (fallback client-side)"}</b>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
            <TabsTrigger value="recap">Récap</TabsTrigger>
            <TabsTrigger value="om">OM</TabsTrigger>
            <TabsTrigger value="vat">TVA</TabsTrigger>
            <TabsTrigger value="tax">Taxes extra</TabsTrigger>
            <TabsTrigger value="products">Produits / HS</TabsTrigger>
          </TabsList>

          <TabsContent value="recap" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle>À propos</CardTitle>
                <CardDescription>
                  Cette page est maintenant centrée sur <b>tes HS codes</b> et permet une recherche produit + destination.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <div>
                  • Objectif : retrouver rapidement les <b>règles OM</b> pour tes produits, puis contrôler TVA/taxes.
                </div>
                <div>
                  • Si <code className="text-xs">products</code> est inaccessible, le récap fonctionne quand même via tes HS.
                </div>
                <div>
                  • OM est lu dans <code className="text-xs">om_rates</code> (données “réelles” = celles que tu importes).
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="om" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle>Règles OM (Octroi de Mer) — Nos HS codes</CardTitle>
                <CardDescription>
                  {isLoading ? "Chargement..." : `${omRows.length} règle(s) trouvée(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Chargement OM…</div>
                ) : !omRows.length ? (
                  <div className="text-sm text-muted-foreground">
                    Aucune règle OM trouvée pour cette destination sur tes HS codes. <br />
                    Vérifie que <code className="text-xs">om_rates</code> contient bien tes HS et la colonne destination.
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
                        Affichage l
