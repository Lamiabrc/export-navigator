import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowUpRight, ExternalLink } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { fetchAlerts, fetchInvoices, fetchKpis, fetchTopClients } from "@/domain/export/queries";
import { ExportFilters, Invoice } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";

function money(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));
}

export default function CommandCenter() {
  const navigate = useNavigate();
  const { resolvedRange, variables } = useGlobalFilters();

  const [filters, setFilters] = React.useState<ExportFilters>({
    from: resolvedRange.from,
    to: resolvedRange.to,
    territory: variables.territory_code || undefined,
    clientId: variables.client_id || undefined,
    invoiceNumber: undefined,
  });

  React.useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      from: resolvedRange.from,
      to: resolvedRange.to,
      territory: variables.territory_code || prev.territory,
      clientId: variables.client_id || prev.clientId,
    }));
  }, [resolvedRange.from, resolvedRange.to, variables.territory_code, variables.client_id]);

  const kpisQuery = useQuery({
    queryKey: ["export-kpis", filters],
    queryFn: () => fetchKpis(filters),
  });

  const invoicesQuery = useQuery({
    queryKey: ["export-invoices-latest", filters],
    queryFn: () => fetchInvoices(filters, { page: 1, pageSize: 8 }),
  });

  const alertsQuery = useQuery({
    queryKey: ["export-alerts", filters],
    queryFn: () => fetchAlerts(filters),
  });

  const topClientsQuery = useQuery({
    queryKey: ["export-top-clients", filters],
    queryFn: () => fetchTopClients(filters),
  });

  const handleDrill = (kpi: string) => navigate(`/sales?tab=invoices&kpi=${encodeURIComponent(kpi)}`);
  const handleInvoiceClick = (inv: Invoice) => navigate(`/invoices/${encodeURIComponent(inv.invoice_number)}`);

  React.useEffect(() => {
    if (kpisQuery.error) toast.error((kpisQuery.error as Error).message);
    if (invoicesQuery.error) toast.error((invoicesQuery.error as Error).message);
    if (alertsQuery.error) toast.error((alertsQuery.error as Error).message);
  }, [kpisQuery.error, invoicesQuery.error, alertsQuery.error]);

  const kpiCards = [
    { id: "ca", label: "CA HT", value: kpisQuery.data?.caHt ?? 0 },
    { id: "products", label: "Total produits", value: kpisQuery.data?.totalProducts ?? 0 },
    { id: "transit", label: "Total transit", value: kpisQuery.data?.totalTransit ?? 0 },
    { id: "transport", label: "Transport (info)", value: kpisQuery.data?.totalTransport ?? 0 },
    { id: "margin", label: "Marge estimee", value: kpisQuery.data?.estimatedMargin ?? 0 },
    { id: "invoices", label: "Nb factures", value: kpisQuery.data?.invoiceCount ?? 0 },
    { id: "parcels", label: "Nb colis", value: kpisQuery.data?.parcelCount ?? 0 },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pilotage export (factures + lignes)</p>
            <h1 className="text-2xl font-bold">Command Center</h1>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/simulator")}>
            Scenario Lab
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>

        <ExportFiltersBar
          value={filters}
          onChange={setFilters}
          onRefresh={() => {
            kpisQuery.refetch();
            invoicesQuery.refetch();
            alertsQuery.refetch();
            topClientsQuery.refetch();
          }}
          loading={kpisQuery.isLoading || invoicesQuery.isLoading}
        />

        {kpisQuery.data?.warning || invoicesQuery.data?.warning ? (
          <div className="rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>{kpisQuery.data?.warning || invoicesQuery.data?.warning}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {kpiCards.map((kpi) => (
            <Card
              key={kpi.id}
              className="cursor-pointer hover:border-primary/50 transition"
              onClick={() => handleDrill(kpi.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{money(kpi.value)}</CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Alertes</CardTitle>
                <CardDescription>Qualite donnees et couts export</CardDescription>
              </div>
              <Badge variant="outline">{alertsQuery.data?.length ?? 0}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (alertsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune alerte sur la periode.</p>
              ) : (
                alertsQuery.data?.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 rounded-lg border p-3"
                  >
                    <Badge variant={a.severity === "critical" ? "destructive" : a.severity === "warning" ? "secondary" : "outline"}>
                      {a.severity}
                    </Badge>
                    <div>
                      <div className="font-medium">{a.title}</div>
                      {a.description ? <div className="text-sm text-muted-foreground">{a.description}</div> : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Top clients (marge estimee)</CardTitle>
                <CardDescription>Base sur toutes les factures filtrees</CardDescription>
              </div>
              <Badge variant="outline">{topClientsQuery.data?.length ?? 0}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {topClientsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (topClientsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun client.</p>
              ) : (
                <div className="space-y-2">
                  {topClientsQuery.data?.slice(0, 6).map((c) => (
                    <div key={c.client_id || "nc"} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{c.client_label || c.client_name || "Sans client"}</div>
                          {c.client_label && looksLikeUuid(c.client_label) ? (
                            <Badge variant="outline" className="text-[10px]">client non rapproche</Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.territory_code || "?"}</div>
                        {c.client_label && looksLikeUuid(c.client_label) ? (
                          <Link to="/clients" className="text-[11px] text-primary hover:underline">Ouvrir Clients</Link>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{money(c.margin_estimee)}</div>
                        <div className="text-[11px] text-muted-foreground">Produits: {money(c.products_ht)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Dernieres factures</CardTitle>
              <CardDescription>Source: v_sales_invoices_enriched en priorite</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/sales?tab=invoices")}>
              Voir tout
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Ile</TableHead>
                    <TableHead className="text-right">Produits HT</TableHead>
                    <TableHead className="text-right">Transit</TableHead>
                    <TableHead className="text-right">Transport</TableHead>
                    <TableHead className="text-right">Marge estimee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : (invoicesQuery.data?.data.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Aucune facture.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoicesQuery.data?.data.map((inv) => (
                      <TableRow
                        key={inv.invoice_number}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => handleInvoiceClick(inv)}
                      >
                        <TableCell>{inv.invoice_date || "?"}</TableCell>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.client_name || inv.client_id || "Sans client"}</TableCell>
                        <TableCell>{inv.territory_code || inv.ile || "?"}</TableCell>
                        <TableCell className="text-right">
                          {inv.products_estimated ? (
                            <Badge variant="outline" className="mr-2">Estime</Badge>
                          ) : null}
                          {money(inv.products_ht_eur)}
                        </TableCell>
                        <TableCell className="text-right">{money(inv.transit_fee_eur)}</TableCell>
                        <TableCell className="text-right">{money(inv.transport_cost_eur)}</TableCell>
                        <TableCell className="text-right">{money(inv.marge_estimee)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Focus couts export</CardTitle>
            <CardDescription>OM, octroi, TVA estimes selon tables Supabase</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiTile label="OM" value={kpisQuery.data?.estimatedExportCosts.om ?? 0} />
            <KpiTile label="Octroi" value={kpisQuery.data?.estimatedExportCosts.octroi ?? 0} />
            <KpiTile label="TVA" value={kpisQuery.data?.estimatedExportCosts.vat ?? 0} />
            <KpiTile label="Autres regles" value={kpisQuery.data?.estimatedExportCosts.extraRules ?? 0} />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 bg-card/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{money(value)}</div>
    </div>
  );
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
