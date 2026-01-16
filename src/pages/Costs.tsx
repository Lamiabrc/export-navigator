import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { ExportFilters } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { toast } from "sonner";
import { useCosts } from "@/hooks/useCosts";

const DROM = ["GP", "MQ", "GF", "RE", "YT"];

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
  invoice_number: string | null;
  invoice_date: string | null;
  territory_code: string | null;
  client_id: string | null;
  nb_colis: number | null;
  products_ht_eur: number | null;
  transit_fee_eur: number | null;
  transport_cost_eur: number | null;
  invoice_ht_eur: number | null;
};

export default function Costs() {
  const { resolvedRange, variables } = useGlobalFilters();

  const [filters, setFilters] = React.useState<ExportFilters>({
    from: resolvedRange.from,
    to: resolvedRange.to,
    territory: variables.territory_code || undefined,
    clientId: variables.client_id || undefined,
  });

  const [invoiceQ, setInvoiceQ] = React.useState("");

  React.useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      from: resolvedRange.from,
      to: resolvedRange.to,
      territory: variables.territory_code || prev.territory,
      clientId: variables.client_id || prev.clientId,
    }));
  }, [resolvedRange.from, resolvedRange.to, variables.territory_code, variables.client_id]);

  // ---- 1) Invoices (réel transport + transit)
  const invoicesQuery = useQuery({
    queryKey: ["costs-sales-invoices", filters],
    queryFn: async (): Promise<SalesInvoiceRow[]> => {
      let q = supabase
        .from("sales_invoices")
        .select(
          "invoice_number,invoice_date,territory_code,client_id,nb_colis,products_ht_eur,transit_fee_eur,transport_cost_eur,invoice_ht_eur"
        )
        .gte("invoice_date", filters.from!)
        .lte("invoice_date", filters.to!)
        .order("invoice_date", { ascending: false })
        .limit(5000);

      if (filters.territory) q = q.eq("territory_code", filters.territory);
      if (filters.clientId) q = q.eq("client_id", filters.clientId);

      const { data, error } = await q;
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: Boolean(filters.from && filters.to),
  });

  React.useEffect(() => {
    if (invoicesQuery.error) toast.error((invoicesQuery.error as Error).message);
  }, [invoicesQuery.error]);

  const invoicesFiltered = React.useMemo(() => {
    const data = invoicesQuery.data || [];
    const q = invoiceQ.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => String(r.invoice_number || "").toLowerCase().includes(q));
  }, [invoicesQuery.data, invoiceQ]);

  const totalTransportReal = React.useMemo(
    () => invoicesFiltered.reduce((s, r) => s + safeNumber(r.transport_cost_eur), 0),
    [invoicesFiltered]
  );
  const totalTransitBilled = React.useMemo(
    () => invoicesFiltered.reduce((s, r) => s + safeNumber(r.transit_fee_eur), 0),
    [invoicesFiltered]
  );
  const gapTransport = totalTransportReal - totalTransitBilled;

  // ---- 2) cost_lines (charges manuelles) filtrées sur même période + destination
  const costLinesDestination = filters.territory && DROM.includes(filters.territory) ? filters.territory : undefined;

  const { rows: costLines, isLoading: costLinesLoading, error: costLinesError, warning: costLinesWarning, refresh: refreshCostLines } =
    useCosts({
      from: filters.from,
      to: filters.to,
      destination: costLinesDestination,
    });

  React.useEffect(() => {
    if (costLinesError) toast.error(costLinesError);
  }, [costLinesError]);

  const totalManualCharges = React.useMemo(
    () => (costLines || []).reduce((s, r) => s + safeNumber(r.amount), 0),
    [costLines]
  );

  const totalNonRecovered = gapTransport + totalManualCharges;

  const byType = React.useMemo(() => {
    const m = new Map<string, number>();
    (costLines || []).forEach((r) => {
      const k = String(r.cost_type || "AUTRE").toUpperCase();
      m.set(k, (m.get(k) || 0) + safeNumber(r.amount));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [costLines]);

  function exportInvoicesCsv() {
    const csv = toCsv(
      invoicesFiltered.map((r) => ({
        invoice_number: r.invoice_number ?? "",
        invoice_date: r.invoice_date ?? "",
        territory_code: r.territory_code ?? "",
        nb_colis: r.nb_colis ?? "",
        products_ht_eur: r.products_ht_eur ?? "",
        transit_fee_eur: r.transit_fee_eur ?? "",
        transport_cost_eur: r.transport_cost_eur ?? "",
        gap_transport_eur: safeNumber(r.transport_cost_eur) - safeNumber(r.transit_fee_eur),
        invoice_ht_eur: r.invoice_ht_eur ?? "",
      }))
    );
    downloadText(csv, `costs_invoices_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportCostLinesCsv() {
    const csv = toCsv(
      (costLines || []).map((r) => ({
        id: r.id,
        date: r.date ?? "",
        destination: r.destination ?? "",
        cost_type: r.cost_type ?? "",
        amount: r.amount ?? 0,
      }))
    );
    downloadText(csv, `cost_lines_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // ---- 3) Ajout charge manuelle
  const [clDate, setClDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [clDestination, setClDestination] = React.useState<string>(costLinesDestination || "GP");
  const [clType, setClType] = React.useState<string>("OM");
  const [clAmount, setClAmount] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (costLinesDestination) setClDestination(costLinesDestination);
  }, [costLinesDestination]);

  async function addCostLine() {
    const amount = safeNumber(clAmount);
    if (!clDate) return toast.error("Date manquante");
    if (!clDestination) return toast.error("Destination manquante");
    if (!clType) return toast.error("Type manquant");
    if (amount <= 0) return toast.error("Montant invalide");

    setSaving(true);
    try {
      const payload = {
        id: crypto.randomUUID(),
        date: clDate,
        destination: clDestination,
        cost_type: clType,
        amount,
      };

      const { error } = await supabase.from("cost_lines").insert(payload as any);
      if (error) throw error;

      setClAmount("");
      toast.success("Charge ajoutée ✅");
      await refreshCostLines();
    } catch (e: any) {
      toast.error(e?.message || "Erreur insertion cost_lines");
    } finally {
      setSaving(false);
    }
  }

  const loading = invoicesQuery.isLoading || costLinesLoading;

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Coûts export</p>
            <h1 className="text-2xl font-bold">Costs</h1>
            <p className="text-sm text-muted-foreground">
              Suivi des coûts non répercutés : transport réel + charges (OM/douane…) – frais de transit.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                invoicesQuery.refetch();
                refreshCostLines();
              }}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>

            <Button variant="outline" onClick={exportInvoicesCsv} disabled={invoicesFiltered.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export invoices
            </Button>

            <Button variant="outline" onClick={exportCostLinesCsv} disabled={(costLines?.length ?? 0) === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export cost_lines
            </Button>
          </div>
        </div>

        <ExportFiltersBar
          value={filters}
          onChange={setFilters}
          onRefresh={() => {
            invoicesQuery.refetch();
            refreshCostLines();
          }}
          loading={loading}
        />

        {/* KPI */}
        <Card>
          <CardHeader>
            <CardTitle>KPI “coûts non répercutés”</CardTitle>
            <CardDescription>
              Période + filtre territoire/client. Pour <b>cost_lines</b>, on filtre sur destination quand le territoire est DROM.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <SummaryTile label="Transport réel" value={totalTransportReal} hint="SUM(sales_invoices.transport_cost_eur)" />
            <SummaryTile label="Transit facturé" value={totalTransitBilled} hint="SUM(sales_invoices.transit_fee_eur)" />
            <SummaryTile label="Gap transport" value={gapTransport} hint="transport - transit" />
            <SummaryTile label="Charges (cost_lines)" value={totalManualCharges} hint="OM / Octroi / Douane / Dossier…" />
            <SummaryTile label="Total non répercuté" value={totalNonRecovered} hint="gap + charges" />

            <div className="md:col-span-5 flex flex-wrap gap-2 pt-2 text-xs">
              <Badge variant="secondary">Invoices: {invoicesFiltered.length}</Badge>
              <Badge variant="secondary">Cost lines: {costLines?.length ?? 0}</Badge>
              {costLinesDestination ? <Badge variant="outline">Destination cost_lines: {costLinesDestination}</Badge> : null}
            </div>

            {byType.length ? (
              <div className="md:col-span-5 rounded-lg border p-3 bg-muted/20">
                <div className="text-xs text-muted-foreground mb-2">Breakdown charges par type</div>
                <div className="flex flex-wrap gap-2">
                  {byType.map(([t, v]) => (
                    <Badge key={t} variant="outline">
                      {t}: {formatMoney(v, 0)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {(costLinesWarning || costLinesError) ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm text-foreground">
              {costLinesWarning || costLinesError}
            </CardContent>
          </Card>
        ) : null}

        {/* Invoices table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices (réel transport vs transit)</CardTitle>
            <CardDescription>Table actionnable : repérer les factures qui créent le gap.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Recherche invoice</p>
                <Input value={invoiceQ} onChange={(e) => setInvoiceQ(e.target.value)} placeholder="Ex: FV3330-2507..." />
              </div>
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Invoice</th>
                    <th className="py-2 px-3 text-left font-medium">Territoire</th>
                    <th className="py-2 px-3 text-right font-medium">Colis</th>
                    <th className="py-2 px-3 text-right font-medium">Produits HT</th>
                    <th className="py-2 px-3 text-right font-medium">Transit</th>
                    <th className="py-2 px-3 text-right font-medium">Transport</th>
                    <th className="py-2 px-3 text-right font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesQuery.isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-4 px-3 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : invoicesFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 px-3 text-center text-muted-foreground">
                        Aucune invoice sur la période.
                      </td>
                    </tr>
                  ) : (
                    invoicesFiltered.map((r, idx) => {
                      const gap = safeNumber(r.transport_cost_eur) - safeNumber(r.transit_fee_eur);
                      return (
                        <tr key={`${r.invoice_number}-${idx}`} className="border-b last:border-0">
                          <td className="py-2 px-3">{r.invoice_date ?? "—"}</td>
                          <td className="py-2 px-3">{r.invoice_number ?? "—"}</td>
                          <td className="py-2 px-3">{r.territory_code ?? "—"}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.nb_colis ?? "—"}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.products_ht_eur), 0)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.transit_fee_eur), 0)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.transport_cost_eur), 0)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatMoney(gap, 0)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* cost_lines table + add */}
        <Card>
          <CardHeader>
            <CardTitle>Charges manuelles (cost_lines)</CardTitle>
            <CardDescription>OM / Octroi / Douane / Dossier… exportable en CSV.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <Input value={clDate} onChange={(e) => setClDate(e.target.value)} type="date" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={clDestination}
                  onChange={(e) => setClDestination(e.target.value)}
                >
                  {DROM.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="FR">FR</option>
                  <option value="UE">UE</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={clType}
                  onChange={(e) => setClType(e.target.value)}
                >
                  {["OM", "OCTROI", "DOUANE", "DOSSIER", "AUTRE"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Montant (€)</p>
                <Input value={clAmount} onChange={(e) => setClAmount(e.target.value)} type="number" inputMode="decimal" />
              </div>
            </div>

            <Button onClick={addCostLine} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Ajout..." : "Ajouter une charge"}
            </Button>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Destination</th>
                    <th className="py-2 px-3 text-left font-medium">Type</th>
                    <th className="py-2 px-3 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {costLinesLoading ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : (costLines?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                        Aucune charge sur la période.
                      </td>
                    </tr>
                  ) : (
                    costLines.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{r.date ?? "—"}</td>
                        <td className="py-2 px-3">{r.destination ?? "—"}</td>
                        <td className="py-2 px-3">{r.cost_type ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.amount), 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="pt-4 text-sm text-slate-700">
                <b>DHL / estimation</b> : tu as les tables de configuration ({`destination_carrier_zones, transport_rate_lines, transport_increment_rules, transport_country_zones`}).
                Dès que tu me colles le résultat du SQL “colonnes + exemples”, je te fais la vue/func qui calcule un devis et on l’affiche ici.
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
