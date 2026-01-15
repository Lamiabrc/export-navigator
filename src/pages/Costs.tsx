// src/pages/Costs.tsx
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { fetchKpis } from "@/domain/export/queries";
import { ExportFilters } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

import { useCosts, type CostLine } from "@/hooks/useCosts";

const DROM = ["GP", "MQ", "GF", "RE", "YT"];
const DESTS = ["all", "FR", ...DROM, "UE"] as const;

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number, digits = 2) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    const needsQuotes = /[,"\n\r;]/.test(s);
    const normalized = s.replace(/"/g, '""');
    return needsQuotes ? `"${normalized}"` : normalized;
  };

  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))];
  return lines.join("\n");
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SummaryTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3 bg-card/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{formatMoney(value, 0)}</div>
      {hint ? <div className="text-[11px] text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

type SalesInvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  client_id: string | null;
  client_name_norm: string | null;
  territory_code: string | null;
  ile: string | null;
  nb_colis: number | null;
  products_ht_eur: number | null;
  transit_fee_eur: number | null;
  transport_cost_eur: number | null;
  invoice_ht_eur: number | null;
};

export default function Costs() {
  const { resolvedRange, variables } = useGlobalFilters();

  // Filtres globaux (période + territoire + client)
  const [filters, setFilters] = React.useState<ExportFilters>({
    from: resolvedRange.from,
    to: resolvedRange.to,
    territory: variables.territory_code || undefined,
    clientId: variables.client_id || undefined,
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

  // --- OM/Octroi estimés via ton moteur (fetchKpis)
  const kpisQuery = useQuery({
    queryKey: ["costs-kpis", filters],
    queryFn: () => fetchKpis(filters),
  });

  React.useEffect(() => {
    if (kpisQuery.error) toast.error((kpisQuery.error as Error).message);
  }, [kpisQuery.error]);

  // --- Factures (réel transport + transit)
  const invoicesQuery = useQuery({
    queryKey: ["costs-sales-invoices", filters],
    queryFn: async () => {
      let q = supabase
        .from("sales_invoices")
        .select(
          "id,invoice_number,invoice_date,client_id,client_name_norm,territory_code,ile,nb_colis,products_ht_eur,transit_fee_eur,transport_cost_eur,invoice_ht_eur"
        )
        .order("invoice_date", { ascending: false })
        .limit(5000);

      if (filters.from) q = q.gte("invoice_date", filters.from);
      if (filters.to) q = q.lte("invoice_date", filters.to);
      if (filters.territory) q = q.eq("territory_code", filters.territory);
      if (filters.clientId) q = q.eq("client_id", filters.clientId);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any as SalesInvoiceRow[];
    },
  });

  // --- Charges manuelles (cost_lines)
  const [destination, setDestination] = React.useState<(typeof DESTS)[number]>(
    (filters.territory as any) || "all"
  );
  const [costType, setCostType] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    // si l’utilisateur a un territoire global, on l’applique comme destination par défaut (sauf si "all")
    setDestination((prev) => {
      if (prev !== "all") return prev;
      return (filters.territory as any) || "all";
    });
  }, [filters.territory]);

  const { rows: costRows, isLoading: costLoading, error: costError, warning: costWarning, refresh: refreshCosts } =
    useCosts({
      from: filters.from,
      to: filters.to,
      destination: destination === "all" ? undefined : destination,
      costType: costType === "all" ? undefined : costType,
    });

  const filteredCostRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return costRows;

    return costRows.filter((r: CostLine) => {
      const hay = [r.id, r.date, r.destination, r.cost_type, r.amount].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [costRows, search]);

  // Totaux factures
  const invoices = invoicesQuery.data || [];
  const totalsInvoices = React.useMemo(() => {
    const transport = invoices.reduce((s, r) => s + safeNumber(r.transport_cost_eur), 0);
    const transit = invoices.reduce((s, r) => s + safeNumber(r.transit_fee_eur), 0);
    const products = invoices.reduce((s, r) => s + safeNumber(r.products_ht_eur), 0);
    const invoiceHT = invoices.reduce((s, r) => s + safeNumber(r.invoice_ht_eur), 0);
    const colis = invoices.reduce((s, r) => s + safeNumber(r.nb_colis), 0);
    return { transport, transit, products, invoiceHT, colis, nb: invoices.length };
  }, [invoices]);

  // Totaux cost_lines
  const totalsCostLines = React.useMemo(() => {
    const total = filteredCostRows.reduce((s, r) => s + safeNumber(r.amount), 0);
    const transport = filteredCostRows.reduce(
      (s, r) => s + (String(r.cost_type || "").toUpperCase() === "TRANSPORT" ? safeNumber(r.amount) : 0),
      0
    );
    const transit = filteredCostRows.reduce(
      (s, r) => s + (String(r.cost_type || "").toUpperCase() === "TRANSIT" ? safeNumber(r.amount) : 0),
      0
    );
    return { total, transport, transit, nb: filteredCostRows.length };
  }, [filteredCostRows]);

  const estimated = kpisQuery.data?.estimatedExportCosts;
  const estDouanes = safeNumber(estimated?.om) + safeNumber(estimated?.octroi);

  // KPI demandé : Transport + OM - Transit
  // On prend le "réel" transport/transit depuis sales_invoices, et on ajoute éventuellement du manuel cost_lines TRANSPORT.
  const kpiNonRepercute =
    totalsInvoices.transport +
    totalsCostLines.transport +
    estDouanes -
    totalsInvoices.transit;

  function exportInvoicesCsv() {
    const csv = toCsv(
      invoices.map((r) => ({
        invoice_number: r.invoice_number ?? "",
        invoice_date: r.invoice_date ?? "",
        client: r.client_name_norm ?? "",
        territory_code: r.territory_code ?? "",
        ile: r.ile ?? "",
        nb_colis: r.nb_colis ?? "",
        products_ht_eur: r.products_ht_eur ?? "",
        transit_fee_eur: r.transit_fee_eur ?? "",
        transport_cost_eur: r.transport_cost_eur ?? "",
        invoice_ht_eur: r.invoice_ht_eur ?? "",
      }))
    );
    downloadText(csv, `sales_invoices_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportCostLinesCsv() {
    const csv = toCsv(
      filteredCostRows.map((r) => ({
        id: r.id ?? "",
        date: r.date ?? "",
        destination: r.destination ?? "",
        cost_type: r.cost_type ?? "",
        amount: r.amount ?? "",
      }))
    );
    downloadText(csv, `cost_lines_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Ajout cost_line (ton id est text -> on génère un UUID en string côté front)
  const [newDate, setNewDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [newDest, setNewDest] = React.useState<string>((filters.territory as any) || "FR");
  const [newType, setNewType] = React.useState<string>("TRANSPORT");
  const [newAmount, setNewAmount] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  async function addCostLine() {
    const amount = safeNumber(newAmount);
    if (!newDate) return toast.error("Date obligatoire.");
    if (!newDest) return toast.error("Destination obligatoire.");
    if (!newType) return toast.error("Type obligatoire.");
    if (amount <= 0) return toast.error("Montant invalide.");

    const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();

    setSaving(true);
    try {
      const { error } = await supabase.from("cost_lines").insert([
        { id, date: newDate, destination: newDest, cost_type: newType, amount },
      ] as any);
      if (error) throw error;

      setNewAmount("");
      toast.success("Charge ajoutée ✅");
      await refreshCosts();
    } catch (e: any) {
      toast.error(e?.message || "Erreur insertion cost_lines");
    } finally {
      setSaving(false);
    }
  }

  const loading = kpisQuery.isLoading || invoicesQuery.isLoading || costLoading;

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Pilotage</p>
            <h1 className="text-2xl font-bold">Charges & coûts non répercutés</h1>
            <p className="text-sm text-muted-foreground">
              KPI = Transport (réel) + Douanes (OM+Octroi) − Transit facturé.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                kpisQuery.refetch();
                invoicesQuery.refetch();
                refreshCosts();
              }}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>

            <Button
              variant="outline"
              onClick={exportInvoicesCsv}
              disabled={loading || invoices.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export factures
            </Button>

            <Button
              variant="outline"
              onClick={exportCostLinesCsv}
              disabled={loading || filteredCostRows.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export charges
            </Button>
          </div>
        </div>

        <ExportFiltersBar
          value={filters}
          onChange={setFilters}
          onRefresh={() => {
            kpisQuery.refetch();
            invoicesQuery.refetch();
            refreshCosts();
          }}
          loading={loading}
        />

        {(costError || costWarning) && (
          <Card className={costError ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
            <CardContent className="pt-4 text-sm">{costError || costWarning}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>KPI “coûts non répercutés”</CardTitle>
            <CardDescription>
              Transport & transit réels depuis <code className="text-xs">sales_invoices</code>, douanes via{" "}
              <code className="text-xs">fetchKpis</code>, charges manuelles via <code className="text-xs">cost_lines</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <SummaryTile label="Transport (factures)" value={totalsInvoices.transport} hint={`${totalsInvoices.nb} factures`} />
            <SummaryTile label="Transit facturé" value={totalsInvoices.transit} hint="transit_fee_eur" />
            <SummaryTile label="OM+Octroi (estimés)" value={estDouanes} hint="via fetchKpis()" />
            <SummaryTile label="Transport (ajustements)" value={totalsCostLines.transport} hint="cost_lines TRANSPORT" />
            <SummaryTile label="KPI non répercuté" value={kpiNonRepercute} hint="Transport + Douanes − Transit" />
          </CardContent>
        </Card>

        {/* TABLE FACTURES */}
        <Card>
          <CardHeader>
            <CardTitle>Factures (sales_invoices)</CardTitle>
            <CardDescription>Ce tableau est le plus important : il contient tes coûts réels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Factures: {totalsInvoices.nb}</Badge>
              <Badge variant="secondary">Colis: {totalsInvoices.colis}</Badge>
              <Badge variant="secondary">Produits HT: {formatMoney(totalsInvoices.products, 0)}</Badge>
              <Badge variant="secondary">Transport: {formatMoney(totalsInvoices.transport, 0)}</Badge>
              <Badge variant="secondary">Transit: {formatMoney(totalsInvoices.transit, 0)}</Badge>
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Facture</th>
                    <th className="py-2 px-3 text-left font-medium">Client</th>
                    <th className="py-2 px-3 text-left font-medium">Territoire</th>
                    <th className="py-2 px-3 text-right font-medium">Colis</th>
                    <th className="py-2 px-3 text-right font-medium">Produits HT</th>
                    <th className="py-2 px-3 text-right font-medium">Transit</th>
                    <th className="py-2 px-3 text-right font-medium">Transport</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesQuery.isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-4 px-3 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 px-3 text-center text-muted-foreground">
                        Aucune facture sur la période.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{r.invoice_date ?? "—"}</td>
                        <td className="py-2 px-3">{r.invoice_number ?? "—"}</td>
                        <td className="py-2 px-3">{r.client_name_norm ?? "—"}</td>
                        <td className="py-2 px-3">{r.territory_code ?? r.ile ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.nb_colis ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.products_ht_eur), 2)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.transit_fee_eur), 2)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.transport_cost_eur), 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* CHARGES MANUELLES */}
        <Card>
          <CardHeader>
            <CardTitle>Charges manuelles (cost_lines)</CardTitle>
            <CardDescription>Pour compléter/corriger (ex: transport non importé dans sales_invoices).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value as any)}
                >
                  {DESTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={costType}
                  onChange={(e) => setCostType(e.target.value)}
                >
                  {["all", "TRANSPORT", "TRANSIT", "OM", "OCTROI", "AUTRE"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Recherche</p>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: GP, TRANSPORT, 2026-01..." />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Lignes: {totalsCostLines.nb}</Badge>
              <Badge variant="secondary">Total: {formatMoney(totalsCostLines.total, 2)}</Badge>
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Type</th>
                    <th className="py-2 px-3 text-left font-medium">Destination</th>
                    <th className="py-2 px-3 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {costLoading ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : filteredCostRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                        Aucune charge.
                      </td>
                    </tr>
                  ) : (
                    filteredCostRows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{r.date ?? "—"}</td>
                        <td className="py-2 px-3">{r.cost_type ?? "—"}</td>
                        <td className="py-2 px-3">{r.destination ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.amount), 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* AJOUT CHARGE */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Ajouter une charge (cost_lines)
            </CardTitle>
            <CardDescription>Id auto généré (texte) pour éviter les erreurs d’insertion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newDest}
                  onChange={(e) => setNewDest(e.target.value)}
                >
                  {["FR", ...DROM, "UE"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  {["TRANSPORT", "TRANSIT", "OM", "OCTROI", "AUTRE"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Montant (€)</p>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Ex: 12.50"
                />
              </div>
            </div>

            <Button onClick={addCostLine} disabled={saving} className="gap-2 w-full md:w-auto">
              <Plus className="h-4 w-4" />
              {saving ? "Ajout..." : "Ajouter"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
