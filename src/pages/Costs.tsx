// src/pages/Costs.tsx
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Download, Plus } from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";
import { useCosts } from "@/hooks/useCosts";
import type { ExportFilters } from "@/domain/export/types";

type InvoiceRow = {
  invoice_number: string | null;
  invoice_date: string | null;
  territory_code: string | null;
  client_id: string | null;
  client_name_norm: string | null;
  nb_colis: number | null;
  products_ht_eur: number | null;
  transit_fee_eur: number | null;
  invoice_ht_eur: number | null;
  transport_cost_eur: number | null;
};

type TaxRow = {
  tax_date: string | null;
  territory_code: string | null;
  tax_name: string | null;
  tax_amount: number | null;
};

const TERRITORIES = [
  { code: "FR", label: "Métropole" },
  { code: "GP", label: "Guadeloupe" },
  { code: "MQ", label: "Martinique" },
  { code: "GF", label: "Guyane" },
  { code: "RE", label: "Réunion" },
  { code: "YT", label: "Mayotte" },
];

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

  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
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

function makeId(): string {
  // cost_lines.id est TEXT
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

async function fetchInvoices(filters: ExportFilters): Promise<InvoiceRow[]> {
  let q = supabase
    .from("sales_invoices_raw") // ✅ SOURCE REELLE
    .select(
      "invoice_number,invoice_date,territory_code,client_id,client_name_norm,nb_colis,products_ht_eur,transit_fee_eur,invoice_ht_eur,transport_cost_eur"
    )
    .order("invoice_date", { ascending: false })
    .limit(5000);

  if (filters.from) q = q.gte("invoice_date", filters.from);
  if (filters.to) q = q.lte("invoice_date", filters.to);
  if (filters.territory) q = q.eq("territory_code", filters.territory);
  if (filters.clientId) q = q.eq("client_id", filters.clientId);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any;
}

async function fetchTaxes(filters: ExportFilters): Promise<TaxRow[]> {
  let q = supabase
    .from("taxes_om")
    .select("tax_date,territory_code,tax_name,tax_amount")
    .order("tax_date", { ascending: false })
    .limit(20000);

  if (filters.from) q = q.gte("tax_date", filters.from);
  if (filters.to) q = q.lte("tax_date", filters.to);
  if (filters.territory) q = q.eq("territory_code", filters.territory);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any;
}

export default function Costs() {
  const { resolvedRange, variables } = useGlobalFilters();

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

  const invoicesQuery = useQuery({
    queryKey: ["costs-invoices-raw", filters],
    queryFn: () => fetchInvoices(filters),
  });

  const taxesQuery = useQuery({
    queryKey: ["costs-taxes-om", filters],
    queryFn: () => fetchTaxes(filters),
  });

  React.useEffect(() => {
    if (invoicesQuery.error) toast.error((invoicesQuery.error as Error).message);
  }, [invoicesQuery.error]);

  React.useEffect(() => {
    if (taxesQuery.error) toast.error((taxesQuery.error as Error).message);
  }, [taxesQuery.error]);

  // cost_lines (manuel) : on filtre par date + destination = territory (si choisi)
  const { rows: manualLines, isLoading: manualLoading, error: manualError, warning: manualWarning, refresh: refreshManual } =
    useCosts({
      from: filters.from,
      to: filters.to,
      destination: filters.territory || undefined,
    });

  const invoices = invoicesQuery.data || [];
  const taxes = taxesQuery.data || [];

  const totals = React.useMemo(() => {
    const transportReal = invoices.reduce((s, r) => s + safeNumber(r.transport_cost_eur), 0);
    const transitFee = invoices.reduce((s, r) => s + safeNumber(r.transit_fee_eur), 0);
    const taxesOm = taxes.reduce((s, r) => s + safeNumber(r.tax_amount), 0);
    const manualCharges = manualLines.reduce((s, r) => s + safeNumber(r.amount), 0);

    // ✅ KPI demandé
    const nonRepercute = transportReal + taxesOm - transitFee;
    const totalNonRepercute = nonRepercute + manualCharges;

    return { transportReal, transitFee, taxesOm, manualCharges, nonRepercute, totalNonRepercute };
  }, [invoices, taxes, manualLines]);

  const taxesByName = React.useMemo(() => {
    const m = new Map<string, number>();
    taxes.forEach((t) => {
      const k = String(t.tax_name || "AUTRE");
      m.set(k, (m.get(k) || 0) + safeNumber(t.tax_amount));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [taxes]);

  const isLoadingAny = invoicesQuery.isLoading || taxesQuery.isLoading || manualLoading;

  function refreshAll() {
    invoicesQuery.refetch();
    taxesQuery.refetch();
    refreshManual();
  }

  function exportKpiCsv() {
    const csv = toCsv([
      {
        from: filters.from ?? "",
        to: filters.to ?? "",
        territory: filters.territory ?? "ALL",
        clientId: filters.clientId ?? "",
        transport_real_eur: totals.transportReal,
        taxes_om_eur: totals.taxesOm,
        transit_fee_eur: totals.transitFee,
        kpi_non_repercute_eur: totals.nonRepercute,
        manual_charges_eur: totals.manualCharges,
        total_non_repercute_eur: totals.totalNonRepercute,
      },
    ]);
    downloadText(csv, `kpi_non_repercute_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Ajout charge manuelle
  const [newDate, setNewDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [newDestination, setNewDestination] = React.useState<string>(filters.territory || "FR");
  const [newType, setNewType] = React.useState<string>("AUTRE");
  const [newAmount, setNewAmount] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (filters.territory) setNewDestination(filters.territory);
  }, [filters.territory]);

  async function addManualCost() {
    const amount = safeNumber(newAmount);
    if (!newDate) return toast.error("Date manquante.");
    if (!newDestination) return toast.error("Destination manquante.");
    if (!newType) return toast.error("Type manquant.");
    if (amount <= 0) return toast.error("Montant invalide.");

    setSaving(true);
    try {
      const payload = {
        id: makeId(),
        date: newDate,
        destination: newDestination,
        cost_type: newType,
        amount,
      };

      const { error } = await supabase.from("cost_lines").insert(payload as any);
      if (error) throw error;

      setNewAmount("");
      toast.success("Charge ajoutée ✅");
      await refreshManual();
    } catch (e: any) {
      toast.error(e?.message || "Erreur ajout cost_lines");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Coûts export</p>
            <h1 className="text-2xl font-bold">Charges & coûts non répercutés</h1>
            <p className="text-sm text-muted-foreground">
              KPI = Transport réel + Taxes OM − Frais de transit (source : <code className="text-xs">sales_invoices_raw</code>)
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshAll} disabled={isLoadingAny} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoadingAny ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button variant="outline" onClick={exportKpiCsv} className="gap-2">
              <Download className="h-4 w-4" />
              Export KPI
            </Button>
          </div>
        </div>

        <ExportFiltersBar value={filters} onChange={setFilters} onRefresh={refreshAll} loading={isLoadingAny} />

        <Card>
          <CardHeader>
            <CardTitle>KPI non répercuté</CardTitle>
            <CardDescription>Ce que tu absorbes réellement dans tes charges export.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <SummaryTile label="Transport réel" value={totals.transportReal} hint="transport_cost_eur" />
            <SummaryTile label="Frais transit facturé" value={totals.transitFee} hint="transit_fee_eur" />
            <SummaryTile label="Taxes OM (total)" value={totals.taxesOm} hint="taxes_om.tax_amount" />
            <SummaryTile label="KPI non répercuté" value={totals.nonRepercute} hint="Transport + OM − Transit" />
            <SummaryTile label="Charges manuelles" value={totals.manualCharges} hint="cost_lines.amount" />
            <SummaryTile label="Total non répercuté" value={totals.totalNonRepercute} hint="KPI + manuelles" />
          </CardContent>
        </Card>

        {taxesByName.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Détail Taxes OM</CardTitle>
              <CardDescription>Répartition par type de taxe (tax_name).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {taxesByName.map(([name, amount]) => (
                <Badge key={name} variant="secondary">
                  {name}: {formatMoney(amount, 0)}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {(manualError || manualWarning) && (
          <Card className={(manualWarning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200 bg-red-50"}>
            <CardContent className="pt-4 text-sm">{manualError || manualWarning}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ajouter une charge</CardTitle>
            <CardDescription>Ce que tu payes mais que tu ne sais pas où ranger (douane, transport extra, etc.).</CardDescription>
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
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                >
                  {TERRITORIES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.label}
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
                  <option value="AUTRE">AUTRE</option>
                  <option value="DOUANE">DOUANE</option>
                  <option value="TRANSPORT_PLUS">TRANSPORT_PLUS</option>
                  <option value="DOSSIER">DOSSIER</option>
                  <option value="PACKAGING">PACKAGING</option>
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Montant (€)</p>
                <Input type="number" inputMode="decimal" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="Ex: 12.50" />
              </div>
            </div>

            <Button onClick={addManualCost} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Ajout..." : "Ajouter"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Charges saisies (cost_lines)</CardTitle>
            <CardDescription>{filters.territory ? `Filtrées sur ${filters.territory}` : "Toutes destinations"} • période filtrée.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Lignes: {manualLines.length}</Badge>
              <Badge variant="secondary">Total: {formatMoney(manualLines.reduce((s, r) => s + safeNumber(r.amount), 0), 2)}</Badge>
            </div>

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
                  {manualLoading ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">Chargement…</td>
                    </tr>
                  ) : manualLines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">Aucune charge.</td>
                    </tr>
                  ) : (
                    manualLines.map((r) => (
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
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
