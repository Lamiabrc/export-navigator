import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { isMissingTableError } from "@/domain/calc";
import { Database, TrendingUp } from "lucide-react";

type SnapshotRow = {
  product_ref: string | null;
  product_name: string | null;
  territory_code: string | null;
  competitor_id: string | null;
  net_price_est: number | null;
  list_price: number | null;
  snapshot_date: string | null;
  currency: string | null;
  source: string | null;
};

type MarketRow = {
  product_ref: string;
  label: string | null;
  territory: string;
  currency: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  lastPrice: number | null;
  lastDate: string | null;
  competitorCount: number;
  sources: string[];
};

const TERRITORIES = [
  { code: "ALL", label: "Tous les territoires" },
  { code: "FR", label: "France (FR)" },
  { code: "US", label: "USA (US)" },
  { code: "DE", label: "Allemagne (DE)" },
  { code: "CN", label: "Chine (CN)" },
  { code: "GB", label: "Royaume-Uni (GB)" },
  { code: "IT", label: "Italie (IT)" },
  { code: "ES", label: "Espagne (ES)" },
  { code: "NL", label: "Pays-Bas (NL)" },
  { code: "BE", label: "Belgique (BE)" },
  { code: "CA", label: "Canada (CA)" },
];

function normalizeTerritory(v: string) {
  const t = String(v || "").trim().toUpperCase();
  return t || "FR";
}

function pickPrice(r: SnapshotRow): number | null {
  const net = typeof r.net_price_est === "number" ? r.net_price_est : null;
  if (net !== null && Number.isFinite(net)) return net;
  const list = typeof r.list_price === "number" ? r.list_price : null;
  if (list !== null && Number.isFinite(list)) return list;
  return null;
}

function useDebouncedValue<T>(value: T, delayMs = 350) {
  const [debounced, setDebounced] = React.useState<T>(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function formatMoney(n: number | null | undefined, currency?: string | null) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const cur = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    // fallback si devise invalide
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Number(n));
  }
}

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const defaultTerritory = normalizeTerritory(String(variables.territory_code || "FR"));
  const [territory, setTerritory] = React.useState<string>(defaultTerritory);

  const [search, setSearch] = React.useState("");
  const searchDebounced = useDebouncedValue(search, 350);

  const [rows, setRows] = React.useState<MarketRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const [observationsCount, setObservationsCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (variables.territory_code) setTerritory(normalizeTerritory(String(variables.territory_code)));
  }, [variables.territory_code]);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        setError("Données concurrence indisponibles.");
        setRows([]);
        setObservationsCount(0);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setWarning(null);

      try {
        const q = supabase
          .from("competitor_snapshots")
          .select(
            "product_ref,product_name,territory_code,competitor_id,net_price_est,list_price,snapshot_date,currency,source"
          )
          .order("snapshot_date", { ascending: false })
          .limit(5000);

        const terr = normalizeTerritory(territory);
        if (terr && terr !== "ALL") q.eq("territory_code", terr);

        const s = searchDebounced.trim();
        if (s) {
          // filtre serveur sur la ref (rapide). Le filtre client couvre aussi le label.
          q.ilike("product_ref", `%${s}%`);
        }

        const { data, error: sbError } = await q;
        if (!active) return;

        if (sbError) {
          if (isMissingTableError(sbError)) {
            setWarning("Aucune donnée concurrence disponible.");
            setRows([]);
            setObservationsCount(0);
            return;
          }
          throw sbError;
        }

        const list = (data || []) as SnapshotRow[];
        setObservationsCount(list.length);

        // Aggregation O(n)
        type Acc = {
          row: MarketRow;
          priceSum: number;
          priceCount: number;
          competitors: Set<string>;
          sources: Set<string>;
          lastDate: string | null;
        };

        const map = new Map<string, Acc>();

        for (const r of list) {
          const ref = (r.product_ref || "").trim();
          if (!ref) continue;

          const terrCode = normalizeTerritory(String(r.territory_code || "NA"));
          const key = `${ref}__${terrCode}`;

          const price = pickPrice(r);
          const currency = (r.currency || null) ? String(r.currency).toUpperCase() : null;

          let acc = map.get(key);
          if (!acc) {
            acc = {
              row: {
                product_ref: ref,
                label: r.product_name ?? null,
                territory: terrCode,
                currency,
                priceMin: null,
                priceMax: null,
                priceAvg: null,
                lastPrice: null,
                lastDate: null,
                competitorCount: 0,
                sources: [],
              },
              priceSum: 0,
              priceCount: 0,
              competitors: new Set<string>(),
              sources: new Set<string>(),
              lastDate: null,
            };
            map.set(key, acc);
          }

          // label (fallback si vide)
          if (!acc.row.label && r.product_name) acc.row.label = r.product_name;

          // currency (garde la première non-null)
          if (!acc.row.currency && currency) acc.row.currency = currency;

          // sources
          if (r.source) acc.sources.add(String(r.source));

          // competitors distinct
          if (r.competitor_id) acc.competitors.add(String(r.competitor_id));

          // min/max + avg
          if (price !== null) {
            acc.row.priceMin = acc.row.priceMin === null ? price : Math.min(acc.row.priceMin, price);
            acc.row.priceMax = acc.row.priceMax === null ? price : Math.max(acc.row.priceMax, price);
            acc.priceSum += price;
            acc.priceCount += 1;
          }

          // last (snapshot_date supposée ISO)
          const d = r.snapshot_date || null;
          if (d && (!acc.lastDate || d > acc.lastDate)) {
            acc.lastDate = d;
            acc.row.lastDate = d;
            acc.row.lastPrice = price ?? acc.row.lastPrice;
            // si la dernière ligne a une devise, on privilégie aussi
            if (currency) acc.row.currency = currency;
          }
        }

        const prepared: MarketRow[] = Array.from(map.values()).map((acc) => {
          acc.row.competitorCount = acc.competitors.size;
          acc.row.sources = Array.from(acc.sources);
          acc.row.priceAvg = acc.priceCount ? acc.priceSum / acc.priceCount : null;
          return acc.row;
        });

        prepared.sort((a, b) => a.product_ref.localeCompare(b.product_ref));
        setRows(prepared);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Erreur chargement concurrence.");
        setRows([]);
        setObservationsCount(0);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [territory, searchDebounced]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.product_ref} ${(r.label || "")}`.toLowerCase().includes(q));
  }, [rows, search]);

  const resetAll = () => {
    setSearch("");
    setTerritory(defaultTerritory);
  };

  const activeTerritoryLabel =
    TERRITORIES.find((t) => t.code === normalizeTerritory(territory))?.label || normalizeTerritory(territory);

  return (
    <AppLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Veille concurrentielle</p>
            <h1 className="text-3xl font-bold text-slate-900">Prix marché par produit</h1>
            <p className="text-sm text-slate-600">Analyse par produit, territoire et prix observé sur le marché.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={normalizeTerritory(territory)} onValueChange={(v) => setTerritory(normalizeTerritory(v))}>
              <SelectTrigger className="w-[240px] bg-white border-slate-200 text-slate-900">
                <SelectValue placeholder="Territoire" />
              </SelectTrigger>
              <SelectContent>
                {TERRITORIES.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (SKU / référence / libellé)"
              className="w-[280px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
            />

            <Button variant="outline" onClick={resetAll}>
              Reset
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border border-rose-200 bg-rose-50">
            <CardContent className="pt-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        ) : null}

        {warning ? (
          <Card className="border border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm text-amber-800">{warning}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Produits couverts
              </CardTitle>
              <CardDescription className="text-slate-500">Références avec données marché</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{rows.length}</CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <Database className="h-4 w-4 text-red-600" />
                Observations
              </CardTitle>
              <CardDescription className="text-slate-500">Nombre de snapshots chargés</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{observationsCount}</CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900">Territoire actif</CardTitle>
              <CardDescription className="text-slate-500">Filtre courant</CardDescription>
            </CardHeader>
            <CardContent className="text-base font-semibold text-slate-900">
              {activeTerritoryLabel}
              {normalizeTerritory(territory) !== "ALL" ? (
                <div className="mt-2">
                  <Badge variant="outline">{normalizeTerritory(territory)}</Badge>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Tableau marché</CardTitle>
            <CardDescription className="text-slate-600">
              Prix observés par produit et territoire (aucune marque affichée).
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-sm text-slate-500">Chargement…</div>
            ) : (
              <div className="overflow-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Produit</TableHead>
                      <TableHead>Territoire</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                      <TableHead className="text-right">Moyen</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                      <TableHead className="text-right">Dernier prix</TableHead>
                      <TableHead className="text-right">Concurrents</TableHead>
                      <TableHead>Sources</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filtered.slice(0, 500).map((row) => (
                      <TableRow key={`${row.product_ref}-${row.territory}`}>
                        <TableCell className="font-medium text-slate-900">
                          <div>{row.product_ref}</div>
                          {row.label ? <div className="text-xs text-slate-500">{row.label}</div> : null}
                        </TableCell>

                        <TableCell>{row.territory}</TableCell>

                        <TableCell className="text-right">{formatMoney(row.priceMin, row.currency)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.priceAvg, row.currency)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.priceMax, row.currency)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.lastPrice, row.currency)}</TableCell>

                        <TableCell className="text-right">
                          <Badge variant="outline">{row.competitorCount}</Badge>
                        </TableCell>

                        <TableCell className="text-xs text-slate-500">
                          {row.sources.length ? row.sources.join(", ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}

                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-slate-500">
                          Aucune donnée concurrence.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}

            {filtered.length > 500 ? (
              <div className="mt-3 text-xs text-slate-500">
                Affichage limité à 500 lignes. Affine la recherche pour réduire la liste.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
