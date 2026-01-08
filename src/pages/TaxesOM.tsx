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

/** ✅ Métropole supprimée du listing */
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

/** ✅ Références douanières (HS codes) fournies */
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
];

type ProductRow = {
  id: string;
  sku?: string | null;
  label?: string | null;
  hs_code?: string | null;
};

type VatInfo = {
  title: string;
  normal?: number;
  reduced?: number;
  special1?: number;
  special2?: number;
  note: string;
};

const OFFICIAL_VAT: Record<string, VatInfo> = {
  GP: { title: "TVA DOM", normal: 8.5, reduced: 2.1, special1: 1.75, special2: 1.05, note: "Guadeloupe : 4 taux (8,5 / 2,1 / 1,75 / 1,05)." },
  MQ: { title: "TVA DOM", normal: 8.5, reduced: 2.1, special1: 1.75, special2: 1.05, note: "Martinique : 4 taux (8,5 / 2,1 / 1,75 / 1,05)." },
  RE: { title: "TVA DOM", normal: 8.5, reduced: 2.1, special1: 1.75, special2: 1.05, note: "Réunion : 4 taux (8,5 / 2,1 / 1,75 / 1,05)." },
  GF: { title: "TVA", note: "Guyane : TVA non applicable." },
  YT: { title: "TVA", note: "Mayotte : TVA non applicable." },
  BL: { title: "TVA", note: "COM : assimilé “pays tiers” pour la TVA (facturation HT/export en général)." },
  MF: { title: "TVA", note: "COM : assimilé “pays tiers” pour la TVA (facturation HT/export en général)." },
  SPM: { title: "TVA", note: "COM : assimilé “pays tiers” pour la TVA (facturation HT/export en général)." },
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
    "hs_code10",
    "hs_code_10",
    "hs4",
  ]);
  const n = normalizeHS(v);
  return n || null;
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

function isMissingColumnError(e: any) {
  const msg = String(e?.message || "").toLowerCase();
  const code = String(e?.code || "").toUpperCase();
  return (
    code === "42703" ||
    (msg.includes("column") &&
      (msg.includes("does not exist") ||
        msg.includes("schema cache") ||
        msg.includes("could not find")))
  );
}

/** ✅ Chargement products avec fallback de colonnes (sku/label/hs_code) */
async function loadProductsFlexible(limit = 5000): Promise<ProductRow[]> {
  const attempts: Array<{
    select: string;
    map: (r: any) => ProductRow;
  }> = [
    {
      select: "id,sku,label,hs_code",
      map: (r) => ({ id: r.id, sku: r.sku ?? null, label: r.label ?? null, hs_code: r.hs_code ?? null }),
    },
    {
      select: "id,code_article,libelle_article,hs_code,hs4",
      map: (r) => ({
        id: r.id,
        sku: r.code_article ?? null,
        label: r.libelle_article ?? null,
        hs_code: r.hs_code ?? r.hs4 ?? null,
      }),
    },
    {
      select: "id,code,libelle,hs_code,hs4",
      map: (r) => ({
        id: r.id,
        sku: r.code ?? null,
        label: r.libelle ?? null,
        hs_code: r.hs_code ?? r.hs4 ?? null,
      }),
    },
    {
      select: "id,code,name,hs_code,hs4",
      map: (r) => ({
        id: r.id,
        sku: r.code ?? null,
        label: r.name ?? null,
        hs_code: r.hs_code ?? r.hs4 ?? null,
      }),
    },
  ];

  let lastErr: any = null;

  for (const a of attempts) {
    const res = await supabase.from("products").select(a.select).limit(limit);
    if (res.error) {
      lastErr = res.error;

      // stop conditions
      if (isPermissionError(res.error)) throw res.error;
      if (isMissingTableError(res.error)) throw res.error;

      // try next if it looks like a missing column / schema-cache mismatch
      if (isMissingColumnError(res.error)) continue;

      // unknown error => stop
      throw res.error;
    }

    const rows = (res.data || []).map(a.map);
    return rows
      .map((p) => ({ ...p, hs_code: normalizeHS(p.hs_code) || null }))
      .filter((p) => Boolean(p.hs_code));
  }

  throw lastErr || new Error("Impossible de charger products");
}

// Essaie plusieurs colonnes possibles pour filtrer (schema incertain)
async function fetchWithColumnFallback<T extends Record<string, any>>(opts: {
  table: string;
  select?: string;
  eqCandidates?: { cols: string[]; value: string }[];
  inCandidates?: { cols: string[]; values: string[] }[];
  limit?: number;
}) {
  const {
    table,
    select = "*",
    eqCandidates = [],
    inCandidates = [],
    limit = 5000,
  } = opts;

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

type RecapRow = {
  key: string;
  sku: string | null;
  label: string | null;
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
  const [productSearch, setProductSearch] = React.useState("");

  const [omRows, setOmRows] = React.useState<any[]>([]);
  const [vatRows, setVatRows] = React.useState<any[]>([]);
  const [taxRows, setTaxRows] = React.useState<any[]>([]);

  const [usedOmDestinationCol, setUsedOmDestinationCol] = React.useState<
    string | null
  >(null);
  const [usedOmHsCol, setUsedOmHsCol] = React.useState<string | null>(null);

  const [selectedHs, setSelectedHs] = React.useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const refreshNonceRef = React.useRef(0);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  React.useEffect(() => {
    if (destination === "FR") setDestination("GP");
  }, [destination]);

  const destinationLabel = React.useMemo(() => {
    return (
      DESTINATIONS.find((d) => d.code === destination)?.name || destination
    );
  }, [destination]);

  const headerMessage = countsError || countsWarning || error || warning;

  const recapRows: RecapRow[] = React.useMemo(() => {
    if (ourProducts.length) {
      return ourProducts
        .map((p) => ({
          key: p.id,
          sku: p.sku ?? null,
          label: p.label ?? null,
          hs_code: normalizeHS(p.hs_code),
        }))
        .filter((r) => Boolean(r.hs_code));
    }

    return OUR_HS_CODES.map((h) => ({
      key: `HS-${h}`,
      sku: null,
      label: null,
      hs_code: normalizeHS(h),
    }));
  }, [ourProducts]);

  const recapFiltered = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return recapRows;
    return recapRows.filter((r) => {
      const blob = `${r.sku ?? ""} ${r.label ?? ""} ${r.hs_code ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [recapRows, productSearch]);

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

  const missingHsForDestination = React.useMemo(() => {
    const set = new Set(Array.from(omByHs.keys()).map(normalizeHS));
    return OUR_HS_CODES.map(normalizeHS).filter((h) => !set.has(h));
  }, [omByHs]);

  React.useEffect(() => {
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
        if (!SUPABASE_ENV_OK) {
          throw new Error("Supabase non configuré (VITE_SUPABASE_URL / KEY).");
        }

        // 1) Produits (fallback colonnes)
        let prod: ProductRow[] = [];
        try {
          prod = await loadProductsFlexible(5000);
        } catch (e: any) {
          const msg = isMissingTableError(e)
            ? "Table products introuvable OU non exposée à l’API (schéma). Recherche par produit limitée (HS only OK)."
            : isPermissionError(e)
              ? "Accès products refusé (RLS/droits). Recherche par produit limitée (HS only OK)."
              : "Impossible de charger products. Recherche par produit limitée (HS only OK).";
          setWarning((prev) => (prev ? `${prev}\n${msg}` : msg));
          prod = [];
        }

        const our = prod.filter((p) =>
          OUR_HS_CODES.includes(normalizeHS(p.hs_code))
        );

        if (!alive) return;
        setProducts(prod);
        setOurProducts(our);

        // 2) OM rates : filtrer sur NOS HS codes
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
                cols: ["hs_code", "hs", "hs6", "hs8", "hs10", "hs_code10", "hs_code_10", "hs4"],
                values: OUR_HS_CODES,
              },
            ],
            limit: 5000,
          });

          if (!alive) return;

          // fallback client-side si filtre HS pas appliqué côté DB
          let data = (om.data || []) as any[];
          if (!om.usedIn) {
            const ourSet = new Set(OUR_HS_CODES.map(normalizeHS));
            data = data.filter((r) => {
              const hs = extractHsFromOmRow(r);
              return hs ? ourSet.has(normalizeHS(hs)) : false;
            });
          }

          setOmRows(data);
          setUsedOmDestinationCol((om as any).usedEq ?? null);
          setUsedOmHsCol((om as any).usedIn ?? null);

          if ((om as any).fallbackNoFilter) {
            setWarning((prev) =>
              prev
                ? `${prev}\nOM: filtre destination/HS non appliqué (colonnes non trouvées) → fallback.`
                : "OM: filtre destination/HS non appliqué (colonnes non trouvées) → fallback."
            );
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

        // 3) VAT rates
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

        // 4) Taxes extra
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
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((prev) =>
              prev
                ? `${prev}\nTable tax_rules_extra absente.`
                : "Table tax_rules_extra absente."
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

  const vatInfo = OFFICIAL_VAT[destination];

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Header */}
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

        {/* Messages */}
        {headerMessage ? (
          <Card
            className={
              String(headerMessage || "").toLowerCase().includes("absente") ||
              String(headerMessage || "").toLowerCase().includes("introuvable") ||
              String(headerMessage || "").toLowerCase().includes("refus")
                ? "border-amber-300 bg-amber-50"
                : "border-red-200"
            }
          >
            <CardContent className="pt-6 text-sm text-foreground whitespace-pre-line">
              {headerMessage}
            </CardContent>
          </Card>
        ) : null}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">VAT rates: {countsLoading ? "…" : counts.vatRates}</Badge>
          <Badge variant="secondary">Tax rules: {countsLoading ? "…" : counts.taxRulesExtra}</Badge>
          <Badge variant="secondary">OM rules: {countsLoading ? "…" : counts.omRates}</Badge>

          <Badge variant="outline" className="ml-0 sm:ml-2">
            Destination: <span className="ml-1 font-semibold">{destinationLabel}</span>
          </Badge>

          <Badge variant="outline">
            HS références: <span className="ml-1 font-semibold">{OUR_HS_CODES.length}</span>
          </Badge>

          <Badge variant={missingHsForDestination.length ? "outline" : "secondary"}>
            HS sans règle OM:{" "}
            <span className="ml-1 font-semibold">{missingHsForDestination.length}</span>
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
            <RefreshCw className={`h-4 w-4 ${(isLoading || countsLoading) ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {/* ✅ TVA officielle (réelle) */}
        {vatInfo ? (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="text-base">TVA officielle — {destinationLabel}</CardTitle>
              <CardDescription>Valeurs “réelles” (référence) pour t’aider même si vat_rates est vide.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {vatInfo.normal !== undefined ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Normal: {vatInfo.normal}%</Badge>
                  <Badge variant="secondary">Réduit: {vatInfo.reduced}%</Badge>
                  {vatInfo.special1 !== undefined ? (
                    <Badge variant="outline">Particulier: {vatInfo.special1}%</Badge>
                  ) : null}
                  {vatInfo.special2 !== undefined ? (
                    <Badge variant="outline">Particulier: {vatInfo.special2}%</Badge>
                  ) : null}
                </div>
              ) : null}
              <div className="text-muted-foreground">{vatInfo.note}</div>
              <div className="text-xs text-muted-foreground">
                (Tes tables Supabase restent la source opérationnelle ; ceci est un repère officiel.)
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ✅ Récap */}
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif — OM de nos produits (HS) + recherche</CardTitle>
            <CardDescription>
              Recherche par produit (si <code className="text-xs">products</code> accessible) ou par HS code.
              Métropole exclue du listing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-[420px]">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher (code article / libellé / HS)…"
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">{recapFiltered.length} ligne(s)</Badge>
              <Badge variant="outline">OM: {omRows.length} règle(s) chargée(s)</Badge>
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="[&>th]:text-left [&>th]:px-3 [&>th]:py-2">
                    <th>Produit</th>
                    <th className="whitespace-nowrap">HS</th>
                    <th className="whitespace-nowrap">Règles OM</th>
                    <th className="whitespace-nowrap">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recapFiltered.slice(0, 300).map((r) => {
                    const hs = normalizeHS(r.hs_code);
                    const rules = omByHs.get(hs) || [];
                    const selected = selectedHs === hs;
                    const ok = rules.length > 0;
                    return (
                      <tr
                        key={r.key}
                        className={`border-t [&>td]:px-3 [&>td]:py-2 hover:bg-muted/30 cursor-pointer ${
                          selected ? "bg-muted/30" : ""
                        }`}
                        onClick={() => setSelectedHs(hs)}
                      >
                        <td className="min-w-[320px]">
                          {r.sku ? (
                            <div className="truncate">
                              <span className="font-medium">{r.sku}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                — {r.label || "Sans libellé"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              (products indisponible) — HS uniquement
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge variant="outline">{hs}</Badge>
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge variant={ok ? "secondary" : "outline"}>
                            {rules.length} règle(s)
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge variant={ok ? "secondary" : "outline"}>
                            {ok ? "OK" : "À compléter"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {missingHsForDestination.length ? (
              <div className="text-xs text-muted-foreground">
                HS sans règle OM pour {destinationLabel} :{" "}
                {missingHsForDestination.slice(0, 12).join(", ")}
                {missingHsForDestination.length > 12 ? "…" : ""}
              </div>
            ) : null}

            <Card className="border-muted">
              <CardHeader>
                <CardTitle className="text-base">
                  Détails OM — {selectedHs ? `HS ${selectedHs}` : "Sélectionne une ligne"}
                </CardTitle>
                <CardDescription>
                  Détails depuis <code className="text-xs">om_rates</code> pour la destination <b>{destination}</b>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedHs ? (
                  <div className="text-sm text-muted-foreground">
                    Clique une ligne du tableau pour afficher les règles OM correspondantes.
                  </div>
                ) : (omByHs.get(selectedHs) || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Aucune règle OM trouvée pour ce HS code sur cette destination.
                  </div>
                ) : (
                  (omByHs.get(selectedHs) || []).slice(0, 50).map((row, idx) => (
                    <Card key={row.id ?? `${idx}`} className="border-muted">
                      <CardContent className="pt-4">
                        <KVPairs row={row} />
                      </CardContent>
                    </Card>
                  ))
                )}

                {(omByHs.get(selectedHs || "") || []).length > 50 ? (
                  <div className="text-xs text-muted-foreground">
                    Affichage limité à 50 règles (performance).
                  </div>
                ) : null}

                <div className="text-xs text-muted-foreground">
                  Filtrage OM utilisé : destination = <b>{usedOmDestinationCol || "non appliqué"}</b>, HS ={" "}
                  <b>{usedOmHsCol || "non appliqué (fallback possible)"}</b>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
            <TabsTrigger value="recap">Récap</TabsTrigger>
            <TabsTrigger value="om">OM</TabsTrigger>
            <TabsTrigger value="vat">TVA</TabsTrigger>
            <TabsTrigger value="tax">Taxes extra</TabsTrigger>
            <TabsTrigger value="products">Produits</TabsTrigger>
          </TabsList>

          <TabsContent value="recap" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle>Récap — Notes</CardTitle>
                <CardDescription>
                  Les données OM/taxes utilisées viennent de tes tables Supabase. La TVA “officielle” est affichée comme repère.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <div>• Métropole exclue du listing.</div>
                <div>• Si products est refusé (RLS), le récap reste utilisable via HS codes.</div>
              </CardContent>
            </Card>
          </TabsContent>

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
                    Aucune règle OM trouvée pour cette destination sur tes HS codes.
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
                        Affichage limité à 200 lignes (performance).
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
                  <div className="text-sm text-muted-foreground">
                    Aucune règle TVA trouvée (ou table absente). Repère officiel affiché plus haut.
                  </div>
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
                  <div className="text-sm text-muted-foreground">
                    Aucune règle extra trouvée (ou table absente).
                  </div>
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
                <CardTitle>Produits</CardTitle>
                <CardDescription>
                  {isLoading ? "Chargement..." : `${products.length} produit(s) avec HS`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {!products.length ? (
                  <div className="text-sm text-muted-foreground">
                    Aucun produit chargé (table absente/refusée). Le récap fonctionne via HS.
                  </div>
                ) : (
                  products.slice(0, 50).map((p) => (
                    <div key={p.id} className="text-sm flex items-center justify-between gap-3">
                      <div className="truncate">
                        <span className="font-medium">{p.sku || p.id}</span>
                        <span className="text-muted-foreground"> — {p.label || "Sans libellé"}</span>
                      </div>
                      <Badge variant="secondary">{normalizeHS(p.hs_code) || "—"}</Badge>
                    </div>
                  ))
                )}

                {products.length > 50 ? (
                  <div className="text-xs text-muted-foreground">
                    Affichage limité à 50 produits (performance).
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
