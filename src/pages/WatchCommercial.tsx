import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type CsvRow = Record<string, string>;

type CompetitorPrice = { name: string; price: number };

type PositionRow = {
  sku: string;
  label: string | null;
  territory: string;

  ourPrice: number | null;
  competitors: CompetitorPrice[];
  bestCompetitor: CompetitorPrice | null;

  gapPct: number | null; // vs best competitor
  status: "premium" | "aligned" | "underpriced" | "no_data";

  rank: number | null; // position Orliman (1 = moins cher)
  competitorCount: number; // nb concurrents avec prix
};

function parseCsvLine(line: string): string[] {
  // parser CSV simple mais robuste pour guillemets doubles
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // "" -> "
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function parseCsv(csv: string): CsvRow[] {
  const trimmed = (csv || "").trim();
  if (!trimmed || trimmed.startsWith("no_data")) return [];

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const row: CsvRow = {};
    headers.forEach((h, idx) => (row[h] = fields[idx] ?? ""));
    rows.push(row);
  }

  return rows;
}

const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n));
};

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeRank(our: number, comps: CompetitorPrice[]) {
  const lower = comps.filter((c) => c.price < our).length;
  return 1 + lower;
}

function computePosition(row: CsvRow, territoryFallback: string): PositionRow {
  const territory = (row["territory_code"] || territoryFallback || "FR").toUpperCase();

  const ourPrice =
    territory === "FR"
      ? num(row["plv_metropole_ttc"])
      : (num(row["plv_om_ttc"]) ?? num(row["plv_metropole_ttc"]));

  const competitorsAll = [
    { name: "Thuasne", price: num(row["thuasne_price_ttc"]) },
    { name: "Donjoy", price: num(row["donjoy_price_ttc"]) },
    { name: "Gibaud", price: num(row["gibaud_price_ttc"]) },
  ];

  const competitors = competitorsAll
    .filter((c) => c.price !== null)
    .map((c) => ({ name: c.name, price: c.price as number }));

  const bestCompetitor =
    competitors.length > 0
      ? competitors.reduce((m, c) => (c.price < m.price ? c : m), competitors[0])
      : null;

  const gapPct =
    ourPrice !== null && bestCompetitor
      ? ((ourPrice - bestCompetitor.price) / bestCompetitor.price) * 100
      : null;

  let status: PositionRow["status"] = "no_data";
  if (gapPct !== null) {
    if (gapPct > 5) status = "premium";
    else if (gapPct < -5) status = "underpriced";
    else status = "aligned";
  }

  const rank =
    ourPrice !== null && competitors.length > 0 ? computeRank(ourPrice, competitors) : null;

  return {
    sku: row["sku"],
    label: row["label"] || null,
    territory,

    ourPrice,
    competitors,
    bestCompetitor,

    gapPct,
    status,

    rank,
    competitorCount: competitors.length,
  };
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function CompetitionPage() {
  const { variables } = useGlobalFilters();

  const [rows, setRows] = React.useState<PositionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [territory, setTerritory] = React.useState(variables.territory_code || "FR");

  const [selectedSku, setSelectedSku] = React.useState<string>("");
  const DROM_CODES = ["GP", "MQ", "GF", "RE", "YT"];

  React.useEffect(() => {
    if (variables.territory_code) setTerritory(variables.territory_code);
  }, [variables.territory_code]);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        setError("Supabase non configure (SUPABASE_ENV_OK=false).");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("export-pricing", {
          body: { territory_code: territory },
        });

        if (!active) return;
        if (fnError) throw fnError;

        const csvText = String(data ?? "");
        const rawRows = parseCsv(csvText);

        const mapped = rawRows
          .filter((r) => r["sku"])
          .map((r) => computePosition(r, territory));

        setRows(mapped);
        if (selectedSku && !mapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
      } catch (err: any) {
        console.error("Edge function export-pricing echouee, fallback v_export_pricing", err);
        try {
          const { data: viewData, error: viewError } = await supabase
            .from("v_export_pricing")
            .select("*")
            .eq("territory_code", territory)
            .limit(3000);
          if (viewError) throw viewError;

          const mapped = (viewData || [])
            .filter((r: any) => r.sku)
            .map((r: any) =>
              computePosition(
                {
                  sku: r.sku,
                  label: r.label,
                  territory_code: r.territory_code,
                  plv_metropole_ttc: r.plv_metropole_ttc,
                  plv_om_ttc: r.plv_om_ttc,
                  thuasne_price_ttc: r.thuasne_price_ttc,
                  donjoy_price_ttc: r.donjoy_price_ttc,
                  gibaud_price_ttc: r.gibaud_price_ttc,
                } as CsvRow,
                territory,
              ),
            );

          setRows(mapped);
          if (selectedSku && !mapped.some((m) => m.sku === selectedSku)) setSelectedSku("");
          setError("Edge Function indisponible (500). Donnees fallback v_export_pricing.");
        } catch (viewErr: any) {
          console.error("Fallback v_export_pricing echoue", viewErr);
          if (!active) return;
          setError(viewErr?.message || err?.message || "Erreur chargement concurrence");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.sku + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rows, search]);

  const gapSummary = React.useMemo(() => {
    const total = rows.length;
    const premium = rows.filter((r) => r.status === "premium").length;
    const aligned = rows.filter((r) => r.status === "aligned").length;
    const under = rows.filter((r) => r.status === "underpriced").length;
    const noData = rows.filter((r) => r.status === "no_data").length;
    return { total, premium, aligned, under, noData };
  }, [rows]);

  const dromSummary = React.useMemo(() => {
    return DROM_CODES.map((code) => {
      const terrRows = rows.filter((r) => (r.territory || "").toUpperCase() === code);
      const count = terrRows.length;
      const avgGap =
        terrRows.filter((r) => r.gapPct !== null).reduce((s, r) => s + (r.gapPct as number), 0) /
        Math.max(1, terrRows.filter((r) => r.gapPct !== null).length);
      const best = terrRows
        .filter((r) => r.gapPct !== null)
        .sort((a, b) => (a.gapPct as number) - (b.gapPct as number))[0];
      return {
        territory: code,
        count,
        avgGap: Number.isFinite(avgGap) ? avgGap : null,
        bestLabel: best?.label || best?.sku || null,
        bestGap: best?.gapPct ?? null,
      };
    });
  }, [rows]);

  const selected = React.useMemo(() => {
    if (!selectedSku) return null;
    return rows.find((r) => r.sku === selectedSku) || null;
  }, [rows, selectedSku]);

  const summary = React.useMemo(() => {
    const base = filtered;
    const total = base.length;

    const premium = base.filter((r) => r.status === "premium").length;
    const aligned = base.filter((r) => r.status === "aligned").length;
    const underpriced = base.filter((r) => r.status === "underpriced").length;
    const noData = base.filter((r) => r.status === "no_data").length;

    const withGap = base.filter((r) => r.gapPct !== null).map((r) => r.gapPct as number);
    const avgGap = withGap.length ? withGap.reduce((a, b) => a + b, 0) / withGap.length : null;

    const ranks = base.filter((r) => r.rank !== null).map((r) => r.rank as number);
    const rankCounts = [1, 2, 3, 4].map((rk) => ({
      rank: `#${rk}`,
      count: ranks.filter((x) => x === rk).length,
    }));

    return { total, premium, aligned, underpriced, noData, avgGap, rankCounts };
  }, [filtered]);

  const priceBarsForSelected = React.useMemo(() => {
    if (!selected) return [];
    const bars: { name: string; price: number }[] = [];
    if (selected.ourPrice !== null) bars.push({ name: "Orliman", price: selected.ourPrice });
    selected.competitors.forEach((c) => bars.push({ name: c.name, price: c.price }));
    return bars;
  }, [selected]);

  return (
    <MainLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">Concurrence & positionnement</p>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard concurrence</h1>
            <p className="text-sm text-slate-600">
              Données via Edge Function <span className="font-mono">export-pricing</span> → CSV → dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Select value={territory} onValueChange={setTerritory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Territoire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FR">Metropole (FR)</SelectItem>
                <SelectItem value="GP">Guadeloupe (GP)</SelectItem>
                <SelectItem value="MQ">Martinique (MQ)</SelectItem>
                <SelectItem value="GF">Guyane (GF)</SelectItem>
                <SelectItem value="RE">Reunion (RE)</SelectItem>
                <SelectItem value="YT">Mayotte (YT)</SelectItem>
                <SelectItem value="SPM">Saint-Pierre-et-Miquelon (SPM)</SelectItem>
                <SelectItem value="BL">Saint-Barthelemy (BL)</SelectItem>
                <SelectItem value="MF">Saint-Martin (MF)</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtre (SKU ou label)"
              className="w-[260px]"
            />

            <Select value={selectedSku} onValueChange={setSelectedSku}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Choisir un produit (SKU)" />
              </SelectTrigger>
              <SelectContent>
                {filtered.slice(0, 800).map((r) => (
                  <SelectItem key={r.sku} value={r.sku}>
                    {r.sku} — {(r.label || "Produit").slice(0, 42)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="text-sm text-red-600">{error}</div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Produits (filtrés)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Territoire: {territory}</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Premium</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.premium}</div>
              <div className="text-xs text-muted-foreground">{pct(summary.premium, summary.total)}</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Aligné</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.aligned}</div>
              <div className="text-xs text-muted-foreground">{pct(summary.aligned, summary.total)}</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Sous-pricé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.underpriced}</div>
              <div className="text-xs text-muted-foreground">{pct(summary.underpriced, summary.total)}</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Gap moyen vs best</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {summary.avgGap === null ? "—" : `${summary.avgGap.toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">Sur produits avec données</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="border-slate-200 shadow lg:col-span-2">
            <CardHeader>
              <CardTitle>Produit sélectionné</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedSku ? (
                <div className="text-sm text-muted-foreground">
                  Sélectionne un SKU pour voir la position Orliman (rang, écarts, comparaison).
                </div>
              ) : !selected ? (
                <div className="text-sm text-muted-foreground">SKU introuvable dans ce territoire.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{selected.sku}</div>
                      <div className="text-lg font-semibold">{selected.label || "Produit"}</div>
                      <div className="text-sm text-muted-foreground">Territoire: {selected.territory}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          selected.status === "premium"
                            ? "text-amber-600 border-amber-300"
                            : selected.status === "underpriced"
                            ? "text-emerald-600 border-emerald-300"
                            : selected.status === "aligned"
                            ? "text-blue-600 border-blue-300"
                            : "text-slate-500 border-slate-300"
                        )}
                      >
                        {selected.status}
                      </Badge>

                      <Badge variant="outline" className="text-slate-700 border-slate-300">
                        Rang Orliman: {selected.rank ?? "—"}
                      </Badge>

                      <Badge variant="outline" className="text-slate-700 border-slate-300">
                        Gap vs best: {selected.gapPct === null ? "—" : `${selected.gapPct.toFixed(1)}%`}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card className="border-slate-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Prix</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Orliman</div>
                          <div className="font-semibold">{money(selected.ourPrice)}</div>
                        </div>

                        {selected.competitors.length ? (
                          selected.competitors
                            .slice()
                            .sort((a, b) => a.price - b.price)
                            .map((c) => (
                              <div key={c.name} className="flex items-center justify-between">
                                <div className="text-sm text-slate-700">{c.name}</div>
                                <div className="text-sm font-medium">{money(c.price)}</div>
                              </div>
                            ))
                        ) : (
                          <div className="text-sm text-muted-foreground">Aucun prix concurrent disponible.</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Comparatif visuel</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[220px]">
                        {priceBarsForSelected.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priceBarsForSelected} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="price" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-sm text-muted-foreground">Pas assez de données pour afficher un graphe.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle>Distribution rang Orliman</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.rankCounts} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rank" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="pt-2 text-xs text-muted-foreground">
                Basé sur produits avec prix Orliman + ≥1 prix concurrent.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle className="text-lg">Résumé DROM</CardTitle>
            <CardDescription>Position prix Orliman vs concurrents sur les DOM-TOM.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {dromSummary.map((d) => (
              <div key={d.territory} className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{d.territory}</span>
                  <Badge variant="outline">{d.count} SKU</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Gap moyen: {d.avgGap !== null ? `${d.avgGap.toFixed(1)}%` : "n/a"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Meilleur: {d.bestLabel || "n/a"} {d.bestGap !== null ? `(${d.bestGap.toFixed(1)}%)` : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle>Positionnement (liste)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Prix Orliman</TableHead>
                    <TableHead>Best concurrent</TableHead>
                    <TableHead className="text-right">Gap %</TableHead>
                    <TableHead className="text-right">Rang</TableHead>
                    <TableHead className="text-right"># conc.</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 400).map((row) => (
                    <TableRow
                      key={row.sku}
                      className={cn(selectedSku === row.sku ? "bg-slate-50" : "")}
                      onClick={() => setSelectedSku(row.sku)}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                      <TableCell className="font-medium">{row.label || "—"}</TableCell>
                      <TableCell className="text-right">{money(row.ourPrice)}</TableCell>
                      <TableCell>
                        {row.bestCompetitor ? (
                          <div>
                            {money(row.bestCompetitor.price)}{" "}
                            <span className="text-xs text-muted-foreground">({row.bestCompetitor.name})</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          row.gapPct !== null && row.gapPct > 5
                            ? "text-amber-600"
                            : row.gapPct !== null && row.gapPct < -5
                            ? "text-emerald-700"
                            : "text-slate-700"
                        )}
                      >
                        {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{row.rank ?? "—"}</TableCell>
                      <TableCell className="text-right">{row.competitorCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            row.status === "premium"
                              ? "text-amber-600 border-amber-300"
                              : row.status === "underpriced"
                              ? "text-emerald-600 border-emerald-300"
                              : row.status === "aligned"
                              ? "text-blue-600 border-blue-300"
                              : "text-slate-500 border-slate-300"
                          )}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                        Aucun produit trouvé.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}

            <div className="pt-2 text-xs text-muted-foreground">
              Astuce : clique une ligne pour sélectionner le produit et voir le détail en haut.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
