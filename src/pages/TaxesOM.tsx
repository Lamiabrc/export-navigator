import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  return String(v ?? "")
    .trim()
    .replace(/[^\d]/g, "");
}

function hs4Of(hs: string) {
  return normalizeHS(hs).slice(0, 4);
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

function percentFormat(raw: any) {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  const v = n > 0 && n <= 1 ? n * 100 : n;
  const rounded = Math.round(v * 100) / 100;
  return `${rounded}%`;
}

function vatFallbackForTerritory(code: string) {
  if (code === "FR") return "TVA 20% (reference France)";
  if (code === "DE") return "TVA 19% (indicatif)";
  if (code === "ES") return "TVA 21% (indicatif)";
  if (code === "US") return "Sales tax selon Etat (indicatif)";
  if (code === "GB") return "TVA 20% (indicatif)";
  return "-";
}
function firstExistingKey(obj: any, candidates: string[]) {
  if (!obj) return null;
  const keys = new Set(Object.keys(obj));
  for (const c of candidates) if (keys.has(c)) return c;
  return null;
}

/**
 * ✅ Choisit une table OM qui a le schéma attendu.
 * On teste un select des colonnes connues (sinon PostgREST renvoie 400).
 */
async function pickOmTableWithSchema(): Promise<string> {
  const tables = ["octroi_rates", "om_rates"] as const;

  for (const t of tables) {
    const res = await supabase
      .from(t)
      .select("territory_code,hs4,om_rate,omr_rate,year,source")
      .limit(1);

    if (!res.error) return t;

    if (isMissingTableError(res.error)) continue;
    if (isPermissionError(res.error)) continue;

    // Si erreur "column does not exist", on skip aussi
    continue;
  }
  return "om_rates";
}

type OmRow = {
  territory_code: string;
  hs4: string;
  om_rate: any;
  omr_rate: any;
  year: number | null;
  source: string | null;
  [k: string]: any;
};

export default function TaxesOM() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const [omTable, setOmTable] = React.useState<string>("(auto)");
  const [omRows, setOmRows] = React.useState<OmRow[]>([]);

  const [vatMeta, setVatMeta] = React.useState<{ table: string; territoryCol: string | null } | null>(null);
  const [vatRows, setVatRows] = React.useState<any[]>([]);

  const [taxMeta, setTaxMeta] = React.useState<{ table: string; territoryCol: string | null; hsCol: string | null } | null>(null);
  const [taxRows, setTaxRows] = React.useState<any[]>([]);

  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<SelectedCell>(null);

  const refreshNonceRef = React.useRef(0);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const hs4List = React.useMemo(() => {
    return Array.from(new Set(HS_CODES.map(hs4Of))).filter(Boolean);
  }, []);

  const filteredHs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return HS_CODES;
    return HS_CODES.filter((h) => h.toLowerCase().includes(q));
  }, [search]);

  const omIndex = React.useMemo(() => {
    const map = new Map<string, Map<string, OmRow[]>>();
    for (const t of TERRITORIES) map.set(t.code, new Map());

    for (const r of omRows) {
      const terr = String(r.territory_code ?? "").trim();
      const h4 = String(r.hs4 ?? "").trim();
      if (!terr || !h4 || !map.has(terr)) continue;
      const terrMap = map.get(terr)!;
      if (!terrMap.has(h4)) terrMap.set(h4, []);
      terrMap.get(h4)!.push(r);
    }

    for (const terrMap of map.values()) {
      for (const [k, arr] of terrMap.entries()) {
        arr.sort((a, b) => (Number(b.year ?? -1) - Number(a.year ?? -1)));
        terrMap.set(k, arr);
      }
    }

    return map;
  }, [omRows]);

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
    const h4 = hs4Of(selected.hs);

    const om = (omIndex.get(selected.territory)?.get(h4) || []) as OmRow[];

    const vat = vatMeta?.territoryCol
      ? vatRows.filter((r) => String(r?.[vatMeta.territoryCol as any] ?? "").trim() === selected.territory)
      : [];

    const extraBase = taxMeta?.territoryCol
      ? taxRows.filter((r) => String(r?.[taxMeta.territoryCol as any] ?? "").trim() === selected.territory)
      : [];

    let extra = extraBase;
    if (taxMeta?.hsCol) {
      const hsCol = taxMeta.hsCol;
      const targetHs = normalizeHS(selected.hs);
      const targetHs4 = hs4Of(selected.hs);
      extra = extraBase.filter((r) => {
        const v = normalizeHS(r?.[hsCol]);
        if (!v) return true;
        return v === targetHs || v === targetHs4 || v.startsWith(targetHs4);
      });
    }

    return { om, vat, extra };
  }, [selected, omIndex, vatMeta, vatRows, taxMeta, taxRows]);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setWarning(null);
      setSelected(null);

      try {
        if (!SUPABASE_ENV_OK) throw new Error("Connexion base indisponible.");

        // ✅ OM : table schema-compatible, puis fallback si vide après filtre
        const terrFilter = TERRITORIES.map((t) => t.code);
        const preferred = await pickOmTableWithSchema();

        const tryLoadOm = async (table: string) => {
          const res = await supabase
            .from(table)
            .select("*")
            .in("territory_code" as any, terrFilter as any)
            .in("hs4" as any, hs4List as any)
            .limit(20000);

          if (res.error) throw res.error;
          return (res.data || []) as OmRow[];
        };

        let used = preferred;
        let data: OmRow[] = [];

        try {
          data = await tryLoadOm(preferred);
        } catch (e: any) {
          // Si octroi_rates a pas les colonnes attendues ou autre, fallback
          if (preferred !== "om_rates") {
            used = "om_rates";
            data = await tryLoadOm("om_rates");
            setWarning((p) => (p ? `${p}\nFallback OM: donnees secondaires utilisees.` : "Fallback OM: donnees secondaires utilisees."));
          } else {
            throw e;
          }
        }

        // si table OK mais retour 0 (souvent table vide) => fallback sur om_rates
        if (data.length === 0 && used !== "om_rates") {
          const omFallback = await tryLoadOm("om_rates");
          if (omFallback.length > 0) {
            used = "om_rates";
            data = omFallback;
            setWarning((p) => (p ? `${p}\nFallback OM: donnees secondaires utilisees.` : "Fallback OM: donnees secondaires utilisees."));
          }
        }

        if (!alive) return;
        setOmTable(used);
        setOmRows(data);

        // ✅ VAT (best effort)
        try {
          const sample = await supabase.from("vat_rates").select("*").limit(1);
          if (sample.error) throw sample.error;
          const one = (sample.data || [])[0] ?? null;
          const territoryCol = firstExistingKey(one, ["territory_code", "destination", "zone", "drom_code"]);
          setVatMeta({ table: "vat_rates", territoryCol });

          if (territoryCol) {
            const res = await supabase
              .from("vat_rates")
              .select("*")
              .in(territoryCol as any, terrFilter as any)
              .limit(20000);
            if (res.error) throw res.error;
            if (!alive) return;
            setVatRows(res.data || []);
          } else {
            setVatRows([]);
          }
        } catch {
          setVatMeta(null);
          setVatRows([]);
          setWarning((p) => (p ? `${p}\nTaux TVA indisponibles : repere TVA affiche.` : "Taux TVA indisponibles : repere TVA affiche."));
        }

        // ✅ Taxes extra (best effort)
        try {
          const sample = await supabase.from("tax_rules_extra").select("*").limit(1);
          if (sample.error) throw sample.error;
          const one = (sample.data || [])[0] ?? null;

          const territoryCol = firstExistingKey(one, ["territory_code", "destination", "zone", "drom_code"]);
          const hsCol = firstExistingKey(one, ["hs_code", "hs4", "hs6", "hs8", "hs10"]);

          setTaxMeta({ table: "tax_rules_extra", territoryCol, hsCol });

          if (territoryCol) {
            const res = await supabase
              .from("tax_rules_extra")
              .select("*")
              .in(territoryCol as any, terrFilter as any)
              .limit(20000);
            if (res.error) throw res.error;
            if (!alive) return;
            setTaxRows(res.data || []);
          } else {
            setTaxRows([]);
          }
        } catch {
          setTaxMeta(null);
          setTaxRows([]);
          setWarning((p) => (p ? `${p}\nTaxes additionnelles indisponibles.` : "Taxes additionnelles indisponibles."));
        }
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message || "Erreur chargement dashboard OM & Taxes");
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [refreshNonce, hs4List]);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Dashboard</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6" />
              OM & Taxes — Récapitulatif par territoire - HS
            </h1>
            <p className="text-sm text-muted-foreground">
              Page dédiée uniquement au récapitulatif : <b>OM/OMR</b> + <b>TVA</b> + <b>Taxes extra</b>.
            </p>
          </div>

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

        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">HS: {HS_CODES.length}</Badge>
          <Badge variant="secondary">HS4 uniques: {hs4List.length}</Badge>
          <Badge variant="secondary">Territoires: {TERRITORIES.length}</Badge>

          <Badge variant="outline">
            OM table: <span className="ml-1 font-semibold">{omTable}</span>
          </Badge>
          <Badge variant="outline">
            OM rows: <span className="ml-1 font-semibold">{omRows.length}</span>
          </Badge>

          <Badge variant="outline">
            VAT: <span className="ml-1 font-semibold">{vatMeta?.table ? "OK" : "fallback"}</span>
          </Badge>
          <Badge variant="outline">
            Extra: <span className="ml-1 font-semibold">{taxMeta?.table ? "OK" : "—"}</span>
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtre HS</CardTitle>
            <CardDescription>Filtrer la matrice par HS code.</CardDescription>
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
            <Badge variant="secondary">
              {filteredHs.length} / {HS_CODES.length}
            </Badge>
            <div className="text-xs text-muted-foreground sm:ml-auto">
              Clique une cellule pour voir les détails.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matrice — OM / OMR / Taxes</CardTitle>
            <CardDescription>
              Lignes = HS codes. Colonnes = territoires. <br />
              OM/OMR matchés via <code className="text-xs">hs4</code> (préfixe des HS codes).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="[&>th]:text-left [&>th]:px-3 [&>th]:py-2">
                    <th className="min-w-[140px]">HS code</th>
                    {TERRITORIES.map((t) => (
                      <th key={t.code} className="min-w-[250px]">
                        <div className="font-medium">{t.code}</div>
                        <div className="text-xs text-muted-foreground">{t.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredHs.map((hs) => {
                    const h4 = hs4Of(hs);
                    return (
                      <tr key={hs} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline">{hs}</Badge>
                            <span className="text-xs text-muted-foreground">HS4: {h4}</span>
                          </div>
                        </td>

                        {TERRITORIES.map((t) => {
                          const rows = omIndex.get(t.code)?.get(h4) || [];
                          const best = rows[0] || null;

                          const om = best ? percentFormat(best.om_rate) : "—";
                          const omr = best ? percentFormat(best.omr_rate) : "—";
                          const year = best?.year ?? null;

                          const tva = vatMeta?.table ? "voir table" : vatFallbackForTerritory(t.code);
                          const extraCount = extraCountByTerritory.get(t.code) || 0;

                          const isSel = selected?.territory === t.code && selected?.hs === hs;

                          return (
                            <td
                              key={`${hs}-${t.code}`}
                              className={`px-3 py-2 align-top cursor-pointer hover:bg-muted/30 ${
                                isSel ? "bg-muted/30" : ""
                              }`}
                              onClick={() => setSelected({ territory: t.code, hs })}
                            >
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={best ? "secondary" : "outline"}>OM: {om}</Badge>
                                <Badge variant={best ? "secondary" : "outline"}>OMR: {omr}</Badge>
                                <Badge variant="outline">TVA: {tva}</Badge>
                                <Badge variant="outline">Extra: {extraCount}</Badge>
                              </div>

                              {best ? (
                                <div className="text-xs text-muted-foreground mt-2">
                                  Année: <b>{year ?? "—"}</b> • Source: <b>{best.source ?? "—"}</b> • Lignes: {rows.length}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground mt-2">
                                  Aucune règle OM/OMR pour {t.code} sur HS4 {h4}
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
              Valeur affichée = règle la plus récente (année max) si plusieurs lignes.
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">
              Détails — {selected ? `${selected.territory} - HS ${selected.hs} (HS4 ${hs4Of(selected.hs)})` : "clique une cellule"}
            </CardTitle>
            <CardDescription>Détails bruts (OM/VAT/Extra) pour validation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="text-sm text-muted-foreground">
                Clique une cellule du tableau pour afficher les détails.
              </div>
            ) : (
              <>
                <Card className="border-muted">
                  <CardHeader>
                    <CardTitle className="text-base">OM / OMR</CardTitle>
                    <CardDescription>
                      Source: <code className="text-xs">{omTable}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedDetails?.om?.length ? (
                      <div className="text-sm text-muted-foreground">Aucune ligne OM/OMR trouvée.</div>
                    ) : (
                      selectedDetails.om.slice(0, 20).map((row: any, idx: number) => (
                        <Card key={row.id ?? `${idx}`} className="border-muted">
                          <CardContent className="pt-4">
                            <KVPairs row={row} />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>

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
                        Aucune ligne TVA trouvée. Repère : <b>{vatFallbackForTerritory(selected.territory)}</b>
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
                  </CardContent>
                </Card>

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
                  </CardContent>
                </Card>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}






