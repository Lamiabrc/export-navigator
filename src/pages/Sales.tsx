import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { fetchInvoices, fetchSalesLines } from "@/domain/export/queries";
import { ExportFilters, Invoice, SaleLine } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { toast } from "sonner";

type SortKey = "invoice_date" | "client" | "territory" | "products" | "transit" | "invoice_ht" | "transport" | "margin";

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));
}

export default function Sales() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resolvedRange, variables } = useGlobalFilters();

  const [activeTab, setActiveTab] = React.useState<"invoices" | "lines">(
    (searchParams.get("tab") as "invoices" | "lines") || "invoices",
  );

  const [filters, setFilters] = React.useState<ExportFilters>({
    from: resolvedRange.from,
    to: resolvedRange.to,
    territory: variables.territory_code || undefined,
    clientId: variables.client_id || undefined,
    invoiceNumber: undefined,
  });

  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: searchParams.get("kpi") === "margin" ? "margin" : "invoice_date",
    dir: "desc",
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

  const invoicesQuery = useQuery({
    queryKey: ["export-sales-invoices", filters],
    queryFn: () => fetchInvoices(filters, { page: 1, pageSize: 200 }),
  });

  const salesLinesQuery = useQuery({
    queryKey: ["export-sales-lines", filters],
    queryFn: () => fetchSalesLines(filters, { page: 1, pageSize: 200 }),
  });

  React.useEffect(() => {
    if (invoicesQuery.error) toast.error((invoicesQuery.error as Error).message);
    if (salesLinesQuery.error) toast.error((salesLinesQuery.error as Error).message);
  }, [invoicesQuery.error, salesLinesQuery.error]);

  const sortedInvoices = React.useMemo(() => {
    const data = invoicesQuery.data?.data ? [...invoicesQuery.data.data] : [];
    const dir = sort.dir === "asc" ? 1 : -1;

    const value = (inv: Invoice) => {
      switch (sort.key) {
        case "client":
          return (inv.client_name || inv.client_id || "").toLowerCase();
        case "territory":
          return (inv.territory_code || inv.ile || "").toLowerCase();
        case "products":
          return Number(inv.products_ht_eur || 0);
        case "transit":
          return Number(inv.transit_fee_eur || 0);
        case "invoice_ht":
          return Number(inv.invoice_ht_eur || 0);
        case "transport":
          return Number(inv.transport_cost_eur || 0);
        case "margin":
          return Number(inv.marge_estimee || 0);
        case "invoice_date":
        default:
          return inv.invoice_date || "";
      }
    };

    data.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return data;
  }, [invoicesQuery.data?.data, sort]);

  const lines = salesLinesQuery.data?.data ?? [];

  const handleSort = (key: SortKey) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  };

  const refresh = () => {
    invoicesQuery.refetch();
    salesLinesQuery.refetch();
  };

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Factures + lignes detaillees</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">Sales</h1>
            <p className="text-sm text-muted-foreground">
              Priorite v_sales_invoices_enriched, fallback sales_invoices. Lignes via sales si disponible.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={invoicesQuery.isLoading || salesLinesQuery.isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${invoicesQuery.isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        <ExportFiltersBar value={filters} onChange={setFilters} onRefresh={refresh} loading={invoicesQuery.isLoading} />

        {invoicesQuery.data?.warning ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm text-amber-800">{invoicesQuery.data.warning}</CardContent>
          </Card>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="invoices">Factures</TabsTrigger>
            <TabsTrigger value="lines">Lignes</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Factures</CardTitle>
                <CardDescription>Tableau triable, recherche invoice_number, filtres universels.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("invoice_date")}>Date</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("client")}>Client</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("territory")}>Ile</TableHead>
                      <TableHead>Nb colis</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort("products")}>Produits HT</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort("transit")}>Transit</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort("invoice_ht")}>Invoice HT</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort("transport")}>Transport (info)</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort("margin")}>Marge estimee</TableHead>
                      <TableHead>Badge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground">Chargement...</TableCell>
                      </TableRow>
                    ) : sortedInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground">Aucune facture.</TableCell>
                      </TableRow>
                    ) : (
                      sortedInvoices.map((inv) => (
                        <TableRow
                          key={inv.invoice_number}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate(`/invoices/${encodeURIComponent(inv.invoice_number)}`)}
                        >
                          <TableCell>{inv.invoice_date || "?"}</TableCell>
                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.client_name || inv.client_id || "Sans client"}</TableCell>
                          <TableCell>{inv.territory_code || inv.ile || "?"}</TableCell>
                          <TableCell>{inv.nb_colis ?? "?"}</TableCell>
                          <TableCell className="text-right">{money(inv.products_ht_eur)}</TableCell>
                          <TableCell className="text-right">{money(inv.transit_fee_eur)}</TableCell>
                          <TableCell className="text-right">{money(inv.invoice_ht_eur)}</TableCell>
                          <TableCell className="text-right">{money(inv.transport_cost_eur)}</TableCell>
                          <TableCell className="text-right">{money(inv.marge_estimee)}</TableCell>
                          <TableCell>
                            <Badge variant={inv.products_estimated ? "outline" : "secondary"}>
                              {inv.products_estimated ? "Estime" : "Reel"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lines" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Lignes (sales)</CardTitle>
                <CardDescription>Affiche les ventes associees si la table sales existe.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Territoire</TableHead>
                      <TableHead className="text-right">Quantite</TableHead>
                      <TableHead className="text-right">PU HT</TableHead>
                      <TableHead className="text-right">Montant HT</TableHead>
                      <TableHead className="text-right">TVA</TableHead>
                      <TableHead className="text-right">TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesLinesQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">Chargement...</TableCell>
                      </TableRow>
                    ) : lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          {salesLinesQuery.data?.warning || "Aucune ligne (table sales manquante ou vide)."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      lines.map((l: SaleLine) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.sale_date || "?"}</TableCell>
                          <TableCell>{l.client_id || "?"}</TableCell>
                          <TableCell>{l.product_id || "?"}</TableCell>
                          <TableCell>{l.territory_code || "?"}</TableCell>
                          <TableCell className="text-right">{l.quantity ?? ""}</TableCell>
                          <TableCell className="text-right">{money(l.unit_price_ht)}</TableCell>
                          <TableCell className="text-right">{money(l.amount_ht)}</TableCell>
                          <TableCell className="text-right">{money(l.vat_amount)}</TableCell>
                          <TableCell className="text-right">{money(l.amount_ttc)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
