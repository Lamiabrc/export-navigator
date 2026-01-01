import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";

type PricingRow = {
  sku: string;
  label: string | null;
  territory_code: string | null;
  plv_metropole_ttc: number | null;
  plv_om_ttc: number | null;
  thuasne_price_ttc: number | null;
  donjoy_price_ttc: number | null;
  gibaud_price_ttc: number | null;
};

type PositionRow = {
  sku: string;
  label: string | null;
  ourPrice: number | null;
  bestCompetitor: { name: string; price: number } | null;
  gapPct: number | null;
  status: "premium" | "aligned" | "underpriced" | "no_data";
  territory: string;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));

export default function WatchCommercial() {
  const { variables } = useGlobalFilters();
  const [rows, setRows] = React.useState<PositionRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [territory, setTerritory] = React.useState(variables.territory_code || "FR");

  React.useEffect(() => {
    if (variables.territory_code) setTerritory(variables.territory_code);
  }, [variables.territory_code]);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: sbError } = await supabase
          .from("v_export_pricing")
          .select("sku,label,territory_code,plv_metropole_ttc,plv_om_ttc,thuasne_price_ttc,donjoy_price_ttc,gibaud_price_ttc")
          .eq("territory_code", territory)
          .limit(1000);
        if (!active) return;
        if (sbError) throw sbError;

        const mapped: PositionRow[] = (data || []).map((row: PricingRow) => {
          const ourPrice =
            territory === "FR"
              ? Number(row.plv_metropole_ttc) || null
              : Number(row.plv_om_ttc) || Number(row.plv_metropole_ttc) || null;
          const competitors = [
            { name: "Thuasne", price: Number(row.thuasne_price_ttc) || null },
            { name: "Donjoy", price: Number(row.donjoy_price_ttc) || null },
            { name: "Gibaud", price: Number(row.gibaud_price_ttc) || null },
          ].filter((c) => c.price !== null) as { name: string; price: number }[];
          const best = competitors.length ? competitors.reduce((m, c) => (c.price < m.price ? c : m), competitors[0]) : null;
          const gapPct = ourPrice && best ? ((ourPrice - best.price) / best.price) * 100 : null;
          let status: PositionRow["status"] = "no_data";
          if (gapPct !== null) {
            if (gapPct > 5) status = "premium";
            else if (gapPct < -5) status = "underpriced";
            else status = "aligned";
          }
          return {
            sku: row.sku,
            label: row.label,
            ourPrice,
            bestCompetitor: best,
            gapPct,
            status,
            territory: row.territory_code || territory,
          };
        });
        setRows(mapped);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Erreur chargement pricing");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [territory]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (r.sku + " " + (r.label || "")).toLowerCase().includes(q);
  });

  return (
    <MainLayout contentClassName="md:p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">Concurrence & positionnement</p>
            <h1 className="text-3xl font-bold text-slate-900">Tableau de bord prix concurrents</h1>
            <p className="text-sm text-slate-600">Source: v_export_pricing (Supabase) · Filtré par territoire et recherche SKU/label.</p>
          </div>
          <div className="flex gap-2">
            <Select value={territory} onValueChange={setTerritory}>
              <SelectTrigger className="w-[160px]">
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
              placeholder="Recherche SKU ou label"
              className="w-[240px]"
            />
          </div>
        </div>

        <Card className="border-slate-200 shadow">
          <CardHeader>
            <CardTitle>Positionnement</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? <div className="text-sm text-red-500 mb-3">{error}</div> : null}
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Prix Orliman</TableHead>
                    <TableHead>Best concurrent</TableHead>
                    <TableHead>Gap %</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 300).map((row) => (
                    <TableRow key={row.sku}>
                      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                      <TableCell className="font-medium">{row.label || "?"}</TableCell>
                      <TableCell>{row.ourPrice ? money(row.ourPrice) : "?"}</TableCell>
                      <TableCell>
                        {row.bestCompetitor ? (
                          <div>
                            {money(row.bestCompetitor.price)} <span className="text-xs text-muted-foreground">({row.bestCompetitor.name})</span>
                          </div>
                        ) : (
                          "?"
                        )}
                      </TableCell>
                      <TableCell className={cn(row.gapPct !== null && row.gapPct > 5 ? "text-amber-500" : row.gapPct !== null && row.gapPct < -5 ? "text-emerald-600" : "text-slate-700")}>
                        {row.gapPct !== null ? `${row.gapPct.toFixed(1)}%` : "n/a"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("capitalize", row.status === "premium" ? "text-amber-600 border-amber-300" : row.status === "underpriced" ? "text-emerald-600 border-emerald-300" : row.status === "aligned" ? "text-blue-600 border-blue-300" : "text-slate-500 border-slate-300")}>
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        Aucun produit trouvé.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
