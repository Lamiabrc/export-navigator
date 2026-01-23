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
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  lastPrice: number | null;
  lastDate: string | null;
  competitorCount: number;
  sources: string[];
};

const TERRITORIES = [
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

const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n));
};

function pickPrice(r: SnapshotRow): number | null {
  const net = typeof r.net_price_est === "number" ? r.net_price_est : null;
  if (net !== null && Number.isFinite(net)) return net;
  const list = typeof r.list_price === "number" ? r.list_price : null;
  if (list !== null && Number.isFinite(list)) return list;
  return null;
}

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();

  const [territory, setTerritory] = React.useState<string>((variables.territory_code || "FR").toUpperCase());
  const [search, setSearch] = React.useState("");
  const [rows, setRows] = React.useState<MarketRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (variables.territory_code) setTerritory(String(variables.territory_code).toUpperCase());
  }, [variables.territory_code]);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        setError("Donnees concurrence indisponibles.");
        return;
      }

      setIsLoading(true);
      setError(null);
      setWarning(null);

      try {
        const query = supabase
          .from("competitor_snapshots")
          .select("product_ref,product_name,territory_code,competitor_id,net_price_est,list_price,snapshot_date,currency,source")
          .order("snapshot_date", { ascending: false })
          .limit(5000);

        if (territory) query.eq("territory_code", territory);
        if (search.trim()) query.ilike("product_ref", `%${search.trim()}%`);

        const { data, error: sbError } = await query;
        if (!active) return;
        if (sbError) {
          if (isMissingTableError(sbError)) {
            setWarning("Aucune donnee concurrence disponible.");
            setRows([]);
            return;
          }
          throw sbError;
        }

        const list = (data || []) as SnapshotRow[];
        const map = new Map<string, MarketRow>();
        const competitorMap = new Map<string, Set<string>>();

        list.forEach((r) => {
          const ref = (r.product_ref || "").trim();
          if (!ref) return;
          const territoryCode = (r.territory_code || "NA").toUpperCase();
          const key = `${ref}__${territoryCode}`;

          const price = pickPrice(r);
          const cur = map.get(key) || {
            product_ref: ref,
            label: r.product_name ?? null,
            territory: territoryCode,
            priceMin: null,
            priceMax: null,
            priceAvg: null,
            lastPrice: null,
            lastDate: null,
            competitorCount: 0,
            sources: [],
          };

          if (price !== null) {
            cur.priceMin = cur.priceMin === null ? price : Math.min(cur.priceMin, price);
            cur.priceMax = cur.priceMax === null ? price : Math.max(cur.priceMax, price);
          }

          if (!cur.lastDate || (r.snapshot_date && r.snapshot_date > cur.lastDate)) {
            cur.lastDate = r.snapshot_date ?? cur.lastDate;
            cur.lastPrice = price ?? cur.lastPrice;
          }

          if (r.source) cur.sources = Array.from(new Set([...cur.sources, r.source]));

          map.set(key, cur);

          if (r.competitor_id) {
            const set = competitorMap.get(key) || new Set<string>();
            set.add(String(r.competitor_id));
            competitorMap.set(key, set);
          }
        });

        const prepared = Array.from(map.values()).map((row) => {
          const key = `${row.product_ref}__${row.territory}`;
          const set = competitorMap.get(key);
          const competitors = set ? set.size : 0;
          row.competitorCount = competitors;

          const prices = list
            .filter((r) => (r.product_ref || "").trim() === row.product_ref && (r.territory_code || "NA").toUpperCase() === row.territory)
            .map((r) => pickPrice(r))
            .filter((p): p is number => p !== null);

          if (prices.length) {
            row.priceAvg = prices.reduce((s, v) => s + v, 0) / prices.length;
          }
          return row;
        });

        setRows(prepared.sort((a, b) => a.product_ref.localeCompare(b.product_ref)));
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Erreur chargement concurrence.");
        setRows([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [territory, search]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.product_ref + " " + (r.label || "")).toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <AppLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Veille concurrentielle</p>
            <h1 className="text-3xl font-bold text-slate-900">Prix marche par produit</h1>
            <p className="text-sm text-slate-600">Analyse par produit, territoire et prix observe sur le marche.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={territory} onValueChange={(v) => setTerritory(String(v).toUpperCase())}>
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
              placeholder="Rechercher (SKU / reference)"
              className="w-[260px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
            />

            <Button variant="outline" onClick={() => setSearch("")}>
              Reset filtre
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
              <CardDescription className="text-slate-500">Reference avec donnees marche</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{rows.length}</CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <Database className="h-4 w-4 text-red-600" />
                Observations
              </CardTitle>
              <CardDescription className="text-slate-500">Total des lignes concurrence</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{rows.reduce((s, r) => s + r.competitorCount, 0)}</CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-900">Territoire actif</CardTitle>
              <CardDescription className="text-slate-500">Filtre courant</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{territory}</CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Tableau marche</CardTitle>
            <CardDescription className="text-slate-600">
              Prix observe par produit et territoire (aucune marque affichee).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-slate-500">Chargement...</div>
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
                        <TableCell className="text-right">{money(row.priceMin)}</TableCell>
                        <TableCell className="text-right">{money(row.priceAvg)}</TableCell>
                        <TableCell className="text-right">{money(row.priceMax)}</TableCell>
                        <TableCell className="text-right">{money(row.lastPrice)}</TableCell>
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
                          Aucune donnee concurrence.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
