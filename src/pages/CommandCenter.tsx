import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { getZoneFromDestination } from "@/data/referenceRates";
import { fetchAllWithPagination } from "@/utils/supabasePagination";
import {
  BreakdownFilters,
  computeExportBreakdown,
  CostLine,
  ExportBreakdown,
  isMissingTableError,
  SalesLine,
  summarizeWarning,
  VatRateRow,
  OmRateRow,
} from "@/domain/calc";

import {
  Activity,
  FileCheck2,
  Calculator,
  Users,
  Package,
  BookOpen,
  Settings2,
  RefreshCw,
  ArrowRight,
  Globe,
  Filter,
  AlertTriangle,
} from "lucide-react";

type Zone = "UE" | "DROM" | "Hors UE";

type FlowRow = {
  id: string;
  flow_code: string;
  data: any;
  created_at: string;
};

type ClientMini = {
  id: string;
  export_zone: string | null;
  drom_code: string | null;
  canal: string | null;
};

type ClientStats = {
  total: number;
  UE: number;
  DROM: number;
  "Hors UE": number;
  direct: number;
  indirect: number;
  depositaire: number;
  unknownChannel: number;
};

type QueryResult<T> = {
  rows: T[];
  warning?: string;
};

type ClientResult = {
  stats: ClientStats;
  warning?: string;
};

function safeText(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function extractDestination(data: any): string {
  return (
    safeText(data?.destination) ||
    safeText(data?.destination_name) ||
    safeText(data?.shipping?.destination) ||
    safeText(data?.meta?.destination) ||
    ""
  );
}

function zoneBadge(z: Zone) {
  if (z === "DROM") return <Badge variant="secondary">DROM</Badge>;
  if (z === "UE") return <Badge variant="outline">UE</Badge>;
  return <Badge variant="outline">Hors UE</Badge>;
}

export default function CommandCenter() {
  const [filters, setFilters] = React.useState<BreakdownFilters>({});

  const {
    stats: productStats,
    isLoading: productsLoading,
    error: productsError,
    refresh: refreshProducts,
  } = useProducts({ pageSize: 2000 });

  const emptyStats: ClientStats = {
    total: 0,
    UE: 0,
    DROM: 0,
    "Hors UE": 0,
    direct: 0,
    indirect: 0,
    depositaire: 0,
    unknownChannel: 0,
  };

  const flowsQuery = useQuery<QueryResult<FlowRow>>({
    queryKey: ["command-center", "flows"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { rows: [], warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      const { data, error } = await supabase
        .from("flows")
        .select("id, flow_code, data, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        if (isMissingTableError(error)) return { rows: [], warning: "Table flows manquante côté Supabase." };
        throw error;
      }

      return { rows: (data ?? []) as FlowRow[] };
    },
    staleTime: 30_000,
  });

  const clientsQuery = useQuery<ClientResult>({
    queryKey: ["command-center", "clients"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { stats: emptyStats, warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      try {
        const pageSize = 1000;

        const rows = await fetchAllWithPagination<ClientMini>(
          (from, to) =>
            supabase
              .from("clients")
              .select("id, export_zone, drom_code, canal")
              .order("id", { ascending: true })
              .range(from, to),
          pageSize,
        );

        const total = rows.length;

        const byZone: Record<Zone, number> = { UE: 0, DROM: 0, "Hors UE": 0 };
        let direct = 0;
        let indirect = 0;
        let depositaire = 0;
        let unknownChannel = 0;

        for (const c of rows) {
          const zRaw = (c.export_zone || "").toUpperCase().trim();
          let z: Zone = "Hors UE";
          if (zRaw.includes("DROM")) z = "DROM";
          else if (zRaw === "UE" || zRaw.includes("EU")) z = "UE";
          else if (zRaw.includes("HORS")) z = "Hors UE";

          if (c.drom_code && safeText(c.drom_code).trim() !== "") z = "DROM";

          byZone[z] = (byZone[z] ?? 0) + 1;

          const canal = (c.canal || "").toLowerCase().trim();
          if (canal.includes("direct")) direct += 1;
          else if (canal.includes("indirect")) indirect += 1;
          else if (canal.includes("depos")) depositaire += 1;
          else unknownChannel += 1;
        }

        return {
          stats: {
            total,
            UE: byZone.UE,
            DROM: byZone.DROM,
            "Hors UE": byZone["Hors UE"],
            direct,
            indirect,
            depositaire,
            unknownChannel,
          },
        };
      } catch (e: any) {
        if (isMissingTableError(e)) {
          return { stats: emptyStats, warning: "Table clients manquante côté Supabase." };
        }
        throw e;
      }
    },
    staleTime: 30_000,
  });

  const salesQuery = useQuery<QueryResult<SalesLine>>({
    queryKey: ["command-center", "sales-lines"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { rows: [], warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      try {
        const pageSize = 1000;
        const rows = await fetchAllWithPagination<SalesLine>(
          (from, to) =>
            supabase
              .from("sales_lines")
              .select("id,date,client_id,product_id,qty,net_sales_ht,currency,market_zone,incoterm,destination")
              .order("date", { ascending: false })
              .range(from, to),
          pageSize,
        );
        return { rows };
      } catch (e: any) {
        if (isMissingTableError(e)) {
          return { rows: [], warning: "Table sales_lines manquante côté Supabase." };
        }
        throw e;
      }
    },
    staleTime: 60_000,
  });

  const costsQuery = useQuery<QueryResult<CostLine>>({
    queryKey: ["command-center", "cost-lines"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { rows: [], warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      try {
        const pageSize = 1000;
        const rows = await fetchAllWithPagination<CostLine>(
          (from, to) =>
            supabase
              .from("cost_lines")
              .select("id,date,cost_type,amount,currency,market_zone,incoterm,client_id,product_id,destination")
              .order("date", { ascending: false })
              .range(from, to),
          pageSize,
        );
        return { rows };
      } catch (e: any) {
        if (isMissingTableError(e)) {
          return { rows: [], warning: "Table cost_lines manquante côté Supabase." };
        }
        throw e;
      }
    },
    staleTime: 60_000,
  });

  const vatRatesQuery = useQuery<QueryResult<VatRateRow>>({
    queryKey: ["command-center", "vat-rates"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { rows: [], warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      const { data, error } = await supabase
        .from("vat_rates")
        .select("id,territory_code,rate_percent,start_date,end_date")
        .order("territory_code", { ascending: true });

      if (error) {
        if (isMissingTableError(error)) return { rows: [], warning: "Table vat_rates manquante côté Supabase." };
        throw error;
      }

      return { rows: (data ?? []) as VatRateRow[] };
    },
    staleTime: 120_000,
  });

  const omRatesQuery = useQuery<QueryResult<OmRateRow>>({
    queryKey: ["command-center", "om-rates"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { rows: [], warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      const { data, error } = await supabase
        .from("om_rates")
        .select("id,territory_code,hs_code,om_rate,omr_rate,start_date,end_date")
        .order("territory_code", { ascending: true });

      if (error) {
        if (isMissingTableError(error)) return { rows: [], warning: "Table om_rates manquante côté Supabase." };
        throw error;
      }

      return { rows: (data ?? []) as OmRateRow[] };
    },
    staleTime: 120_000,
  });

  const breakdown: ExportBreakdown = React.useMemo(
    () =>
      computeExportBreakdown({
        salesLines: salesQuery.data?.rows ?? [],
        costLines: costsQuery.data?.rows ?? [],
        vatRates: vatRatesQuery.data?.rows ?? [],
        omRates: omRatesQuery.data?.rows ?? [],
        filters,
      }),
    [
      salesQuery.data?.rows,
      costsQuery.data?.rows,
      vatRatesQuery.data?.rows,
      omRatesQuery.data?.rows,
      filters,
    ],
  );

  const flowsByZone = React.useMemo(() => {
    const base: Record<Zone, number> = { UE: 0, DROM: 0, "Hors UE": 0 };
    for (const r of flowsQuery.data?.rows ?? []) {
      const dest = extractDestination(r.data);
      let z: Zone = "Hors UE";
      if (dest) {
        try {
          z = (getZoneFromDestination(dest as any) as Zone) || "Hors UE";
        } catch {
          z = "Hors UE";
        }
      }
      base[z] = (base[z] ?? 0) + 1;
    }
    return base;
  }, [flowsQuery.data?.rows]);

  const recentFlows = React.useMemo(() => (flowsQuery.data?.rows ?? []).slice(0, 16), [flowsQuery.data?.rows]);

  const allWarnings = React.useMemo(() => {
    const list = [
      salesQuery.data?.warning,
      costsQuery.data?.warning,
      vatRatesQuery.data?.warning,
      omRatesQuery.data?.warning,
      flowsQuery.data?.warning,
      clientsQuery.data?.warning,
      ...breakdown.warnings,
    ];
    return (list.filter(Boolean) as string[]).map((w, idx) => summarizeWarning(`Alerte ${idx + 1}`, w));
  }, [
    breakdown.warnings,
    clientsQuery.data?.warning,
    costsQuery.data?.warning,
    flowsQuery.data?.warning,
    omRatesQuery.data?.warning,
    salesQuery.data?.warning,
    vatRatesQuery.data?.warning,
  ]);

  const firstError =
    salesQuery.error ||
    costsQuery.error ||
    vatRatesQuery.error ||
    omRatesQuery.error ||
    flowsQuery.error ||
    clientsQuery.error;

  const clientStats = clientsQuery.data?.stats ?? emptyStats;

  const number = (v: number, options: Intl.NumberFormatOptions = {}) =>
    Number.isFinite(v) ? v.toLocaleString("fr-FR", options) : "—";

  const handleFilterChange = (key: keyof BreakdownFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const resetFilters = () => setFilters({});

  const kpiLoading =
    salesQuery.isLoading || costsQuery.isLoading || vatRatesQuery.isLoading || omRatesQuery.isLoading;
  const fmtPercent = (v: number) => `${v.toFixed(1)}%`;
  const zoneEntries = Object.entries(breakdown.byZone);
  const destinationEntries = Object.entries(breakdown.byDestination);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-accent" />
              Dashboard principal Export
            </h1>
            <p className="text-muted-foreground mt-1">
              Pilotage des données (ventes/charges/OM/TVA) + raccourcis vers les référentiels Supabase.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link to="/verifier">
                <FileCheck2 className="h-4 w-4" />
                Contrôle documents
              </Link>
            </Button>

            <Button asChild variant="outline" className="gap-2">
              <Link to="/simulator">
                <Calculator className="h-4 w-4" />
                Simulation export
              </Link>
            </Button>

            <Button asChild variant="outline" className="gap-2">
              <Link to="/sales">
                <BookOpen className="h-4 w-4" />
                Ventes (source)
              </Link>
            </Button>

            <Button asChild variant="ghost" className="gap-2">
              <Link to="/settings">
                <Settings2 className="h-4 w-4" />
                Réglages
              </Link>
            </Button>
          </div>
        </div>

        {firstError ? (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-4 text-sm text-red-700">
              Erreur Supabase : {firstError instanceof Error ? firstError.message : String(firstError)}
            </CardContent>
          </Card>
        ) : null}

        {allWarnings.length ? (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Connecte les tables pour activer 100% des KPI
              </CardTitle>
              <CardDescription>Les données manquantes sont affichées en mode placeholder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-foreground">
              {allWarnings.map((w) => (
                <div key={w}>• {w}</div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres KPI
            </CardTitle>
            <CardDescription>Filtre les calculs (source computeExportBreakdown + Supabase).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              <Input type="date" value={filters.startDate ?? ""} onChange={(e) => handleFilterChange("startDate", e.target.value)} placeholder="Début" />
              <Input type="date" value={filters.endDate ?? ""} onChange={(e) => handleFilterChange("endDate", e.target.value)} placeholder="Fin" />
              <Input value={filters.zone ?? ""} onChange={(e) => handleFilterChange("zone", e.target.value)} placeholder="Zone (UE / DROM / Hors UE)" />
              <Input value={filters.destination ?? ""} onChange={(e) => handleFilterChange("destination", e.target.value)} placeholder="Destination (texte libre)" />
              <Input value={filters.incoterm ?? ""} onChange={(e) => handleFilterChange("incoterm", e.target.value)} placeholder="Incoterm" />
              <Input value={filters.clientId ?? ""} onChange={(e) => handleFilterChange("clientId", e.target.value)} placeholder="Client" />
              <Input value={filters.productId ?? ""} onChange={(e) => handleFilterChange("productId", e.target.value)} placeholder="Produit" />
              <div className="flex items-center justify-end">
                <Button variant="outline" onClick={resetFilters} size="sm">
                  Réinitialiser
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">CA HT (ventes)</CardTitle>
              <CardDescription>Source: sales_lines</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {kpiLoading ? "…" : `${number(Math.round(breakdown.totals.caHt))} €`}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Charges</CardTitle>
              <CardDescription>Source: cost_lines</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {kpiLoading ? "…" : `${number(Math.round(breakdown.totals.costs))} €`}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">TVA estimée</CardTitle>
              <CardDescription>Source: vat_rates</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {kpiLoading ? "…" : `${number(Math.round(breakdown.totals.vat))} €`}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">OM + OMR estimés</CardTitle>
              <CardDescription>Source: om_rates</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {kpiLoading ? "…" : `${number(Math.round(breakdown.totals.om))} €`}
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Marge nette</CardTitle>
              <CardDescription>CA - charges - TVA - OM</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {kpiLoading ? "…" : `${number(Math.round(breakdown.totals.margin))} €`}
              <div className="text-sm text-muted-foreground">{kpiLoading ? "…" : fmtPercent(breakdown.totals.marginRate)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown standard (zone / destination / incoterm)</CardTitle>
            <CardDescription>Alimente la navigation drilldown (clients, produits, flows).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="py-2 px-2">Zone</th>
                    <th className="py-2 px-2 text-right">CA</th>
                    <th className="py-2 px-2 text-right">Charges</th>
                    <th className="py-2 px-2 text-right">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneEntries.length === 0 ? (
                    <tr>
                      <td className="py-3 px-2 text-muted-foreground" colSpan={4}>
                        Aucune donnée filtrée.
                      </td>
                    </tr>
                  ) : (
                    zoneEntries.map(([zone, values]) => (
                      <tr key={zone} className="border-b">
                        <td className="py-2 px-2 font-medium">{zone}</td>
                        <td className="py-2 px-2 text-right">{number(Math.round(values.caHt))}</td>
                        <td className="py-2 px-2 text-right">{number(Math.round(values.costs))}</td>
                        <td className="py-2 px-2 text-right">{number(Math.round(values.margin))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="py-2 px-2">Destination</th>
                    <th className="py-2 px-2 text-right">CA</th>
                    <th className="py-2 px-2 text-right">Charges</th>
                    <th className="py-2 px-2 text-right">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {destinationEntries.length === 0 ? (
                    <tr>
                      <td className="py-3 px-2 text-muted-foreground" colSpan={4}>
                        Aucune donnée filtrée.
                      </td>
                    </tr>
                  ) : (
                    destinationEntries.map(([destination, values]) => (
                      <tr key={destination} className="border-b">
                        <td className="py-2 px-2 font-medium">{destination}</td>
                        <td className="py-2 px-2 text-right">{number(Math.round(values.caHt))}</td>
                        <td className="py-2 px-2 text-right">{number(Math.round(values.costs))}</td>
                        <td className="py-2 px-2 text-right">{number(Math.round(values.margin))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produits
              </CardTitle>
              <CardDescription>Référentiel Supabase products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {productsError ? <p className="text-sm text-red-600">{productsError}</p> : null}

              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{productsLoading ? "…" : productStats.total}</div>
                <Button variant="outline" size="sm" onClick={refreshProducts} disabled={productsLoading}>
                  <RefreshCw className={`h-4 w-4 ${productsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Nouveautés: {productStats.nouveautes}</Badge>
                <Badge variant="secondary">LPPR: {productStats.lppr}</Badge>
                <Badge variant="secondary">TVA OK: {productStats.withTva}</Badge>
              </div>

              <div className="pt-1">
                <Button asChild size="sm" variant="outline" className="w-full justify-between">
                  <Link to={`/products${filters.productId ? `?q=${encodeURIComponent(filters.productId)}` : ""}`}>
                    Ouvrir référentiel produits <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clients export
              </CardTitle>
              <CardDescription>Référentiel Supabase clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {clientsQuery.isLoading ? "…" : clientStats.total}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clientsQuery.refetch()}
                  disabled={clientsQuery.isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${clientsQuery.isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">UE: {clientStats.UE}</Badge>
                <Badge variant="outline">DROM: {clientStats.DROM}</Badge>
                <Badge variant="outline">Hors UE: {clientStats["Hors UE"]}</Badge>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Direct: {clientStats.direct}</Badge>
                <Badge variant="secondary">Indirect: {clientStats.indirect}</Badge>
                <Badge variant="secondary">Dépositaire: {clientStats.depositaire}</Badge>
              </div>

              <div className="pt-1">
                <Button asChild size="sm" variant="outline" className="w-full justify-between">
                  <Link to={`/clients${filters.clientId ? `?q=${encodeURIComponent(filters.clientId)}` : ""}`}>
                    Ouvrir base clients <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Derniers flux
            </CardTitle>
            <CardDescription>Lecture rapide par destination / zone (flows)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">UE: {flowsByZone.UE}</Badge>
              <Badge variant="outline">DROM: {flowsByZone.DROM}</Badge>
              <Badge variant="outline">Hors UE: {flowsByZone["Hors UE"]}</Badge>

              <Button
                variant="outline"
                size="sm"
                onClick={() => flowsQuery.refetch()}
                disabled={flowsQuery.isLoading}
                className="ml-auto"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${flowsQuery.isLoading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>

            {flowsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : recentFlows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun flux à afficher.</p>
            ) : (
              <div className="space-y-2">
                {recentFlows.map((f) => {
                  const dest = extractDestination(f.data);
                  let z: Zone = "Hors UE";
                  if (dest) {
                    try {
                      z = (getZoneFromDestination(dest as any) as Zone) || "Hors UE";
                    } catch {
                      z = "Hors UE";
                    }
                  }

                  return (
                    <div
                      key={f.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{f.flow_code}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Destination: {dest || "—"}{" "}
                          <span className="ml-2 inline-flex items-center gap-2">{zoneBadge(z)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2">
              <Button asChild variant="outline" className="w-full justify-between">
                <Link to="/flows">
                  Ouvrir la liste des flux <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
