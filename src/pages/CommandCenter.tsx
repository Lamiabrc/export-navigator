import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Scale, Search } from "lucide-react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

type Territory = { code: string; name: string };

const TERRITORIES: Territory[] = [
  { code: "FR", name: "France" },
  { code: "DE", name: "Allemagne" },
  { code: "ES", name: "Espagne" },
  { code: "US", name: "Etats-Unis" },
  { code: "CN", name: "Chine" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "CH", name: "Suisse" },
];

const HS_CODES = [
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

type SelectedCell = { territory: string; hs: string } | null;

function normalizeHS(v: any) {
  return String(v ?? "").trim().replace(/[^\d]/g, "");
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

function firstExistingKey(obj: any, candidates: string[]) {
  if (!obj) return null;
  const keys = new Set(Object.keys(obj));
  for (const c of candidates) if (keys.has(c)) return c;
  return null;
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

/**
 * ✅ On lit 1 ligne pour "deviner" les colonnes réelles
 * => plus de 400 en spam
 */
async function pickFirstWorkingTable(tables: string[]) {
  const errors: any[] = [];
  for (const t of tables) {
    try {
      const res = await supabase.from(t).select("*").limit(1);
      if (res.error) throw res.error;
      const sample = (res.data || [])[0] ?? null;
      return { table: t, sample };
    } catch (e: any) {
      errors.push({ table: t, error: e });
      if (isPermissionError(e)) break;
    }
  }
  const first = errors[0]?.error || new Error("Aucune table accessible");
  throw first;
}

function percentFormat(raw: any) {
  if (raw === null || raw === undefined || raw === "") return null;

  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);

  // Heuristique : si stocké en décimal (0.025) => 2.5%
  const v = n > 0 && n <= 1 ? n * 100 : n;

  // affichage “propre”
  const rounded = Math.round(v * 100) / 100;
  return `${rounded}%`;
}

function extractRateFromRow(row: any) {
  // On tente les noms les plus fréquents
  const v =
    row?.om_rate ??
    row?.taux_om ??
    row?.taux ??
    row?.rate ??
    row?.octroi_rate ??
    row?.om ??
    null;

  return percentFormat(v);
}

function vatFallbackForTerritory(code: string) {
  if (code === "FR") return "TVA 20% (reference France)";
  if (code === "DE") return "TVA 19% (indicatif)";
  if (code === "ES") return "TVA 21% (indicatif)";
  if (code === "US") return "Sales tax selon Etat (indicatif)";
  if (code === "GB") return "TVA 20% (indicatif)";
  return "-";
}
export default function TaxesOM() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<SelectedCell>(null);

  // Data
  const [omMeta, setOmMeta] = React.useState<{ table: string; hsCol: string | null; territoryCol: string | null } | null>(null);
  const [vatMeta, setVatMeta] = React.useState<{ table: string; territoryCol: string | null } | null>(null);
  const [taxMeta, setTaxMeta] = React.useState<{ table: string; territoryCol: string | null } | null>(null);

  const [omRows, setOmRows] = React.useState<any[]>([]);
  const [vatRows, setVatRows] = React.useState<any[]>([]);
  const [taxRows, setTaxRows] = React.useState<any[]>([]);

  const refreshNonceRef = React.useRef(0);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const filteredHs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return HS_CODES;
    return HS_CODES.filter((h) => h.toLowerCase().includes(q));
  }, [search]);

  const omMap = React.useMemo(() => {
    // omMap[territory][hsKey] = rows[]
    const map = new Map<string, Map<string, any[]>>();
    for (const t of TERRITORIES) map.set(t.code, new Map());

    // si table HS = hs4 ou hs6, on va matcher par préfixe
    const hsCol = omMeta?.hsCol || "";
    const hsLen =
      hsCol.toLowerCase().includes("hs4") ? 4 :
      hsCol.toLowerCase().includes("hs6") ? 6 :
      hsCol.toLowerCase().includes("hs8") ? 8 :
      hsCol.toLowerCase().includes("hs10") ? 10 : 0;

    const tCol = omMeta?.territoryCol;

    for (const row of omRows) {
      if (!tCol) continue;
      const terr = String(row?.[tCol] ?? "").trim();
      if (!map.has(terr)) continue;

      const rawHs = normalizeHS(
        row?.[omMeta?.hsCol as any] ??
        row?.hs_code ??
        row?.hs ??
        row?.hs6 ??
        row?.hs8 ??
        row?.hs10 ??
        row?.hs4
      );

      if (!rawHs) continue;
      const key = hsLen ? rawHs.slice(0, hsLen) : rawHs;
      const terrMap = map.get(terr)!;
      if (!terrMap.has(key)) terrMap.set(key, []);
      terrMap.get(key)!.push(row);
    }

    return { map, hsLen };
  }, [omRows, omMeta]);

  const vatByTerritory = React.useMemo(() => {
    const tCol = vatMeta?.territoryCol;
    const m = new Map<string, any[]>();
    for (const t of TERRITORIES) m.set(t.code, []);
    for (const row of vatRows) {
      if (!tCol) continue;
      const terr = String(row?.[tCol] ?? "").trim();
      if (!m.has(terr)) continue;
      m.get(terr)!.push(row);
    }
    return m;
  }, [vatRows, vatMeta]);

  const extraCountByTerritory = React.useMemo(() => {
    const tCol = taxMeta?.territoryCol;
    const m = new Map<string, number>();
    for (const t of TERRITORIES) m.set(t.code, 0);
    for (const row of taxRows) {
      if (!tCol) continue;
      const terr = String(row?.[tCol] ?? "").trim();
      if (!m.has(terr)) continue;
      m.set(terr, (m.get(terr) || 0) + 1);
    }
    return m;
  }, [taxRows, taxMeta]);

  const selectedDetails = React.useMemo(() => {
    if (!selected) return null;
    const { territory, hs } = selected;

    const hsKey = omMap.hsLen ? normalizeHS(hs).slice(0, omMap.hsLen) : normalizeHS(hs);
    const terrMap = omMap.map.get(territory);
    const om = terrMap?.get(hsKey) || [];
    const vat = vatByTerritory.get(territory) || [];
    const extra = taxRows.filter((r) => String(r?.[taxMeta?.territoryCol as any] ?? "").trim() === territory);

    return { om, vat, extra };
  }, [selected, omMap, vatByTerritory, taxRows, taxMeta]);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setWarning(null);
      setSelected(null);

      try {
        if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré (VITE_SUPABASE_URL / KEY).");

        // 1) OM / Octroi : on prend octroi_rates en priorité
        let omTable = "";
        let omSample: any = null;
        try {
          const picked = await pickFirstWorkingTable(["octroi_rates", "om_rates"]);
          omTable = picked.table;
          omSample = picked.sample;
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((p) => (p ? `${p}\nAucune table OM accessible (octroi_rates / om_rates).` : "Aucune table OM accessible (octroi_rates / om_rates)."));
          } else {
            throw e;
          }
        }

        let territoryColOm: string | null = null;
        let hsColOm: string | null = null;

        if (omTable && omSample) {
          territoryColOm = firstExistingKey(omSample, ["drom_code", "territory_code", "destination", "ile", "island", "territory"]);
          hsColOm = firstExistingKey(omSample, ["hs_code", "hs", "hs6", "hs8", "hs10", "hs_code10", "hs_code_10", "hs4"]);
          setOmMeta({ table: omTable, territoryCol: territoryColOm, hsCol: hsColOm });

          if (!territoryColOm || !hsColOm) {
            setWarning((p) =>
              p
                ? `${p}\n${omTable}: colonnes détectées insuffisantes (territoire=${territoryColOm ?? "?"}, hs=${hsColOm ?? "?"}).`
                : `${omTable}: colonnes détectées insuffisantes (territoire=${territoryColOm ?? "?"}, hs=${hsColOm ?? "?"}).`
            );
          } else {
            // Adapter les HS selon hs4/hs6/hs8/hs10 pour filtrer efficacement
            const hsColLower = hsColOm.toLowerCase();
            const hsLen =
              hsColLower.includes("hs4") ? 4 :
              hsColLower.includes("hs6") ? 6 :
              hsColLower.includes("hs8") ? 8 :
              hsColLower.includes("hs10") ? 10 : 0;

            const hsFilter = hsLen
              ? Array.from(new Set(HS_CODES.map((h) => normalizeHS(h).slice(0, hsLen))))
              : HS_CODES.map(normalizeHS);

            const terrFilter = TERRITORIES.map((t) => t.code);

            const res = await supabase
              .from(omTable)
              .select("*")
              .in(hsColOm as any, hsFilter as any)
              .in(territoryColOm as any, terrFilter as any)
              .limit(10000);

            if (res.error) throw res.error;
            if (!alive) return;
            setOmRows(res.data || []);
          }
        } else {
          setOmMeta(null);
          setOmRows([]);
        }

        // 2) VAT rates (si dispo)
        try {
          const pickedVat = await pickFirstWorkingTable(["vat_rates", "vat_rates_v2"]);
          const vatTable = pickedVat.table;
          const sample = pickedVat.sample;
          const terrCol = firstExistingKey(sample, ["territory_code", "destination", "zone", "drom_code", "territory"]);
          setVatMeta({ table: vatTable, territoryCol: terrCol });

          if (terrCol) {
            const terrFilter = TERRITORIES.map((t) => t.code);
            const res = await supabase
              .from(vatTable)
              .select("*")
              .in(terrCol as any, terrFilter as any)
              .limit(10000);

            if (res.error) throw res.error;
            if (!alive) return;
            setVatRows(res.data || []);
          } else {
            setVatRows([]);
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((p) => (p ? `${p}\nTable vat_rates absente (fallback repère TVA).` : "Table vat_rates absente (fallback repère TVA)."));
            setVatMeta(null);
            setVatRows([]);
          } else {
            setWarning((p) => (p ? `${p}\nVAT: ${e?.message || "erreur"}` : `VAT: ${e?.message || "erreur"}`));
            setVatMeta(null);
            setVatRows([]);
          }
        }

        // 3) Taxes extra
        try {
          const pickedTax = await pickFirstWorkingTable(["tax_rules_extra"]);
          const taxTable = pickedTax.table;
          const sample = pickedTax.sample;
          const terrCol = firstExistingKey(sample, ["territory_code", "destination", "zone", "drom_code", "territory"]);
          setTaxMeta({ table: taxTable, territoryCol: terrCol });

          if (terrCol) {
            const terrFilter = TERRITORIES.map((t) => t.code);
            const res = await supabase
              .from(taxTable)
              .select("*")
              .in(terrCol as any, terrFilter as any)
              .limit(10000);

            if (res.error) throw res.error;
            if (!alive) return;
            setTaxRows(res.data || []);
          } else {
            setTaxRows([]);
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((p) => (p ? `${p}\nTable tax_rules_extra absente.` : "Table tax_rules_extra absente."));
          } else {
            setWarning((p) => (p ? `${p}\nTaxes extra: ${e?.message || "erreur"}` : `Taxes extra: ${e?.message || "erreur"}`));
          }
          setTaxMeta(null);
          setTaxRows([]);
        }
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message || "Erreur chargement dashboard OM/Taxes");
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [refreshNonce]);

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Dashboard</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6" />
              OM & Taxes — Récapitulatif par territoire �- HS code
            </h1>
            <p className="text-sm text-muted-foreground">
              Objectif : afficher un tableau récapitulatif des <b>OM</b> et <b>taxes</b> pour tes HS codes sur chaque territoire.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                refreshNonceRef.current += 1;
                setRefreshNonce(refreshNonceRef.current);
              }}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error ? (
          <Card className="border-red-200">
            <CardContent className="pt-6 text-sm text-foreground whitespace-pre-line">
              {error}
            </CardContent>
          </Card>
        ) : warning ? (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-6 text-sm text-foreground whitespace-pre-line">
              {warning}
            </CardContent>
          </Card>
        ) : null}

        {/* Meta */}
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">HS: {HS_CODES.length}</Badge>
          <Badge variant="secondary">Territoires: {TERRITORIES.length}</Badge>
          <Badge variant="outline">
            OM table: <span className="ml-1 font-semibold">{omMeta?.table || "—"}</span>
          </Badge>
          <Badge variant="outline">
            VAT table: <span className="ml-1 font-semibold">{vatMeta?.table || "—"}</span>
          </Badge>
          <Badge variant="outline">
            Extra table: <span className="ml-1 font-semibold">{taxMeta?.table || "—"}</span>
          </Badge>
          <Badge variant="outline">
            OM rows: <span className="ml-1 font-semibold">{omRows.length}</span>
          </Badge>
          <Badge variant="outline">
            VAT rows: <span className="ml-1 font-semibold">{vatRows.length}</span>
          </Badge>
          <Badge variant="outline">
            Extra rows: <span className="ml-1 font-semibold">{taxRows.length}</span>
          </Badge>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Filtre HS</CardTitle>
            <CardDescription>Filtre le tableau par HS code.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative w-full sm:w-[420px]">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un HS code…"
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filteredHs.length} / {HS_CODES.length}</Badge>
            <div className="text-xs text-muted-foreground sm:ml-auto">
              Clique une case pour voir les détails (OM/VAT/Extra).
            </div>
          </CardContent>
        </Card>

        {/* Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Matrice OM & Taxes</CardTitle>
            <CardDescription>
              Lignes = HS codes. Colonnes = territoires. <br />
              Chaque cellule : OM (si trouvé) • TVA (table ou repère) • Extra (nb règles).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="[&>th]:text-left [&>th]:px-3 [&>th]:py-2">
                    <th className="min-w-[120px]">HS code</th>
                    {TERRITORIES.map((t) => (
                      <th key={t.code} className="min-w-[200px]">
                        <div className="font-medium">{t.code}</div>
                        <div className="text-xs text-muted-foreground">{t.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHs.map((hs) => {
                    const hsKey = omMap.hsLen ? normalizeHS(hs).slice(0, omMap.hsLen) : normalizeHS(hs);

                    return (
                      <tr key={hs} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge variant="outline">{hs}</Badge>
                        </td>

                        {TERRITORIES.map((t) => {
                          const terrMap = omMap.map.get(t.code);
                          const omList = terrMap?.get(hsKey) || [];
                          const omRate = omList.length ? extractRateFromRow(omList[0]) : null;

                          // VAT : si table => on affiche juste “présent” + fallback repère
                          const vatList = vatByTerritory.get(t.code) || [];
                          const vatDisplay =
                            vatList.length ? "voir table" : vatFallbackForTerritory(t.code);

                          const extraCount = extraCountByTerritory.get(t.code) || 0;

                          const isSelected =
                            selected?.territory === t.code && selected?.hs === hs;

                          return (
                            <td
                              key={`${hs}-${t.code}`}
                              className={`px-3 py-2 align-top cursor-pointer hover:bg-muted/30 ${
                                isSelected ? "bg-muted/30" : ""
                              }`}
                              onClick={() => setSelected({ territory: t.code, hs })}
                            >
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={omRate ? "secondary" : "outline"}>
                                  OM: {omRate || "—"}
                                </Badge>
                                <Badge variant="outline">TVA: {vatDisplay}</Badge>
                                <Badge variant="outline">Extra: {extraCount}</Badge>
                              </div>
                              {omList.length ? (
                                <div className="text-xs text-muted-foreground mt-2">
                                  {omList.length} règle(s) OM
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground mt-2">
                                  aucune règle OM
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              NB : si ta table OM est en <b>hs4/hs6</b>, la page match automatiquement par préfixe.
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">
              Détails — {selected ? `${selected.territory} �- HS ${selected.hs}` : "clique une cellule"}
            </CardTitle>
            <CardDescription>
              Détails bruts des tables (utile pour valider les champs exacts).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="text-sm text-muted-foreground">
                Clique une cellule du tableau pour afficher les lignes OM / VAT / Extra correspondantes.
              </div>
            ) : (
              <>
                {/* OM */}
                <Card className="border-muted">
                  <CardHeader>
                    <CardTitle className="text-base">OM (octroi)</CardTitle>
                    <CardDescription>
                      Source: <code className="text-xs">{omMeta?.table || "—"}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedDetails?.om?.length ? (
                      <div className="text-sm text-muted-foreground">Aucune ligne OM trouvée.</div>
                    ) : (
                      selectedDetails.om.slice(0, 20).map((row: any, idx: number) => (
                        <Card key={row.id ?? `${idx}`} className="border-muted">
                          <CardContent className="pt-4">
                            <KVPairs row={row} />
                          </CardContent>
                        </Card>
                      ))
                    )}
                    {selectedDetails?.om?.length > 20 ? (
                      <div className="text-xs text-muted-foreground">Affichage limité à 20 lignes.</div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* VAT */}
                <Card className="border-muted">
                  <CardHeader>
                    <CardTitle className="text-base">TVA</CardTitle>
                    <CardDescription>
                      Source: <code className="text-xs">{vatMeta?.table || "fallback repère"}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedDetails?.vat?.length ? (
                      <div className="text-sm text-muted-foreground">
                        Aucune ligne VAT trouvée dans la table. Repère : <b>{vatFallbackForTerritory(selected.territory)}</b>
                      </div>
                    ) : (
                      selectedDetails.vat.slice(0, 10).map((row: any, idx: number) => (
                        <Card key={row.id ?? `${idx}`} className="border-muted">
                          <CardContent className="pt-4">
                            <KVPairs row={row} />
                          </CardContent>
                        </Card>
                      ))
                    )}
                    {selectedDetails?.vat?.length > 10 ? (
                      <div className="text-xs text-muted-foreground">Affichage limité à 10 lignes.</div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Extra */}
                <Card className="border-muted">
                  <CardHeader>
                    <CardTitle className="text-base">Taxes extra</CardTitle>
                    <CardDescription>
                      Source: <code className="text-xs">{taxMeta?.table || "—"}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedDetails?.extra?.length ? (
                      <div className="text-sm text-muted-foreground">Aucune taxe extra trouvée.</div>
                    ) : (
                      selectedDetails.extra.slice(0, 10).map((row: any, idx: number) => (
                        <Card key={row.id ?? `${idx}`} className="border-muted">
                          <CardContent className="pt-4">
                            <KVPairs row={row} />
                          </CardContent>
                        </Card>
                      ))
                    )}
                    {selectedDetails?.extra?.length > 10 ? (
                      <div className="text-xs text-muted-foreground">Affichage limité à 10 lignes.</div>
                    ) : null}
                  </CardContent>
                </Card>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}



